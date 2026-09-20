const API = 'https://api.github.com'
export const SITE_PATH = 'src/data/site.json'

// 大文本按块 push，避免 spread 爆栈（V8 实参上限约 12.5 万，整串 spread 会 RangeError）
export function strToB64(s) {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
export function b64ToStr(b64) {
  const bin = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}
export const bytesToB64 = (u8) => {
  let bin = ''
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000))
  return btoa(bin)
}
export function extFromType(t) {
  return { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[t]
}

function err(code) { const e = new Error(code); e.code = code; return e }

// PUT 提交成功响应里的新 blob sha：GitHub 对「内容未变」的提交返回 2xx + content: null
// （不是 204），此时取不到 sha。宁可显式 bad_response，也不能静默返回 undefined 丢新 sha。
function contentSha(r) {
  const sha = r?.content?.sha
  if (!sha) throw err('bad_response')
  return sha
}

export function makeGh({ owner, repo, token, fetchImpl = fetch }) {
  const base = `${API}/repos/${owner}/${repo}`
  async function req(path, opts = {}) {
    let res
    try {
      res = await fetchImpl(base + path, {
        ...opts,
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          Authorization: `Bearer ${token}`,
          // 写请求显式声明 JSON：body 是字符串时浏览器按 text/plain 发，GitHub 可能回 415。
          // 只给非 GET 加：GET 带上它会从 simple request 变成先跑一次 CORS 预检，白涨一个往返。
          ...(opts.method && opts.method.toUpperCase() !== 'GET'
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...(opts.headers || {}),
        },
      })
    } catch { throw err('network') }
    if (res.status === 401) throw err('bad_token')
    if (res.status === 403 || res.status === 404) throw err('no_access')
    if (res.status === 409) throw err('conflict')
    // 用 status 区间判定而非 res.ok：注入的 fake fetch（测试用）不带 Response 原型上的 ok
    if (res.status < 200 || res.status >= 300) throw err('bad_response')
    // 2xx 但响应体不可解析（204 空体、代理返回 HTML 错误页等）在此会抛裸 SyntaxError，
    // 收敛为 bad_response 以保证「所有失败都带 .code」的对外契约。
    // 注意：内容未变的 PUT 提交并不走这条分支 —— GitHub 返回 2xx + content: null，
    // 由 contentSha 处理。
    try {
      return await res.json()
    } catch { throw err('bad_response') }
  }
  return {
    async checkAccess() { await req(`/contents/${SITE_PATH}`); return true },
    async getSite() {
      const f = await req(`/contents/${SITE_PATH}`)
      // 仓库里的 site.json 本身可能损坏（非法 base64 / JSON 残缺 / 无 content 字段）：
      // 解码与解析都在此收敛为 bad_response，保证「所有失败都带 .code」的对外契约
      let site
      try {
        site = JSON.parse(b64ToStr(f.content))
      } catch { throw err('bad_response') }
      return { site, sha: f.sha }
    },
    async putSite(site, sha) {
      // 与 scripts/migrate-works.mjs 落盘格式逐字一致（2 空格缩进 + 末尾换行）：
      // 「仓库即数据库」卖的就是 Git 历史可读，压缩成一行的 diff 没法看也没法手工回滚。
      const r = await req(`/contents/${SITE_PATH}`, {
        method: 'PUT',
        body: JSON.stringify({
          message: 'content: 更新灵感实践',
          content: strToB64(JSON.stringify(site, null, 2) + '\n'),
          sha,
        }),
      })
      return { sha: contentSha(r) }
    },
    async putImage(name, bytes, message) {
      const r = await req(`/contents/public/images/works/${name}`, {
        method: 'PUT',
        body: JSON.stringify({ message, content: bytesToB64(bytes) }),
      })
      return { sha: contentSha(r) }
    },
    async latestCommitDate() {
      const r = await req(`/commits?path=${encodeURIComponent(SITE_PATH)}&per_page=1`)
      return r[0]?.commit?.committer?.date ?? null
    },
  }
}
