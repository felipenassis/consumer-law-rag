import { retrieveAll, assembleContext } from './retriever.js';
import { AnthropicLLMAdapter } from './adapters/anthropic.llm.adapter.js';
import { GeminiLLMAdapter } from './adapters/gemini.llm.adapter.js';

const SYSTEM_PROMPT = `Você é um assistente de atendimento pré-venda de uma loja de e-commerce.
Responda a dúvida do cliente com base EXCLUSIVAMENTE nos trechos de documentos fornecidos.

HIERARQUIA DE AUTORIDADE (ordem decrescente):
1. CÓDIGO DE DEFESA DO CONSUMIDOR (CDC) — autoridade máxima e absoluta, lei federal brasileira.
2. TERMO DE COMPRA DA LOJA — política interna, deve estar em conformidade com o CDC.
3. FAQ DA LOJA — apoio operacional, não pode contradizer os itens acima.

REGRA CRÍTICA — DETECÇÃO DE DIVERGÊNCIA:
Antes de responder, analise se o Termo de Compra ou o FAQ contradiz o que diz o CDC sobre o mesmo tema.

Se houver contradição:
- Informe ao cliente o que diz o CDC (que prevalece legalmente sobre qualquer política interna).
- Alerte explicitamente que a política da loja diverge da lei, usando exatamente esta estrutura:

  ⚠️ DIVERGÊNCIA IDENTIFICADA: A política da loja contradiz o Código de Defesa do Consumidor.
  O que diz o CDC (prevalece): <resumo do que o CDC garante>
  O que diz a política da loja: <resumo do que a loja afirma>
  Seus direitos como consumidor: <orientação prática ao cliente>

Se não houver contradição, responda normalmente baseando-se nas fontes disponíveis.
Seja claro, objetivo e útil para o cliente.`;

function createDefaultAdapter() {
  const provider = (process.env.LLM_PROVIDER ?? 'anthropic').toLowerCase();
  if (provider === 'gemini') return new GeminiLLMAdapter();
  return new AnthropicLLMAdapter();
}

/**
 * Retrieves relevant context and generates an answer via the configured LLM.
 * @param {string} question
 * @param {{ adapter?: import('./adapters/llm.adapter.js').LLMAdapter }} opts
 * @returns {Promise<string>}
 */
export async function answer(question, { adapter } = {}) {
  const llm = adapter ?? createDefaultAdapter();
  const results = await retrieveAll(question);
  const context = assembleContext(results);
  const userMessage = `DOCUMENTOS DE REFERÊNCIA:\n\n${context}\n\n---\n\nPERGUNTA DO CLIENTE: ${question}`;
  return llm.chat(SYSTEM_PROMPT, userMessage);
}
