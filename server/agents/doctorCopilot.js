const fs = require('fs');
const path = require('path');
const { generateJSON, generateStream } = require('./geminiClient');

const copilotPromptPath = path.join(__dirname, '../prompts/copilot.txt');
const chatPromptPath = path.join(__dirname, '../prompts/chat.txt');

/**
 * Doctor Copilot Agent
 * Generates visit prep, questions, and doctor brief
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
    .replace('{familyHistory}', familyHistory.map(f => `${f.relation}: ${JSON.parse(f.conditions || '[]').join(', ')}`).join('\n'));

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

/**
 * Health Chat Agent (streaming)
 */
async function* streamHealthChat(userProfile, healthContext, conversationHistory, userMessage) {
  const promptTemplate = fs.readFileSync(chatPromptPath, 'utf-8');

  // Build conversation history string
  const historyStr = conversationHistory.slice(-6).map(m =>
    `${m.role === 'user' ? 'User' : 'HealthOS AI'}: ${m.content}`
  ).join('\n\n');

  const { retrieveGuidelines } = require('../rag/retriever');
  const guidelines = await retrieveGuidelines(userMessage, 2);

  // Condense health context
  const contextSummary = {
    recentMetrics: healthContext.metrics?.slice(0, 15) || [],
    insights: healthContext.insights?.slice(0, 3).map(i => i.title) || [],
    reportCount: healthContext.reportCount || 0,
    clinicalGuidelines: guidelines.map(g => ({
      title: g.title,
      text: g.text,
      source: g.source,
      url: g.url
    }))
  };

  const prompt = promptTemplate
    .replace('{userProfile}', JSON.stringify(userProfile, null, 2))
    .replace('{healthContext}', JSON.stringify(contextSummary, null, 2))
    .replace('{conversationHistory}', historyStr || 'No previous conversation.')
    .replace('{userMessage}', userMessage);

  yield* generateStream(prompt);
}

module.exports = { generateDoctorBrief, streamHealthChat };
