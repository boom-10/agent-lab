import { useEffect, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'

type Head = { id: string; text: string; level: number }

/**
 * 右：本页内容（TOC）+ 滚动高亮。
 *
 * 标题直接从渲染后的正文 DOM 里扫，而不是从 MDX 导出 ——
 * 这样作者不用维护任何清单，加个 ## 标题就自动出现在目录里。
 */
export function Toc() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [heads, setHeads] = useState<Head[]>([])
  const [active, setActive] = useState<string | null>(null)

  // 路由变化后重新扫标题
  useEffect(() => {
    let cancelled = false
    const collect = () => {
      const root = document.querySelector('.prose')
      if (!root) return false
      const found = [...root.querySelectorAll<HTMLElement>('h2[id], h3[id]')].map((h) => ({
        id: h.id,
        text: h.textContent ?? '',
        level: h.tagName === 'H3' ? 3 : 2,
      }))
      if (!cancelled) setHeads(found)
      return true
    }
    if (!collect()) {
      // 首帧可能还没挂上，等一拍
      const t = setTimeout(collect, 60)
      return () => {
        cancelled = true
        clearTimeout(t)
      }
    }
  }, [pathname])

  // 滚动高亮：以视口上方 1/3 处为「当前读到哪」的判据
  useEffect(() => {
    if (!heads.length) return
    const onScroll = () => {
      const line = window.scrollY + window.innerHeight / 3
      let cur: string | null = null
      for (const h of heads) {
        const el = document.getElementById(h.id)
        if (el && el.offsetTop <= line) cur = h.id
      }
      setActive(cur)
    }
    let raf = 0
    const handler = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(onScroll)
    }
    window.addEventListener('scroll', handler, { passive: true })
    window.addEventListener('resize', handler, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', handler)
      window.removeEventListener('resize', handler)
      cancelAnimationFrame(raf)
    }
  }, [heads])

  // 高亮项自动滚进可视区。
  // 目录比视口长时，当前小节可能滚到看不见的地方 —— 那「我在哪」就白标了。
  // block:'nearest' 是关键：只在真的看不见时才滚，且滚最小距离，不打断阅读。
  useEffect(() => {
    if (!active) return
    document
      .querySelector(`.doc-rail a[href="#${CSS.escape(active)}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!heads.length) return <aside className="doc-rail no-print" />

  return (
    <aside className="doc-rail no-print sticky top-[var(--spacing-topbar)] max-h-[calc(100vh-var(--spacing-topbar))] overflow-y-auto py-12 text-[0.86rem]">
      <div className="mb-2.5 flex items-center gap-1.5 text-[0.8rem] font-semibold text-ink-soft">
        <span className="text-ink-faint">≡</span> 本页内容
      </div>
      {heads.map((h) => {
        const on = active === h.id
        return (
          <a
            key={h.id}
            href={`#${h.id}`}
            className={[
              'block border-l-2 py-1 no-underline leading-snug transition-colors',
              h.level === 3 ? 'pl-6 text-[0.82rem]' : 'pl-3.5',
              on ? 'border-accent font-semibold text-accent' : 'border-line text-ink-faint hover:text-ink',
            ].join(' ')}
          >
            {h.text}
          </a>
        )
      })}
    </aside>
  )
}
