import { useEffect, useState } from 'react'
import { makeGh } from '../lib/gh.js'
import { SITE_REPO } from '../data/config.js'

// ---------- 会话存取：localStorage 键 mp-admin-auth，形状 { owner, repo, token } ----------
const AUTH_KEY = 'mp-admin-auth'

const validAuth = (a) =>
  !!a && typeof a.owner === 'string' && typeof a.repo === 'string' && typeof a.token === 'string' &&
  !!a.owner.trim() && !!a.token.trim()

export function getAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const a = JSON.parse(raw)
    return validAuth(a) ? { owner: a.owner, repo: a.repo, token: a.token } : null
  } catch {
    // 手改过的脏数据、或浏览器禁用了 storage：一律当作没登录，别让整个后台崩掉
    return null
  }
}

export function setAuth(auth) {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth))
  } catch {
    // 隐私模式写不进去：本次会话照常可用，只是下次进来还要再输一遍
  }
}

export function clearAuth() {
  try {
    localStorage.removeItem(AUTH_KEY)
  } catch {
    // 同上，读不到就当已经清干净了
  }
}

// ---------- 错误文案：gh.js 的契约是「抛出的错误一定带 .code」 ----------
const ERROR_CN = {
  bad_token: '令牌无效或过期',
  no_access: '该令牌没有此仓库的读写权限（需 fine-grained + Contents: RW）',
  conflict: '内容正被其他改动覆盖，请先刷新再试一次',
  network: '网络不通',
  bad_response: 'GitHub 返回了读不懂的内容，请稍后重试',
}

export function errorText(code) {
  return ERROR_CN[code] || '连不上仓库，请检查网络与仓库地址后重试'
}

// 父级传下来的是一句话（如「读取失败：network」），从中认出 code 换成人话；认不出就原样显示
export function errorTextFrom(text) {
  const msg = String(text || '')
  const code = Object.keys(ERROR_CN).find((c) => msg.includes(c))
  return code ? ERROR_CN[code] : msg
}

// ---------- 令牌门禁卡 ----------
export default function TokenGate({ onDone }) {
  const [owner, setOwner] = useState(SITE_REPO.owner)
  const [repo, setRepo] = useState(SITE_REPO.repo)
  const [token, setToken] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  const configured = !!(SITE_REPO.owner && SITE_REPO.repo)

  // 从墙页脚点进来时页面还停在底部，卡片在顶上 —— 和详情页一样回到顶部
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [])

  async function enter(e) {
    e.preventDefault()
    if (checking) return
    const draft = { owner: owner.trim(), repo: repo.trim(), token: token.trim() }
    if (!draft.owner || !draft.repo) {
      setError('还没配好仓库地址：请先在 src/data/config.js 填 owner / repo，或在上面手动填。')
      return
    }
    if (!draft.token) {
      setError('还没有填令牌。')
      return
    }
    setError('')
    setChecking(true)
    try {
      await makeGh(draft).checkAccess()
      // 验证通过才落盘：错令牌不会被留在 localStorage 里
      setAuth(draft)
      onDone(draft)
    } catch (err) {
      setError(errorText(err.code))
    } finally {
      setChecking(false)
    }
  }

  return (
    <form className="admin-card" onSubmit={enter}>
      <span className="tape tape-left" />
      <h2 className="admin-card-title">✏️ 进入后台</h2>
      <p className="admin-card-sub">贴上你的 GitHub 令牌，验证通过就能直接改这面墙。</p>

      {!configured && (
        <p className="admin-warn">
          仓库还没配置好：请在 <code>src/data/config.js</code> 里回填 owner / repo（建仓库那一步之后做）。
        </p>
      )}

      <label className="admin-field">
        <span>仓库主人 owner</span>
        <input className="admin-input" value={owner} onChange={(e) => setOwner(e.target.value)}
          placeholder="GitHub 用户名" autoComplete="off" spellCheck={false} />
      </label>
      <label className="admin-field">
        <span>仓库名 repo</span>
        <input className="admin-input" value={repo} onChange={(e) => setRepo(e.target.value)}
          placeholder="仓库名" autoComplete="off" spellCheck={false} />
      </label>
      <label className="admin-field">
        <span>fine-grained 令牌</span>
        <input className="admin-input" type="password" value={token} onChange={(e) => setToken(e.target.value)}
          placeholder="只在本地保存，验证通过才记住" autoComplete="off" spellCheck={false} />
      </label>

      {error && <p className="admin-error" role="alert">⚠️ {error}</p>}

      <button className="admin-btn primary" type="submit" disabled={checking}>
        {checking ? '正在验证…' : '进入后台 →'}
      </button>

      <p className="admin-tip">
        令牌建议只授权这一个仓库、权限只勾 Contents: Read and write，并设个过期日。
        它只存在这台浏览器的 localStorage 里，不经过任何服务器；换设备要重输一次。
      </p>
      <a className="admin-back" href="#/">← 先回去看看墙</a>
    </form>
  )
}
