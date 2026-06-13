const express = require('express');
const { getDb } = require('../db/database');
const { generateDoctorBrief } = require('../agents/doctorCopilot');
const { generateForecast, generateHealthGraph, generateHealthStory } = require('../agents/additionalAgents');
const { generateFallbackDoctorBrief, generateFallbackForecast } = require('../pipeline/fallbackEngine');

const router = express.Router();

// GET /api/copilot/brief — Doctor visit brief
router.get('/brief', async (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get('default-user');
    const recentMetrics = db.prepare(`
      SELECT m.metric_name, m.value, m.unit, m.status, m.category, r.uploaded_at
      FROM report_metrics m
      JOIN reports r ON r.id = m.report_id
      WHERE r.user_id = 'default-user' AND r.status IN ('analyzed', 'partial')
      ORDER BY r.uploaded_at DESC
      LIMIT 40
    `).all();
    const insights = db.prepare(`
      SELECT i.* FROM ai_insights i
      JOIN reports r ON r.id = i.report_id
      WHERE i.user_id = ? AND r.status IN ('analyzed', 'partial')
      LIMIT 10
    `).all('default-user');
    const family = db.prepare('SELECT * FROM family_members WHERE user_id = ?').all('default-user');

    if (recentMetrics.length === 0) {
      return res.json({ visitBrief: null, suggestedQuestions: [], questions: [], summary: 'Upload medical reports to generate your Doctor Copilot brief.', discussionTopics: [], redFlags: [], followUpTests: [] });
    }

    let brief;
    try {
      brief = await generateDoctorBrief(user, recentMetrics, insights, family);
      // Normalise field names for frontend compatibility
      brief.questions = brief.suggestedQuestions || [];
      brief.summary = brief.reportSummary || '';
      brief.checklist = brief.visitChecklist || [
        'Bring all recent lab reports',
        'List current medications and supplements',
        'Note any symptoms or changes since last visit',
      ];
    } catch (geminiErr) {
      console.warn('[Copilot] Gemini unavailable — using fallback brief:', geminiErr.message);
      brief = generateFallbackDoctorBrief(recentMetrics);
    }

    res.json(brief);

  } catch (err) {
    console.error('Copilot error:', err.message);
    res.json({ visitBrief: null, suggestedQuestions: [], questions: [], summary: 'Could not load Doctor Copilot. Please try again.', discussionTopics: [], redFlags: [], followUpTests: [] });
  }
});

// GET /api/graph/nodes — Health graph
router.get('/graph', async (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get('default-user');
    const allMetrics = db.prepare(`
      SELECT m.* FROM report_metrics m
      JOIN reports r ON r.id = m.report_id
      WHERE r.user_id = 'default-user' AND r.status IN ('analyzed', 'partial')
      ORDER BY r.uploaded_at DESC LIMIT 50
    `).all();
    const insights = db.prepare(`
      SELECT i.* FROM ai_insights i
      JOIN reports r ON r.id = i.report_id
      WHERE i.user_id = ? AND r.status IN ('analyzed', 'partial')
      LIMIT 10
    `).all('default-user');

    if (allMetrics.length === 0) {
      return res.json({ nodes: [], edges: [] });
    }

    const graph = await generateHealthGraph(user, allMetrics, insights);
    res.json(graph);

  } catch (err) {
    console.error('Graph error:', err.message);
    res.json({ nodes: [], edges: [], error: err.message });
  }
});

// POST /api/simulator/forecast — Future simulator
router.post('/simulator', async (req, res) => {
  try {
    const { scenario = 'combined' } = req.body;
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get('default-user');
    const currentMetrics = db.prepare(`
      SELECT m.* FROM report_metrics m
      JOIN reports r ON r.id = m.report_id
      WHERE r.user_id = 'default-user' AND r.status IN ('analyzed', 'partial')
      ORDER BY r.uploaded_at DESC LIMIT 30
    `).all();
    const scoreHistory = db.prepare('SELECT * FROM health_scores WHERE user_id = ? ORDER BY date').all('default-user');

    if (currentMetrics.length === 0) {
      return res.json({ forecast: [], confidence: '0%', projectedOutcomes: { healthScoreChange: '', biologicalAgeChange: '', keyImprovements: [], timeToGoal: '' }, disclaimer: 'No data to simulate. Please upload medical reports first.' });
    }

    let forecast;
    try {
      forecast = await generateForecast(user, currentMetrics, scoreHistory, scenario);
    } catch (geminiErr) {
      console.warn('[Simulator] Gemini unavailable — using deterministic forecast:', geminiErr.message);
      forecast = generateFallbackForecast(currentMetrics, scenario);
    }

    res.json(forecast);

  } catch (err) {
    console.error('Simulator error:', err.message);
    res.json({ forecast: [], confidence: '0%', projectedOutcomes: { healthScoreChange: '', biologicalAgeChange: '', keyImprovements: [], timeToGoal: '' }, disclaimer: 'Simulation unavailable. Please try again.' });
  }
});

// GET /api/timeline/vitals
router.get('/vitals', (req, res) => {
  const db = getDb();
  const vitals = db.prepare('SELECT * FROM vitals_timeline WHERE user_id = ? ORDER BY date').all('default-user');
  const scores = db.prepare('SELECT * FROM health_scores WHERE user_id = ? ORDER BY date').all('default-user');

  // Group vitals by date for chart format
  const byDate = {};
  for (const v of vitals) {
    if (!byDate[v.date]) byDate[v.date] = { date: v.date };
    const key = v.metric_name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    byDate[v.date][key] = v.value;
    byDate[v.date][key + '_unit'] = v.unit;
  }

  const formattedVitals = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

  // If no real data, return seed vitals
  if (formattedVitals.length === 0) {
    return res.json({ vitals: [], scores: [], hasData: false });
  }

  res.json({ vitals: formattedVitals, scores, hasData: true });
});

// GET /api/timeline/events — Journey events
router.get('/events', (req, res) => {
  const db = getDb();
  const events = db.prepare('SELECT * FROM health_events WHERE user_id = ? ORDER BY date DESC').all('default-user');

  if (events.length === 0) {
    return res.json({ events: [] });
  }

  res.json({ events });
});

// GET /api/preventive
router.get('/preventive', (req, res) => {
  const db = getDb();
  const items = db.prepare('SELECT * FROM preventive_care WHERE user_id = ? ORDER BY priority, due').all('default-user');
  res.json({ items });
});

// GET /api/family
router.get('/family', (req, res) => {
  const db = getDb();
  const members = db.prepare('SELECT * FROM family_members WHERE user_id = ?').all('default-user');
  res.json({
    members: members.map(m => ({
      ...m,
      conditions: JSON.parse(m.conditions || '[]'),
    })),
  });
});

// GET /api/journey/story
router.get('/story', async (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get('default-user');
    const events = db.prepare(`
      SELECT e.* FROM health_events e
      LEFT JOIN reports r ON r.id = e.report_id
      WHERE e.user_id = ? AND (r.id IS NULL OR r.status IN ('analyzed', 'partial'))
      ORDER BY e.date DESC LIMIT 20
    `).all('default-user');
    const scores = db.prepare('SELECT * FROM health_scores WHERE user_id = ? ORDER BY date').all('default-user');
    const insights = db.prepare(`
      SELECT i.* FROM ai_insights i
      JOIN reports r ON r.id = i.report_id
      WHERE i.user_id = ? AND r.status IN ('analyzed', 'partial')
      LIMIT 5
    `).all('default-user');

    if (events.length === 0) {
      return res.json({ story: "Your Health Journey is empty. Upload medical reports to write your health history story.", milestones: [] });
    }

    const story = await generateHealthStory(user, events, scores, insights);
    res.json(story);
  } catch (err) {
    res.json({ story: "Your Health Journey is empty. Upload medical reports to write your health history story.", milestones: [] });
  }
});

// ===== DEMO DATA FALLBACKS =====
function getDemoCopilot() {
  return {
    visitBrief: {
      chiefConcern: 'Vitamin D deficiency & LDL management',
      recentLabs: 'CBC, Lipid Profile, HbA1c (May–Jun 2026)',
      medications: 'None currently',
      allergies: 'None known',
      recentSymptoms: 'Occasional fatigue, mild headaches',
    },
    suggestedQuestions: [
      'Should I start Vitamin D supplementation given my recent deficiency?',
      'Is my HbA1c trend concerning — what dietary changes should I make?',
      'Can my borderline LDL be managed with diet alone or do I need medication?',
      'How should I adjust my exercise routine given my resting heart rate?',
      'Is there a genetic risk assessment I should consider given my family history?',
    ],
    discussionTopics: [
      { topic: 'Vitamin D Deficiency', context: 'Current level 18 ng/mL — below optimal 30+ ng/mL range', priority: 'high' },
      { topic: 'LDL Cholesterol', context: 'Borderline high at 142 mg/dL — lifestyle modification window', priority: 'medium' },
    ],
    reportSummary: 'Patient presents with borderline lipid values and vitamin deficiency identified through recent lab work.',
    redFlags: [],
    followUpTests: ['Repeat Lipid Panel in 60 days', 'Vitamin D recheck after 3 months supplementation'],
    demo: true,
  };
}

function getDemoGraph() {
  return {
    nodes: [
      { id: 'heart', label: 'Heart Health', category: 'metric', score: 88, x: 50, y: 20, color: '#f43f5e', size: 56, value: 'Score: 88', trend: 'improving' },
      { id: 'glucose', label: 'Blood Sugar', category: 'metric', score: 79, x: 75, y: 40, color: '#f59e0b', size: 48, value: '89 mg/dL', trend: 'improving' },
      { id: 'sleep', label: 'Sleep Quality', category: 'habit', score: 71, x: 25, y: 45, color: '#6366f1', size: 46, value: '7.1 hrs avg', trend: 'stable' },
      { id: 'vitaminD', label: 'Vitamin D', category: 'metric', score: 42, x: 60, y: 65, color: '#f59e0b', size: 40, value: '18 ng/mL ⚠️', trend: 'declining' },
      { id: 'activity', label: 'Activity', category: 'habit', score: 85, x: 20, y: 70, color: '#10b981', size: 50, value: '9,000 steps/day', trend: 'improving' },
      { id: 'cholesterol', label: 'Cholesterol', category: 'metric', score: 65, x: 80, y: 70, color: '#f59e0b', size: 44, value: 'LDL: 142 mg/dL', trend: 'stable' },
      { id: 'nutrition', label: 'Nutrition', category: 'habit', score: 80, x: 45, y: 85, color: '#06b6d4', size: 44, value: 'Score: 80', trend: 'stable' },
    ],
    edges: [
      { from: 'sleep', to: 'glucose', strength: 'moderate', type: 'negative', label: 'Poor sleep raises glucose' },
      { from: 'activity', to: 'heart', strength: 'strong', type: 'positive', label: 'Exercise improves heart health' },
      { from: 'nutrition', to: 'cholesterol', strength: 'strong', type: 'positive', label: 'Diet affects LDL levels' },
      { from: 'activity', to: 'cholesterol', strength: 'moderate', type: 'positive', label: 'Exercise raises HDL' },
      { from: 'vitaminD', to: 'activity', strength: 'weak', type: 'positive', label: 'Vitamin D supports muscle function' },
    ],
    clusterGroups: [],
    demo: true,
  };
}

function getDemoForecast() {
  return {
    disclaimer: 'Forecast only. Not medical advice. Consult your physician before making health decisions.',
    scenario: 'combined',
    scenarioDescription: 'Combined lifestyle interventions: 30 min cardio 5x/week, dietary optimization, 8h sleep target',
    forecast: [
      { month: 'Month 1', healthScore: 84, keyMetrics: { ldl: 135, vitamin_d: 22, heart_rate: 67 }, milestone: 'Exercise habit forming' },
      { month: 'Month 2', healthScore: 85, keyMetrics: { ldl: 128, vitamin_d: 28, heart_rate: 65 }, milestone: 'LDL improving' },
      { month: 'Month 3', healthScore: 87, keyMetrics: { ldl: 122, vitamin_d: 34, heart_rate: 64 }, milestone: 'Vitamin D normalized' },
      { month: 'Month 4', healthScore: 88, keyMetrics: { ldl: 118, vitamin_d: 38, heart_rate: 63 }, milestone: 'LDL in optimal range' },
      { month: 'Month 5', healthScore: 89, keyMetrics: { ldl: 115, vitamin_d: 42, heart_rate: 62 }, milestone: 'Cardiovascular fitness peak' },
      { month: 'Month 6', healthScore: 91, keyMetrics: { ldl: 112, vitamin_d: 45, heart_rate: 61 }, milestone: 'Health score 90+' },
    ],
    projectedOutcomes: {
      healthScoreChange: '+9 points',
      biologicalAgeChange: '−2 years',
      keyImprovements: ['LDL normalized from 142 to 112 mg/dL', 'Vitamin D sufficient at 45 ng/mL', 'Heart rate at athletic baseline'],
      timeToGoal: '4 months for LDL normalization',
    },
    confidence: '78%',
    demo: true,
  };
}

function getDemoVitals() {
  return [
    { date: '2026-01', heartRate: 72, bp: 120, glucose: 95, weight: 81 },
    { date: '2026-02', heartRate: 74, bp: 122, glucose: 98, weight: 80 },
    { date: '2026-03', heartRate: 71, bp: 118, glucose: 93, weight: 79.5 },
    { date: '2026-04', heartRate: 69, bp: 116, glucose: 91, weight: 79 },
    { date: '2026-05', heartRate: 70, bp: 119, glucose: 96, weight: 78.5 },
    { date: '2026-06', heartRate: 68, bp: 115, glucose: 89, weight: 78 },
  ];
}

function getDemoScores() {
  return [
    { date: '2026-01', overall: 73, cardiovascular: 80, metabolic: 74 },
    { date: '2026-02', overall: 75, cardiovascular: 82, metabolic: 75 },
    { date: '2026-03', overall: 77, cardiovascular: 84, metabolic: 76 },
    { date: '2026-04', overall: 78, cardiovascular: 85, metabolic: 77 },
    { date: '2026-05', overall: 80, cardiovascular: 86, metabolic: 78 },
    { date: '2026-06', overall: 82, cardiovascular: 88, metabolic: 79 },
  ];
}

function getDemoEvents() {
  return [
    { date: 'June 12, 2026', type: 'report', title: 'Complete Blood Count Analyzed', detail: '3 insights generated — 1 abnormal finding', color: '#6366f1' },
    { date: 'June 8, 2026', type: 'report', title: 'Lipid Profile Results', detail: 'LDL borderline high at 142 mg/dL', color: '#f59e0b' },
    { date: 'June 1, 2026', type: 'milestone', title: 'Health Score Milestone', detail: 'Reached 80+ score for the first time', color: '#10b981' },
    { date: 'May 28, 2026', type: 'report', title: 'HbA1c Test — 5.4%', detail: 'Normal range, excellent metabolic control', color: '#06b6d4' },
  ];
}

module.exports = router;
