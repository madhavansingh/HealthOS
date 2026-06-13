const { GoogleGenerativeAI } = require('@google/generative-ai');
const env = require('./environment');

let genAIInstance = null;

function getGenAI() {
  if (!genAIInstance) {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('GEMINI_API_KEY is not configured. Please define it in your environment variables.');
    }
    genAIInstance = new GoogleGenerativeAI(apiKey);
  }
  return genAIInstance;
}

module.exports = { getGenAI };
