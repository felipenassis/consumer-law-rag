# Consumer Law RAG — E-commerce Consumer Assistant

> Pre-sales chat assistant for e-commerce powered by hierarchical RAG, with automatic detection of divergences between store policies and the Brazilian Consumer Defense Code (CDC).

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-0.6.3-FF6B35)](https://trychroma.com)
[![OpenAI](https://img.shields.io/badge/Embeddings-OpenAI-412991?logo=openai)](https://openai.com)
[![Claude](https://img.shields.io/badge/LLM-Claude%20Opus%204.8-D4A843)](https://anthropic.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## About

A portfolio project that implements a RAG (*Retrieval-Augmented Generation*) system for e-commerce customer support. The assistant answers customer questions based on three information sources organized in a strict authority hierarchy:

| Priority | Source | Role |
|:---:|---|---|
| 1 | **Consumer Defense Code (CDC — Lei 8.078/90)** | Absolute authority — federal law, cannot be overridden |
| 2 | **Store Purchase Terms** | Internal policy — must comply with the CDC |
| 3 | **Store FAQ** | Operational support — cannot contradict sources above |

**Core business rule:** when the store's policy contradicts the CDC, the system explicitly flags the divergence in its response, informing the customer of their legal rights — regardless of what the store claims.

---

## Demo

### Contradiction case (right of withdrawal)

The fictional store (TechStore) prohibits returns due to change of mind in its Purchase Terms (clause 4.3) and FAQ. However, CDC Article 49 guarantees consumers 7 days to withdraw from any purchase made outside a physical store.

```
$ node chat.js "Can I return a product I didn't like?"
```

```
⚠️ DIVERGENCE IDENTIFIED: The store's policy contradicts the Consumer Defense Code.

What the CDC says (legally prevails): Article 49 of the CDC guarantees consumers the
right of withdrawal. For purchases made online, you may cancel within 7 days of
receiving the product — even without any defect. All amounts paid must be refunded
immediately, monetarily adjusted (including shipping).

What the store's policy says: TechStore states (Purchase Terms item 4.3 and FAQ)
that it does not accept returns due to change of mind. This clause violates the law.

Your rights as a consumer: Contact support within 7 calendar days of receipt,
invoking CDC Article 49. If the store refuses, file a complaint with Procon
or at consumidor.gov.br.
```

### No-contradiction case (warranty)

```
$ node chat.js "What is the warranty period for products?"
```

```
All TechStore products carry a 12-month warranty against manufacturing defects,
counted from the delivery date.

In addition to the contractual warranty, the CDC (Article 26) provides a legal
warranty of 90 days for durable goods (electronics) and 30 days for non-durable goods,
counted from receipt.

The warranty covers manufacturing defects but does not cover damage from drops,
liquids, or misuse.
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PHASE 1 — INGESTION                  │
│                                                         │
│  data/cdc.txt ──┐                                       │
│  data/termo.txt ├─► Chunker ──► OpenAI Embeddings ──►  │
│  data/faq.txt ──┘              (text-embedding-3-small) │
│                                         │               │
│                             ┌───────────▼────────────┐  │
│                             │       ChromaDB         │  │
│                             │  cdc | termo_compra    │  │
│                             │       | faq            │  │
│                             └────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│               PHASE 2 — RETRIEVAL (at query time)       │
│                                                         │
│  Question ──► Embedding ──► Parallel query (3 collections)│
│                                    │                    │
│                          CDC top-6 + terms top-6        │
│                               + faq top-6               │
│                                    │                    │
│                         assembleContext() ──► context   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                 PHASE 3 — GENERATION (LLM)              │
│                                                         │
│  System prompt (hierarchy + divergence detection rule)  │
│         + retrieved context                             │
│         + customer question                             │
│                    │                                    │
│            LLMAdapter (pluggable)                       │
│         ┌──────────┴──────────┐                        │
│  AnthropicAdapter        GeminiAdapter                  │
│  (Claude Opus 4.8)   (Gemini 2.0 Flash Lite)           │
│                    │                                    │
│              Final response                             │
│    (with ⚠️ DIVERGENCE banner when applicable)         │
└─────────────────────────────────────────────────────────┘
```

---

## Design Decisions

### Separate collections per source
The CDC, Purchase Terms, and FAQ live in **three separate ChromaDB collections** — not in a single collection with metadata filtering. This ensures the CDC never "loses" by cosine similarity to a FAQ chunk that happens to be semantically closer to a given query: each source is queried independently and gets its own allocation of chunks in context.

### Adapter pattern (embeddings and LLM)
Both the embedding and generation layers use the Strategy/Adapter pattern:

```
EmbeddingAdapter          LLMAdapter
     │                         │
OpenAIEmbeddingAdapter   AnthropicLLMAdapter
                         GeminiLLMAdapter
```

Switching providers is a single environment variable (`LLM_PROVIDER=gemini`), with no application code changes.

### LLM-based divergence detection
Contradiction detection between the CDC and store policy is a **semantic task delegated to the model itself** via the system prompt. Rule-based approaches would fail with natural language variation; the LLM understands context, synonyms, and legal implications.

### Paragraph-aware chunker
The chunker respects paragraph boundaries before reaching the maximum chunk size, avoiding cuts in the middle of legal articles. A 200-character overlap maintains semantic continuity across adjacent chunks.

---

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js 20+ (ES Modules, top-level await) |
| Vector DB | ChromaDB 0.6.3 (Docker) |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dims) |
| Default LLM | Anthropic Claude Opus 4.8 (adaptive thinking) |
| Alternate LLM | Google Gemini 2.0 Flash Lite |
| Anthropic SDK | `@anthropic-ai/sdk` |
| Google SDK | `@google/genai` |
| Env | `dotenv` |

---

## Prerequisites

- Node.js >= 20
- Docker and Docker Compose
- OpenAI API key (embeddings)
- Anthropic API key **or** Google AI Studio key (generation)

---

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd consumer-law-rag
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```dotenv
OPENAI_API_KEY=sk-...          # required (embeddings)
ANTHROPIC_API_KEY=sk-ant-...   # required if LLM_PROVIDER=anthropic
GOOGLE_API_KEY=AIza...         # required if LLM_PROVIDER=gemini
LLM_PROVIDER=anthropic         # anthropic | gemini
CHROMA_URL=http://localhost:8000
```

### 3. Start ChromaDB

```bash
docker compose up -d
```

### 4. Ingest documents

```bash
npm run ingest
# or, to recreate collections from scratch:
npm run ingest:reset
```

Expected output:
```
[cdc]          123 chunks in 2 batch(es)
[termo_compra]   3 chunks in 1 batch(es)
[faq]            4 chunks in 1 batch(es)
```

### 5. Chat with the assistant

**Single-shot mode:**
```bash
node chat.js "Do I have the right to return a product I bought online?"
```

**Interactive REPL mode:**
```bash
npm run chat
```

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run ingest` | Ingest (or idempotently re-ingest) all 3 documents |
| `npm run ingest:reset` | Drop and recreate collections, then ingest |
| `npm run query` | Inspect retrieved chunks for a question (debug) |
| `npm run chat` | Start the interactive REPL |

---

## Project Structure

```
consumer-law-rag/
├── data/
│   ├── cdc.txt              # Lei 8.078/90 — Brazilian Consumer Defense Code
│   ├── termo_compra.txt     # Fictional purchase terms (with intentional CDC contradictions)
│   └── faq.txt              # Fictional FAQ (same)
├── src/
│   ├── adapters/
│   │   ├── embedding.adapter.js          # Base interface (embeddings)
│   │   ├── openai.embedding.adapter.js   # OpenAI implementation
│   │   ├── llm.adapter.js                # Base interface (LLM)
│   │   ├── anthropic.llm.adapter.js      # Claude Opus 4.8 implementation
│   │   └── gemini.llm.adapter.js         # Gemini 2.0 Flash Lite implementation
│   ├── chunker.js           # Paragraph-aware chunker with overlap
│   ├── chroma.js            # ChromaDB client and collection helpers
│   ├── pipeline.js          # Ingestion orchestrator per source
│   ├── retriever.js         # retrieveAll() + assembleContext()
│   └── chat.js              # answer() — generation entry point
├── ingest.js                # Ingestion CLI
├── query.js                 # Retrieval inspection CLI (debug)
├── chat.js                  # Chat CLI (single-shot and REPL)
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## Suggested Test Questions

| Question | Expected behavior |
|---|---|
| "Can I return a product I didn't like?" | ⚠️ Divergence — CDC Art. 49 vs store policy |
| "I bought online. Can I cancel after shipping?" | ⚠️ Divergence — CDC Art. 49 vs FAQ |
| "What is the warranty period?" | Normal response, no divergence |
| "My product arrived defective. What should I do?" | Normal response — store and CDC agree |
| "Do discounted products have warranty?" | Normal response with legal context |

---

## Known Limitations

- **Chunking quality:** the CDC generates ~123 chunks via paragraph-aware segmentation. Articles that fall in the middle of a mixed-context chunk may have higher semantic distance for certain queries. Mitigated by setting `nResults=6`.
- **Retrieval coverage:** the system returns the top-6 most similar chunks per collection. Highly specific questions about obscure CDC articles may not surface the exact passage.
- **No conversation memory:** each question is handled independently — there is no turn history in the LLM context.

---

## License

MIT
