const fs = require('fs');
const path = require('path');
const { generateJSON } = require('./geminiClient');

const twinPromptPath = path.join(__dirname, '../prompts/twin.txt');

/**
 * Health Twin Generator Agent
 * Synthesizes all health data into a comprehensive Digital Twin profile
 */
async function generateHealthTwin(userProfile, allMetrics, scoreHistory) {
  const promptTemplate = fs.readFileSync(twinPromptPath, 'utf-8');

  const reportCount = new Set(allMetrics.map(m => m.report_id)).size;
  const dates = allMetrics.map(m => m.created_at).filter(Boolean).sort();
  const timespan = dates.length >= 2
    ? `${dates[0]?.split('T')[0]} to ${dates[dates.length - 1]?.split('T')[0]}`
    : 'recent data';

  const { retrieveGuidelines } = require('../rag/retriever');
  const guidelines = await retrieveGuidelines('cardiovascular metabolic nutrition thyroid lipid blood sugar', 3);
  const guidelinesText = guidelines.map(g => `- [${g.source}] (${g.title}): ${g.text}`).join('\n');

  const prompt = promptTemplate
    .replace('{userProfile}', JSON.stringify(userProfile, null, 2))
    .replace('{allMetrics}', JSON.stringify(allMetrics.slice(0, 50), null, 2)) // Limit tokens
    .replace('{scoreHistory}', JSON.stringify(scoreHistory, null, 2))
    .replace('{reportCount}', String(reportCount))
    .replace('{timespan}', timespan) + '\n\nCLINICAL REFERENCE GUIDELINES (RAG):\n' + guidelinesText;

  const twin = await generateJSON(prompt);

  // Validate and add defaults
  return {
    biologicalAge: twin.biologicalAge || userProfile.age,
    biologicalAgeVsChronological: twin.biologicalAgeVsChronological || '0 years',
    twinAccuracy: Math.min(100, Math.max(50, twin.twinAccuracy || 70)),
    overallScore: Math.min(100, Math.max(0, twin.overallScore || 75)),
    scoreBreakdown: {
      cardiovascular: twin.scoreBreakdown?.cardiovascular || 75,
      metabolic: twin.scoreBreakdown?.metabolic || 75,
      sleep: twin.scoreBreakdown?.sleep || 71,
      activity: twin.scoreBreakdown?.activity || 80,
      mental: twin.scoreBreakdown?.mental || 75,
      nutrition: twin.scoreBreakdown?.nutrition || 75,
    },
    twinSummary: twin.twinSummary || 'Your health twin is being built from your medical data.',
    keyStrengths: Array.isArray(twin.keyStrengths) ? twin.keyStrengths : [],
    keyRisks: Array.isArray(twin.keyRisks) ? twin.keyRisks : [],
    metabolicAge: twin.metabolicAge || userProfile.age,
    cardiovascularFitnessAge: twin.cardiovascularFitnessAge || userProfile.age,
    healthTrajectory: ['improving', 'stable', 'declining'].includes(twin.healthTrajectory)
      ? twin.healthTrajectory
      : 'stable',
    predictedScoreIn90Days: twin.predictedScoreIn90Days || (twin.overallScore || 75) + 3,
    dataPoints: allMetrics.length,
    reportsCovered: reportCount,
  };
}

module.exports = { generateHealthTwin };
