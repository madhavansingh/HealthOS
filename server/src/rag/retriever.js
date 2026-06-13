// HealthOS RAG Retriever Engine
// Performs vector-based similarity search using Gemini embeddings, with a robust keyword-matching fallback.

const { CLINICAL_GUIDELINES } = require('./knowledgeBase');
const { generateEmbedding } = require('../agents/geminiClient');

let embeddedGuidelines = null;

// Utility to calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Simple keyword matching fallback
function keywordSearch(query, limit = 2) {
  const queryTerms = query.toLowerCase().split(/\W+/).filter(t => t.length > 2);
  if (queryTerms.length === 0) {
    return CLINICAL_GUIDELINES.slice(0, limit);
  }

  const scored = CLINICAL_GUIDELINES.map(g => {
    const text = (g.title + ' ' + g.text + ' ' + g.category).toLowerCase();
    let score = 0;
    for (const term of queryTerms) {
      if (text.includes(term)) {
        score += 1;
      }
    }
    return { ...g, score };
  });

  return scored
    .filter(g => g.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Perform vector pre-computation for the knowledge base
async function initializeEmbeddings() {
  if (embeddedGuidelines) return;

  const embedded = [];
  for (const g of CLINICAL_GUIDELINES) {
    try {
      const vector = await generateEmbedding(`${g.title}: ${g.text} (${g.category})`);
      embedded.push({ ...g, vector });
    } catch (err) {
      console.warn(`[RAG] Embedding failed for ${g.id}: ${err.message}. Falling back to keyword-search mode.`);
      return null;
    }
  }
  embeddedGuidelines = embedded;
  console.log('[RAG] Initialized vector embeddings for clinical guidelines.');
}

/**
 * Retrieve the most clinically relevant guidelines for a given health concern or query.
 */
async function retrieveGuidelines(query, limit = 2) {
  if (!query?.trim()) return [];

  try {
    // Attempt initialization if not done yet
    if (!embeddedGuidelines) {
      await initializeEmbeddings();
    }

    if (embeddedGuidelines && embeddedGuidelines.length > 0) {
      const queryVector = await generateEmbedding(query);
      const scored = embeddedGuidelines.map(g => {
        const score = cosineSimilarity(queryVector, g.vector);
        return { ...g, score };
      });

      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    }
  } catch (err) {
    console.warn(`[RAG] Vector search failed, falling back to keyword search:`, err.message);
  }

  // Fallback if vector search failed or Gemini is not configured
  return keywordSearch(query, limit);
}

module.exports = { retrieveGuidelines };
