const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

let genAI = null;

/**
 * Typed error class for Gemini quota/rate-limit failures.
 * Allows upstream callers to detect and gracefully degrade instead of crashing.
 */
class GeminiQuotaError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GeminiQuotaError';
    this.isQuotaError = true;
  }
}

/**
 * Detect whether a raw API error is a quota / rate-limit issue.
 * Covers: 429 Too Many Requests, RESOURCE_EXHAUSTED, quota exceeded messages.
 */
function isQuotaError(err) {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const status = err.status || err.statusCode || err.code || '';
  return (
    status === 429 ||
    String(status) === '429' ||
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('too many requests') ||
    msg.includes('ratequotaexceeded') ||
    msg.includes('exhausted')
  );
}

function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('GEMINI_API_KEY not configured in server/.env');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

// Standard text generation with JSON mode
async function generateJSON(prompt, modelName = 'gemini-2.5-flash') {
  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    try {
      return JSON.parse(text);
    } catch (e) {
      const jsonMatch = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error(`Failed to parse Gemini JSON response: ${text.slice(0, 200)}`);
    }
  } catch (err) {
    if (isQuotaError(err)) {
      console.warn('[Gemini] Quota/rate-limit hit — triggering fallback engine.');
      throw new GeminiQuotaError(err.message);
    }
    throw err;
  }
}

// Standard text generation
async function generateText(prompt, modelName = 'gemini-2.5-flash') {
  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0.7 },
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    if (isQuotaError(err)) {
      console.warn('[Gemini] Quota/rate-limit hit — triggering fallback engine.');
      throw new GeminiQuotaError(err.message);
    }
    throw err;
  }
}

// Streaming for chat
async function* generateStream(prompt, modelName = 'gemini-2.5-flash') {
  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0.7 },
    });
    const result = await model.generateContentStream(prompt);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  } catch (err) {
    if (isQuotaError(err)) {
      console.warn('[Gemini] Quota/rate-limit hit in stream — yielding fallback message.');
      yield 'AI services are temporarily busy. Your health data is safe and your Health Twin was built using clinical rules. Please try again in a few minutes.';
      return;
    }
    throw err;
  }
}

// Generate embeddings for RAG
async function generateEmbedding(text) {
  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (err) {
    if (isQuotaError(err)) {
      // Return a zero vector — embeddings are optional for RAG ranking
      return new Array(768).fill(0);
    }
    throw err;
  }
}

module.exports = { generateJSON, generateText, generateStream, generateEmbedding, GeminiQuotaError, isQuotaError };
