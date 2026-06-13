const fs = require('fs');
const path = require('path');
const { generateJSON } = require('./geminiClient');

const simulatorPromptPath = path.join(__dirname, '../prompts/simulator.txt');
const storyPromptPath = path.join(__dirname, '../prompts/story.txt');
const graphPromptPath = path.join(__dirname, '../prompts/graph.txt');

/**
 * Future Simulator Agent
 */
async function generateForecast(userProfile, currentMetrics, historicalTrend, scenario = 'combined') {
  const promptTemplate = fs.readFileSync(simulatorPromptPath, 'utf-8');

  const prompt = promptTemplate
    .replace('{userProfile}', JSON.stringify(userProfile, null, 2))
    .replace('{currentMetrics}', JSON.stringify(currentMetrics.slice(0, 20), null, 2))
    .replace('{historicalTrend}', JSON.stringify(historicalTrend, null, 2))
    .replace('{scenario}', scenario);

  const forecast = await generateJSON(prompt);

  // Always ensure disclaimer is present
  forecast.disclaimer = 'Forecast only. Not medical advice. Consult your physician before making health decisions.';

  return forecast;
}

/**
 * Health Story Agent
 */
async function generateHealthStory(userProfile, events, scoreHistory, insights) {
  const promptTemplate = fs.readFileSync(storyPromptPath, 'utf-8');

  const prompt = promptTemplate
    .replace('{userProfile}', JSON.stringify(userProfile, null, 2))
    .replace('{events}', JSON.stringify(events.slice(0, 20), null, 2))
    .replace('{scoreHistory}', JSON.stringify(scoreHistory, null, 2))
    .replace('{insights}', JSON.stringify(insights.slice(0, 5).map(i => i.title), null, 2));

  return await generateJSON(prompt);
}

/**
 * Health Graph Engine Agent
 */
async function generateHealthGraph(userProfile, allMetrics, insights) {
  const promptTemplate = fs.readFileSync(graphPromptPath, 'utf-8');

  const prompt = promptTemplate
    .replace('{userProfile}', JSON.stringify(userProfile, null, 2))
    .replace('{allMetrics}', JSON.stringify(allMetrics.slice(0, 30), null, 2))
    .replace('{insights}', JSON.stringify(insights.slice(0, 5), null, 2));

  const graph = await generateJSON(prompt);

  // Validate structure
  if (!graph.nodes || !Array.isArray(graph.nodes)) {
    return getDefaultGraph();
  }

  return {
    nodes: graph.nodes.map(n => ({
      id: n.id || String(Math.random()),
      label: n.label || 'Unknown',
      category: n.category || 'metric',
      score: Math.min(100, Math.max(0, Number(n.score) || 75)),
      x: Math.min(95, Math.max(5, Number(n.x) || 50)),
      y: Math.min(95, Math.max(5, Number(n.y) || 50)),
      color: n.color || '#6366f1',
      size: Math.min(70, Math.max(30, Number(n.size) || 44)),
      value: n.value || '',
      trend: n.trend || 'stable',
    })),
    edges: Array.isArray(graph.edges) ? graph.edges : [],
    clusterGroups: Array.isArray(graph.clusterGroups) ? graph.clusterGroups : [],
  };
}

/**
 * Health Mission Control Agent
 */
async function generateMissionControl(userProfile, recentMetrics, activeInsights) {
  try {
    const prompt = `
You are the Health Mission Control Agent for HealthOS.
Your job is to analyze the patient's current health status, identify key priorities, and convert insights into concrete, actionable steps.

USER PROFILE:
${JSON.stringify(userProfile, null, 2)}

RECENT METRICS:
${JSON.stringify(recentMetrics.slice(0, 15), null, 2)}

ACTIVE INSIGHTS:
${JSON.stringify(activeInsights.slice(0, 5).map(i => i.title + ': ' + i.description), null, 2)}

Please return a prioritized checklist of 3-5 concrete action items.
Each item should have:
{
  "priority": 1 | 2 | 3,
  "action": "Short, clear action description (e.g., 'Start Vitamin D3 supplement (2000 IU/day)')",
  "rationale": "Brief clinical rationale based on their biomarkers",
  "category": "supplement" | "lifestyle" | "medical_followup" | "diet",
  "timeframe": "Immediate" | "Within 30 days" | "Within 60 days" | "Routine"
}

Return ONLY a valid JSON array of these prioritized action objects. Do not add markdown formatting outside the JSON array.
`;

    return await generateJSON(prompt);
  } catch (err) {
    console.error('Mission control agent error:', err.message);
    return getDemoMissionControl();
  }
}

/**
 * Health Twin Memory Agent
 */
async function generateTwinHistory(userProfile, scoreHistory, healthEvents) {
  try {
    const prompt = `
You are the Health Twin Memory Agent for HealthOS.
Your job is to analyze the patient's multi-year/multi-month health scores and events history to synthesize milestones, improvements, concerns, and overall trajectory.

USER PROFILE:
${JSON.stringify(userProfile, null, 2)}

HEALTH SCORE HISTORY:
${JSON.stringify(scoreHistory, null, 2)}

HEALTH EVENTS HISTORY:
${JSON.stringify(healthEvents.slice(0, 20), null, 2)}

Please return a JSON object summarizing their health evolution:
{
  "trajectory": "improving" | "stable" | "declining",
  "trajectoryExplanation": "<brief explanation>",
  "milestones": [
    { "date": "<date>", "title": "<milestone title>", "description": "<description>" }
  ],
  "improvements": [
    { "metric": "<metric name>", "details": "<improvement description>" }
  ],
  "concerns": [
    { "metric": "<metric name>", "details": "<concern description>", "urgency": "high" | "medium" | "low" }
  ]
}

Return ONLY valid JSON. Do not add markdown formatting outside the JSON object.
`;

    return await generateJSON(prompt);
  } catch (err) {
    console.error('Twin history agent error:', err.message);
    return getDemoTwinHistory();
  }
}

function getDemoMissionControl() {
  return [
    { priority: 1, action: 'Vitamin D follow-up recommended', rationale: 'Your Vitamin D levels (18 ng/mL) are deficient (<30 ng/mL is optimal). Discuss supplementation with Dr. Priya Sharma.', category: 'supplement', timeframe: 'Immediate' },
    { priority: 2, action: 'Lipid profile due in 60 days', rationale: 'LDL is borderline elevated (142 mg/dL). Lifestyle improvements should be reassessed.', category: 'medical_followup', timeframe: 'Within 60 days' },
    { priority: 3, action: 'Discuss fatigue symptoms with physician', rationale: 'Subjective fatigue correlates with lower hemoglobin and vitamin D levels.', category: 'lifestyle', timeframe: 'Within 30 days' }
  ];
}

function getDemoTwinHistory() {
  return {
    trajectory: 'improving',
    trajectoryExplanation: 'Your health score has shown steady improvement over the last 6 months, rising from 73 to 82, driven by cardiovascular and metabolic improvements.',
    milestones: [
      { date: '2026-06-01', title: 'Health Score Milestone', description: 'Reached a health score of 82/100, entering the optimal bracket for cardiovascular metrics.' },
      { date: '2026-05-15', title: 'Running Program Launched', description: 'Initiated a 5-day/week cardio routine contributing to a decrease in resting heart rate.' }
    ],
    improvements: [
      { metric: 'Resting Heart Rate', details: 'Resting heart rate decreased from 74 to 68 bpm over 3 months.' },
      { metric: 'Fasting Glucose', details: 'Fasting glucose stabilized at 89 mg/dL (normal range).' }
    ],
    concerns: [
      { metric: 'Vitamin D', details: 'Levels fell to 18 ng/mL, requiring active supplementation.', urgency: 'high' },
      { metric: 'LDL Cholesterol', details: 'Borderline elevated at 142 mg/dL, requiring dietary adjustments.', urgency: 'medium' }
    ]
  };
}

function getDefaultGraph() {
  return {
    nodes: [
      { id: 'heart', label: 'Heart Health', category: 'metric', score: 88, x: 50, y: 20, color: '#f43f5e', size: 56, value: '', trend: 'improving' },
      { id: 'glucose', label: 'Blood Sugar', category: 'metric', score: 79, x: 75, y: 40, color: '#f59e0b', size: 48, value: '', trend: 'stable' },
      { id: 'sleep', label: 'Sleep Quality', category: 'habit', score: 71, x: 25, y: 45, color: '#6366f1', size: 46, value: '', trend: 'stable' },
      { id: 'activity', label: 'Activity', category: 'habit', score: 85, x: 20, y: 70, color: '#10b981', size: 50, value: '', trend: 'improving' },
      { id: 'nutrition', label: 'Nutrition', category: 'habit', score: 80, x: 45, y: 85, color: '#06b6d4', size: 44, value: '', trend: 'stable' },
    ],
    edges: [
      { from: 'sleep', to: 'glucose', strength: 'moderate', type: 'negative', label: 'Poor sleep raises glucose' },
      { from: 'activity', to: 'heart', strength: 'strong', type: 'positive', label: 'Exercise improves heart health' },
    ],
    clusterGroups: [],
  };
}

module.exports = { generateForecast, generateHealthStory, generateHealthGraph, generateMissionControl, generateTwinHistory, getDemoMissionControl, getDemoTwinHistory };
