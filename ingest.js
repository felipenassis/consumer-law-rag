import 'dotenv/config';
import { createChromaClient, getOrResetCollection } from './src/chroma.js';
import { OpenAIEmbeddingAdapter }                   from './src/adapters/openai.embedding.adapter.js';
import { ingestSource }                             from './src/pipeline.js';

const SOURCES = [
  { name: 'cdc',   file: 'data/cdc.txt',          collection: 'cdc' },
  { name: 'termo', file: 'data/termo_compra.txt',  collection: 'termo_compra' },
  { name: 'faq',   file: 'data/faq.txt',           collection: 'faq' },
];

const reset  = process.argv.includes('--reset');
const client = createChromaClient();
const embed  = new OpenAIEmbeddingAdapter();

if (reset) console.log('--reset: dropping and recreating all collections\n');

for (const src of SOURCES) {
  const col    = await getOrResetCollection(client, src.collection, reset);
  const result = await ingestSource(src.name, src.file, col, embed);
  console.log(`[${src.name}] done — ${result.chunksIngested} chunks in ${result.batches} batch(es)\n`);
}

console.log('Ingestão concluída.');
