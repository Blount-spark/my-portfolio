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
