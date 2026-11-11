// Every UI string passed to tr('…') must have a Russian and a Kazakh translation with the same {placeholders}.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const i18n = readFileSync(join(root, 'src/lib/i18n.tsx'), 'utf8').replace(/\r\n/g, '\n')
const start = i18n.indexOf('const D: Record<string, [string, string]> = {')
const from = i18n.indexOf('{', start)
const to = i18n.indexOf('\n}\n', from) + 2
const D = new Function('return ' + i18n.slice(from, to))()

const placeholders = (s) => (s.match(/\{[a-z]+\}/g) || []).sort().join(',')

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? (f === 'admin' ? [] : files(p)) : /\.tsx?$/.test(f) ? [p] : []
  })
}

// tr('literal') and tr("literal") calls in the student-facing code (admin screens are English only)
function usedKeys() {
  const keys = new Map()
  const re = /\btr\(\s*(['"])((?:\\.|(?!\1).)*)\1/g
  for (const f of files(join(root, 'src'))) {
    const text = readFileSync(f, 'utf8')
    const add = (key) => !keys.has(key) && keys.set(key, f.slice(root.length))
    for (const m of text.matchAll(re)) add(m[2].replace(/\\(['"\\])/g, '$1'))
    // strings translated later with tr(x): student menu labels, NavCard labels, notification titles and texts
    if (f.endsWith('Layouts.tsx')) {
      const student = text.split('/* ---------- Admin shell')[0]
      for (const m of student.matchAll(/(?<![-\w])label: '([^']+)'/g)) add(m[1])
    }
    for (const m of text.matchAll(/<NavCard[^>]*?\slabel="([^"]+)"/g)) add(m[1])
    if (f.endsWith('notifications.ts')) {
      for (const line of text.split('\n').filter((l) => /\b(title|body):/.test(l) && !/raw: true/.test(l) && !/n\.(title|body)/.test(l))) {
        for (const m of line.matchAll(/(?:title|body):\s*(?:[^'\n]*\?\s*)?'([^']+)'(?:\s*:\s*[^'\n]*\?\s*'([^']+)'\s*:\s*'([^']+)'|\s*:\s*'([^']+)')?/g)) {
          for (const s of m.slice(1)) if (s) add(s)
        }
        for (const m of line.matchAll(/\|\|\s*'([^']+)'/g)) add(m[1])
      }
    }
  }
  return keys
}

test('the dictionary has entries', () => {
  assert.ok(Object.keys(D).length > 100)
})

test('every translation keeps the placeholders of its key', () => {
  const bad = []
  for (const [k, [ru, kk]] of Object.entries(D)) {
    if (placeholders(k) !== placeholders(ru)) bad.push(`RU ${k} -> ${ru}`)
    if (placeholders(k) !== placeholders(kk)) bad.push(`KK ${k} -> ${kk}`)
    if (!ru.trim() || !kk.trim()) bad.push(`empty: ${k}`)
  }
  assert.deepEqual(bad, [])
})

test('every tr() string in the app is translated', () => {
  const missing = [...usedKeys()].filter(([k]) => !(k in D)).map(([k, f]) => `${f}: ${k}`)
  assert.deepEqual(missing, [])
})
