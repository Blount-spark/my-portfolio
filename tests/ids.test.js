import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newWorkId, tiltFromId, tapeFromId } from '../src/lib/ids.js'

test('newWorkId 符合 w-<ts36>-<2rand> 且两次不同', () => {
  const a = newWorkId(new Date(1727000000000))
  assert.match(a, /^w-[0-9a-z]{1,8}-[0-9a-z]{2}$/)
  assert.notEqual(newWorkId(), newWorkId())
})

test('tiltFromId 稳定且落在 -1.8~1.8', () => {
  const t1 = tiltFromId('w-legacy-1')
  assert.equal(t1, tiltFromId('w-legacy-1'))
  assert.ok(t1 >= -1.8 && t1 <= 1.8)
})

test('tapeFromId 稳定二值', () => {
  assert.ok(['tape-left', 'tape-right'].includes(tapeFromId('w-a')))
  assert.equal(tapeFromId('w-a'), tapeFromId('w-a'))
})
