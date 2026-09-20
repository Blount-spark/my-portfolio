# 灵感杂货铺 · 个人作品展示网页

一个不设领域边界的个人作品集：代码、影像、写作、手工……只要一个想法真的被做出来了，它就会出现在这面墙上。作品不一定成熟，但都是真的动手。

- **技术栈**：Vite + React 18，纯 CSS（无 UI 库、无路由库），依赖极少
- **风格**：活泼多彩拼贴手账风（点阵纸背景、胶带、歪斜卡片、贴纸标题）
- **内容维护**：打开网页后台 `站点地址/#/admin` 就能新增/编辑/删除，图片直接上传，不用再碰代码
- **部署**：push 到 main 分支 → GitHub Actions 自动构建发布到 GitHub Pages，约 1~2 分钟上线

线上地址：<https://blount-spark.github.io/my-portfolio/>

## 每天怎么用：打开后台就行

在浏览器打开 **`https://blount-spark.github.io/my-portfolio/#/admin`**，贴上令牌进入后台：

- **新增**：点「＋ 新的灵感实践」，填标题、分类、日期、一句话简介、标签、外部链接，选个封面 emoji 或渐变色，正文「制作手记」直接写 Markdown（支持标题/列表/表格/图片）
- **编辑 / 删除**：列表里每条作品都有「编辑」「删除」按钮（删除会弹二次确认），改完点「💾 保存到仓库」提交
- **传图片**：编辑页里点「🖼️ 上传封面」或在正文工具条点「🖼️ 插入图片」，选本地图片即可——图片会自动传到仓库 `public/images/works/`，正文里的引用路径也自动填好
- **生效时间**：保存成功后内容立刻写进 GitHub 仓库，Actions 会在后台重新构建发布，**等 1~2 分钟刷新前台**就能看到新样子。不用一直盯着，去喝口水正好

必填项没填对时，对应格子下面会标红字、提交会被拦下来；真删错了也别慌，Git 历史随时能找回来。

### 第一次进入后台：创建一个 GitHub 令牌（PAT）

后台需要一个「钥匙」才能替你向 GitHub 提交内容，这把钥匙叫 **Fine-grained Personal Access Token**。全程在 GitHub 网页上点选，约两分钟：

1. 登录 GitHub，点右上角头像 → **Settings**
2. 左侧菜单拉到最底部 → **Developer settings**
3. 点 **Personal access tokens** → 选 **Fine-grained tokens**（注意不是右侧的 Tokens (classic)）→ 点 **Generate new token**
4. **Token name** 随便起，比如 `my-portfolio-admin`
5. **Expiration** 建议设一个过期日（比如 90 天或自定义）——到期后重新生成一个、在后台重贴一次即可，比永久钥匙安全
6. **Repository access** 选 **Only select repositories**，在下面的搜索框里选中 **`my-portfolio`** 这一个仓库（千万别选 All repositories，钥匙泄露影响面太大）
7. 展开 **Permissions** → **Repository permissions** → 找到 **Contents**，拨成 **Read and write**（Metadata 会自动带上 Read-only，正常）；**其它权限一律保持 No access**
8. 拉到底点 **Generate token**，立刻复制以 `github_pat_` 开头的那串字符
9. 回到 `#/admin` 页面，粘贴进令牌输入框 → 点「进入后台」，验证通过就能用了

三件事要记住：

- 令牌只存在**这台浏览器**的本地存储里，不经过任何第三方服务器；**换电脑或换浏览器要重输一次**，这是设计如此，不是 bug
- 这个令牌等于你仓库的写作权：**泄露它 = 任何人都能改你这面墙**。万一泄露，去 GitHub 令牌页面点 Delete/Revoke 立刻作废，再建一个；被改乱的内容 Git 历史都能回滚
- 令牌过期后后台会提示「令牌无效或过期」，重新生成一个贴上即可，网站本身不受影响

## 背后是怎么工作的（可以不看）

- 后台本身就是一段纯静态网页，没有服务器。它拿着你的令牌**直接调 GitHub API** 提交改动：作品数据写在 **`src/data/site.json`**，图片提交到仓库 `public/images/works/`
- 每次提交都会触发 GitHub Actions 重新构建、发布整站，所以「保存 → 上线」有一两分钟延迟
- 个人信息在 `src/data/profile.js`，仓库位置（owner/repo）在 `src/data/config.js`，这两处一般不动
- 仍然会写代码的话，本地直接改 `src/data/site.json` 再 push，效果和后台一模一样——后台只是省掉了这一步

## 快速开始（本地开发）

```bash
npm install        # 安装依赖（仅首次）
npm run dev        # 本地开发，改文件即时生效
npm test           # 跑单元测试（28 条）
npm run build      # 构建，产物在 dist/
npm run preview    # 本地预览构建结果
```

## 项目结构

```
my-portfolio/
├── index.html              # 页面骨架、标题、SEO 描述
├── .github/workflows/
│   └── deploy.yml          # push main → 自动构建发布到 Pages
├── public/images/works/    # 后台上传的图片落在这
├── src/
│   ├── main.jsx            # 入口
│   ├── App.jsx             # 前台：Hero / 作品墙 / 筛选 / 详情页
│   ├── index.css           # 全部样式（拼贴风）
│   ├── data/
│   │   ├── site.json       # ★ 全部作品内容（后台写入的文件）
│   │   ├── profile.js      # 个人信息
│   │   └── config.js       # GitHub 仓库定位（owner/repo）
│   ├── admin/              # 内容后台（#/admin 路由下）
│   ├── lib/                # 纯函数：GitHub API 客户端、校验、路由等
│   └── components/         # Markdown 渲染等小组件
└── tests/                  # node --test 单元测试
```

没有 functions/、没有后端服务、没有数据库——全部家当就是这个静态仓库本身。

## 部署上线

正常情况你什么都不用做：**往 main 分支 push 一次提交**（或后台保存一条作品），GitHub Actions 就会自动构建并发布。

- 构建流水线：`npm ci → npm test → npm run build → 上传 dist/ → 发布 Pages`，测试不过不会发布，线上传不了坏版本
- 仓库必须是**公开（public）**：GitHub 免费版的 Pages 只服务公开仓库，**把仓库转成私有，网站会直接停掉**
- 开通 Pages（Settings → Pages → Build source 选 GitHub Actions）是一次性的，**首次部署时由维护者完成**；想手动触发一次发布，去仓库 Actions 页 → Deploy site → Run workflow

## 常见问题

**后台保存了，前台没变化？** 等 1~2 分钟再刷新（强刷 Ctrl+Shift+R）。Actions 构建发布需要时间；要是几分钟后还没变，去仓库 **Actions** 页看那次「Deploy site」运行是否变红，红了点进去看报错。

**换电脑 / 换浏览器，后台又要我输令牌？** 正常。令牌只存在原浏览器的本地存储里，不上传任何地方，新环境重贴一次即可。

**图片上传被拒「图片超过 5MB」？** 后台限单张 5MB。先用 [squoosh.app](https://squoosh.app) 压到 500KB 以内再传——仓库更轻、访客加载也快。

**本地改了数据页面没变？** 确认跑的是 `npm run dev`（开发）而不是 `npm run preview`（预览的是上次构建的旧产物）。

**想改配色/字体？** 都在 `src/index.css` 顶部的 `:root` 变量里（纸张色、墨色、卡片色）。
