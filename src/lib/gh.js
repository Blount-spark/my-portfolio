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
          ...(opts.headers || {}),
        },
      })
    } catch { throw err('network') }
    if (res.status === 401) throw err('bad_token')
    if (res.status === 403 || res.status === 404) throw err('no_access')
    if (res.status === 409) throw err('conflict')
    // 用 status 区间判定而非 res.ok：注入的 fake fetch（测试用）不带 Response 原型上的 ok
    if (res.status < 200 || res.status >= 300) throw err('bad_response')
    // 204 No Content（内容未变的提交）与代理返回的非 JSON 都会在此抛裸 SyntaxError，
    // 收敛为 bad_response 以保证「所有失败都带 .code」的对外契约
    try {
      return await res.json()
    } catch { throw err('bad_response') }
  }
  return {
    async checkAccess() { await req(`/contents/${SITE_PATH}`); return true },
    async getSite() {
      const f = await req(`/contents/${SITE_PATH}`)
      return { site: JSON.parse(b64ToStr(f.content)), sha: f.sha }
    },
    async putSite(site, sha) {
      const r = await req(`/contents/${SITE_PATH}`, {
        method: 'PUT',
        body: JSON.stringify({ message: 'content: 更新灵感实践', content: strToB64(JSON.stringify(site)), sha }),
      })
      return { sha: r.content.sha }
    },
    async putImage(name, bytes, message) {
      const r = await req(`/contents/public/images/works/${name}`, {
        method: 'PUT',
        body: JSON.stringify({ message, content: bytesToB64(bytes) }),
      })
      return { sha: r.content.sha }
    },
    async latestCommitDate() {
      const r = await req(`/commits?path=${encodeURIComponent(SITE_PATH)}&per_page=1`)
      return r[0]?.commit?.committer?.date ?? null
    },
  }
}
