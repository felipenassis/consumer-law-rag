export class EmbeddingAdapter {
  /** @param {string[]} texts @returns {Promise<number[][]>} */
  async embed(texts) {
    throw new Error(`${this.constructor.name} must implement embed()`);
  }

  /** @returns {number} */
  get dimensions() {
    throw new Error(`${this.constructor.name} must implement dimensions`);
  }

  get providerName() {
    return this.constructor.name;
  }
}
