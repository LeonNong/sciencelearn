import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateText } from '../src/lib/memoryInput.mjs'

test('checks every character in a recognised word', () => {
  assert.deepEqual(evaluateText('hello'.split(''), 0, 'hello', 1),
    { cursor: 5, mistakes: 0, step: 'complete' })
})

test('continues a partial submission and preserves spaces and newlines', () => {
  const tokens = 'hello world\nnext'.split('')
  const first = evaluateText(tokens, 0, 'hello', 2)
  assert.equal(first.cursor, 5)
  assert.deepEqual(evaluateText(tokens, first.cursor, ' world\nnext', 2),
    { cursor: tokens.length, mistakes: 0, step: 'complete' })
})

test('easy and medium count errors without advancing past the expected character', () => {
  for (const difficulty of [1, 2]) {
    assert.deepEqual(evaluateText(['a', 'b'], 0, 'xab', difficulty),
      { cursor: 2, mistakes: 1, step: 'complete' })
  }
})

test('hard stops the entire submission at the first mistake', () => {
  assert.deepEqual(evaluateText('abc'.split(''), 0, 'axbc', 3),
    { cursor: 1, mistakes: 1, step: 'revealed' })
})

test('completion ignores remaining input and empty input makes no progress', () => {
  assert.deepEqual(evaluateText(['a'], 0, 'abc', 1),
    { cursor: 1, mistakes: 0, step: 'complete' })
  assert.deepEqual(evaluateText(['a'], 0, '', 1),
    { cursor: 0, mistakes: 0, step: 'game' })
})
