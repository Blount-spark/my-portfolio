import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

// 正文 markdown → React 元素；sanitize 白名单常用语法（spec §6），相对路径图片原样通过
export default function Markdown({ source }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{source || ''}</ReactMarkdown>
    </div>
  )
}
