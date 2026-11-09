import type { MDXComponents } from 'mdx/types'
import { Quiz } from '@/components/Quiz'
import { BufferDemo } from '@/components/BufferDemo'
import { CodeBlock } from '@/components/CodeBlock'

/** 提示框。MDX 里：<Callout kind="do" title="现在就做">…</Callout> */
export function Callout({
  kind = 'note',
  title,
  children,
}: {
  kind?: 'note' | 'do' | 'warn' | 'good'
  title?: string
  children: React.ReactNode
}) {
  const tone = {
    note: 'bg-subtle border-line-soft',
    do: 'bg-accent-soft border-accent-line',
    warn: 'bg-warn-bg border-[#f5e0c0]',
    good: 'bg-ok-bg border-[#c9ecd6]',
  }[kind]

  const labelTone = {
    note: 'text-ink',
    do: 'text-accent',
    warn: 'text-warn',
    good: 'text-ok',
  }[kind]

  return (
    <div className={`mb-6 rounded-xl border px-5 py-4 text-[0.95rem] ${tone}`}>
      {title && <div className={`mb-1.5 text-[0.9rem] font-bold ${labelTone}`}>{title}</div>}
      <div className="[&>*:last-child]:mb-0">{children}</div>
    </div>
  )
}

/**
 * 外部链接：一律新标签打开。
 * 读书、查文档时不会把课程页面顶掉，回来能接着做。
 * 站内链接（/ 开头）和页内锚点（# 开头）保持原样。
 */
export function ExternalLink({ href = '', children, ...props }: React.ComponentPropsWithoutRef<'a'>) {
  if (!/^https?:\/\//i.test(href)) return <a href={href} {...props}>{children}</a>
  return (
    <a href={href} {...props} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

/** 课程的 eyebrow 小标 */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow">{children}</div>
}

/** 导语 */
export function Lede({ children }: { children: React.ReactNode }) {
  return <p className="lede">{children}</p>
}

export const mdxComponents: MDXComponents = {
  // 覆盖 pre，给每个代码块加「复制」按钮
  pre: CodeBlock,
  // 外链一律新标签打开
  a: ExternalLink,
  Quiz,
  BufferDemo,
  Callout,
  Eyebrow,
  Lede,
}
