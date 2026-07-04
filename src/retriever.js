import { createChromaClient } from './chroma.js';
import { OpenAIEmbeddingAdapter } from './adapters/openai.embedding.adapter.js';

const SOURCES = ['cdc', 'termo_compra', 'faq'];

/**
 * Embeds the query and retrieves the top-k most relevant chunks from each
 * collection independently, preserving source hierarchy in the return shape.
 *
 * @param {string} queryText
 * @param {{ nResults?: number, adapter?: EmbeddingAdapter, client?: ChromaClient }} opts
 * @returns {Promise<{ cdc: Chunk[], termo_compra: Chunk[], faq: Chunk[] }>}
 *
 * @typedef {{ text: string, distance: number, chunkIndex: number }} Chunk
 */
export async function retrieveAll(queryText, { nResults = 6, adapter, client } = {}) {
  const embed  = adapter ?? new OpenAIEmbeddingAdapter();
  const chroma = client  ?? createChromaClient();

  const [queryVector] = await embed.embed([queryText]);

  const entries = await Promise.all(
    SOURCES.map(async (source) => {
      const col = await chroma.getCollection({ name: source, embeddingFunction: null });
      const res = await col.query({
        queryEmbeddings: [queryVector],
        nResults,
        include: ['documents', 'metadatas', 'distances'],
      });
      const chunks = res.documents[0].map((text, i) => ({
        text,
        distance:   res.distances[0][i],
        chunkIndex: res.metadatas[0][i].chunkIndex,
      }));
      return [source, chunks];
    }),
  );

  return Object.fromEntries(entries);
}

/**
 * Formats retrieval results into a prompt-ready context string.
 * Order reflects the hierarchy: CDC (authority) → termo → faq.
 *
 * @param {ReturnType<retrieveAll> extends Promise<infer T> ? T : never} results
 * @returns {string}
 */
export function assembleContext(results) {
  const sections = [
    { key: 'cdc',          label: 'CÓDIGO DE DEFESA DO CONSUMIDOR (autoridade máxima)' },
    { key: 'termo_compra', label: 'TERMO DE COMPRA DA LOJA' },
    { key: 'faq',          label: 'FAQ DA LOJA' },
  ];

  return sections
    .map(({ key, label }) => {
      const chunks = results[key];
      if (!chunks?.length) return null;
      const body = chunks.map(c => c.text).join('\n\n');
      return `=== ${label} ===\n${body}`;
    })
    .filter(Boolean)
    .join('\n\n');
}
