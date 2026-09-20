# 灵感实践后台提交系统 · 设计文档

日期：2026-09-20 ｜ 状态：待审阅 ｜ 方案：A（同站后台路由 + 单边缘函数）

## 1. 背景与目标

现状：my-portfolio 是部署在 Qoder Sites 的纯静态站（Vite + React 18，hash 路由），全部内容手写维护在 `src/data/works.js`，图片手动放进 `public/images/`，每次更新要改代码、重新构建、重新发布。

目标：在现有站点内增加一个后台页面（`#/admin`），用**单一管理密码**保护，可以：

- 以 **Markdown** 格式撰写「灵感实践」的详情正文，并**上传图片**（上传后自动插入正文）
- 填写与现有作品墙一致的卡片字段（标题、分类、日期、简介、标签、封面、外链）
- 对已发布内容做**列表、编辑、删除**

数据源统一到 Sites 数据库，`works.js` 退役为「函数不可用时的静态兜底数据 + 本地开发种子数据」。

非目标（YAGNI）：多用户账号、草稿箱、定时发布、评论、访问统计、富文本所见即所得编辑器。

## 2. 架构总览

```
浏览器
 ├─ 前台  #/work/<id> 详情（markdown 渲染）、作品墙 ──┐ 同源 fetch
 ├─ 后台  #/admin  登录 / 列表 / 编辑表单 ────────────┤
                                                      ▼
 Qoder Sites Edge Function  functions/ → /functions/v1/app
 ├─ 密码校验、签发/校验会话 token（HMAC）
 ├─ works 表 CRUD（Supabase JS SDK，随附 adapter）
 └─ 图片：签发 Storage 上传 URL；代理读取图片字节
        │                          │
        ▼                          ▼
  Sites 数据库（works 表）    Sites Storage（works/ 前缀对象）
```

- 一个站点、一套部署；数据库、Storage、Functions 均由 Sites 后端提供，不引入任何外部服务。
- 前端保持 Vite + React 静态导出，构建产物 `dist/`；服务端能力全部收敛在唯一一个 `app` 函数里。

## 3. 数据模型

### 3.1 `works` 表（一次迁移创建）

| 列 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid PK（`gen_random_uuid()`） | 替代现有数字 id；详情页路由 `#/work/<uuid>` |
| `title` | text not null | ≤ 80 字符 |
| `category` | text not null | 分类 id，沿用代码里的 `CATEGORIES`（代码常量，暂不入库） |
| `date` | text not null | `YYYY-MM`，与现有一致，用于排序 |
| `desc` | text not null | 卡片简介，≤ 300 字符 |
| `img` | text null | 封面图访问路径（见 5.3）；为空则用 `emoji` |
| `emoji` | text null | 封面表情 |
| `gradient` | jsonb not null | `[起色, 止色]` |
| `tags` | jsonb not null | 字符串数组，1~3 个 |
| `link` | text not null default '#' | 外部链接 |
| `body_md` | text null | **Markdown 详情正文**，取代原 `detail.story/gallery/captions` |
| `created_at` / `updated_at` | timestamptz not null | 同日期时按 `created_at` 倒序 |

排序与首页现有逻辑一致：`date desc, created_at desc`。个人作品集量级小（几十条），前台一次拉全量（上限 200），不做分页。

### 3.2 旧字段映射（works.js → 数据库）

- `detail.story` 各段落 → 拼为 markdown 空行分隔的 `body_md`
- `detail.gallery + captions` → 转成 `body_md` 尾部的图片行 + 斜体说明
- 数字 `id` → uuid；`tiltOf(id)` 的倾斜角改为对 uuid 字符串做稳定哈希取角度，视觉效果不变

### 3.3 RLS 访问策略（已知平台边界，需你知情）

平台侧声明式策略只有 `deny / public / owner(auth.uid())` 三档，而函数运行时的数据库身份是匿名 key——平台不会把 Sites 登录或管理密码翻译成 Supabase 用户。因此：

- **SELECT：public**（作品内容本来就是公开的）
- **INSERT / UPDATE / DELETE：只能对匿名身份开放**，写入门禁由函数层的应用鉴权承担：每个写请求必须携带有效管理 token（HMAC 校验 + 过期时间），函数校验通过后才执行 SQL。
- 这意味着「绕过函数、直接拿数据库端点写数据」是否可行，取决于托管商对数据库端点的物理访问限制。**实施时我会专项验证这一点**（直连探测被限制与否）；若验证发现数据库端点可从公网匿名触达，则回到这里重新决策（例如升级为已验证的应用后端），不会默默上线。

这是当前平台能力下个人站点「单管理员」模式的务实边界：防普通访客，不防能拿到基础设施端点的定向攻击。

## 4. 管理密码与会话

- Secret：`ADMIN_PASSWORD`（Sites 应用 Secret，Portal 设置里录入，可随时更换；换密码即使所有旧 token 失效）。
- `POST ?action=login` `{ password }` → 常量时间比较 → 成功返回 `token = base64({exp, sig=HMAC_SHA256(exp, ADMIN_PASSWORD)})`，有效期 7 天。
- 前端把 token 存 `sessionStorage`（关标签页即失效，进一步降低共享电脑上残留的风险），所有写请求带头 `x-admin-token`；函数侧校验失败统一回 401，前端据此退回密码框并清 token。
- 失败尝试不限速但无任何数据回显；Sites 网关本身对写请求有同源校验。

## 5. API 一览（全部走 `/functions/v1/app`）

| action | 方法 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| `list` | GET | 无 | 全量公开作品（字段白名单，不含敏感内部列） |
| `get&id` | GET | 无 | 单条（含 `body_md`） |
| `login` | POST | 密码 | 签发 token |
| `create` | POST | token | 新增，服务端生成 id/时间戳，字段白名单 + 长度/类型校验 |
| `update` | POST | token | 按 id 更新白名单字段，校验 `updated_at` |
| `delete` | POST | token | 按 id 删除（连带删除其 Storage 图片尽力而为，孤儿对象不影响正确性） |
| `sign-upload` | POST | token | 校验 MIME∈{png,jpeg,webp,gif}、≤5MB → 生成 `works/<uuid>.<ext>` → 返回签名直传 URL |
| `image?path=` | GET | 无 | 代理读取：path 强制 `works/` 前缀 + 拒绝穿越 → `storage.download` 回字节，带正确 Content-Type 与长缓存头 |

错误约定：400 输入非法（带稳定错误码）、401 未登录/密码错/token 过期、403 上下文非法、503 固定文案（不外泄原始错误）。未知 action 404，方法不符 405。

### 图片链路与鉴权补充

1. 编辑器点「插入图片」→ `sign-upload` → 浏览器 PUT 直传签名 URL → 服务端 `download` 回读验证字节数与 MIME（复用平台 `verifyUploadedObject` 模式）→ 才算成功
2. 成功后向 textarea 光标处插入 `![说明](/functions/v1/app?action=image&path=works/xxx.png)`；封面图选择器同一次上传、写 `img` 字段
3. 相对路径写法在本地 dev（vite 代理）与线上（网关路由）下通用
4. 若实施中验证 Storage 支持公开读 URL，则正文图片切换为直链、函数不再代理字节（二选一，接口形状不变）

## 6. 前端改动

保持现有拼贴手账风格与全部 CSS 变量，新增/修改：

- `src/api.js`：`requestJson` 同源请求助手（沿用平台模式：校验 JSON 形状、区分错误码、401 上抛）
- `src/App.jsx`：
  - 顶层数据从 `import WORKS` 改为 `useWorks()`：启动时拉 `?action=list`，成功用数据库数据，**失败回退 `works.js` 内置数据**（顶栏出现「离线预览」小纸条，仅 dev 可见）——函数抖动不会让墙变白
  - `useHashRoute` 增加 `#/admin` 分支；`#/work/<id>` 查找源换成同一份列表
- 前台详情页：`detail.story/gallery/captions` 渲染替换为 markdown 渲染（`react-markdown` + `rehype-sanitize`，白名单常用语法：标题/加粗斜体/列表/引用/代码块/链接/图片）。正文经 sanitize 后渲染，访客侧 XSS 有底线防护
- 后台 `src/admin/`：
  - `AdminApp.jsx`：token 守卫 → 列表视图 ⇄ 编辑视图
  - `WorkList.jsx`：倒序表格，行内「编辑 / 删除（二次确认）」，顶部「＋ 新的灵感实践」
  - `WorkEditor.jsx`：分区表单（卡片字段 / 正文），markdown textarea + 小工具条（插入图片、加粗、列表、代码块、引用按钮），右侧「预览」页签复用前台同一渲染组件；提交中禁用按钮、失败保留全部输入（含已上传图片）
  - 风格沿用现有纸张/胶带/贴纸元素，不引入 UI 组件库
- 新增依赖：`react-markdown`、`rehype-sanitize`（仅此两个）
- `vite.config.js`：dev 代理 `/functions/v1/app → 127.0.0.1:8000`（本地 fixture 服务）
- `works.js`：保留为兜底 + 种子；`CATEGORIES` 仍从此文件导出

## 7. 数据迁移

上线后执行一次：本地脚本读取 `works.js` 现有条目 → 按第 3.2 节映射 → 经 `create` 接口逐条写入（用真实站点与密码）。条目少、一次性、不需要回滚机制（数据库表可整表清空重来）。示例数据不迁移，只迁你保留下来的真实内容（迁移前你给我一份要保留的条目清单，或全部照迁后你在后台删）。

## 8. 错误处理与恢复

- 首页：`list` 失败 → 渲染 `works.js` 兜底 + 重试按钮；空数据库 → 空态文案
- 编辑器：任何失败不回显输入；`update` 用 `updated_at` 做乐观检查，冲突时提示「内容已被别处修改，请刷新后重贴」，不自动覆盖
- 上传：PUT 失败/回读校验失败 → 该图片不写入正文、不记入成功态，可重试；未知结果先按 objectPath 回读对账，不盲目重传
- 函数数据库超时 = 结果未知：写请求超时后前端提示「可能已保存，请在列表中确认」，列表刷新为权威，绝不自动重放 POST

## 9. 验证计划（实施完成的验收口径）

本地（fixture，明确标注为本地样例）：

1. `npm run build` 通过；`deno check functions/index.ts` 通过
2. 登录：错密码 401 / 正确密码得 token
3. 全链路：登录 → 建条（含 markdown + 假图片上传回读）→ 列表出现 → 前台详情正确渲染
4. 边界抽验：非图片 MIME 拒绝、token 过期 401、`image?path=../` 穿越拒绝

线上（已发布站点，发布预览不执行函数，必须在真站点验证）：

5. 一次代表性真实请求贯穿：login → create → 前台 list 可见 → 真图片上传后前台可见
6. 3.3 节两项专项验证：数据库端点公网可达性；Storage 是否有公开读 URL
7. 迁移脚本跑通、旧数据以数据库为源展示正常

## 10. 部署与配置步骤（实施计划会展开）

1. `ensure_backend` 开启 Database / Functions / Storage，等待就绪
2. `sites-management` 创建并应用 `works` 表迁移，按 3.3 配 `accessPolicies`，记录版本号
3. Portal 录入 `ADMIN_PASSWORD`，确认同步
4. 首次带后端发布按 sites-hosting 流程：`prepare_site`（`webDirectory: dist`、`functionDirectory: functions`、`databaseAccess: read_write`、`requiredSchemaVersion`、`secretNames: [ADMIN_PASSWORD]`）→ 发布 → 线上验证
5. 运行迁移脚本导入存量内容

## 11. 开放事项（不阻塞设计，实施前需落定）

1. **站点绑定**：本地项目里没有 `.站点名称.qoder.site` 描述符；实施时若无法自动定位你现有站点，需要你提供站点地址（或确认在云端新建站点并替换旧地址）。
2. 3.3 节两项平台边界验证结果可能微调第 5/10 节的做法（不影响整体架构）。
3. 迁移保留清单（第 7 节）由你确认。
