import { useEffect, useMemo, useRef, useState } from 'react'
import { validateWork, validateImage, IMAGE_MAX } from '../lib/validate.js'
import { newWorkId } from '../lib/ids.js'
import { extFromType } from '../lib/gh.js'
import Markdown from '../components/Markdown.jsx'
import { errorText } from './TokenGate.jsx'

// 编辑器：表单 + markdown 工具条 + 图片上传 + 保存管线（spec §3.3 / §5）。
// props 契约由 AdminApp 定死：{ gh, site, sha, work, onCancel, onSaved }。
// AdminApp 没有把 refresh 传下来，所以「内容被别人改过」时本组件自己 gh.getSite() 换基线，
// 表单里的字一个都不动（和 WorkList 删除那条同一套自取写法）。

const IMG_DIR = '/images/works/'
const DEFAULT_GRADIENT = ['#a8edea', '#fed6e3']
const MAX_MB = Math.round(IMAGE_MAX / 1024 / 1024)

// 红字出现在哪个格子，就按表单从上到下的顺序聚焦第一个
const ERROR_ORDER = ['title', 'category', 'date', 'desc', 'tags', 'link', 'emoji', 'gradient']

// entry 上后台管不着的键原样带回去（万一以后加了新字段，编辑保存不该把它弄丢）
const KNOWN_KEYS = ['id', 'title', 'category', 'date', 'desc', 'tags', 'link', 'emoji', 'img', 'gradient', 'bodyMd']

const pad2 = (n) => String(n).padStart(2, '0')
const nowYm = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}` }

const invalidCls = (base, err) => (err ? `${base} invalid` : base)

// tags 输入框里是一串逗号分隔的文本，写回 site.json 时是数组（中文逗号、顿号都认）
const splitTags = (s) => String(s).split(/[,，、]+/).map((t) => t.trim()).filter(Boolean)

// color input 只吃 #rrggbb：三位缩写补全，读不懂就退回默认色（旁边小字显示真正要写回的值）
function hex6(v, fallback) {
  const s = String(v || '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase()
  const m = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i)
  return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase() : fallback
}

function toDraft(work, categories) {
  const g = work && Array.isArray(work.gradient) ? work.gradient : []
  return {
    id: (work && work.id) || newWorkId(),
    title: (work && work.title) || '',
    category: (work && work.category) || (categories[0] && categories[0].id) || '',
    date: (work && work.date) || nowYm(),
    desc: (work && work.desc) || '',
    tags: work && Array.isArray(work.tags) ? work.tags.join(', ') : '',
    link: (work && work.link) || '',
    emoji: (work && work.emoji) || '',
    gradient: [hex6(g[0], DEFAULT_GRADIENT[0]), hex6(g[1], DEFAULT_GRADIENT[1])],
    img: (work && work.img) || '',
    bodyMd: (work && work.bodyMd) || '',
  }
}

// 草稿 → site.json entry：空的可选字段干脆不写，别留 "img": "" 这种噪音
function toEntry(d, extras) {
  const entry = {
    ...extras,
    id: d.id,
    title: d.title.trim(),
    category: d.category,
    date: d.date.trim(),
    desc: d.desc.trim(),
    tags: splitTags(d.tags),
    gradient: [d.gradient[0], d.gradient[1]],
  }
  const put = (k, v) => { const s = String(v || '').trim(); if (s) entry[k] = s }
  put('link', d.link)
  put('emoji', d.emoji)
  put('img', d.img)
  put('bodyMd', d.bodyMd)
  return entry
}

function Spinner({ text }) {
  return <span className="admin-busy"><span className="admin-spin" />{text}</span>
}

export default function WorkEditor({ gh, site, sha, work, onCancel, onSaved }) {
  // 写回的基线（site + blob sha）：初值取父级传下来的，冲突或父级刷新后换成最新的这一份
  const [base, setBase] = useState(() => ({ site: site || null, sha: sha || null }))
  const [form, setForm] = useState(() => toDraft(work, site && Array.isArray(site.categories) ? site.categories : []))
  const [snapshot] = useState(() => JSON.stringify(form))
  const [extras] = useState(() => {
    if (!work) return {}
    const rest = { ...work }
    KNOWN_KEYS.forEach((k) => { delete rest[k] })
    return rest
  })
  const [tab, setTab] = useState('write')
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState({ text: '', kind: '' })
  const [pending, setPending] = useState(false)   // 正在写 site.json
  const [uploading, setUploading] = useState('')  // 'body' | 'cover' | ''

  const busy = pending || !!uploading
  // 分类下拉与校验都看基线里这一份（自取到的 / 父级刷回来的）
  const categories = useMemo(
    () => (base.site && Array.isArray(base.site.categories) ? base.site.categories : []),
    [base.site]
  )
  const ids = useMemo(() => categories.map((c) => c && c.id).filter(Boolean), [categories])

  const fields = useRef({})
  const setFieldRef = (key) => (el) => { fields.current[key] = el }
  const formRef = useRef(form)
  const bodyRef = useRef(null)
  const fileRef = useRef(null)
  const pickMode = useRef('body')
  const cursor = useRef(null)
  const selAfter = useRef(null)
  const seq = useRef(0)

  // 从列表页跳进来时后台可能还没把 site.json 取回来：自己补一次，分类下拉不至于空着
  useEffect(() => {
    if (base.site) return
    let alive = true
    gh.getSite()
      .then((r) => { if (alive) setBase(r) })
      .catch((e) => { if (alive) fail(`⚠️ 仓库最新内容没取回来：${errorText(e.code)}。分类下拉是空的，先回列表重试一下。`) })
    return () => { alive = false }
  }, [base.site, gh])

  // 父级刷过新内容（sha 变了）就以它为新基线，别拿旧 blob sha 去撞 409
  useEffect(() => {
    if (site && sha) setBase({ site, sha })
  }, [site, sha])

  // 新建时分类要等 site.json 到手才填得上默认值
  useEffect(() => {
    if (!form.category && categories.length) setForm((f) => ({ ...f, category: categories[0].id }))
  }, [form.category, categories])

  // 上传是异步的：回调里要读到最新的表单正文，不能拿发起请求那一刻的快照
  useEffect(() => { formRef.current = form })

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [])

  // 文本操作后要还原选区（受控 textarea 重渲染会把 selection 冲掉），所以排在每次渲染之后
  useEffect(() => {
    if (!selAfter.current) return
    const range = selAfter.current
    selAfter.current = null
    const ta = bodyRef.current
    if (ta) {
      const len = ta.value.length
      ta.focus()
      ta.setSelectionRange(Math.min(range[0], len), Math.min(range[1], len))
    }
  })

  const say = (text) => setNotice({ text, kind: '' })
  const fail = (text) => setNotice({ text, kind: 'error' })

  function clearError(key) {
    setErrors((e) => {
      if (!e[key]) return e
      const next = { ...e }
      delete next[key]
      return next
    })
  }

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
    clearError(key)
  }

  function setGradient(i, value) {
    setForm((f) => {
      const gradient = [...f.gradient]
      gradient[i] = value
      return { ...f, gradient }
    })
    clearError('gradient')
  }

  // 光标位置：切片包装与插图都以它为准。三种「其实没光标」的情形都退回末尾：
  // 正文没挂载（在预览页签）、从没点过、刚重新挂载（切页签会让选区复位成 (0,0)）
  function takeCursor() {
    const ta = bodyRef.current
    const len = form.bodyMd.length
    if (!ta) return { start: len, end: len }
    const start = Math.min(Math.max(ta.selectionStart, 0), len)
    const end = Math.min(Math.max(ta.selectionEnd, start), len)
    if (document.activeElement !== ta && start === 0 && end === 0) return { start: len, end: len }
    return { start, end }
  }

  // 切片包装：选中的字 → 前缀 + 原文 + 后缀。没选中就塞个占位词并把占位词选上，接着打字就顶掉
  function wrap(before, after, placeholder, block) {
    const v = form.bodyMd
    const { start, end } = takeCursor()
    const inner = v.slice(start, end) || placeholder
    const lead = block && start > 0 && v[start - 1] !== '\n' ? '\n' : ''
    const trail = block && end < v.length && v[end] !== '\n' ? '\n' : ''
    setField('bodyMd', v.slice(0, start) + lead + before + inner + after + trail + v.slice(end))
    const from = start + lead.length + before.length
    selAfter.current = [from, from + inner.length]
  }

  // 行前缀（列表 / 引用）：按整行取范围，空白行不加前缀；整块已有前缀就撤掉，再点一次等于取消
  function prefixLines(mark) {
    const v = form.bodyMd
    const { start, end } = takeCursor()
    const from = start === 0 ? 0 : v.lastIndexOf('\n', start - 1) + 1
    const cut = v.indexOf('\n', end)
    const to = cut === -1 ? v.length : cut
    const lines = v.slice(from, to).split('\n')
    const on = lines.some((l) => l.trim()) && lines.every((l) => !l.trim() || l.startsWith(mark))
    // 光标单独停在空行上：不给前缀就等于点了没反应，所以这一种空行也照加
    const bare = lines.length === 1 && !lines[0].trim()
    const next = lines.map((l) => {
      if (!l.trim() && !bare) return l
      return on ? l.slice(mark.length) : (l.startsWith(mark) ? l : mark + l)
    }).join('\n')
    setField('bodyMd', v.slice(0, from) + next + v.slice(to))
    selAfter.current = [from, from + next.length]
  }

  // 序号 + 每次现取的随机尾巴：图片 commit 成功、site.json 失败时，再点保存会重新生成名字，
  // 不会出现「同名再创建」被 GitHub 判 409（Contents API 建新文件不允许已存在同名）
  function nextImageName(ext) {
    seq.current += 1
    const slug = String(form.id).replace(/[^A-Za-z0-9._-]/g, '-')
    const rnd = Math.random().toString(36).slice(2, 6) || 'x'
    return `${slug}-${pad2(seq.current)}-${rnd}.${ext}`
  }

  function pickImage(mode) {
    if (busy) return
    pickMode.current = mode
    if (mode === 'body') {
      cursor.current = takeCursor()
      setTab('write')
    }
    const input = fileRef.current
    if (!input) return
    input.value = '' // 连点同一张图也要重新触发 change
    input.click()
  }

  async function onFilePicked(e) {
    const file = e.target.files && e.target.files[0]
    const mode = pickMode.current
    if (!file) return
    const check = validateImage(file)
    if (!check.ok) {
      fail(`⚠️ ${file.name}：${check.error}`)
      return
    }
    const ext = extFromType(file.type)
    if (!ext) {
      fail(`⚠️ ${file.name}：认不出图片格式，换一张 PNG/JPG/WebP/GIF 试试。`)
      return
    }
    setUploading(mode)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const name = nextImageName(ext)
      await gh.putImage(name, bytes, `content: 新增图片 ${name}`)
      if (mode === 'cover') {
        setField('img', IMG_DIR + name)
        // 「表情与图片至少填一个」这条挂在 emoji 格子下，传好封面就该消掉
        clearError('emoji')
        say(`✅ 封面已换成 ${name}。图片已经单独提了一个 commit，点「保存到仓库」才会写进 site.json。`)
      } else {
        // 用最新一份正文：上传这几秒里可能又打了几行字，拿发起时的快照会把它们冲掉
        const v = formRef.current.bodyMd
        const at = cursor.current ? Math.min(cursor.current.end, v.length) : v.length
        const md = `![说明](${IMG_DIR}${name})`
        setField('bodyMd', v.slice(0, at) + md + v.slice(at))
        selAfter.current = [at + 2, at + 4] // 把「说明」两个字选上，直接打字就是图注
        say(`✅ 图片 ${name} 已进仓库，正文里插好引用了。写完点「保存到仓库」一起提交。`)
      }
    } catch (err) {
      // 已经传好的图片留在仓库里（孤儿图片无害），表单也原样保留，直接再点一次就行
      fail(`⚠️ 图片没传上去：${errorText(err.code)}。之前传好的图片还在仓库里，改完可以直接重试。`)
    } finally {
      setUploading('')
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function save() {
    if (busy) return
    // 分类列表还没到手（仓库没读回来）就校验，只会得到一句骗人的「分类不存在」
    if (!ids.length) {
      fail('⚠️ 还没拿到仓库里的分类列表，先别提交：回列表刷新一下再试，这里填的东西都还在。')
      return
    }
    const entry = toEntry(form, extras)
    const v = validateWork(entry, ids)
    if (!v.ok) {
      setErrors(v.errors)
      fail(`⚠️ 有 ${Object.keys(v.errors).length} 处还没填对，红字写在对应的格子下面。`)
      const first = ERROR_ORDER.find((k) => v.errors[k])
      const el = first && fields.current[first]
      if (el) {
        el.focus()
        if (el.tagName === 'INPUT' && el.type === 'text') el.select()
      }
      return
    }
    setErrors({})
    setNotice({ text: '', kind: '' })
    setPending(true)
    try {
      let cur = base
      if (!cur.site || !cur.sha) cur = await gh.getSite()
      const root = cur.site
      if (!root || typeof root !== 'object' || Array.isArray(root)) {
        fail('⚠️ 仓库里的 site.json 不是一个对象，先别提交：回列表刷新看看，或去仓库里检查这个文件。')
        return
      }
      const list = Array.isArray(root.works) ? root.works : []
      const owned = list.some((w) => w && w.id === entry.id)
      const merged = owned ? list.map((w) => (w && w.id === entry.id ? entry : w)) : [...list, entry]
      // 与 lib/migrate.js buildSite 里的比较器逐字相同：墙上就是靠它排顺序
      const works = merged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      const newSite = { ...root, works }
      const r = await gh.putSite(newSite, cur.sha)
      setBase({ site: newSite, sha: r.sha })
      window.alert('已提交，站点约 1~2 分钟后自动更新')
      await onSaved()
    } catch (err) {
      if (err.code === 'conflict') {
        try {
          const fresh = await gh.getSite()
          setBase(fresh)
          fail('⚠️ 内容已被其他设备修改，已经替你取回仓库里的最新内容（表单里写的字一个都没丢）。再点一次「保存到仓库」就是基于新内容提交。')
        } catch (err2) {
          fail(`⚠️ 提交被别的改动抢先了，而且最新内容也没取回来：${errorText(err2.code)}。表单里的修改还在，可以直接重试。`)
        }
      } else {
        fail(`⚠️ 没提交上去：${errorText(err.code)}。表单里的修改全都留着，可以直接再点一次「保存到仓库」。`)
      }
    } finally {
      setPending(false)
    }
  }

  function cancel() {
    if (busy) return
    // 图片是「传完就是独立 commit」，取消也撤不回来（孤儿图片无害，spec §3.3），提示里得说实话
    const msg = seq.current > 0
      ? '还没保存的修改要丢掉吗？\n（已经传上去的图片留在仓库里，不会自动删，孤儿图片无害；正文与表单里没提交的改动会丢。）'
      : '还没保存的修改要丢掉吗？\n（丢掉就回列表，仓库里的内容不会有任何变化。）'
    if (JSON.stringify(form) !== snapshot && !window.confirm(msg)) return
    onCancel()
  }

  const cover = () => {
    if (form.img) return <img src={form.img} alt="封面预览" />
    return <span className="admin-thumb-emoji">{form.emoji || '🗒️'}</span>
  }

  return (
    <section className="admin admin-editor">
      <header className="admin-top">
        <div className="admin-top-text">
          <h2 className="admin-title">{work ? '✏️ 改这一条灵感实践' : '🪄 新的灵感实践'}</h2>
          <p className="admin-sub">
            <span className="admin-repo">{form.id}</span>
            <span>{work ? '保存后替换仓库里同 id 的那一条' : '保存后按日期倒序挂上墙'}</span>
            {!base.site && <span>📥 正在取仓库最新内容…</span>}
          </p>
        </div>
        <div className="admin-actions">
          <button className="admin-btn" onClick={cancel} disabled={busy}>← 返回列表</button>
          <button className="admin-btn primary" onClick={save} disabled={busy}>
            {pending ? <Spinner text="正在提交…" /> : '💾 保存到仓库'}
          </button>
        </div>
      </header>

      {notice.text && (
        notice.kind === 'error'
          ? <p className="admin-callout error" role="alert">{notice.text}</p>
          : <p className="admin-callout">{notice.text}</p>
      )}

      <div className="admin-card wide admin-form">
        <div className="admin-cell">
          <label className="admin-field">
            <span>标题 *</span>
            <input className={invalidCls('admin-input', errors.title)} ref={setFieldRef('title')}
              value={form.title} maxLength={80} placeholder="这条灵感实践叫什么"
              onChange={(e) => setField('title', e.target.value)} />
          </label>
          {errors.title && <span className="admin-field-error">{errors.title}</span>}
        </div>

        <div className="admin-grid">
          <div className="admin-cell">
            <label className="admin-field">
              <span>分类 *</span>
              <select className={invalidCls('admin-input', errors.category)} ref={setFieldRef('category')}
                value={form.category} onChange={(e) => setField('category', e.target.value)}>
                {categories.length === 0 && <option value="">（分类还没取回来）</option>}
                {!!form.category && !ids.includes(form.category) && (
                  <option value={form.category}>（未知分类 {form.category}）</option>
                )}
                {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>
            </label>
            {errors.category && <span className="admin-field-error">{errors.category}</span>}
          </div>
          <div className="admin-cell">
            <label className="admin-field">
              <span>日期 *</span>
              <input className={invalidCls('admin-input', errors.date)} ref={setFieldRef('date')}
                value={form.date} maxLength={7} placeholder="YYYY-MM" spellCheck={false}
                onChange={(e) => setField('date', e.target.value)} />
            </label>
            <span className="admin-hint">格式 YYYY-MM，墙上的先后就是按它排的</span>
            {errors.date && <span className="admin-field-error">{errors.date}</span>}
          </div>
        </div>

        <div className="admin-cell">
          <label className="admin-field">
            <span>简介 *</span>
            <textarea className={invalidCls('admin-input admin-textarea-sm', errors.desc)} ref={setFieldRef('desc')}
              rows={2} maxLength={300} value={form.desc} placeholder="一两句说清这条在做什么，卡片上就显示这些"
              onChange={(e) => setField('desc', e.target.value)} />
          </label>
          <span className="admin-hint">{form.desc.length}/300 字</span>
          {errors.desc && <span className="admin-field-error">{errors.desc}</span>}
        </div>

        <div className="admin-grid">
          <div className="admin-cell">
            <label className="admin-field">
              <span>标签 *</span>
              <input className={invalidCls('admin-input', errors.tags)} ref={setFieldRef('tags')}
                value={form.tags} placeholder="Python, Agent" spellCheck={false}
                onChange={(e) => setField('tags', e.target.value)} />
            </label>
            <span className="admin-hint">1~3 个，逗号隔开，每个不超过 12 字</span>
            {errors.tags && <span className="admin-field-error">{errors.tags}</span>}
          </div>
          <div className="admin-cell">
            <label className="admin-field">
              <span>外链（可留空）</span>
              <input className={invalidCls('admin-input', errors.link)} ref={setFieldRef('link')}
                value={form.link} placeholder="https://… 或 #" spellCheck={false}
                onChange={(e) => setField('link', e.target.value)} />
            </label>
            <span className="admin-hint">留空或填 # = 卡片和详情页都不显示「去看看」按钮</span>
            {errors.link && <span className="admin-field-error">{errors.link}</span>}
          </div>
        </div>

        <div className="admin-grid">
          <div className="admin-cell">
            <label className="admin-field">
              <span>封面表情 *</span>
              <input className={invalidCls('admin-input', errors.emoji)} ref={setFieldRef('emoji')}
                value={form.emoji} maxLength={8} placeholder="🧾"
                onChange={(e) => setField('emoji', e.target.value)} />
            </label>
            <span className="admin-hint">表情和下面的封面图至少有一个；有图时优先显示图</span>
            {errors.emoji && <span className="admin-field-error">{errors.emoji}</span>}
          </div>
          <div className="admin-cell">
            <div className="admin-field">
              <span>卡片渐变色 *</span>
              <div className="admin-colors">
                {[0, 1].map((i) => (
                  <span className="admin-color" key={i}>
                    <input type="color" className="admin-color-input" aria-label={`渐变色 ${i + 1}`}
                      ref={i === 0 ? setFieldRef('gradient') : undefined}
                      value={form.gradient[i]} onChange={(e) => setGradient(i, e.target.value)} />
                    <span className="admin-color-note">{form.gradient[i]}</span>
                  </span>
                ))}
              </div>
            </div>
            {errors.gradient && <span className="admin-field-error">{errors.gradient}</span>}
          </div>
        </div>

        <div className="admin-cell">
          <div className="admin-field">
            <span>封面图</span>
            <div className="admin-cover">
              <span className="admin-cover-preview">{cover()}</span>
              <span className="admin-cover-ops">
                <input className="admin-input" readOnly value={form.img}
                  placeholder="/images/works/…（还没上传封面）" spellCheck={false} onFocus={(e) => e.target.select()} />
                <span className="admin-actions">
                  <button type="button" className="admin-btn" onClick={() => pickImage('cover')} disabled={busy}>
                    {uploading === 'cover' ? <Spinner text="封面上传中…" /> : '🖼️ 上传封面'}
                  </button>
                  {!!form.img && (
                    <button type="button" className="admin-btn ghost" onClick={() => setField('img', '')} disabled={busy}>
                      移除封面
                    </button>
                  )}
                </span>
              </span>
            </div>
          </div>
          <span className="admin-hint">
            支持 PNG/JPG/WebP/GIF，单张不超过 {MAX_MB}MB；Pages 上建议先压到 500KB 以内，仓库会轻很多。
            上传就是往仓库提一个 commit，删掉这条记录也不会自动删图片（孤儿图片无害）。
          </span>
        </div>

        <div className="admin-cell">
          <div className="admin-field">
            <span>正文（Markdown）</span>
            <div className="admin-tabs">
              <button type="button" className={tab === 'write' ? 'admin-btn sm tab active' : 'admin-btn sm tab'}
                onClick={() => setTab('write')}>✏️ 写正文</button>
              <button type="button" className={tab === 'preview' ? 'admin-btn sm tab active' : 'admin-btn sm tab'}
                onClick={() => setTab('preview')}>👀 预览</button>
              <span className="admin-tabs-hint">预览用的就是前台详情页那个渲染器</span>
            </div>
            {tab === 'write' ? (
              <>
                <div className="admin-toolbar" onMouseDown={(e) => e.preventDefault()}>
                  <button type="button" className="admin-btn sm tool" onClick={() => pickImage('body')} disabled={busy}>
                    {uploading === 'body' ? <Spinner text="图片上传中…" /> : '🖼️ 插入图片'}
                  </button>
                  <button type="button" className="admin-btn sm tool" onClick={() => wrap('**', '**', '加粗', false)}>B</button>
                  <button type="button" className="admin-btn sm tool" onClick={() => prefixLines('- ')}>· 列表</button>
                  <button type="button" className="admin-btn sm tool" onClick={() => prefixLines('> ')}>❝ 引用</button>
                  <button type="button" className="admin-btn sm tool" onClick={() => wrap('```\n', '\n```', '代码', true)}>{'</>'} 代码块</button>
                </div>
                <textarea ref={bodyRef} className="admin-input admin-textarea" value={form.bodyMd}
                  spellCheck={false} placeholder={'## 怎么做出来的\n\n想写什么写什么，图片点上面的「插入图片」。'}
                  onChange={(e) => setField('bodyMd', e.target.value)} />
              </>
            ) : (
              <div className="admin-preview">
                {form.bodyMd.trim()
                  ? <Markdown source={form.bodyMd} />
                  : <p className="admin-loading">正文还是空的，切回「✏️ 写正文」涂两段。</p>}
              </div>
            )}
          </div>
          <span className="admin-hint">{form.bodyMd.length} 字 · 标准 markdown：标题、列表、引用、表格、代码块都吃</span>
        </div>

        <input ref={fileRef} type="file" accept="image/*" className="admin-file" onChange={onFilePicked} />

        <div className="admin-actions admin-form-ops">
          <button className="admin-btn" onClick={cancel} disabled={busy}>← 返回列表</button>
          <button className="admin-btn primary" onClick={save} disabled={busy}>
            {pending ? <Spinner text="正在提交…" /> : '💾 保存到仓库'}
          </button>
          <span className="admin-hint">提交前会先把没填对的格子标红</span>
        </div>
      </div>

      <p className="admin-foot-tip">
        一次保存最多产生两个 commit：先传新图片，再更新 site.json；Actions 构建约 1~2 分钟后前台生效。
      </p>
    </section>
  )
}
