// hash 路由的 slug 还原：#/work/<slug> 里 <slug> 可能被浏览器 percent 编码。
// decodeURIComponent 对畸形 percent 序列（手输 #/work/%、聊天软件截断的 %E7%BC）会抛 URIError，
// 若发生在 App render 里会卸载整个 React 根、全站白屏。
// 这里捕获后原样返回：非法 slug 匹配不到任何 work.id，自然回落作品墙（与旧 Number() 静默 NaN 一致）。
export function decodeSlug(raw) {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}
