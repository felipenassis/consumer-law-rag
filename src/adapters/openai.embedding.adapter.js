import OpenAI from 'openai';
import { EmbeddingAdapter } from './embedding.adapter.js';

const RETRY_DELAYS_MS = [1000, 2000, 4000];

export class OpenAIEmbeddingAdapter extends EmbeddingAdapter {
  #client;
  #model;
  #batchSize;

  constructor({ model = 'text-embedding-3-small', batchSize = 100 } = {}) {
    super();
    this.#client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.#model = model;
    this.#batchSize = batchSize;
  }

  get providerName() { return `OpenAI/${this.#model}`; }
  get dimensions()   { return 1536; }

  async embed(texts) {
    const vectors = [];
    for (let i = 0; i < texts.length; i += this.#batchSize) {
      const batch = texts.slice(i, i + this.#batchSize);
      const res = await this.#embedWithRetry(batch);
      vectors.push(...res.data.map(d => d.embedding));
    }
    return vectors;
  }

  async #embedWithRetry(batch) {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        return await this.#client.embeddings.create({ model: this.#model, input: batch });
      } catch (err) {
        if (err.status === 429 && attempt < RETRY_DELAYS_MS.length) {
          await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        } else {
          throw err;
        }
      }
    }
  }
}
