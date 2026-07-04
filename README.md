# Consumer Law RAG — Assistente de Atendimento ao Consumidor

> Chat de atendimento pré-venda para e-commerce com RAG hierárquico e detecção automática de divergências entre a política da loja e o Código de Defesa do Consumidor.

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-0.6.3-FF6B35)](https://trychroma.com)
[![OpenAI](https://img.shields.io/badge/Embeddings-OpenAI-412991?logo=openai)](https://openai.com)
[![Claude](https://img.shields.io/badge/LLM-Claude%20Opus%204.8-D4A843)](https://anthropic.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Sobre o projeto

Projeto de portfólio que implementa um sistema RAG (*Retrieval-Augmented Generation*) para atendimento ao consumidor em e-commerce. O assistente responde dúvidas de clientes com base em três fontes de informação organizadas em hierarquia de autoridade:

| Prioridade | Fonte | Papel |
|:---:|---|---|
| 1 | **Código de Defesa do Consumidor (CDC)** | Autoridade máxima — lei federal, nunca pode ser contrariada |
| 2 | **Termo de Compra da Loja** | Política interna — deve estar em conformidade com o CDC |
| 3 | **FAQ da Loja** | Apoio operacional — não pode contradizer as fontes acima |

**Regra de negócio crítica:** quando a política da loja contradiz o CDC, o sistema sinaliza a divergência explicitamente na resposta, informando ao consumidor o que a lei garante — independente do que a loja afirme.

---

## Demonstração

### Caso com contradição (devolução por arrependimento)

A TechStore proíbe devoluções por arrependimento no Termo de Compra (cláusula 4.3) e no FAQ. O CDC Art. 49, porém, garante 7 dias para desistência em compras feitas fora do estabelecimento.

```
$ node chat.js "Posso devolver um produto que não gostei?"
```

```
⚠️ DIVERGÊNCIA IDENTIFICADA: A política da loja contradiz o Código de Defesa do Consumidor.

O que diz o CDC (prevalece): O Art. 49 do CDC garante ao consumidor o direito de
arrependimento. Em compras feitas pela internet, você pode desistir no prazo de 7 dias
a contar do recebimento do produto — mesmo sem defeito. Todos os valores pagos devem
ser devolvidos imediatamente e atualizados monetariamente (inclusive o frete).

O que diz a política da loja: A TechStore afirma (item 4.3 do Termo de Compra e FAQ)
que não aceita devoluções por arrependimento ou insatisfação. Essa regra desrespeita a lei.

Seus direitos como consumidor: Entre em contato com o suporte dentro de 7 dias corridos
do recebimento, invocando o Art. 49 do CDC. Caso a loja recuse, registre reclamação
no Procon ou em consumidor.gov.br.
```

### Caso sem contradição (garantia)

```
$ node chat.js "Qual é o prazo de garantia dos produtos?"
```

```
Todos os produtos da TechStore têm 12 meses de garantia contra defeitos de fabricação,
contados a partir da data de entrega.

Além da garantia contratual, o CDC (Art. 26) assegura o prazo legal de 90 dias para
reclamar de vícios em produtos duráveis (eletrônicos) e 30 dias para não duráveis,
contados a partir do recebimento.

A garantia cobre defeitos de fabricação, mas não danos por quedas, líquidos ou mau uso.
```

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                      FASE 1 — INGESTÃO                  │
│                                                         │
│  data/cdc.txt ──┐                                       │
│  data/termo.txt ├─► Chunker ──► OpenAI Embeddings ──►  │
│  data/faq.txt ──┘              (text-embedding-3-small) │
│                                         │               │
│                             ┌───────────▼────────────┐  │
│                             │       ChromaDB         │  │
│                             │  cdc | termo_compra    │  │
│                             │       | faq            │  │
│                             └───────────────────────-┘  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              FASE 2 — RETRIEVAL (em tempo real)         │
│                                                         │
│  Pergunta ──► Embedding ──► Query paralela (3 coleções) │
│                                    │                    │
│                          CDC top-6 + termo top-6        │
│                               + faq top-6               │
│                                    │                    │
│                         assembleContext() ──► contexto  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│               FASE 3 — GERAÇÃO (LLM)                    │
│                                                         │
│  System prompt (hierarquia + regra de divergência)      │
│         + contexto recuperado                           │
│         + pergunta do usuário                           │
│                    │                                    │
│            LLMAdapter (plugável)                        │
│         ┌──────────┴──────────┐                        │
│  AnthropicAdapter        GeminiAdapter                  │
│  (Claude Opus 4.8)   (Gemini 2.0 Flash Lite)           │
│                    │                                    │
│              Resposta final                             │
│    (com ⚠️ DIVERGÊNCIA se aplicável)                    │
└─────────────────────────────────────────────────────────┘
```

---

## Decisões de design

### Coleções separadas por fonte
O CDC, o Termo e o FAQ vivem em **três coleções distintas** no ChromaDB — não em uma só com filtro de metadado. Isso garante que o CDC nunca "perca" por similaridade semântica para um chunk de FAQ mais próximo da query: cada fonte é consultada de forma independente e recebe sua cota de chunks no contexto.

### Padrão Adapter (embeddings e LLM)
Tanto a camada de embedding quanto a de geração usam o padrão Strategy/Adapter:

```
EmbeddingAdapter          LLMAdapter
     │                         │
OpenAIEmbeddingAdapter   AnthropicLLMAdapter
                         GeminiLLMAdapter
```

Trocar de provedor é uma variável de ambiente (`LLM_PROVIDER=gemini`), sem alterar o código da aplicação.

### Detecção de divergência via LLM
A detecção de contradições CDC vs política da loja é uma **tarefa semântica delegada ao próprio modelo**, via system prompt. Abordagens baseadas em regras falhariam com a variação de linguagem natural; o LLM entende contexto, sinônimos e implicações legais.

### Chunker paragraph-aware
O chunker respeita quebras de parágrafo antes de atingir o tamanho máximo do chunk, evitando cortes no meio de artigos de lei. Um overlap de 200 caracteres garante continuidade semântica entre chunks adjacentes.

---

## Stack tecnológica

| Componente | Tecnologia |
|---|---|
| Runtime | Node.js 20+ (ES Modules, top-level await) |
| Vector DB | ChromaDB 0.6.3 (Docker) |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dims) |
| LLM padrão | Anthropic Claude Opus 4.8 (thinking adaptativo) |
| LLM alternativo | Google Gemini 2.0 Flash Lite |
| SDK Anthropic | `@anthropic-ai/sdk` |
| SDK Google | `@google/genai` |
| Env | `dotenv` |

---

## Pré-requisitos

- Node.js >= 20
- Docker e Docker Compose
- Chave de API da OpenAI (embeddings)
- Chave de API da Anthropic **ou** Google AI Studio (geração)

---

## Instalação e execução

### 1. Clone e instale as dependências

```bash
git clone <repo-url>
cd consumer-law-rag
npm install
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env`:

```dotenv
OPENAI_API_KEY=sk-...          # obrigatório (embeddings)
ANTHROPIC_API_KEY=sk-ant-...   # necessário se LLM_PROVIDER=anthropic
GOOGLE_API_KEY=AIza...         # necessário se LLM_PROVIDER=gemini
LLM_PROVIDER=anthropic         # anthropic | gemini
CHROMA_URL=http://localhost:8000
```

### 3. Suba o ChromaDB

```bash
docker compose up -d
```

### 4. Ingira os documentos

```bash
npm run ingest
# ou, para recriar as coleções do zero:
npm run ingest:reset
```

Saída esperada:
```
[cdc]          123 chunks em 2 batch(es)
[termo_compra]   3 chunks em 1 batch(es)
[faq]            4 chunks em 1 batch(es)
```

### 5. Converse com o assistente

**Modo single-shot:**
```bash
node chat.js "Tenho direito a devolução por arrependimento?"
```

**Modo interativo (REPL):**
```bash
npm run chat
```

---

## Scripts disponíveis

| Script | Descrição |
|---|---|
| `npm run ingest` | Ingere (ou re-ingere de forma idempotente) os 3 documentos |
| `npm run ingest:reset` | Recria as coleções do zero antes de ingerir |
| `npm run query` | Inspeciona os chunks recuperados para uma pergunta (debug) |
| `npm run chat` | Inicia o REPL interativo |

---

## Estrutura do projeto

```
consumer-law-rag/
├── data/
│   ├── cdc.txt              # Lei 8.078/90 — Código de Defesa do Consumidor
│   ├── termo_compra.txt     # Termo fictício (com contradições intencionais ao CDC)
│   └── faq.txt              # FAQ fictício (idem)
├── src/
│   ├── adapters/
│   │   ├── embedding.adapter.js          # Interface base (embeddings)
│   │   ├── openai.embedding.adapter.js   # Impl. OpenAI
│   │   ├── llm.adapter.js                # Interface base (LLM)
│   │   ├── anthropic.llm.adapter.js      # Impl. Claude Opus 4.8
│   │   └── gemini.llm.adapter.js         # Impl. Gemini 2.0 Flash Lite
│   ├── chunker.js           # Chunker paragraph-aware com overlap
│   ├── chroma.js            # Cliente ChromaDB e helpers de coleção
│   ├── pipeline.js          # Orquestra ingestão por fonte
│   ├── retriever.js         # retrieveAll() + assembleContext()
│   └── chat.js              # answer() — ponto de entrada da geração
├── ingest.js                # CLI de ingestão
├── query.js                 # CLI de inspeção do retrieval (debug)
├── chat.js                  # CLI do chat (single-shot e REPL)
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## Perguntas sugeridas para teste

| Pergunta | Comportamento esperado |
|---|---|
| "Posso devolver um produto que não gostei?" | ⚠️ Divergência — CDC Art. 49 vs política da loja |
| "Comprei pela internet. Posso cancelar após o envio?" | ⚠️ Divergência — CDC Art. 49 vs FAQ |
| "Qual é o prazo de garantia?" | Resposta normal, sem divergência |
| "O produto chegou com defeito. O que faço?" | Resposta normal — loja e CDC concordam |
| "Produtos em promoção têm garantia?" | Resposta normal com contexto legal |

---

## Limitações conhecidas

- **Qualidade do chunking:** o CDC tem ~123 chunks gerados por segmentação paragraph-aware. Artigos que caem no meio de chunks com contexto misto podem ter distância semântica mais alta para certas queries. Mitigado com `nResults=6`.
- **Cobertura de retrieval:** o sistema retorna os top-6 chunks mais similares por coleção. Perguntas muito específicas sobre artigos obscuros do CDC podem não trazer o trecho exato.
- **Sem memória de conversa:** cada pergunta é tratada de forma independente — não há histórico de turno no contexto do LLM.

---

## Licença

MIT
