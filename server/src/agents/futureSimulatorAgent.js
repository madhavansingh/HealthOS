const fs = require('fs');
const path = require('path');
const { generateJSON } = require('./geminiClient');

const simulatorPromptPath = path.join(__dirname, '../prompts/simulator.txt');

/**
 * Future Simulator Agent
 * 
 * @param {object} userProfile - Patient demographic details.
 * @param {Array} currentMetrics - Biomarker data points.
 * @param {Array} historicalTrend - Past health score history logs.
 * @param {string} scenario - Active scenario (e.g. combined, exercise_increase, etc.)
 * @returns {Promise<object>}
 */
async function generateForecast(userProfile, currentMetrics, historicalTrend, scenario = 'combined') {
  const promptTemplate = fs.readFileSync(simulatorPromptPath, 'utf-8');

  const prompt = promptTemplate
    .replace('{userProfile}', JSON.stringify(userProfile, null, 2))
    .replace('{currentMetrics}', JSON.stringify(currentMetrics.slice(0, 20), null, 2))
    .replace('{historicalTrend}', JSON.stringify(historicalTrend, null, 2))
    .replace('{scenario}', scenario);

  const forecast = await generateJSON(prompt);

  // Always enforce disclaimer logic for compliance
  forecast.disclaimer = 'Forecast only. Not medical advice. Consult your physician before making health decisions.';

  return forecast;
}

module.exports = { generateForecast };
