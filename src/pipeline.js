import { readFile } from 'node:fs/promises';
import { chunkText } from './chunker.js';

/**
 * @param {string} sourceName  'cdc' | 'termo' | 'faq'
 * @param {string} filePath
 * @param {import('chromadb').Collection} collection
 * @param {import('./adapters/embedding.adapter.js').EmbeddingAdapter} adapter
 * @returns {Promise<{ chunksIngested: number, batches: number }>}
 */
export async function ingestSource(sourceName, filePath, collection, adapter) {
  const text = await readFile(filePath, 'utf-8');
  const chunks = chunkText(text);

  const ids       = chunks.map((_, i) => `${sourceName}-${i}`);
  const documents = chunks;
  const metadatas = chunks.map((t, i) => ({ source: sourceName, chunkIndex: i, text: t }));

  console.log(`[${sourceName}] ${chunks.length} chunks — embedding via ${adapter.providerName}...`);

  const embeddings = await adapter.embed(chunks);

  await collection.upsert({ ids, embeddings, documents, metadatas });

  const batches = Math.ceil(chunks.length / 100);
  return { chunksIngested: chunks.length, batches };
}
