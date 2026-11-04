// Evaluate a committed chunk with a local cursor: React state updates are batched.
export function evaluateText(tokens, cursor, text, difficulty) {
  let mistakes = 0
  for (const character of text.split('')) {
    if (cursor >= tokens.length) break
    if (character === tokens[cursor]) {
      cursor += 1
    } else {
      mistakes += 1
      if (difficulty === 3) return { cursor, mistakes, step: 'revealed' }
    }
  }
  return { cursor, mistakes, step: cursor >= tokens.length ? 'complete' : 'game' }
}
