import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detailToMd, workToEntry, buildSite } from '../src/lib/migrate.js'

test('story 段落以空行拼接', () =>
  assert.equal(detailToMd({ story: ['一', '二'] }), '一\n\n二'))

test('gallery 转图片行+斜体说明', () => {
  const md = detailToMd({ story: ['x'], gallery: ['/images/a.png'], captions: ['说明'] })
  assert.match(md, /!\[说明\]\(\/images\/a\.png\)/)
  assert.match(md, /\*说明\*/)
})

test('workToEntry：数字id→w-legacy、detail→bodyMd、无 detail 不出 bodyMd', () => {
  const e = workToEntry({ id: 1, title: 't', detail: { story: ['a'] }, gradient: ['#a', '#b'], tags: ['x'] })
  assert.equal(e.id, 'w-legacy-1')
  assert.equal(e.bodyMd, 'a')
  assert.equal(workToEntry({ id: 2 }).bodyMd, undefined)
})

test('buildSite 按 date 倒序、剔除 all 分类', () => {
  const s = buildSite({
    categories: [{ id: 'all' }, { id: 'code' }],
    works: [{ date: '2026-01' }, { date: '2026-09' }],
  })
  assert.deepEqual(s.categories.map((c) => c.id), ['code'])
  assert.equal(s.works[0].date, '2026-09')
})
