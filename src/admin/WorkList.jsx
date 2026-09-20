import { useEffect, useState } from 'react'
import { assetSrc } from '../lib/asset.js'
import { errorText, errorTextFrom } from './TokenGate.jsx'

// site.json 里的分类是有限集合（没有前台那个「✨ 全部」伪条目）。
// 分类被删掉或手写错时，这里只如实显示原始 id，绝不兜底成「全部」骗人。
function catOf(site, id) {
  return (site && Array.isArray(site.categories) ? site.categories : []).find((c) => c.id === id) || null
}

const pad = (n) => String(n).padStart(2, '0')
function localTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function thumbStyle(gradient) {
  const g = Array.isArray(gradient) ? gradient : []
  if (!g[0]) return { background: '#EEE6D6' }
  return { background: `linear-gradient(135deg, ${g[0]}, ${g[1] || g[0]})` }
}

export default function WorkList({ gh, site, error, auth, onNew, onEdit, onReload, onLogout, onChanged }) {
  const [busy, setBusy] = useState('') // 正在提交的那一行的 id（'' 表示空闲）
  const [notice, setNotice] = useState('')
  const [committedAt, setCommittedAt] = useState('')

  // 和门禁卡一样：从墙页脚跳进来时页面还停在底部，回到顶部才看得到列表
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [])

  // spec §5：顶部显示当前内容对应的最近一次提交时间。拉不到就算了，不影响主流程。
  useEffect(() => {
    let alive = true
    gh.latestCommitDate()
      .then((d) => { if (alive && d) setCommittedAt(localTime(d)) })
      .catch(() => {})
    return () => { alive = false }
  }, [gh, site])

  const works = (site && Array.isArray(site.works) ? site.works : [])

  async function remove(work) {
    if (busy) return
    const ok = window.confirm(`删除《${work.title || work.id}》？\n这会直接提交到仓库（约 1~2 分钟后前台就不再显示）。真删错了可以用 Git 历史找回。`)
    if (!ok) return
    setBusy(work.id)
    setNotice('')
    try {
      // 删除也是一次写库：先拉最新的 site + blob sha，别拿手上这份可能已经旧了的工作区去覆盖别人的改动
      const fresh = await gh.getSite()
      const list = Array.isArray(fresh.site.works) ? fresh.site.works : []
      const next = { ...fresh.site, works: list.filter((w) => w.id !== work.id) }
      await gh.putSite(next, fresh.sha)
      setNotice('🗑️ 已提交，站点约 1~2 分钟后自动更新。')
      onChanged()
    } catch (e) {
      setNotice(e.code === 'conflict'
        ? '⚠️ 这一条刚好被其他改动抢先了：请先点「刷新」拿到最新内容，再删一次。'
        : `⚠️ ${errorText(e.code)}`)
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="admin">
      <header className="admin-top">
        <div className="admin-top-text">
          <h2 className="admin-title">🧷 灵感实践 · 后台</h2>
          <p className="admin-sub">
            <span className="admin-repo">{auth.owner}/{auth.repo}</span>
            <span>共 {works.length} 件</span>
            {committedAt && <span>最近一次提交 {committedAt}</span>}
          </p>
        </div>
        <div className="admin-actions">
          <button className="admin-btn primary" onClick={onNew} disabled={!!busy}>＋ 新的灵感实践</button>
          <button className="admin-btn" onClick={onReload} disabled={!!busy}>刷新</button>
          <a className="admin-btn ghost" href="#/">看前台</a>
          <button className="admin-btn ghost" onClick={onLogout} disabled={!!busy}>退出登录</button>
        </div>
      </header>

      {notice && <p className="admin-notice">{notice}</p>}
      {error && (
        <div className="admin-card wide admin-error-card">
          <p className="admin-error" role="alert">⚠️ {errorTextFrom(error)}</p>
          <p className="admin-tip">{error}</p>
          <div className="admin-actions">
            <button className="admin-btn" onClick={onReload}>再试一次</button>
            <button className="admin-btn ghost" onClick={onLogout}>换个令牌登录</button>
          </div>
        </div>
      )}

      {!site && !error && (
        <div className="admin-card wide">
          <p className="admin-loading">📥 正在从仓库取最新内容…</p>
        </div>
      )}

      {site && !error && works.length === 0 && (
        <div className="admin-card wide">
          <p className="admin-empty-title">🪴 墙上还空着</p>
          <p className="admin-tip">仓库里的 <code>src/data/site.json</code> 一件作品都没有，点上面的「＋ 新的灵感实践」挂第一件。</p>
        </div>
      )}

      {works.length > 0 && (
        <ul className="admin-list">
          {works.map((w) => {
            const cat = catOf(site, w.category)
            return (
              <li className="admin-row" key={w.id}>
                <span className="admin-thumb" style={thumbStyle(w.gradient)}>
                  {w.img ? <img src={assetSrc(w.img)} alt="" loading="lazy" /> : <span className="admin-thumb-emoji">{w.emoji || '🗒️'}</span>}
                </span>
                <span className="admin-row-main">
                  <span className="admin-row-title">{w.title || '（还没写标题）'}</span>
                  <span className="admin-row-meta">
                    {cat
                      ? <span className="admin-chip" style={{ background: cat.color }}>{cat.emoji} {cat.label}</span>
                      : <span className="admin-chip unknown">未知分类 {w.category || '（空）'}</span>}
                    <time className="admin-row-date">{w.date || '—'}</time>
                  </span>
                  {Array.isArray(w.tags) && w.tags.length > 0 && (
                    <span className="card-tags admin-row-tags">
                      {w.tags.map((t) => <span key={t} className="tag">#{t}</span>)}
                    </span>
                  )}
                </span>
                <span className="admin-row-ops">
                  <button className="admin-btn" onClick={() => onEdit(w)} disabled={!!busy}>编辑</button>
                  <button
                    className="admin-btn danger"
                    onClick={() => remove(w)}
                    disabled={!!busy}
                  >
                    {busy === w.id ? '删除中…' : '删除'}
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <p className="admin-foot-tip">改完就是往仓库提一次 commit，Actions 构建约 1~2 分钟后前台生效。</p>
    </section>
  )
}
