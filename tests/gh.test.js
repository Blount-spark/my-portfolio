import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeGh, strToB64, b64ToStr, bytesToB64, extFromType } from '../src/lib/gh.js'

const route = (handler) => async (url, opts = {}) => {
  const res = await handler(String(url), opts)
  return { status: res.status ?? 200, json: async () => res.json ?? res, headers: { get: () => null } }
}
const cfg = { owner: 'o', repo: 'r', token: 'gpat' }

test('base64 中文往返', () => assert.equal(b64ToStr(strToB64('中文🎨')), '中文🎨'))
test('extFromType', () => {
  assert.equal(extFromType('image/png'), 'png')
  assert.equal(extFromType('image/jpeg'), 'jpg')
})

test('getSite 带正确头并解码内容', async () => {
  let seen
  const gh = makeGh({ ...cfg, fetchImpl: route((url, opts) => {
    seen = { url, opts }
    return { json: { sha: 'S1', content: strToB64('{"works":[]}').replace(/(.{60})/g, '$1\n') } }
  }) })
  const { site, sha } = await gh.getSite()
  assert.equal(sha, 'S1')
  assert.deepEqual(site, { works: [] })
  assert.ok(seen.url.includes('/repos/o/r/contents/src/data/site.json'))
  assert.equal(seen.opts.headers.Authorization, 'Bearer gpat')
  assert.equal(seen.opts.headers['X-GitHub-Api-Version'], '2022-11-28')
  // GET 不带 Content-Type：带了就不是 simple request，每次读仓库都要先跑一遍 CORS 预检
  assert.equal(seen.opts.headers['Content-Type'], undefined)
})

test('401→bad_token 403→no_access 409→conflict', async () => {
  for (const [status, code] of [[401, 'bad_token'], [403, 'no_access'], [404, 'no_access'], [409, 'conflict']]) {
    const gh = makeGh({ ...cfg, fetchImpl: route(() => ({ status, json: { message: 'x' } })) })
    await assert.rejects(gh.checkAccess(), (err) => err.code === code)
  }
})

test('putSite 发 PUT：content 为 2 空格缩进 + 末尾换行的 JSON，且显式声明 Content-Type', async () => {
  const site = { works: [{ id: 'w-1', title: '中文🎨' }] }
  let seen
  const gh = makeGh({ ...cfg, fetchImpl: route((url, opts) => {
    if (opts.method === 'PUT') seen = { body: JSON.parse(opts.body), headers: opts.headers }
    return { status: 201, json: { content: { sha: 'S2' } } }
  }) })
  const out = await gh.putSite(site, 'S1')
  assert.equal(out.sha, 'S2')
  assert.equal(seen.body.sha, 'S1')
  assert.ok(seen.body.message.length > 0)
  // 存进仓库的必须是人能读、能 diff 的这一份（与 scripts/migrate-works.mjs 落盘格式逐字相同）：
  // 压成一行的话，「Git 历史随时可回滚」这个卖点就只剩机器能看了
  const content = b64ToStr(seen.body.content)
  assert.equal(content, '{\n  "works": [\n    {\n      "id": "w-1",\n      "title": "中文🎨"\n    }\n  ]\n}\n')
  assert.equal(content, JSON.stringify(site, null, 2) + '\n')
  assert.equal(content, JSON.stringify(JSON.parse(content), null, 2) + '\n') // 幂等：读回来再写出去不抖动
  // 字符串 body 默认按 text/plain 发，GitHub 可能 415 —— 写请求要显式带 JSON 头
  assert.equal(seen.headers['Content-Type'], 'application/json')
})

// ---- 补充覆盖：brief 接口块声明但上方未断言的成员（putImage / latestCommitDate /
// network 与 bad_response 两条错误码 / bytesToB64 / strToB64 分块要求） ----

test('strToB64 用分块实现：大文本不爆栈且能往返', () => {
  const big = '中文🎨'.repeat(60000) // 660000 字节，>0x8000 分块阈值；spread 版会 RangeError
  const b64 = strToB64(big)
  assert.equal(b64.length % 4, 0)
  assert.equal(b64ToStr(b64), big)
})

test('bytesToB64 直编字节，且与 strToB64 对同一段 UTF-8 结果一致', () => {
  assert.equal(bytesToB64(new Uint8Array([0, 1, 2, 253, 254, 255])), 'AAEC/f7/')
  assert.equal(bytesToB64(new TextEncoder().encode('中文🎨')), strToB64('中文🎨'))
})

test('checkAccess 成功返回 true，请求 site.json 元数据', async () => {
  let seen
  const gh = makeGh({ ...cfg, fetchImpl: route((url, opts) => {
    seen = { url, headers: opts.headers }
    return { json: { sha: 'S1' } }
  }) })
  assert.equal(await gh.checkAccess(), true)
  assert.ok(seen.url.endsWith('/repos/o/r/contents/src/data/site.json'))
  assert.equal(seen.headers.Accept, 'application/vnd.github+json')
})

test('putImage 发 PUT 到 images/works 且 body 只有 message/content', async () => {
  let seen
  const gh = makeGh({ ...cfg, fetchImpl: route((url, opts) => {
    seen = { url, method: opts.method, body: JSON.parse(opts.body), headers: opts.headers }
    return { status: 201, json: { content: { sha: 'I2' } } }
  }) })
  const bytes = new TextEncoder().encode('PNGDATA')
  const out = await gh.putImage('w-x-01-1.png', bytes, 'content: 新增图片 w-x-01-1.png')
  assert.equal(out.sha, 'I2')
  assert.equal(seen.method, 'PUT')
  assert.equal(seen.headers['Content-Type'], 'application/json')
  assert.ok(seen.url.endsWith('/repos/o/r/contents/public/images/works/w-x-01-1.png'))
  assert.deepEqual(seen.body, { message: 'content: 新增图片 w-x-01-1.png', content: bytesToB64(bytes) })
})

test('latestCommitDate 取首条提交日期，无提交返回 null', async () => {
  let url
  const gh = makeGh({ ...cfg, fetchImpl: route((u) => {
    url = u
    return { json: [{ commit: { committer: { date: '2026-09-20T08:00:00Z' } } }] }
  }) })
  assert.equal(await gh.latestCommitDate(), '2026-09-20T08:00:00Z')
  assert.ok(url.includes('/repos/o/r/commits?path=src%2Fdata%2Fsite.json'))
  const none = makeGh({ ...cfg, fetchImpl: route(() => ({ json: [] })) })
  assert.equal(await none.latestCommitDate(), null)
})

test('fetch 抛错→network，其他非 2xx→bad_response', async () => {
  const down = makeGh({ ...cfg, fetchImpl: async () => { throw new TypeError('Failed to fetch') } })
  await assert.rejects(down.getSite(), (err) => err.code === 'network')
  const boom = makeGh({ ...cfg, fetchImpl: route(() => ({ status: 500, json: { message: 'boom' } })) })
  await assert.rejects(boom.putSite({ works: [] }, 'S1'), (err) => err.code === 'bad_response')
})

// 注：GitHub 对「内容未变」的 PUT 提交并不返回 204，而是 2xx + content: null（见下方用例）。
// 本条只守住 req 层这一半：空/非 JSON 响应体不得漏出裸 SyntaxError。
test('2xx 但响应体不可解析（空体 / 非 JSON）→ req 层收敛为 bad_response', async () => {
  const gh = makeGh({ ...cfg, fetchImpl: async () => ({
    status: 204, json: async () => { throw new SyntaxError('Unexpected end of JSON input') },
  }) })
  await assert.rejects(gh.checkAccess(), (err) => err.code === 'bad_response')
})

// 方法体内取 sha 也要守住 .code 契约：Task 5 只做 setError('…：' + e.code)，
// 若此处抛裸 TypeError 会显示 "读取失败：undefined"。
test('2xx + content:null（内容未变的提交）→ putSite/putImage 抛 bad_response 而非裸 TypeError', async () => {
  const noChange = makeGh({ ...cfg, fetchImpl: route(() => ({
    status: 200, json: { content: null, commit: { sha: 'C1' } },
  })) })
  await assert.rejects(noChange.putSite({ works: [] }, 'S1'), (err) => err.code === 'bad_response')
  await assert.rejects(noChange.putImage('w-1.png', new Uint8Array([1, 2]), 'content: 新增图片'),
    (err) => err.code === 'bad_response')
  // 响应体整体不是对象（代理返回 null 之类异常体）同样不能裸抛
  const broken = makeGh({ ...cfg, fetchImpl: async () => ({ status: 200, json: async () => null }) })
  await assert.rejects(broken.putSite({ works: [] }, 'S1'), (err) => err.code === 'bad_response')
})

test('getSite：仓库内容损坏（非法 base64 / JSON 残缺 / 缺 content）→ bad_response，不外泄裸异常', async () => {
  for (const f of [
    { sha: 'S1', content: 'not!!base64@@@' },        // 非 base64 字母表 → atob 抛 InvalidCharacterError
    { sha: 'S1', content: strToB64('{ "works": [ ') }, // 合法 base64，但解码后是残缺 JSON
    { sha: 'S1' },                                    // 无 content 字段（目录列表响应 / 元数据不全）
  ]) {
    const gh = makeGh({ ...cfg, fetchImpl: route(() => ({ status: 200, json: f })) })
    await assert.rejects(gh.getSite(), (err) => err.code === 'bad_response')
  }
})
