import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateWork, validateImage } from '../src/lib/validate.js'

const base = {
  id: 'w-x-01', title: '好', category: 'code', date: '2026-09',
  desc: 'ok', tags: ['a'], link: '#', gradient: ['#fff', '#eee'], emoji: '✨',
}
const cats = ['code', 'craft']

test('合法作品通过', () => assert.equal(validateWork(base, cats).ok, true))
test('分类/日期/标题/tags 非法逐项报错', () => {
  const r = validateWork({ ...base, category: 'nope', date: '2026-9', title: '', tags: [] }, cats)
  assert.equal(r.ok, false)
  assert.ok(r.errors.category && r.errors.date && r.errors.title && r.errors.tags)
})
test('emoji 与 img 至少要有一个', () => {
  assert.equal(validateWork({ ...base, emoji: '', img: '' }, cats).ok, false)
  assert.ok(validateWork({ ...base, emoji: '', img: '' }, cats).errors.emoji)
  assert.equal(validateWork({ ...base, emoji: '', img: '/images/works/a.png' }, cats).ok, true)
})
test('图片：>5MB 或非白名单 MIME 被拒', () => {
  assert.equal(validateImage({ name: 'a.png', type: 'image/png', size: 6 * 1024 * 1024 }).ok, false)
  assert.equal(validateImage({ name: 'a.exe', type: 'application/x-msdownload', size: 10 }).ok, false)
  assert.equal(validateImage({ name: 'a.png', type: 'image/png', size: 10 }).ok, true)
})
