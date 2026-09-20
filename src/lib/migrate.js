// 一次性数据迁移：legacy works.js 形状 → site.json entry（spec §3.1）。仅 scripts/migrate-works.mjs 与测试使用，不进运行时。

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
