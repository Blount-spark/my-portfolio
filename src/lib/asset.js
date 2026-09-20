// 内容里的图片路径在 site.json 中保持「根相对」规范形式（spec §3.1：/images/works/x.png），
// 但站点用 vite base './' 发布到 Pages 的项目子目录（/仓库名/）下，
// 浏览器会把 /images/... 解析到域名根 → 404。所以只在渲染那一刻把开头的 '/' 去掉，
// 让它相对当前页面解析（'./' 下与仓库名同级）。存储侧一个字都不改，Git 历史里仍是规范路径。
// 协议相对（//cdn/...）、绝对 URL、data:、非字符串一律原样返回。
export const assetSrc = (p) => (typeof p === 'string' && /^\/(?!\/)/.test(p) ? p.slice(1) : p)
