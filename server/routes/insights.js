const express = require('express');
const { getDb } = require('../db/database');
const { generateTrendInsights } = require('../agents/trendIntelligence');
const { generateHealthTwin } = require('../agents/healthTwinGenerator');
const { GeminiQuotaError } = require('../agents/geminiClient');
const { generateFallbackTwin, generateFallbackInsights } = require('../pipeline/fallbackEngine');

const router = express.Router();

// GET /api/insights/trends
// Generate AI trend insights from all stored metrics
router.get('/trends', async (req, res) => {
  try {
    const db = getDb();

    // Get stored insights first (fast path)
    const stored = db.prepare(`
      SELECT i.*, r.name as report_name, r.uploaded_at
      FROM ai_insights i
      JOIN reports r ON r.id = i.report_id
      WHERE i.user_id = 'default-user' AND r.status IN ('analyzed', 'partial')
      ORDER BY i.created_at DESC
      LIMIT 20
    `).all();

    if (stored.length > 0) {
      return res.json({
        insights: stored.map(formatInsight),
        cached: true,
        count: stored.length,
      });
    }

    // If no stored insights, generate fresh
    const allMetrics = db.prepare(`
      SELECT m.*, r.uploaded_at as report_date, r.name as report_name
      FROM report_metrics m
      JOIN reports r ON r.id = m.report_id
      WHERE r.user_id = 'default-user' AND r.status IN ('analyzed', 'partial')
      ORDER BY r.uploaded_at DESC
    `).all();

    if (allMetrics.length === 0) {
      return res.json({ insights: [], demo: false });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get('default-user');
    const reports = db.prepare("SELECT * FROM reports WHERE user_id = ? AND status IN ('analyzed', 'partial') ORDER BY uploaded_at DESC").all('default-user');

    let insights;
    try {
      insights = await generateTrendInsights(
        user,
        [{ date: 'recent', metrics: allMetrics }],
        reports.slice(0, 5)
      );
    } catch (geminiErr) {
      console.warn('[Insights] Gemini unavailable — using fallback engine:', geminiErr.message);
      insights = generateFallbackInsights(allMetrics);
    }

    res.json({ insights, fresh: true });
  } catch (err) {
    console.error('Insights error:', err.message);
    res.json({ insights: [], demo: false });
  }
});

// GET /api/insights/twin
router.get('/twin', async (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get('default-user');
    const allMetrics = db.prepare(`
      SELECT * FROM report_metrics
      WHERE report_id IN (SELECT id FROM reports WHERE user_id = 'default-user' AND status IN ('analyzed', 'partial'))
      ORDER BY created_at DESC
    `).all();
    const scoreHistory = db.prepare('SELECT * FROM health_scores WHERE user_id = ? ORDER BY date').all('default-user');

    if (allMetrics.length === 0) {
      return res.json({ overallScore: 0, biomarkers: [], keyStrengths: [], keyRisks: [], twinSummary: '', dataPoints: 0, reportsCovered: 0 });
    }

    let twin;
    try {
      twin = await generateHealthTwin(user, allMetrics, scoreHistory);
    } catch (geminiErr) {
      console.warn('[Twin] Gemini unavailable — using fallback engine:', geminiErr.message);
      twin = generateFallbackTwin(user, allMetrics);
    }

    res.json({
      ...twin,
      biomarkers: twin.biomarkers || allMetrics.map(m => ({
        name: m.metric_name,
        value: m.value,
        unit: m.unit || '',
        status: m.status || 'normal',
        referenceRange: m.reference_low != null && m.reference_high != null
          ? `${m.reference_low}\u2013${m.reference_high}`
          : null,
      })),
      // Map field names the frontend expects
      strengths: twin.keyStrengths || twin.strengths || [],
      healthStory: twin.twinSummary || twin.healthStory || '',
    });
  } catch (err) {
    console.error('Twin error:', err.message);
    res.json({
      biologicalAge: null,
      overallScore: 0,
      scoreBreakdown: { cardiovascular: 0, metabolic: 0, sleep: 0, activity: 0, mental: 0, nutrition: 0 },
      twinSummary: 'Upload medical reports to construct your Health Twin.',
      keyStrengths: [], keyRisks: [], biomarkers: [],
      dataPoints: 0, reportsCovered: 0,
    });
  }
});

// GET /api/insights/summary (for dashboard)
router.get('/summary', (req, res) => {
  const db = getDb();
  const insights = db.prepare(`
    SELECT i.*, r.name as report_name
    FROM ai_insights i
    JOIN reports r ON r.id = i.report_id
    WHERE i.user_id = 'default-user' AND r.status IN ('analyzed', 'partial')
    ORDER BY i.created_at DESC
    LIMIT 5
  `).all();

  res.json({
    insights: insights.length > 0 ? insights.map(formatInsight) : [],
    count: insights.length,
  });
});

function formatInsight(i) {
  return {
    id: i.id,
    category: i.category,
    severity: i.severity,
    title: i.title,
    description: i.description,
    metric: i.metric,
    icon: i.icon || 'activity',
    sources: JSON.parse(i.sources || '[]'),
    reportName: i.report_name,
    date: i.created_at?.split('T')[0],
  };
}

function getDemoInsights() {
  return [
    { id: 1, category: 'Trend', severity: 'positive', title: 'Heart rate trending healthier', description: 'Your resting heart rate dropped from 74 to 68 bpm over 3 months — indicating improved cardiovascular fitness.', metric: '−6 bpm', icon: 'heart', sources: ['AHA'], demo: true },
    { id: 2, category: 'Risk', severity: 'warning', title: 'Vitamin D deficiency detected', description: 'Your Vitamin D levels (18 ng/mL) fall below the optimal range. Supplementation and morning sunlight exposure recommended.', metric: '18 ng/mL', icon: 'sun', sources: ['NIH'], demo: true },
    { id: 3, category: 'Correlation', severity: 'info', title: 'Sleep affects glucose levels', description: 'On days with less than 6h of sleep, your fasting glucose is 12% higher on average — a significant metabolic correlation.', metric: '+12% glucose', icon: 'moon', sources: ['CDC'], demo: true },
    { id: 4, category: 'Risk', severity: 'caution', title: 'LDL borderline elevation', description: 'Total LDL is at 142 mg/dL — borderline high. Dietary modification and repeat test in 60 days recommended.', metric: '142 mg/dL', icon: 'activity', sources: ['AHA'], demo: true },
    { id: 5, category: 'Comparison', severity: 'positive', title: 'Better than peers your age', description: 'Your overall health score is 14% above the median for males aged 30–39 with similar BMI.', metric: '+14% vs peers', icon: 'trending-up', sources: ['WHO'], demo: true },
  ];
}

function getDemoTwin() {
  return {
    biologicalAge: 31,
    biologicalAgeVsChronological: '−3 years younger',
    twinAccuracy: 78,
    overallScore: 82,
    scoreBreakdown: { cardiovascular: 88, metabolic: 79, sleep: 71, activity: 85, mental: 78, nutrition: 80 },
    twinSummary: 'Your health profile shows a strong cardiovascular foundation with room for improvement in sleep quality and vitamin nutrition. Upload more reports to increase twin accuracy.',
    keyStrengths: ['Improving cardiovascular fitness', 'Metabolic control in healthy range', 'Active lifestyle'],
    keyRisks: ['Vitamin D deficiency', 'Borderline LDL cholesterol'],
    metabolicAge: 32,
    cardiovascularFitnessAge: 30,
    healthTrajectory: 'improving',
    predictedScoreIn90Days: 86,
    dataPoints: 0,
    reportsCovered: 0,
    demo: true,
  };
}

module.exports = router;
