import { BOOK_NAMES, type BookId, type BookRef } from '@/content/manifest'

/**
 * 「对应的书」：课程页上的阅读入口，按书分组列出这一节要读的章节。
 *
 * 只放链接，不转载正文（两本书都是 CC BY-NC-SA 4.0）。
 * 链接在新标签页打开，读完再回来做这一节。
 */
export function BookRefs({ books }: { books: BookRef[] }) {
  if (books.length === 0) return null

  // 按书分组，保持传入顺序（同一本书的章节挨在一起）
  const groups: { book: BookId; items: BookRef[] }[] = []
  for (const b of books) {
    const last = groups[groups.length - 1]
    if (last && last.book === b.book) last.items.push(b)
    else groups.push({ book: b.book, items: [b] })
  }

  return (
    <aside className="book-refs" aria-label="对应的书">
      <div className="book-refs-title">对应的书</div>
      <p className="book-refs-hint">
        建议先读对应章节，再做这一节。两本书都是 CC BY-NC-SA 4.0：我们只借概念，代码自己写。
      </p>
      {groups.map((g) => (
        <div key={g.book} className="book-refs-group">
          <div className="book-refs-book">{BOOK_NAMES[g.book]}</div>
          <ul>
            {g.items.map((b) => (
              <li key={b.href}>
                <a href={b.href} target="_blank" rel="noopener noreferrer">
                  {b.title}
                </a>
                {b.note && <span className="book-refs-note">　{b.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  )
}
