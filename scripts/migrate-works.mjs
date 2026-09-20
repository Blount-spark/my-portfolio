// 一次性迁移：读旧 works.js → 生成 src/data/site.json（spec §3.1）。历史保留，勿再接入运行时。
// ⚠️ 已执行完毕，仅作留档：src/data/works.js 已随前台切换删除（Task 4），本脚本不再参与构建，直接运行会因找不到 works.js 报错。
import { CATEGORIES, WORKS } from '../src/data/works.js'
import { buildSite } from '../src/lib/migrate.js'
import { writeFileSync, mkdirSync } from 'node:fs'

mkdirSync('src/data', { recursive: true })
writeFileSync('src/data/site.json', JSON.stringify(buildSite({ categories: CATEGORIES, works: WORKS }), null, 2) + '\n')
console.log('site.json 已生成')
