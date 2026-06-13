const fs = require('fs');
const path = require('path');
const { generateStream } = require('./geminiClient');

const chatPromptPath = path.join(__dirname, '../prompts/chat.txt');

/**
 * Health Chat Agent (streaming SSE answers)
 * 
 * @param {object} userProfile - Patient age, gender.
 * @param {object} healthContext - List of metrics, insights, and guidelines context.
 * @param {Array} conversationHistory - Recent message roles and content.
 * @param {string} userMessage - Prompt query.
 * @returns {AsyncGenerator<string>}
 */
async function* streamHealthChat(userProfile, healthContext, conversationHistory, userMessage) {
  const promptTemplate = fs.readFileSync(chatPromptPath, 'utf-8');

  // Build conversation history string
  const historyStr = conversationHistory.slice(-6).map(m =>
    `${m.role === 'user' ? 'User' : 'HealthOS AI'}: ${m.content}`
  ).join('\n\n');

  const { retrieveGuidelines } = require('../rag/retriever');
  const guidelines = await retrieveGuidelines(userMessage, 2);

  // Condense health context to save token space
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

module.exports = { streamHealthChat };
