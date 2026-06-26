/**
 * Paragraph-aware text splitter.
 *
 * Splits on blank lines (\n\n+), greedily groups paragraphs until chunkSize
 * is reached, then seeds the next chunk with the trailing `overlap` chars of
 * the previous one. Avoids mid-sentence cuts common in legal text.
 *
 * @param {string} text
 * @param {{ chunkSize?: number, overlap?: number }} opts
 * @returns {string[]}
 */
export function chunkText(text, {
  chunkSize = Number(process.env.CHUNK_SIZE)  || 1000,
  overlap   = Number(process.env.CHUNK_OVERLAP) || 200,
} = {}) {
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let buffer = '';

  for (const para of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${para}` : para;

    if (candidate.length > chunkSize && buffer) {
      chunks.push(buffer);
      const seed = buffer.slice(-overlap);
      buffer = seed ? `${seed}\n\n${para}` : para;
    } else {
      buffer = candidate;
    }
  }

  if (buffer) chunks.push(buffer);

  return chunks;
}
