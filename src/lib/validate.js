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
