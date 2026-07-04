export class LLMAdapter {
  /**
   * @param {string} systemPrompt
   * @param {string} userMessage
   * @returns {Promise<string>}
   */
  async chat(systemPrompt, userMessage) {
    throw new Error(`${this.constructor.name} must implement chat()`);
  }

  get providerName() {
    return this.constructor.name;
  }
}
