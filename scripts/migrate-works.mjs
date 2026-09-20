// 一次性迁移：读旧 works.js → 生成 src/data/site.json（spec §3.1）。历史保留，勿再接入运行时。
import { CATEGORIES, WORKS } from '../src/data/works.js'
import { buildSite } from '../src/lib/migrate.js'
import { writeFileSync, mkdirSync } from 'node:fs'

mkdirSync('src/data', { recursive: true })
writeFileSync('src/data/site.json', JSON.stringify(buildSite({ categories: CATEGORIES, works: WORKS }), null, 2) + '\n')
console.log('site.json 已生成')
