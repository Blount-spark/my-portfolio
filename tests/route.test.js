import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodeSlug } from '../src/lib/route.js'

test('decodeSlug 普通 slug 原样还原', () => {
  assert.equal(decodeSlug('w-legacy-1'), 'w-legacy-1')
  assert.equal(decodeSlug(''), '')
})

test('decodeSlug percent 编码正常还原', () => {
  assert.equal(decodeSlug('%77-legacy-1'), 'w-legacy-1')
  assert.equal(decodeSlug('%E7%BC%A0'), '缠')
})

test('decodeSlug 畸形/截断 percent 序列不抛错、原样返回（回落作品墙）', () => {
  assert.equal(decodeSlug('%'), '%')
  assert.equal(decodeSlug('%E7%BC'), '%E7%BC') // 聊天软件截断的半个汉字
  assert.equal(decodeSlug('100%'), '100%')
})
