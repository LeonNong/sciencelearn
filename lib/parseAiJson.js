/** Parse JSON from an LLM text reply (markdown fences, trailing commas). */
function parseAiJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty AI response');
  }

  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const candidates = [cleaned];
  const block = cleaned.match(/\{[\s\S]*\}/);
  if (block?.[0] && block[0] !== cleaned) candidates.push(block[0]);

  let lastErr;
  for (const raw of candidates) {
    try {
      const normalized = raw.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(normalized);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('No JSON object in AI response');
}

module.exports = { parseAiJson };
