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

  // 扫标题。
  //
  // ★ 这里**不能只依赖 [pathname]**，那有过一个很隐蔽的 bug：
  //   TanStack Router 的客户端导航里，pathname 先更新（urgent），
  //   路由内容后更新（transition）。所以 effect 跑的时候 DOM 里还是
  //   【上一页】的标题 —— 表现是右侧目录永远慢一整页，
  //   而整页刷新（硬导航）却是对的，因为那时 DOM 已经是新的了。
  //
  //   修法：除了 pathname，再挂一个 MutationObserver 盯住正文容器。
  //   内容一换就重扫。这样不管框架什么时候 commit，都能跟上。
  useEffect(() => {
    let stopped = false
    let raf = 0

    const collect = () => {
      const root = document.querySelector('.prose')
      if (!root) return
      const found = [...root.querySelectorAll<HTMLElement>('h2[id], h3[id]')].map((h) => ({
        id: h.id,
        text: h.textContent ?? '',
        level: h.tagName === 'H3' ? 3 : 2,
      }))
      if (stopped) return
      setHeads((prev) => {
        // 内容没变就别 setState，否则 observer 会把自己触发成死循环
        if (prev.length === found.length && prev.every((p, i) => p.id === found[i]!.id)) return prev
        return found
      })
    }

    collect() // 先来一次（硬导航时 DOM 已经就绪）

    // 观察 main（它在路由切换间是常驻的，.prose 本身会被换掉）
    const target = document.querySelector('main.doc-main') ?? document.body
    const obs = new MutationObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(collect)
    })
    obs.observe(target, { childList: true, subtree: true })

    return () => {
      stopped = true
      obs.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [pathname])

  // 滚动高亮：以视口上方 1/3 处为「当前读到哪」的判据
  useEffect(() => {
    if (!heads.length) return
    // 换了页先把高亮清掉，否则会停在上一页的 id 上（那个 id 已经不存在了）
    setActive(null)
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
