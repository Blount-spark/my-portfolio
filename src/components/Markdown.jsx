import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { useMemo } from 'react'
import { assetSrc } from '../lib/asset.js'

// 正文 markdown → React 元素；sanitize 白名单常用语法（spec §6），相对路径图片原样通过
// 正文里的图片写的是根相对 /images/works/...（spec §3.1 规范形式），
// img 组件在这里过一遍 assetSrc：Pages 项目子目录托管下否则 404。
export default function Markdown({ source }) {
  // memo 于 source：后台预览（Task 6）每敲一键都重渲染，不 memo 会整条 remark→rehype→sanitize 重跑
  const body = useMemo(
    () => (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{ img: ({ src, ...rest }) => <img {...rest} src={assetSrc(src)} /> }}
      >{source || ''}</ReactMarkdown>
    ),
    [source]
  )
  return <div className="md">{body}</div>
}
