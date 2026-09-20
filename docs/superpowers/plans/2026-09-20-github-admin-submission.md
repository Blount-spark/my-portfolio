# GitHub 后台提交系统 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or executors to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 my-portfolio 用「后台页面 + Markdown + 图片上传」维护内容：后台经 fine-grained PAT 直接提交 GitHub Contents API，Actions 构建发布到 Pages。

**Architecture:** 仓库即数据库。内容存 `src/data/site.json`（构建时打进静态前台），图片存 `public/images/works/`；后台页 `#/admin` 是纯前端，运行时只调 GitHub REST API。无自建后端。

**Tech Stack:** Vite 5 + React 18（现有）、`react-markdown` + `rehype-sanitize` + `remark-gfm`、Node 内置 `node --test`（仅纯逻辑单测）、GitHub Contents API、GitHub Actions deploy-pages。

**Spec:** `docs/superpowers/specs/2026-09-20-admin-markdown-submission-design.md`（v2，已批准）

**对 spec §6 的一处偏离（已在实施中生效）：** markdown 渲染多加一个 `remark-gfm`（表格/删除线），与 spec「白名单常用语法」意图一致。

## Global Constraints

- 依赖只允许新增三个：`react-markdown`、`rehype-sanitize`、`remark-gfm`；不引入 UI 组件库、路由库
- UI 与提交信息一律中文；风格沿用拼贴手账（`src/index.css` 现有变量，不重设计）
- 路由保持 hash（`#/work/<id>`、`#/admin`），`vite.config.js` 保持 `base: './'`
- 新 id 规则：`w-<Date.now().toString(36)>-<2位36进制随机>`；迁移旧 id → `w-legacy-<旧数字>`
- 图片白名单 MIME：`image/png` `image/jpeg` `image/webp` `image/gif`；单张 ≤ 5MB（5 * 1024 * 1024 字节）
- 文本上限：title ≤ 80、desc ≤ 300、tags 1~3 个且每个 ≤ 12 字符、date 必须匹配 `^\d{4}-(0[1-9]|1[0-2])$`
- GitHub API 固定头：`Accept: application/vnd.github+json`、`X-GitHub-Api-Version: 2022-11-28`；错误映射 401→`bad_token`、403/404→`no_access`、409→`conflict`
- 纯逻辑放 `src/lib/`（Node 可直接 import 的 ESM），组件不做自动化测试，用 `npm run build` + 手工检查验收
- 每个任务结束跑 `npm test` 与 `npm run build`，通过后单独 commit（中文信息，风格照 `git log`）

---

### Task 1: 测试基建 + 纯函数库（ids / validate）

**Files:**
- Modify: `package.json`（scripts 增加 `"test": "node --test tests/"`）
- Create: `src/lib/ids.js`
- Create: `src/lib/validate.js`
- Test: `tests/ids.test.js`、`tests/validate.test.js`

**Interfaces:**
- Produces: `newWorkId(date?) → string`；`tiltFromId(id) → number`（-1.8~1.8）；`tapeFromId(id) → 'tape-left'|'tape-right'`；`validateWork(work, categoryIds) → { ok, errors: {field: msg} }`；`validateImage(file) → { ok, error? }`（Task 3/6 消费）

- [ ] **Step 1: 在 package.json 的 scripts 中加入 `"test": "node --test tests/"`**
- [ ] **Step 2: 写失败测试 `tests/ids.test.js`**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newWorkId, tiltFromId, tapeFromId } from '../src/lib/ids.js'

test('newWorkId 符合 w-<ts36>-<2rand> 且两次不同', () => {
  const a = newWorkId(new Date(1727000000000))
  assert.match(a, /^w-[0-9a-z]{1,8}-[0-9a-z]{2}$/)
  assert.notEqual(newWorkId(), newWorkId())
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
```

- [ ] **Step 3: 运行 `npm test` 确认失败（模块不存在）**
- [ ] **Step 4: 实现 `src/lib/ids.js`**

```js
// 作品 id 与由 id 派生的稳定视觉值（拼贴歪斜/胶带）。id 是字符串 slug，见 spec §3.1。
export function newWorkId(date = new Date()) {
  const ts = date.getTime().toString(36)
  const rnd = Math.random().toString(36).slice(2, 4) || 'zz'
  return `w-${ts}-${rnd}`
}

function hash(str) {
  let h = 0
  for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}
export const tiltFromId = (id) => ((hash(id) % 5) - 2) * 0.9
export const tapeFromId = (id) => (hash(id) % 2 === 0 ? 'tape-left' : 'tape-right')
```

- [ ] **Step 5: 写失败测试 `tests/validate.test.js`**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateWork, validateImage } from '../src/lib/validate.js'

const base = {
  id: 'w-x-01', title: '好', category: 'code', date: '2026-09',
  desc: 'ok', tags: ['a'], link: '#', gradient: ['#fff', '#eee'], emoji: '✨',
}
const cats = ['code', 'craft']

test('合法作品通过', () => assert.equal(validateWork(base, cats).ok, true))
test('分类/日期/标题/tags 非法逐项报错', () => {
  const r = validateWork({ ...base, category: 'nope', date: '2026-9', title: '', tags: [] }, cats)
  assert.equal(r.ok, false)
  assert.ok(r.errors.category && r.errors.date && r.errors.title && r.errors.tags)
})
test('emoji 与 img 至少要有一个', () => {
  assert.equal(validateWork({ ...base, emoji: '', img: '' }, cats).ok, false)
  assert.ok(validateWork({ ...base, emoji: '', img: '' }, cats).errors.emoji)
  assert.equal(validateWork({ ...base, emoji: '', img: '/images/works/a.png' }, cats).ok, true)
})
test('图片：>5MB 或非白名单 MIME 被拒', () => {
  assert.equal(validateImage({ name: 'a.png', type: 'image/png', size: 6 * 1024 * 1024 }).ok, false)
  assert.equal(validateImage({ name: 'a.exe', type: 'application/x-msdownload', size: 10 }).ok, false)
  assert.equal(validateImage({ name: 'a.png', type: 'image/png', size: 10 }).ok, true)
})
```

注意：emoji/img 用例以 `errors.emoji` 键存在为准断言（实现前先想清楚形状：`{ ok: false, errors: { emoji: '表情和图片至少填一个' } }`；上面第三条写法以本注释为准修正为直接断言 `errors.emoji` 存在）。

- [ ] **Step 6: 实现 `src/lib/validate.js`**

```js
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])$/
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
export const IMAGE_MAX = 5 * 1024 * 1024

export function validateWork(w, categoryIds) {
  const e = {}
  if (!w.title || w.title.length > 80) e.title = '标题必填，不超过 80 字'
  if (!categoryIds.includes(w.category)) e.category = '分类不存在'
  if (!DATE_RE.test(w.date || '')) e.date = '日期格式 YYYY-MM'
  if (!w.desc || w.desc.length > 300) e.desc = '简介必填，不超过 300 字'
  if (!Array.isArray(w.tags) || w.tags.length < 1 || w.tags.length > 3
      || w.tags.some((t) => !t || t.length > 12)) e.tags = '标签 1~3 个，每个 ≤12 字'
  if (!w.gradient || w.gradient.length !== 2) e.gradient = '渐变色需要起止两色'
  if (!w.emoji && !w.img) e.emoji = '封面表情与封面图片至少填一个'
  if (w.link && !/^(https?:\/\/|#)/.test(w.link)) e.link = '链接需 http(s):// 开头或填 #'
  return { ok: Object.keys(e).length === 0, errors: e }
}

export function validateImage(file) {
  if (!IMAGE_TYPES.includes(file.type)) return { ok: false, error: '只支持 PNG/JPG/WebP/GIF' }
  if (file.size > IMAGE_MAX) return { ok: false, error: '图片超过 5MB' }
  if (file.size === 0) return { ok: false, error: '空文件' }
  return { ok: true }
}
```

- [ ] **Step 7: `npm test` 全绿 → commit `feat: id 与表单校验纯函数（含测试）`**

---

### Task 2: GitHub Contents API 客户端 `src/lib/gh.js`

**Files:**
- Create: `src/lib/gh.js`
- Test: `tests/gh.test.js`

**Interfaces:**
- Consumes: 无（只依赖 fetch，可注入 fake）
- Produces（Task 5/6 消费，全部方法返回已解析对象）:
  - `makeGh({ owner, repo, token, fetchImpl }) → gh`
  - `gh.checkAccess() → true | 抛 Error(code)`（GET site.json 元数据）
  - `gh.getSite() → { site, sha }`（解码 JSON + blob sha）
  - `gh.putSite(site, sha) → { sha }`；`gh.putImage(name, bytes, message) → { sha }`
  - `gh.latestCommitDate() → string | null`
  - 纯函数 `strToB64 / b64ToStr / bytesToB64 / extFromType(type)`
  - 错误对象 `.code ∈ bad_token | no_access | conflict | network | bad_response`

- [ ] **Step 1: 写失败测试 `tests/gh.test.js`（fake fetch，断言 URL/方法/头/体与错误映射）**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeGh, strToB64, b64ToStr, extFromType } from '../src/lib/gh.js'

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
})

test('401→bad_token 403→no_access 409→conflict', async () => {
  for (const [status, code] of [[401, 'bad_token'], [403, 'no_access'], [404, 'no_access'], [409, 'conflict']]) {
    const gh = makeGh({ ...cfg, fetchImpl: route(() => ({ status, json: { message: 'x' } })) })
    await assert.rejects(gh.checkAccess(), (err) => err.code === code)
  }
})

test('putSite 发 PUT 且 content/message/sha 齐全', async () => {
  let seen
  const gh = makeGh({ ...cfg, fetchImpl: route((url, opts) => {
    if (opts.method === 'PUT') seen = JSON.parse(opts.body)
    return { status: 201, json: { content: { sha: 'S2' } } }
  }) })
  const out = await gh.putSite({ works: [] }, 'S1')
  assert.equal(out.sha, 'S2')
  assert.equal(seen.sha, 'S1')
  assert.equal(b64ToStr(seen.content.replace(/\n/g, '')), '{"works":[]}')
  assert.ok(seen.message.length > 0)
})
```

- [ ] **Step 2: `npm test` 确认失败**
- [ ] **Step 3: 实现 `src/lib/gh.js`**

```js
const API = 'https://api.github.com'
export const SITE_PATH = 'src/data/site.json'

export const strToB64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)))
  // 大文本按块 push，避免 spread 爆栈：
  // const bytes=new TextEncoder().encode(s); let bin=''; for(let i=0;i<bytes.length;i+=0x8000) bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000)); return btoa(bin)
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
    if (!res.ok) throw err('bad_response')
    return res.json()
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
```

实现 `strToB64` 时直接用注释里的分块版本（勿留 spread 版）。

- [ ] **Step 4: `npm test` 全绿 → commit `feat: GitHub Contents API 客户端（校验/编解码/错误映射）`**

---

### Task 3: 数据迁移 → `src/data/site.json`

**Files:**
- Create: `src/lib/migrate.js`
- Create: `scripts/migrate-works.mjs`（一次性）
- Create: `src/data/site.json`（由脚本生成）
- Create: `src/data/profile.js`（从 works.js 剪出的 PROFILE 常量）
- Test: `tests/migrate.test.js`

**Interfaces:**
- Produces: `detailToMd(detail) → string|''`；`workToEntry(w) → entry`；`buildSite({ categories, works }) → { categories, works }`（含排序，去 all）（Task 4 消费 site.json，Task 6 复用 entry 形状）

- [ ] **Step 1: 写失败测试 `tests/migrate.test.js`**

```js
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
```

- [ ] **Step 2: `npm test` 确认失败后实现 `src/lib/migrate.js`**

```js
export function detailToMd({ story = [], gallery = [], captions = [] } = {}) {
  const parts = story.filter(Boolean).join('\n\n')
  const body = gallery.length
    ? (parts ? parts + '\n\n## 过程图\n\n' : '## 过程图\n\n') +
      gallery.map((src, i) => {
        const cap = captions[i]
        return cap ? `![${cap}](${src})\n\n*${cap}*` : `![](${src})`
      }).join('\n\n')
    : parts
  return body
}

export function workToEntry(w) {
  const e = { ...w, id: `w-legacy-${w.id}` }
  if (w.detail) {
    const md = detailToMd(w.detail)
    if (md) e.bodyMd = md
    delete e.detail
  }
  return e
}

export function buildSite({ categories, works }) {
  return {
    categories: categories.filter((c) => c.id !== 'all'),
    works: works.map(workToEntry).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
  }
}
```

- [ ] **Step 3: 写一次性脚本 `scripts/migrate-works.mjs` 并运行**

```js
// 一次性迁移：读旧 works.js → 生成 src/data/site.json（spec §3.1）。历史保留，勿再接入运行时。
import { CATEGORIES, WORKS } from '../src/data/works.js'
import { buildSite } from '../src/lib/migrate.js'
import { writeFileSync, mkdirSync } from 'node:fs'

mkdirSync('src/data', { recursive: true })
writeFileSync('src/data/site.json', JSON.stringify(buildSite({ categories: CATEGORIES, works: WORKS }), null, 2) + '\n')
console.log('site.json 已生成')
```

Run: `node scripts/migrate-works.mjs` → Expected: `site.json 已生成`；肉眼抽查 `src/data/site.json`：12 条 works、id 均 `w-legacy-`、1/4 号有 bodyMd。

- [ ] **Step 4: 写 `src/data/profile.js`** —— 把 `works.js` 里的 `PROFILE` 对象原样剪切到此文件并 `export default PROFILE`（字段一字不改，见 works.js:174-186）。
- [ ] **Step 5: `npm test` 全绿 → commit `feat: works.js 迁移为 site.json 数据层（含映射测试与一次性脚本）`**

---

### Task 4: 前台切换到 site.json + Markdown 详情页

**Files:**
- Modify: `src/App.jsx`（import 区、tilt/tape、WorkCard、WorkDetail、App 路由）
- Create: `src/components/Markdown.jsx`
- Modify: `package.json`（+react-markdown、rehype-sanitize、remark-gfm）
- Delete: `src/data/works.js`（site.json 已生成且前台渲染一致后删除；git 历史即备份）

**Interfaces:**
- Consumes: `src/data/site.json`（Task 3）、`tiltFromId/tapeFromId`（Task 1）
- Produces: `<Markdown source={string} />` 组件（Task 6 预览复用）；`WORKS` 条目形状即 site.json entry

- [ ] **Step 1: `npm install react-markdown rehype-sanitize remark-gfm`**
- [ ] **Step 2: 写 `src/components/Markdown.jsx`**

```jsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

// 正文 markdown → React 元素；sanitize 白名单常用语法（spec §6），相对路径图片原样通过
export default function Markdown({ source }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{source || ''}</ReactMarkdown>
    </div>
  )
}
```

- [ ] **Step 3: 改 `src/App.jsx`**
  - 顶部 import：删 `./data/works.js`，改为 `import site from './data/site.json'` 与 `import PROFILE from './data/profile.js'`、`import { tiltFromId, tapeFromId } from './lib/ids.js'`、`import Markdown from './components/Markdown.jsx'`
  - 常量：`const CATEGORIES = [{ id: 'all', label: '全部', emoji: '✨', color: '#6C5CE7' }, ...site.categories]`；`const WORKS = site.works`
  - 删 `tiltOf/tapeOf` 两函数，卡片处改 `tiltFromId(work.id)` / `tapeFromId(work.id)`；详情页 gallery 已不存在，相应使用删除
  - `useHashRoute` 注释更新；App 内：`const route = hash.startsWith('#/work/') ? decodeURIComponent(hash.slice('#/work/'.length)) : null`，`detailWork = route ? WORKS.find((w) => w.id === route && w.bodyMd) : null`（去掉 Number()）
  - `WorkCard`：`hasDetail = !!work.bodyMd`
  - `WorkDetail`：删 detail.story / detail.gallery 两个 section，替换为

```jsx
{work.bodyMd && (
  <section className="detail-story">
    <h3>📓 制作手记</h3>
    <Markdown source={work.bodyMd} />
  </section>
)}
```

- [ ] **Step 4: 在 `src/index.css` 末尾追加 markdown 基础样式（手账风）**

```css
/* markdown 正文（详情页 & 后台预览共用 .md） */
.md > *:first-child { margin-top: 0 }
.md h2, .md h3 { font-family: inherit; margin: 1.4em 0 .5em }
.md h2 { font-size: 1.25rem; transform: rotate(-.4deg) }
.md p { margin: .8em 0; line-height: 1.9 }
.md ul, .md ol { padding-left: 1.4em; margin: .8em 0 }
.md blockquote { border-left: 4px solid var(--ink, #444); margin: 1em 0; padding: .2em 1em; background: rgba(255,255,255,.5); border-radius: 6px }
.md pre { background: #2d2a32; color: #eee; padding: 1em; border-radius: 10px; overflow-x: auto }
.md code { font-family: ui-monospace, monospace }
.md img { max-width: 100%; border-radius: 10px; border: 6px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.12); transform: rotate(-.6deg); margin: .6em 0 }
.md a { color: #0984E3 }
.md table { border-collapse: collapse } .md td, .md th { border: 1px solid #cba; padding: .3em .6em }
```

- [ ] **Step 5: `npm run build` 通过；`npm run dev` 手工核对**：墙 12 张卡与旧版一致（含歪斜），`#/work/w-legacy-1` 手记按 markdown 正常分段，外链/「有手记」角标行为不变
- [ ] **Step 6: 删 `src/data/works.js`，`npm run build` 再通过 → commit `feat: 前台改用 site.json 数据源，详情正文切换 markdown 渲染`**
  （`scripts/migrate-works.mjs` import works.js 会失效——它是一次性历史脚本，在文件头注释标注「已执行完毕，仅作留档」即可，不参与构建。）

---

### Task 5: 后台外壳——路由、令牌卡、作品列表

**Files:**
- Create: `src/data/config.js`
- Create: `src/admin/AdminApp.jsx`、`src/admin/TokenGate.jsx`、`src/admin/WorkList.jsx`
- Create: `src/admin/WorkEditor.jsx`（本任务仅建占位桩：`export default function WorkEditor(){return <div className="admin-card">编辑器建设中</div>}`；Task 6 整体替换实现，否则 AdminApp 的 import 会使本任务构建失败）
- Modify: `src/App.jsx`（#/admin 分支）
- Modify: `src/index.css`（后台小样式）

**Interfaces:**
- Consumes: `makeGh`（Task 2）、`site.json` 的 entry 形状（Task 3）
- Produces: `getAuth()/setAuth()/clearAuth()`（localStorage 键 `mp-admin-auth`，形状 `{ owner, repo, token }`，Task 6 复用）；`<AdminApp />` 顶层组件；WorkList 通过 props `onEdit(work)` 回调（Task 6 接线编辑）

- [ ] **Step 1: `src/data/config.js`**

```js
// GitHub 仓库定位（Task 7 建立仓库后回填真实值；占位空串时后台会提示先配置）
export const SITE_REPO = { owner: 'Blount-spark', repo: 'my-portfolio' }
```

- [ ] **Step 2: `src/admin/AdminApp.jsx` —— 会话存取 + 组装**

```jsx
import { useEffect, useState } from 'react'
import { makeGh } from '../lib/gh.js'
import { SITE_REPO } from '../data/config.js'
import TokenGate, { getAuth, setAuth, clearAuth } from './TokenGate.jsx'
import WorkList from './WorkList.jsx'
import WorkEditor from './WorkEditor.jsx'

export default function AdminApp() {
  const [auth, setAuthState] = useState(getAuth)
  const [site, setSite] = useState(null)
  const [sha, setSha] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | work 对象

  const gh = auth ? makeGh(auth) : null
  async function refresh() {
    if (!gh) return
    try {
      const r = await gh.getSite()
      setSite(r.site); setSha(r.sha); setError('')
    } catch (e) {
      if (e.code === 'bad_token' || e.code === 'no_access') { clearAuth(); setAuthState(null) }
      else setError('读取失败：' + e.code)
    }
  }
  useEffect(() => { refresh() }, [auth])

  if (!auth || !SITE_REPO.owner) return <TokenGate onDone={(a) => { setAuth(a); setAuthState(a) }} />
  if (editing !== null) return <WorkEditor gh={gh} site={site} sha={sha} auth={auth}
      work={editing === 'new' ? null : editing} onCancel={() => setEditing(null)}
      onSaved={async () => { await refresh(); setEditing(null) }} />

  return <WorkList gh={gh} site={site} error={error} auth={auth}
      onNew={() => setEditing('new')} onEdit={(w) => setEditing(w)}
      onReload={refresh} onLogout={() => { clearAuth(); setAuthState(null) }}
      onChanged={refresh} />
}
```

- [ ] **Step 3: `src/admin/TokenGate.jsx`** —— 输入 owner/repo/token 三格（owner/repo 预填 config），「进入后台」按钮：先 `setAuth` 草稿 → 试 `makeGh(...).checkAccess()` → 成功才持久化并调 `onDone`；失败按 code 显示中文：bad_token「令牌无效或过期」/ no_access「该令牌没有此仓库的读写权限（需 fine-grained + Contents: RW）」/ network「网络不通」。本文件导出 `getAuth/setAuth/clearAuth`（localStorage `mp-admin-auth`）。样式复用卡片纸感：`.admin-card { background:#fffdf7; border:2px dashed #b98; border-radius:14px; padding:24px; max-width:480px; margin:40px auto; transform:rotate(-.5deg) }`。

- [ ] **Step 4: `src/admin/WorkList.jsx`** —— 顶部「＋ 新的灵感实践」「刷新」「退出登录」；行：emoji/封面缩略、title、category、date、tags，操作「编辑」「删除」（删除：window.confirm 后 `site.works.filter` → `gh.putSite(newSite, sha)` → 提示「已提交，站点约 1~2 分钟后自动更新」→ `onChanged()`；conflict 时提示先刷新）。加载中/空态/错误态三个分支。
- [ ] **Step 5: `src/App.jsx` 接线** —— `App()` 最前：`if (hash === '#/admin') return <div className="page"><AdminApp /></div>`；footer 加小链接 `<a href="#/admin">✏️ 后台</a>`（dim 小字）。
- [ ] **Step 6: `npm run build` 通过；dev 手工核对**：未登录时 `#/admin` 出令牌卡；输入任意错串点进入 → 网络请求发出并显示「令牌无效」；首页新链接可跳转。真 token 验证留给 Task 8。→ commit `feat: 后台外壳（#/admin 路由、令牌门禁、作品列表与删除）`

---

### Task 6: 编辑器——表单、图片上传、markdown 工具条、保存管线

**Files:**
- Modify: `src/admin/WorkEditor.jsx`（Task 5 的占位桩整体替换为真实实现）
- Modify: `src/admin/AdminApp.jsx`（如接线需要）

**Interfaces:**
- Consumes: `gh.putSite/putImage/latestCommitDate`（Task 2）、`validateWork/validateImage/newWorkId`（Task 1）、`IMAGE_MAX`（Task 1）、`<Markdown />`（Task 4）
- Produces: 完整保存流程；site.json 的 `works` 数组保持 date 倒序后写回

- [ ] **Step 1: 表单** —— 字段与 site entry 一一对应（title/category 下拉自 site.categories/date/desc/tags 逗号分隔/link/emoji/gradient 两个 color input/img 只读回显+上传按钮/bodyMd 大 textarea）。初值：编辑传入 work，新建给合理默认（`newWorkId()`、gradient 取现有值 `['#a8edea','#fed6e3']`）。提交前 `validateWork`，错误以红字标在对应字段下并聚焦第一个错误字段。
- [ ] **Step 2: markdown 工具条** —— textarea 上方按钮：`插入图片 / B / · 列表 / ❝ 引用 / </> 代码块`；文本操作用 `selectionStart/End` 切片包装（`**`、`- ` 前缀、`> ` 前缀、围栏）；「预览」页签 `<Markdown source={form.bodyMd} />` 与正文页签互切。
- [ ] **Step 3: 图片插入（正文与封面共用一条管线）** —— `<input type=file accept="image/*">` → `validateImage` → `arrayBuffer()` → 命名 `${form.id}-${序号}.${extFromType(type)}` → `gh.putImage(name, bytes, 'content: 新增图片 '+name)` → 成功：正文在光标处插入 `![说明](/images/works/${name})`（封面则 `form.img = '/images/works/' + name`）；失败保留输入并提示可重试。上传中按钮禁用转圈。spec §3.3：图片与 site.json 是两个 commit，图片成功、json 失败时孤儿图片无害。
- [ ] **Step 4: 保存管线 `save()`** —— 组新 works 数组（新建 push / 编辑替换同 id），写回前按 `date` 字符串倒序排序（与 Task 3 `buildSite` 中的比较器逐字相同：`(a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)`，直接内联在组件里）→ `gh.putSite(newSite, sha)` → 成功：`alert('已提交，站点约 1~2 分钟后自动更新')` → `onSaved()`；`conflict`：提示「内容已被其他设备修改，正在刷新最新数据」并调父级 `refresh` 后停留在编辑器（不清空表单）；按钮 pending 期间禁用。
- [ ] **Step 5: `npm run build` 通过；dev 手工核对（无真 token 时走本地拦截）**：临时在 devtools 里 mock `fetchImpl` 太重——改为核对到「校验红字、工具条文本操作、预览渲染 markdown」三件事即可，提交管线留 Task 8。→ commit `feat: 后台编辑器（markdown 正文、图片上传、保存与冲突处理）`

---

### Task 7: GitHub 仓库、Pages 与首次部署（用户协作步骤已写出原话）

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md`（部署/维护章节重写：后台用法 + PAT 创建指引，删除 works.js 相关段落）

**Interfaces:**
- Produces: 线上 Pages 站点；Task 8 在其上做端到端验收

- [ ] **Step 1: 写 workflow**

```yaml
name: Deploy site
on:
  push: { branches: [main] }
  workflow_dispatch: {}
permissions:
  contents: read
  pages: write
  id-token: write
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: ${{ steps.out.outputs.page_url }} }
    steps:
      - id: out
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: 环境事实（已核实）：本机无 gh CLI，不代为安装软件。建仓/开 Pages 走「网页操作 + git 推送」；若用户自行安装 gh 可回退用 Step 3/4 括号里的命令**
- [ ] **Step 3: 建仓并推送**
  1. 让用户在浏览器打开 `https://github.com/new`，创建**公开**仓库 `my-portfolio`（不勾选 README/gitignore，避免历史冲突）。owner 默认 `Blount-spark`（PROFILE 中的主页），若用户报来不同则以其为准
  2. `git remote add origin https://github.com/Blount-spark/my-portfolio.git && git push -u origin main`（凭据弹窗由用户完成，git credential manager 保存；严禁把 token 写进 remote URL）
  （装了 gh 则等价：`gh repo create Blount-spark/my-portfolio --public --source . --remote origin --push`）
- [ ] **Step 4: 开启 Pages 并确认首次部署**：仓库 Settings → Pages → Build source 选 **GitHub Actions** → push 已触发 workflow，到 Actions 页确认 build+deploy 绿 → Pages 卡片显示 `https://blount-spark.github.io/my-portfolio/`，curl 该地址返回 200 且含「灵感杂货铺」
  （装了 gh 则等价：`gh api -X POST /repos/Blount-spark/my-portfolio/pages -f build_type=workflow -f "source[branch]=main" -f "source[path]=/"`）
- [ ] **Step 5: 回填 `src/data/config.js` 真实 owner/repo（若与默认不同）→ commit + push → 到仓库 Actions 页（或 `curl -s https://api.github.com/repos/Blount-spark/my-portfolio/actions/runs?per_page=1`，公开仓库免鉴权）确认重新部署绿**
- [ ] **Step 6: README 重写「内容维护」章节**：如何进后台（`#/admin`）、PAT 创建逐项截图级文字指引（GitHub → Settings → Developer settings → Fine-grained tokens → 只选目标仓库 → Permissions: Contents: Read and write，其余全 No access → 生成后立刻复制到后台）、换浏览器要重输、发布延迟 1~2 分钟。commit `ci: Actions 构建发布 GitHub Pages；docs: 后台维护指引`

---

### Task 8: 线上端到端验收（spec §8）+ 收尾

**Files:** 无新增（验收驱动小修复；修复按 systematic-debugging 处理）

- [ ] **Step 1: 错 token 拒绝** —— 打开 `https://blount-spark.github.io/my-portfolio/#/admin`（以 Step 7.4 实际 html_url 为准），输随便一串 → 显示「令牌无效或过期」，无数据被改
- [ ] **Step 2: 真 PAT 进入后台** —— 用户按 README 创建并提供 PAT 贴入（值不进对话/日志/代码；只确认成功态）→ 列表显示 12 条
- [ ] **Step 3: 全链路新建** —— 新建一条含中文标点的 markdown（标题/加粗/列表/引用/代码块/图片）→ 上传真实图片（<5MB）→ 保存 → 仓库出现图片与 site.json 两个 commit → Actions 绿 → 前台墙出现新卡、详情页 markdown 与图片渲染正确
- [ ] **Step 4: 编辑与删除** —— 改标题→生效；删除该测试条→前台 1~2 分钟后消失（图片留在仓库属预期，spec §3.3）
- [ ] **Step 5: 边界抽验** —— 传 >5MB 或非图片文件→前端拒并有中文提示；开两个标签页先后保存制造 409→出现「已刷新最新数据」路径且不覆盖丢内容
- [ ] **Step 6: 恢复性** —— 浏览器清 localStorage 后重输 PAT 可恢复工作
- [ ] **Step 7: 旧数据去留** —— 与用户确认示例条目是否删除（用户自行在后台删，或列出保留清单）
- [ ] **Step 8: 最后 `npm test`、`npm run build`、`git status` 干净 → commit（如有零星修复）`chore: 端到端验收修复收尾`**

---

## Self-Review 结论

- Spec 覆盖：§3 数据模型→Task 3；§4 PAT→Task 5；§5 后台三组件→Task 5/6；§6 前台+workflow→Task 4/7；§7 迁移步骤→Task 3+7；§8 验收→Task 8；§9 限制文案进 Task 6 提示与 README。无遗漏。
- 类型一致性：`makeGh` 方法名以 Task 2 接口块为准；entry 形状以 Task 3 site.json 实际生成物为准（Task 5/6 都从 `gh.getSite()` 取，不另造形状）。
- 风险点：GitHub 用户名/仓库名沿用 PROFILE 中的 `Blount-spark`，Task 7 Step 3 有存在性检查兜底；Pages 首建延迟有轮询步骤；本机无 gh CLI（已核实），Task 7 主路径为网页建仓 + git push。
