import Anthropic from '@anthropic-ai/sdk';
import { LLMAdapter } from './llm.adapter.js';

export class AnthropicLLMAdapter extends LLMAdapter {
  #client;
  #model;
  #maxTokens;

  constructor({ model = 'claude-opus-4-8', maxTokens = 2048 } = {}) {
    super();
    this.#client = new Anthropic();
    this.#model = model;
    this.#maxTokens = maxTokens;
  }

  get providerName() { return `Anthropic/${this.#model}`; }

  async chat(systemPrompt, userMessage) {
    const stream = this.#client.messages.stream({
      model: this.#model,
      max_tokens: this.#maxTokens,
      thinking: { type: 'adaptive' },
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    const msg = await stream.finalMessage();
    return msg.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');
  }
}
