const fs = require('fs');
const path = require('path');
const { generateJSON } = require('./geminiClient');

const copilotPromptPath = path.join(__dirname, '../prompts/copilot.txt');

/**
 * Doctor Copilot Agent
 * Generates visit prep briefs, suggested discussion topics, and checklist guidelines.
 * 
 * @param {object} userProfile - Patient age, gender, plans.
 * @param {Array} recentMetrics - Biomarkers parsed from recent logs.
 * @param {Array} insights - List of AI generated insights.
 * @param {Array} familyHistory - Relational medical context.
 * @returns {Promise<object>}
 */
async function generateDoctorBrief(userProfile, recentMetrics, insights, familyHistory) {
  const { retrieveGuidelines } = require('../rag/retriever');
  const query = recentMetrics.map(m => m.metric_name).join(' ') + ' ' + insights.map(i => i.title).join(' ');
  const guidelines = await retrieveGuidelines(query, 2);
  const guidelinesText = guidelines.map(g => `- [${g.source}] (${g.title}): ${g.text}`).join('\n');

  const promptTemplate = fs.readFileSync(copilotPromptPath, 'utf-8');
  const insightsSummary = insights.slice(0, 5).map(i => `${i.title}: ${i.description}`).join('\n');

  const prompt = promptTemplate
    .replace('{userProfile}', JSON.stringify(userProfile, null, 2))
    .replace('{recentMetrics}', JSON.stringify(recentMetrics.slice(0, 30), null, 2))
    .replace('{insightsSummary}', insightsSummary + '\n\nCLINICAL REFERENCE GUIDELINES (RAG):\n' + guidelinesText)
    .replace('{familyHistory}', familyHistory.map(f => `${f.relation}: ${JSON.stringify(f.conditions || [])}`).join('\n'));

  const brief = await generateJSON(prompt);

  return {
    visitBrief: brief.visitBrief || {
      chiefConcern: 'Review recent lab results',
      recentLabs: 'Recent blood work',
      medications: 'None currently',
      allergies: 'None known',
      recentSymptoms: 'To be discussed',
    },
    suggestedQuestions: Array.isArray(brief.suggestedQuestions)
      ? brief.suggestedQuestions.slice(0, 8)
      : [],
    discussionTopics: Array.isArray(brief.discussionTopics)
      ? brief.discussionTopics.slice(0, 5)
      : [],
    reportSummary: brief.reportSummary || '',
    redFlags: Array.isArray(brief.redFlags) ? brief.redFlags : [],
    followUpTests: Array.isArray(brief.followUpTests) ? brief.followUpTests : [],
  };
}

module.exports = { generateDoctorBrief };
