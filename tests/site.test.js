import { test } from 'node:test'
import assert from 'node:assert/strict'
import site from '../src/data/site.json' with { type: 'json' }
import { validateWork } from '../src/lib/validate.js'

// 仓库里真正随包发出去的这一份 site.json 的内容契约（deploy.yml: npm ci → npm test → build）。
// 前台与后台都是「构建时把 site.json 打进产物」，手改错一个字段（tags 写成字符串、
// gradient 少一色、分类 id 打错）过去会一路绿到线上、渲染时才炸成白屏；
// 现在它在 CI 这一层就红，且红在哪一条哪一格都写在断言消息里。

const isStr = (v) => typeof v === 'string' && v.trim() !== ''

test('site.json：分类非空，且每条 id/label/emoji/color 齐全、id 不重复', () => {
  assert.ok(Array.isArray(site.categories), 'categories 必须是数组')
  assert.ok(site.categories.length > 0, 'categories 不能为空：前台筛选条与后台下拉都靠它')
  const seen = new Set()
  for (const c of site.categories) {
    for (const k of ['id', 'label', 'emoji', 'color']) {
      assert.ok(isStr(c?.[k]), `分类 ${c?.id ?? '?'} 的 ${k} 不能为空`)
    }
    assert.ok(!seen.has(c.id), `分类 id 重复：${c.id}`)
    seen.add(c.id)
  }
})

test('site.json：作品非空，tags 是数组、gradient 是两色', () => {
  assert.ok(Array.isArray(site.works), 'works 必须是数组')
  assert.ok(site.works.length > 0, 'works 不能为空')
  const ids = new Set()
  for (const w of site.works) {
    assert.ok(isStr(w.id), '每条作品都要有 id（详情路由与编辑定位都用它）')
    assert.ok(!ids.has(w.id), `作品 id 重复：${w.id}`)
    ids.add(w.id)
    assert.ok(Array.isArray(w.tags), `${w.id}: tags 必须是数组（写成字符串会让卡片渲染崩）`)
    assert.ok(Array.isArray(w.gradient) && w.gradient.length === 2, `${w.id}: gradient 必须是起止两色`)
    assert.ok(w.gradient.every(isStr), `${w.id}: gradient 两色都得是颜色字符串`)
  }
})

test('site.json：每条作品都过后台同一套校验（validateWork）', () => {
  const categoryIds = site.categories.map((c) => c.id)
  for (const w of site.works) {
    const v = validateWork(w, categoryIds)
    assert.equal(v.ok, true, `${w.id}（${w.title}）不合格：${JSON.stringify(v.errors)}`)
  }
})

test('site.json：date 倒序（墙上就是按这个顺序排的）', () => {
  const dates = site.works.map((w) => w.date)
  const sorted = [...dates].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
  assert.deepEqual(dates, sorted, '写入时按 date 倒序排好（spec §3.1），手改顺序请连同这里一起改')
})
