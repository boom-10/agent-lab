import type { BookRef } from '@/content/manifest'

/**
 * 「对应的书」：课程页上的阅读入口，列出这一节要读的书章节。
 *
 * 只放链接，不转载正文（书的正文是 CC BY-NC-SA 4.0）。
 * 链接在新标签页打开，读完再回来做这一节。
 */
export function BookRefs({ books }: { books: BookRef[] }) {
  if (books.length === 0) return null
  return (
    <aside className="book-refs" aria-label="对应的书">
      <div className="book-refs-title">对应的书 · waylandz《AI Agent 架构模式与实战》</div>
      <p className="book-refs-hint">建议先读对应章节，再做这一节。书里的代码基于 Shannon，我们只借概念，代码自己写。</p>
      <ul>
        {books.map((b) => (
          <li key={b.href}>
            <a href={b.href} target="_blank" rel="noopener noreferrer">
              {b.title}
            </a>
            {b.note && <span className="book-refs-note">　{b.note}</span>}
          </li>
        ))}
      </ul>
    </aside>
  )
}
