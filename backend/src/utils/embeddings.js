const axios = require('axios');

const EMBEDDINGS_SERVICE_URL = process.env.EMBEDDINGS_SERVICE_URL || 'http://embeddings:8000';

/**
 * Get embedding for a single text from RoBERTa service
 * @param {string} text - Text to embed
 * @returns {Promise<Array>} Embedding vector
 */
async function getTextEmbedding(text) {
  try {
    const response = await axios.post(`${EMBEDDINGS_SERVICE_URL}/embed`, { text }, {
      timeout: 5000
    });

    return response.data.embedding;
  } catch (err) {
    console.error('Failed to get embedding:', err.message);
    return null;
  }
}

/**
 * Get embeddings for multiple texts
 * @param {Array<string>} texts - Texts to embed
 * @returns {Promise<Array<Array>>} Batch of embedding vectors
 */
async function getTextEmbeddingsBatch(texts) {
  try {
    if (!texts || texts.length === 0) return [];
    if (texts.length > 100) {
      console.warn('Batch size exceeds 100, truncating');
      texts = texts.slice(0, 100);
    }

    const response = await axios.post(`${EMBEDDINGS_SERVICE_URL}/embed-batch`, { texts }, {
      timeout: 10000
    });

    return response.data.embeddings;
  } catch (err) {
    console.error('Failed to get batch embeddings:', err.message);
    return null;
  }
}

/**
 * Check embeddings service health
 * @returns {Promise<boolean>} True if service is healthy
 */
async function checkEmbeddingsServiceHealth() {
  try {
    const response = await axios.get(`${EMBEDDINGS_SERVICE_URL}/health`, {
      timeout: 3000
    });
    return response.status === 200;
  } catch (err) {
    return false;
  }
}

/**
 * Build a 73-point personality vector from social text + metrics.
 * @param {{texts?: Array<string>, metrics?: Record<string, number>}} payload
 * @returns {Promise<{vector73: Array<number>, vector35: Array<number>, model: string, textSamplesUsed: number, metricsUsed: Record<string, number>}|null>}
 */
async function buildPersonalityVector73(payload) {
  try {
    const response = await axios.post(`${EMBEDDINGS_SERVICE_URL}/personality-73`, payload, {
      timeout: 15000
    });

    return response.data;
  } catch (err) {
    console.error('Failed to build personality vector:', err.message);
    return null;
  }
}

module.exports = {
  getTextEmbedding,
  getTextEmbeddingsBatch,
  checkEmbeddingsServiceHealth,
  buildPersonalityVector73,
  EMBEDDINGS_SERVICE_URL
};
