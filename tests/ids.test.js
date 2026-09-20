import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newWorkId, tiltFromId, tapeFromId } from '../src/lib/ids.js'

// npm test 是 deploy 闸门（deploy.yml: npm ci → npm test → npm run build），
// 所以这里一条都不能靠运气：id 的「两次不同」必须用显式不同的时刻来证，
// 同毫秒下那 1/1296 的随机尾撞车概率不能留给主干去踩。
test('newWorkId 形状：w-<ts36>-<2位随机>', () => {
  assert.match(newWorkId(new Date(1727000000000)), /^w-[0-9a-z]{1,8}-[0-9a-z]{2}$/)
  assert.match(newWorkId(), /^w-[0-9a-z]{1,8}-[0-9a-z]{2}$/)
})

test('newWorkId 时刻不同则必不同（ts36 段决定，与随机尾无关）', () => {
  const a = newWorkId(new Date(1000))
  const b = newWorkId(new Date(1001))
  assert.notEqual(a, b)
  assert.equal(a.split('-')[1], (1000).toString(36))
  assert.equal(b.split('-')[1], (1001).toString(36))
})

test('newWorkId 同一毫秒靠随机尾区分；随机尾确实取自 Math.random，取不到时回落 zz', () => {
  const real = Math.random
  const at = new Date(1727000000000)
  const ts = at.getTime().toString(36)
  // parseInt(tail,36)/36^2 反推出 toString(36).slice(2,4) === tail 的那个随机数
  const stub = (tail) => () => parseInt(tail, 36) / 36 ** tail.length
  try {
    Math.random = stub('aa')
    assert.equal(newWorkId(at), `w-${ts}-aa`)
    assert.equal(newWorkId(at), `w-${ts}-aa`) // 同一随机数 → 同一个 id，说明差异只可能来自随机尾
    Math.random = stub('bb')
    assert.equal(newWorkId(at), `w-${ts}-bb`)
    assert.notEqual(newWorkId(at), `w-${ts}-aa`)
    Math.random = () => 0 // (0).toString(36) === '0' → slice(2,4) 为空 → 回落 'zz'
    assert.equal(newWorkId(at), `w-${ts}-zz`)
  } finally {
    Math.random = real
  }
  assert.match(newWorkId(at), /^w-[0-9a-z]{1,8}-[0-9a-z]{2}$/) // 还原后再跑一次，桩没漏
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
