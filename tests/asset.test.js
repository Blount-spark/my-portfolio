import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assetSrc } from '../src/lib/asset.js'

// Pages 项目子目录托管（vite base './'）下，根相对路径会打到域名根 → 404。
// 存储保持 /images/works/...（spec §3.1 规范形式），只在渲染时降级为相对 base 的路径。
test('assetSrc：根相对路径去掉开头的 /（子目录托管不 404）', () => {
  assert.equal(assetSrc('/images/works/a.png'), 'images/works/a.png')
  assert.equal(assetSrc('/a/b/c.jpg'), 'a/b/c.jpg')
})

test('assetSrc：协议相对 / 绝对 URL / data: 原样返回', () => {
  assert.equal(assetSrc('//cdn.com/x.png'), '//cdn.com/x.png')
  assert.equal(assetSrc('https://x.com/a.png'), 'https://x.com/a.png')
  assert.equal(assetSrc('http://x.com/a.png'), 'http://x.com/a.png')
  assert.equal(assetSrc('data:image/png;base64,iVBOR'), 'data:image/png;base64,iVBOR')
  assert.equal(assetSrc('images/works/a.png'), 'images/works/a.png')
})

test('assetSrc：空值与非字符串原样透传（不吞成空串）', () => {
  assert.equal(assetSrc(undefined), undefined)
  assert.equal(assetSrc(null), null)
  assert.equal(assetSrc(''), '')
  assert.equal(assetSrc(123), 123)
  assert.deepEqual(assetSrc({ url: '/a.png' }), { url: '/a.png' })
})
