import { useMemo, useState, useEffect, useRef } from 'react'
import site from './data/site.json'
import PROFILE from './data/profile.js'
import { tiltFromId, tapeFromId } from './lib/ids.js'
import { decodeSlug } from './lib/route.js'
import Markdown from './components/Markdown.jsx'
import AdminApp from './admin/AdminApp.jsx'

// ---------- 数据源：site.json（后台提交唯一写入的文件，见 spec §3） ----------
const CATEGORIES = [{ id: 'all', label: '全部', emoji: '✨', color: '#6C5CE7' }, ...site.categories]
const WORKS = site.works

// ---------- 小工具 ----------
const catById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0]

// 极简 hash 路由：'' 表示作品墙，'#/work/w-legacy-1' 表示该 slug 作品的详情页
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

// ---------- 入场动画 hook ----------
function useReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add('revealed')
          io.disconnect()
        }
      },
      { threshold: 0.12 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}

// ---------- 标题：每个字一张彩色贴纸 ----------
function StickerTitle({ text }) {
  const colors = ['#FF6B6B', '#F4A62A', '#2EC4B6', '#6C5CE7', '#E84393', '#0984E3']
  return (
    <h1 className="sticker-title" aria-label={text}>
      {text.split('').map((ch, i) =>
        ch === ' ' ? (
          <span key={i} className="sticker-space"> </span>
        ) : (
          <span
            key={i}
            className="sticker-char"
            style={{
              '--c': colors[i % colors.length],
              '--r': `${((i * 13) % 7) - 3}deg`,
              animationDelay: `${i * 60}ms`,
            }}
          >
            {ch}
          </span>
        )
      )}
    </h1>
  )
}

// ---------- 顶部 ----------
function Hero() {
  return (
    <header className="hero">
      <span className="doodle d1">✂️</span>
      <span className="doodle d2">📌</span>
      <span className="doodle d3">🌈</span>
      <span className="doodle d4">💡</span>
      <span className="doodle d5">🧩</span>
      <StickerTitle text="灵感杂货铺" />
      <p className="hero-sub">
        {PROFILE.tagline} —— 这里不分类别、不设边界，
        <br className="hide-mobile" />
        做出来的一切都值得被挂上墙。
      </p>
      <div className="hero-stats">
        <span className="stat">🧱 {WORKS.length} 件作品</span>
        <span className="stat">🗂️ {CATEGORIES.length - 1} 个领域</span>
        <span className="stat">🕐 持续上新</span>
      </div>
    </header>
  )
}

// ---------- 跑马灯 ----------
function Ticker() {
  const items = WORKS.map((w) => `${catById(w.category).emoji} ${w.title}`)
  const line = items.join(' ✦ ')
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        <span>{line} ✦ </span>
        <span>{line} ✦ </span>
      </div>
    </div>
  )
}

// ---------- 分类筛选 ----------
function FilterBar({ active, onChange }) {
  return (
    <nav className="filter-bar" aria-label="作品分类">
      {CATEGORIES.map((c) => {
        const count =
          c.id === 'all' ? WORKS.length : WORKS.filter((w) => w.category === c.id).length
        if (c.id !== 'all' && count === 0) return null
        return (
          <button
            key={c.id}
            className={`pill ${active === c.id ? 'pill-active' : ''}`}
            style={{ '--pc': c.color }}
            onClick={() => onChange(c.id)}
          >
            {c.emoji} {c.label}
            <span className="pill-count">{count}</span>
          </button>
        )
      })}
    </nav>
  )
}

// ---------- 作品卡片 ----------
function WorkCard({ work, index }) {
  const ref = useReveal()
  const cat = catById(work.category)
  const hasDetail = !!work.bodyMd
  const hasLink = work.link && work.link !== '#'
  return (
    <article
      ref={ref}
      className={`card reveal ${hasDetail ? 'card-clickable' : ''}`}
      style={{ '--tilt': `${tiltFromId(work.id)}deg`, '--i': index }}
      onClick={hasDetail ? (e) => {
        // 点卡片空白处进详情；点卡片里的链接（如外链）不拦截
        if (e.target.closest('a')) return
        window.location.hash = `#/work/${work.id}`
      } : undefined}
    >
      <span className={`tape ${tapeFromId(work.id)}`} />
      <div
        className="card-cover"
        style={{ background: `linear-gradient(135deg, ${work.gradient[0]}, ${work.gradient[1]})` }}
      >
        {work.img ? (
          <img src={work.img} alt={work.title} loading="lazy" />
        ) : (
          <span className="cover-emoji">{work.emoji}</span>
        )}
        <span className="card-cat" style={{ background: cat.color }}>
          {cat.emoji} {cat.label}
        </span>
        {hasDetail && <span className="card-badge">📓 有手记</span>}
      </div>
      <div className="card-body">
        <h3 className="card-title">{work.title}</h3>
        <p className="card-desc">{work.desc}</p>
        <div className="card-tags">
          {work.tags.map((t) => (
            <span key={t} className="tag">#{t}</span>
          ))}
        </div>
        <div className="card-foot">
          <time>{work.date}</time>
          <span className="card-foot-links">
            {hasDetail && (
              <a className="card-link" href={`#/work/${work.id}`}>查看详情 →</a>
            )}
            {hasLink ? (
              <a className="card-link" href={work.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                {hasDetail ? '原文 ↗' : '看看去 →'}
              </a>
            ) : (
              !hasDetail && <span className="card-link dim">敬请期待</span>
            )}
          </span>
        </div>
      </div>
    </article>
  )
}

// ---------- 作品详情页（站内手记） ----------
function WorkDetail({ work, onBack }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [work.id])
  const cat = catById(work.category)
  const hasLink = work.link && work.link !== '#'
  return (
    <main className="detail">
      <button className="back-btn" onClick={onBack}>← 回到作品墙</button>
      <article className="detail-page">
        <span className="tape tape-left" />
        <span className="tape tape-right" />
        <div
          className="detail-cover"
          style={{ background: `linear-gradient(135deg, ${work.gradient[0]}, ${work.gradient[1]})` }}
        >
          {work.img ? <img src={work.img} alt={work.title} /> : <span className="cover-emoji big">{work.emoji}</span>}
        </div>
        <div className="detail-head">
          <span className="detail-cat" style={{ background: cat.color }}>{cat.emoji} {cat.label}</span>
          <time className="detail-date">{work.date}</time>
        </div>
        <h2 className="detail-title">{work.title}</h2>
        <p className="detail-lead">{work.desc}</p>
        <div className="card-tags">
          {work.tags.map((t) => <span key={t} className="tag">#{t}</span>)}
        </div>

        {work.bodyMd && (
          <section className="detail-story">
            <h3>📓 制作手记</h3>
            <Markdown source={work.bodyMd} />
          </section>
        )}

        {hasLink && (
          <a className="detail-ext" href={work.link} target="_blank" rel="noreferrer">
            去外部平台看完整版 ↗
          </a>
        )}
      </article>
    </main>
  )
}

// ---------- 关于我 ----------
function About() {
  const ref = useReveal()
  return (
    <section className="about reveal" ref={ref} id="about">
      <span className="tape tape-left" />
      <h2 className="about-title">🖼️ 关于这面墙</h2>
      <p className="about-intro">{PROFILE.intro}</p>
      <div className="about-links">
        {PROFILE.links.map((l) => (
          <a key={l.label} className="about-link" href={l.url} target="_blank" rel="noreferrer">
            {l.label}
          </a>
        ))}
      </div>
      <p className="about-name">—— {PROFILE.name}</p>
    </section>
  )
}

// ---------- 主应用 ----------
export default function App() {
  const [active, setActive] = useState('all')
  const hash = useHashRoute()
  const route = hash.startsWith('#/work/') ? decodeSlug(hash.slice('#/work/'.length)) : null
  const detailWork = route ? WORKS.find((w) => w.id === route && w.bodyMd) : null

  const shown = useMemo(
    () => (active === 'all' ? WORKS : WORKS.filter((w) => w.category === active)),
    [active]
  )

  // 后台：整页换成 AdminApp（令牌门禁 → 列表 ⇄ 编辑；返回前台的入口在 AdminApp 自己里面）。
  // 必须放在所有 hook 之后 —— 早退写在 useState/useMemo 前面会让 hook 数量随路由变化，React 直接报错。
  if (hash === '#/admin') return <div className="page"><AdminApp /></div>

  if (detailWork) {
    return (
      <div className="page">
        <WorkDetail work={detailWork} onBack={() => { window.location.hash = '' }} />
        <footer className="footer">
          © {new Date().getFullYear()} {PROFILE.name} · 想法不落灰，作品上墙来
          <a className="admin-link" href="#/admin">✏️ 后台</a>
        </footer>
      </div>
    )
  }

  return (
    <div className="page">
      <Hero />
      <Ticker />
      <main className="wall-area">
        <FilterBar active={active} onChange={setActive} />
        <div className="wall" key={active}>
          {shown.map((w, i) => (
            <WorkCard key={w.id} work={w} index={i} />
          ))}
        </div>
        <About />
      </main>
      <footer className="footer">
        © {new Date().getFullYear()} {PROFILE.name} · 想法不落灰，作品上墙来
        <a className="admin-link" href="#/admin">✏️ 后台</a>
      </footer>
    </div>
  )
}
