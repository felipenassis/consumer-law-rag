import 'dotenv/config';
import { createInterface } from 'node:readline';
import { answer } from './src/chat.js';

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

function printAnswer(message) {
  for (const block of message.content) {
    if (block.type === 'text') {
      console.log('\n' + block.text);
    }
  }
}

// ── Single-shot mode: node chat.js "<pergunta>" ──────────────────────────────
const singleQuestion = process.argv.slice(2).join(' ').trim();
if (singleQuestion) {
  console.log(`\nPergunta: "${singleQuestion}"\n`);
  process.stdout.write('Consultando fontes e gerando resposta...\n');
  const msg = await answer(singleQuestion);
  printAnswer(msg);
  rl.close();
  process.exit(0);
}

// ── Interactive REPL mode ────────────────────────────────────────────────────
console.log('Chat RAG — Atendimento ao Consumidor');
console.log('Digite sua pergunta ou "sair" para encerrar.\n');

while (true) {
  const question = (await ask('Você: ')).trim();
  if (!question) continue;
  if (question.toLowerCase() === 'sair') break;

  process.stdout.write('\nAssistente: consultando...\n');
  try {
    const msg = await answer(question);
    printAnswer(msg);
  } catch (err) {
    console.error('\nErro ao gerar resposta:', err.message);
  }
  console.log();
}

rl.close();
