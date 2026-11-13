import { test } from 'node:test'
import assert from 'node:assert/strict'
import { videoFirst } from '../src/lib/types.ts'

const l = (id: string, video_url: string | null) => ({ id, video_url })

test('lessons with a video go first, the rest keep their order', () => {
  const list = [l('a', null), l('b', 'https://youtu.be/dQw4w9WgXcQ'), l('c', ''), l('d', 'https://x.test/v.mp4'), l('e', null)]
  assert.deepEqual(videoFirst(list).map((x) => x.id), ['b', 'd', 'a', 'c', 'e'])
})

test('the original array is left untouched', () => {
  const list = [l('a', null), l('b', 'https://x.test/v.mp4')]
  videoFirst(list)
  assert.deepEqual(list.map((x) => x.id), ['a', 'b'])
})
