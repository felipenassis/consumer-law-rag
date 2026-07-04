import { GoogleGenAI } from '@google/genai';
import { LLMAdapter } from './llm.adapter.js';

export class GeminiLLMAdapter extends LLMAdapter {
  #client;
  #model;
  #maxTokens;

  constructor({ model = 'gemini-2.0-flash', maxTokens = 2048 } = {}) {
    super();
    this.#client = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
    this.#model = model;
    this.#maxTokens = maxTokens;
  }

  get providerName() { return `Google/${this.#model}`; }

  async chat(systemPrompt, userMessage) {
    const response = await this.#client.models.generateContent({
      model: this.#model,
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: this.#maxTokens,
      },
    });
    return response.text;
  }
}
