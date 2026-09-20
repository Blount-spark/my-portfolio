# 灵感实践后台提交系统 · 设计文档（v2 · 路线 1：GitHub）

日期：2026-09-20 ｜ 状态：待审阅 ｜ 取代 v1（Qoder Sites 后端方案，因 Free 计划无法开通数据库/存储后端而作废）

## 1. 背景与目标

现状：my-portfolio 是纯静态站（Vite + React 18，hash 路由），全部内容手写维护在 `src/data/works.js`，图片手动放进 `public/images/`，每次更新要改代码、重新构建、重新发布。

目标：部署到 **GitHub Pages**，并在站点内提供一个后台页面（`#/admin`），可以：

- 以 **Markdown** 撰写「灵感实践」正文，**上传图片**（上传后自动插入正文）
- 填写卡片字段（标题、分类、日期、简介、标签、封面、外链）
- 对已有内容做列表、编辑、删除

核心思路：**仓库即数据库**。后台页面用你的 GitHub 细粒度令牌直接提 commit 改仓库里的内容文件与图片，GitHub Actions 自动构建并发布 Pages，约 1~2 分钟后前台生效。全程无服务器、无第三方付费服务，数据就是 Git 文件（天然版本历史，随时可导出/迁移）。

非目标（YAGNI）：即时发布（接受 1~2 分钟构建延迟）、多用户协作、草稿箱、评论、访问统计、所见即所得编辑器。

## 2. 架构总览

```
浏览器 #/admin（后台页，公开部署但需 PAT 才能操作）
  │  GitHub REST API（fetch，携带 fine-grained PAT）
  ▼
GitHub 仓库  ── src/data/site.json（内容数据）
  │            ── public/images/works/*（图片，base64 提交）
  │ push 触发
  ▼
GitHub Actions（构建 vite → Pages 发布）
  ▼
GitHub Pages（前台墙 + 详情页 + 后台页本体）
```

前台是纯静态：内容在**构建时**打进产物，运行时不请求任何 API；只有后台页在操作时调 GitHub API。

## 3. 数据模型（文件即数据库）

### 3.1 `src/data/site.json`（新建，取代 works.js）

```json
{
  "categories": [ { "id": "code", "label": "代码", "emoji": "💻" } ],
  "works": [
    {
      "id": "w-m2xk9f-7c",            // 新建时服务端无关：由保存时刻生成 `w-<时间戳36进制>-<2位随机>`，稳定不变、可进 URL；旧数字 id 迁移时映射为 `w-legacy-<旧id>`
      "title": "…", "category": "code", "date": "2026-09",
      "desc": "…", "tags": ["…"], "link": "#",
      "emoji": "✨", "img": "/images/works/xxx.png",   // img 优先，二选一
      "gradient": ["#a8edea", "#fed6e3"],
      "bodyMd": "## 第一段\n\n正文 markdown，图片写 ![说明](/images/works/a.png)"
    }
  ]
}
```

- `id` 从数字改为 slug：`tiltOf` 倾斜角改为对 id 字符串做稳定哈希，视觉效果不变
- `detail.story/gallery/captions` 结构废除 → 统一进 `bodyMd`（旧 gallery 迁移时转为图片行 + 斜体说明）
- `PROFILE`（个人信息）仍留在代码里，不纳入后台（改得少，YAGNI；后台结构预留扩展位置）
- 排序沿用现逻辑：`date` 倒序，写入时按此排好再序列化

### 3.2 图片

- 路径：`public/images/works/<id>-<n>.<ext>`，后台上传即 base64 经 Contents API 提交
- 限制：MIME ∈ {png, jpeg, webp, gif}，单张 ≤ 5MB（Pages 图片建议 ≤ 500KB，编辑器里给压缩提示文案）
- 封面（`img`）与正文图片同一条链路

### 3.3 写入与并发

- Contents API 更新文件必须带当前 blob `sha`：后台每次进入/保存前都先拉最新 `site.json`，冲突（409）则提示「内容已被其他设备修改，已为你刷新最新数据，请重新提交」，不自动覆盖
- 一次「保存」= 最多两个 commit（先传新图片，再更新 site.json），全部成功才算保存成功；图片 commit 成功但 json 失败时，孤儿图片无害，重试即可

## 4. 后台鉴权：GitHub 细粒度 PAT

- 后台页首次进入要求输入 PAT，验证方式：`GET /repos/{owner}/{repo}/contents/src/data/site.json` 带 token 能 200 即通过；token 存 `localStorage`，之后免输
- 你创建 token 时按最小权限：**指定单个仓库 + Contents: Read and write**，其余全部不设；建议设过期日
- 无服务端，因此没有「密码校验接口」——PAT 本身就是唯一门槛；公开页面上只有表单，不存任何凭据提示
- 已知边界（接受）：token 泄露 = 该仓库内容可被改写（Git 历史可回滚）；换浏览器需重输一次 token

## 5. 后台页面功能（`src/admin/`）

- `AdminApp.jsx`：无 token → 令牌输入卡；有 → 列表 ⇄ 编辑
- `WorkList.jsx`：按 site.json 顺序倒显，行内编辑 / 删除（二次确认），顶部「＋ 新的灵感实践」；显示当前内容对应的最近 commit 时间
- `WorkEditor.jsx`：卡片字段表单 + markdown textarea（工具条：插入图片/加粗/列表/引用/代码块）+「预览」页签（与前台同一渲染组件）；保存 = 上传图片 → 更新 site.json；成功后提示「已提交，站点约 1~2 分钟后自动更新」
- 失败保留全部输入（含已上传图片），提交中禁用按钮

## 6. 前台改动

- `works.js` → `site.json`（vite 直接 import JSON），一次性把现有条目按 3.1 映射迁入后删除 works.js
- 详情页正文改 markdown 渲染：新增依赖 `react-markdown` + `rehype-sanitize`（白名单常用语法；sanitize 保证渲染访客侧无 XSS 面）
- `useHashRoute` 增加 `#/admin`；其余视觉（拼贴手账、CATEGORIES 筛选、tilt）不变
- 构建发布：`.github/workflows/deploy.yml`（checkout → setup-node → npm ci → npm run build → upload → deploy-pages），Pages source 设为 GitHub Actions；`vite.config.js` 保持 `base: './'` + hash 路由，项目页/自定义域名均可用

## 7. 迁移与上线步骤

1. 我：仓库转 GitHub（本地 git 已初始化）→ 生成 site.json 迁移 + 后台代码 + workflow → 本地 `npm run build` 通过
2. 你：创建**公开**仓库并 push（Pages 免费版要求公开）；创建 fine-grained PAT（照我给的清单点选，2 分钟）
3. 我：开启 Pages（source=Actions）→ 首建发布 → 用你的 PAT 走一次真实端到端验证（见 §8）
4. 你：后台把示例数据改成真实内容；旧 `public/images` 图片随仓库自然带过去

## 8. 验证计划（验收口径）

本地：`npm run build` 通过；site.json 迁移后前台渲染与旧版一致（抽查 markdown 渲染/图片路径）。

真实端到端（唯一可信验收，发布后在 Pages 站点上做）：

1. 错 token 被拒（401 路径）；正确 PAT 进入后台
2. 新建一条（含 markdown 真图片上传）→ 仓库出现 2 个 commit → Actions 构建绿 → 前台墙与详情正确显示
3. 编辑该条 → 生效；删除 → 前台消失（图片留仓库，无害）
4. 边界：>5MB/非图片 MIME 前端拒；两设备并发改 site.json 的 409 提示路径
5. 换浏览器/清 localStorage 后重新输 token 可恢复

## 9. 已知限制（如实记录）

- **发布延迟 1~2 分钟**（Actions 构建），后台不显示实时「已上线」，只提示构建队列；如需确认可看仓库 Actions 页
- 图片走仓库文件，量大后仓库体积增长（Git 不分桶），个人作品集量级无碍
- token 存浏览器本地（§4 边界）；仓库必须公开
- GitHub 服务条款下 Pages 限非商业个人站点，作品集符合

## 10. 开放事项（实施前需你确认/操作）

1. GitHub 用户名/新仓库名（建议 `my-portfolio` 或你的域名习惯）
2. PAT 创建（平台不允许我代生成凭据，我给逐步指引，你粘贴给后台页）
3. 已有 Qoder Sites 上如有已发布版本：确认 GitHub 上线后是否弃用/保留
