const fs = require('fs');
const path = require('path');
const { generateJSON } = require('./geminiClient');

const trendPromptPath = path.join(__dirname, '../prompts/trends.txt');

/**
 * Trend Intelligence Agent
 * Analyzes metrics across multiple reports → insight cards
 */
async function generateTrendInsights(userProfile, metricsHistory, reportsSummary) {
  const { retrieveGuidelines } = require('../rag/retriever');
  const queryWords = (reportsSummary || []).map(r => r.type || '').join(' ') + ' ' + 
                     (metricsHistory || []).flatMap(h => (h.metrics || []).map(m => m.metric_name || '')).join(' ');
  const guidelines = await retrieveGuidelines(queryWords, 3);
  const guidelinesText = guidelines.map(g => `- [${g.source}] (${g.title}): ${g.text}`).join('\n');

  const promptTemplate = fs.readFileSync(trendPromptPath, 'utf-8');

  const prompt = promptTemplate
    .replace('{userProfile}', JSON.stringify(userProfile, null, 2))
    .replace('{metricsHistory}', JSON.stringify(metricsHistory, null, 2))
    .replace('{reportsSummary}', JSON.stringify(reportsSummary, null, 2) + '\n\nCLINICAL REFERENCE GUIDELINES (RAG):\n' + guidelinesText);

  const insights = await generateJSON(prompt);

  if (!Array.isArray(insights)) {
    return [];
  }

  return insights.map((ins, idx) => {
    // Match this insight to a metric in history
    const matchedMetric = (metricsHistory || []).flatMap(h => h.metrics || []).find(m => 
      String(m.metric_name || '').toLowerCase().includes(String(ins.title || '').toLowerCase()) ||
      String(ins.title || '').toLowerCase().includes(String(m.metric_name || '').toLowerCase()) ||
      String(ins.description || '').toLowerCase().includes(String(m.metric_name || '').toLowerCase())
    );

    const matchedGuideline = guidelines.find(g => 
      String(ins.description || '').toLowerCase().includes(String(g.category || '').toLowerCase()) ||
      String(ins.title || '').toLowerCase().includes(String(g.category || '').toLowerCase())
    ) || guidelines[0];

    const evidence = {
      reportName: matchedMetric ? 'Biomarker Data' : (reportsSummary?.[0]?.name || 'Medical Report'),
      metric: matchedMetric ? matchedMetric.metric_name : (ins.metric || 'Biomarker'),
      value: matchedMetric ? `${matchedMetric.value} ${matchedMetric.unit || ''}` : (ins.metric || 'N/A'),
      guideline: matchedGuideline ? matchedGuideline.source : 'Clinical Guidelines',
      explanation: matchedGuideline ? matchedGuideline.text : ins.description
    };

    return {
      id: idx + 1,
      category: ins.category || 'Info',
      severity: validateSeverity(ins.severity),
      title: String(ins.title || 'Health Insight').slice(0, 100),
      description: String(ins.description || ''),
      metric: String(ins.metric || ''),
      icon: ins.icon || 'activity',
      recommendation: ins.recommendation || '',
      sources: [evidence],
    };
  });
}

/**
 * Timeline Builder Agent
 * Converts per-report metrics into unified time-series data
 */
function buildTimeline(metricsAcrossReports) {
  const timeline = {};

  for (const { date, metrics } of metricsAcrossReports) {
    for (const metric of metrics) {
      const key = normalizeMetricName(metric.metric_name);
      if (!timeline[key]) {
        timeline[key] = { label: metric.metric_name, unit: metric.unit, data: [] };
      }
      if (metric.value !== null) {
        timeline[key].data.push({ date, value: metric.value });
      }
    }
  }

  // Sort each series by date
  for (const key of Object.keys(timeline)) {
    timeline[key].data.sort((a, b) => a.date.localeCompare(b.date));
  }

  return timeline;
}

function normalizeMetricName(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function validateSeverity(s) {
  const valid = ['positive', 'warning', 'caution', 'info'];
  return valid.includes(s) ? s : 'info';
}

/**
 * Calculate health score dimensions from metrics
 */
function calculateHealthScores(metrics) {
  const scores = {
    cardiovascular: 75,
    metabolic: 75,
    nutrition: 75,
    overall: 75,
  };

  const byName = {};
  for (const m of metrics) {
    byName[m.metric_name.toLowerCase()] = m;
  }

  // Cardiovascular scoring
  let cardioFactors = [];
  if (byName['ldl cholesterol'] || byName['ldl']) {
    const ldl = byName['ldl cholesterol'] || byName['ldl'];
    cardioFactors.push(ldl.value < 100 ? 95 : ldl.value < 130 ? 80 : ldl.value < 160 ? 60 : 40);
  }
  if (byName['hdl cholesterol'] || byName['hdl']) {
    const hdl = byName['hdl cholesterol'] || byName['hdl'];
    cardioFactors.push(hdl.value > 60 ? 95 : hdl.value > 40 ? 75 : 55);
  }
  if (cardioFactors.length > 0) {
    scores.cardiovascular = Math.round(cardioFactors.reduce((a, b) => a + b, 0) / cardioFactors.length);
  }

  // Metabolic scoring
  let metaFactors = [];
  if (byName['fasting glucose'] || byName['glucose']) {
    const g = byName['fasting glucose'] || byName['glucose'];
    metaFactors.push(g.value < 100 ? 95 : g.value < 126 ? 65 : 40);
  }
  if (byName['hba1c'] || byName['hemoglobin a1c']) {
    const a1c = byName['hba1c'] || byName['hemoglobin a1c'];
    metaFactors.push(a1c.value < 5.7 ? 95 : a1c.value < 6.5 ? 70 : 40);
  }
  if (metaFactors.length > 0) {
    scores.metabolic = Math.round(metaFactors.reduce((a, b) => a + b, 0) / metaFactors.length);
  }

  // Nutrition scoring
  let nutFactors = [];
  if (byName['vitamin d'] || byName['25-oh vitamin d'] || byName['vitamin d, 25-hydroxy']) {
    const vd = byName['vitamin d'] || byName['25-oh vitamin d'] || byName['vitamin d, 25-hydroxy'];
    nutFactors.push(vd.value > 50 ? 95 : vd.value > 30 ? 80 : vd.value > 20 ? 60 : 30);
  }
  if (byName['vitamin b12'] || byName['b12']) {
    const b12 = byName['vitamin b12'] || byName['b12'];
    nutFactors.push(b12.value > 400 ? 90 : b12.value > 200 ? 70 : 40);
  }
  if (nutFactors.length > 0) {
    scores.nutrition = Math.round(nutFactors.reduce((a, b) => a + b, 0) / nutFactors.length);
  }

  scores.overall = Math.round((scores.cardiovascular + scores.metabolic + scores.nutrition) / 3);

  return scores;
}

module.exports = { generateTrendInsights, buildTimeline, calculateHealthScores, normalizeMetricName };
