import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseWordList, shuffle } from '../src/lib/flashcards.ts'

test('table with a header: columns found by name', () => {
  const cards = parseWordList(['| Word | Definition | Example |', '|---|---|---|', '| **abate** | to become less intense | The storm abated. |', '| candid | honest, direct | |'].join('\n'))
  assert.deepEqual(cards, [
    { word: 'abate', definition: 'to become less intense', example: 'The storm abated.' },
    { word: 'candid', definition: 'honest, direct' },
  ])
})

test('the format of the word lists in the database ("Day 1: Essential SAT Words")', () => {
  const text = [
    '## Day 1 Vocabulary',
    '',
    'Learn these 8 high-frequency SAT words today.',
    '',
    '| Word | Meaning | Example |',
    '|------|---------|---------|',
    '| **Aberrant** | Departing from normal | His *aberrant* behavior alarmed his teachers. |',
    '| **Abate** | Become less intense | The storm gradually *abated*. |',
  ].join('\n')
  assert.deepEqual(parseWordList(text), [
    { word: 'Aberrant', definition: 'Departing from normal', example: 'His aberrant behavior alarmed his teachers.' },
    { word: 'Abate', definition: 'Become less intense', example: 'The storm gradually abated.' },
  ])
})

test('table with columns in another order (Russian headers)', () => {
  const cards = parseWordList(['| Значение | Слово |', '| --- | --- |', '| смягчать | mitigate |'].join('\n'))
  assert.deepEqual(cards, [{ word: 'mitigate', definition: 'смягчать' }])
})

test('list lines with dashes, colons, numbers, bold and part of speech', () => {
  const text = [
    '## SAT Words 1',
    '',
    '- **abate** (v.) — to become less intense',
    '1. benevolent: kind and generous',
    'cogent - clear and convincing',
    '* *diligent* – careful and hardworking',
  ].join('\n')
  assert.deepEqual(parseWordList(text), [
    { word: 'abate', pos: 'v.', definition: 'to become less intense' },
    { word: 'benevolent', definition: 'kind and generous' },
    { word: 'cogent', definition: 'clear and convincing' },
    { word: 'diligent', definition: 'careful and hardworking' },
  ])
})

test('an example line belongs to the card above it', () => {
  const cards = parseWordList(['**ephemeral** — lasting a very short time', 'Example: Fame on social media is often ephemeral.', 'frugal — careful with money', '*She lived a frugal life.*'].join('\n'))
  assert.equal(cards[0].example, 'Fame on social media is often ephemeral.')
  assert.equal(cards[1].example, 'She lived a frugal life.')
})

test('hyphenated words are not split and long sentences are not cards', () => {
  const cards = parseWordList(['well-being — health and happiness', 'This is a long introduction sentence that explains the list - read it carefully.', 'Study these words every day.'].join('\n'))
  assert.deepEqual(cards, [{ word: 'well-being', definition: 'health and happiness' }])
})

test('duplicates are removed and empty text gives no cards', () => {
  assert.equal(parseWordList('abate — less\nAbate — less intense').length, 1)
  assert.deepEqual(parseWordList(''), [])
})

test('shuffle keeps every item and does not change the input', () => {
  const input = [1, 2, 3, 4, 5]
  let seed = 1
  const out = shuffle(input, () => ((seed = (seed * 16807) % 2147483647) / 2147483647))
  assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5])
  assert.deepEqual(input, [1, 2, 3, 4, 5])
})
