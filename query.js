import 'dotenv/config';
import { retrieveAll, assembleContext } from './src/retriever.js';

const queryText = process.argv.slice(2).join(' ').trim();

if (!queryText) {
  console.error('Uso: node query.js "<pergunta>"');
  process.exit(1);
}

console.log(`\nConsulta: "${queryText}"\n`);

const results = await retrieveAll(queryText);

const SOURCE_LABELS = {
  cdc:          'CDC (autoridade máxima)',
  termo_compra: 'Termo de Compra',
  faq:          'FAQ da Loja',
};

for (const [source, chunks] of Object.entries(results)) {
  console.log(`--- ${SOURCE_LABELS[source]} ---`);
  for (const [i, chunk] of chunks.entries()) {
    const preview = chunk.text.replace(/\s+/g, ' ').slice(0, 200);
    console.log(`  [${i + 1}] distância: ${chunk.distance.toFixed(4)} | chunk #${chunk.chunkIndex}`);
    console.log(`       ${preview}${chunk.text.length > 200 ? '…' : ''}`);
  }
  console.log();
}

console.log('=== CONTEXTO MONTADO PARA O LLM ===\n');
console.log(assembleContext(results));
