// Helper: parse definition field which may be JSON array of meanings or plain string
export function parseMeanings(definition) {
  if (!definition) return []
  try {
    const parsed = JSON.parse(definition)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  return [{ part_of_speech: '', pos_abbr: '', definition, example: '' }]
}
