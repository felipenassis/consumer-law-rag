import { ChromaClient } from 'chromadb';

export function createChromaClient() {
  const url = new URL(process.env.CHROMA_URL ?? 'http://localhost:8000');
  return new ChromaClient({
    ssl:  url.protocol === 'https:',
    host: url.hostname,
    port: Number(url.port) || 8000,
  });
}

/**
 * @param {ChromaClient} client
 * @param {string} name
 * @param {boolean} reset
 * @returns {Promise<import('chromadb').Collection>}
 */
export async function getOrResetCollection(client, name, reset = false) {
  // embeddingFunction: null tells chromadb@3.x not to inject DefaultEmbeddingFunction
  // metadata into the request — we always supply raw vectors ourselves via upsert().
  const opts = { name, embeddingFunction: null };
  if (reset) {
    try { await client.deleteCollection(name); } catch { /* not found, ok */ }
    return client.createCollection(opts);
  }
  return client.getOrCreateCollection(opts);
}
