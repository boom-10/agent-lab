import type { MDXComponents } from 'mdx/types'
import { Quiz } from '@/components/Quiz'
import { BufferDemo } from '@/components/BufferDemo'

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

/** 课程的 eyebrow 小标 */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow">{children}</div>
}

/** 导语 */
export function Lede({ children }: { children: React.ReactNode }) {
  return <p className="lede">{children}</p>
}

export const mdxComponents: MDXComponents = {
  Quiz,
  BufferDemo,
  Callout,
  Eyebrow,
  Lede,
}
