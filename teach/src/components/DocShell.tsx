import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { chapters, references, totalLessons } from '@/content/manifest'
import { useProgress } from '@/lib/progress'
import { Toc } from './Toc'

/**
 * 文档站外壳：顶栏 + 左（章节目录）+ 中（正文）+ 右（本页内容）
 *
 * 侧栏按【章】分组，每章显示完成进度 —— 因为交付单位是章不是节。
 */
/** 只统计「已写」的节，否则分母会把还没写的算进去，进度看起来永远做不完 */
function countWritten(done: Set<string>) {
  return chapters.flatMap((c) => c.items.filter((i) => !i.wip).map((i) => i.slug)).filter((s) => done.has(s)).length
}

export function DocShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <div className="min-h-screen">
      <Topbar />

      <div className="doc-layout">
        <Sidebar pathname={pathname} />

        <main className="doc-main">
          <div className="doc-main-inner">
            <Outlet />

            {/* AI 生成声明 —— 常驻页脚，每一页都能看到 */}
            <footer className="no-print mt-16 border-t border-line pt-5 text-[0.78rem] leading-relaxed text-ink-faint">
              <strong className="text-ink-soft">这份课程材料由 AI 生成。</strong>
              它是一个前端工程师转型 Agent 方向时的学习记录 ——
              AI 在这里同时扮演老师和教材作者，练习由学习者手写、AI 评审。
              <a
                className="text-ink-soft underline"
                href="https://github.com/boom-10/agent-lab"
                target="_blank"
                rel="noopener noreferrer"
              >
                源码与完整声明 ↗
              </a>
            </footer>
          </div>
        </main>

        <Toc />
      </div>
    </div>
  )
}

/* ══════════════════ 顶栏 ══════════════════ */
function Topbar() {
  const { ready, done } = useProgress()

  return (
    <header className="no-print sticky top-0 z-50 flex h-[var(--spacing-topbar)] items-center gap-6 border-b border-line bg-panel px-6">
      <Link to="/" className="flex items-center gap-2 text-[1.02rem] font-bold tracking-tight no-underline">
        <span className="text-accent">◇</span>
        <span>Agent 学习</span>
      </Link>

      <nav className="ml-auto hidden items-center gap-1 md:flex">
        <TopLink splat="lessons/0001-first-api-call">课程</TopLink>
        <TopLink splat="reference/api-response">速查</TopLink>
        <a
          className="rounded-md px-3 py-1.5 text-[0.9rem] text-ink-soft no-underline hover:bg-subtle hover:text-ink"
          href="https://api-docs.deepseek.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          API 文档 ↗
        </a>
      </nav>

      <span className="hidden rounded-full border border-line px-3 py-1 font-mono text-[0.74rem] text-ink-faint xl:inline">
        已完成 {ready ? countWritten(done) : 0}/{totalLessons} 节
      </span>
    </header>
  )
}

function TopLink({ splat, children }: { splat: string; children: React.ReactNode }) {
  return (
    <Link
      to="/$"
      params={{ _splat: splat }}
      className="rounded-md px-3 py-1.5 text-[0.9rem] text-ink-soft no-underline hover:bg-subtle hover:text-ink"
    >
      {children}
    </Link>
  )
}

/* ══════════════════ 左：章节目录 ══════════════════ */
function Sidebar({ pathname }: { pathname: string }) {
  const { ready, isDone, count } = useProgress()
  const allSlugs = chapters.flatMap((c) => c.items.map((i) => i.slug))

  return (
    <aside className="doc-rail no-print sticky top-[var(--spacing-topbar)] max-h-[calc(100vh-var(--spacing-topbar))] overflow-y-auto py-6 pb-12 text-[0.875rem]">
      <div className="flex items-center justify-between px-2.5 pb-4 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-ink-faint">
        <span>章节目录</span>
        <kbd className="rounded border border-line bg-subtle px-1.5 py-0.5 font-mono text-[0.65rem] normal-case tracking-normal">
          {ready ? `${count(allSlugs)}/${totalLessons}` : `共 ${totalLessons} 节`}
        </kbd>
      </div>

      {chapters.map((ch) => {
        const slugs = ch.items.map((i) => i.slug)
        const doneN = ready ? count(slugs) : 0
        const writtenN = ch.items.filter((i) => !i.wip).length
        const open = ch.items.some((i) => pathname === `/${i.slug}`)

        return (
          <div key={ch.id} className="mb-5">
            <div className="px-2.5 pb-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[0.76rem] font-bold">{ch.title}</span>
                <span className="shrink-0 font-mono text-[0.66rem] text-ink-faint">
                  {writtenN === 0 ? '计划中' : `完成 ${doneN}/${writtenN}`}
                </span>
              </div>
              {(open || doneN > 0) && (
                <div className="mt-0.5 text-[0.68rem] leading-snug text-ink-faint">{ch.subtitle}</div>
              )}
            </div>

            {ch.items.map((item) => {
              const active = pathname === `/${item.slug}`
              const ok = ready && isDone(item.slug)
              return (
                <Link
                  key={item.slug}
                  to="/$"
                  params={{ _splat: item.slug }}
                  className={[
                    'flex items-center gap-2 rounded-[7px] px-2.5 py-1.5 no-underline leading-snug',
                    active
                      ? 'bg-[#ececea] font-semibold text-ink'
                      : item.wip
                        ? 'text-ink-faint'
                        : 'text-ink-soft hover:bg-subtle hover:text-ink',
                  ].join(' ')}
                >
                  <span className={`w-3 shrink-0 text-center text-[0.75rem] ${ok ? 'text-ok' : 'text-line'}`}>
                    {ok ? '✓' : item.wip ? '·' : '○'}
                  </span>
                  <span className="flex-1">{item.title}</span>
                  {item.minutes && !item.wip && (
                    <span className="shrink-0 font-mono text-[0.64rem] text-ink-faint">{item.minutes}m</span>
                  )}
                  {item.wip && <span className="shrink-0 text-[0.64rem] text-ink-faint">待写</span>}
                </Link>
              )
            })}
          </div>
        )
      })}

      <div className="mb-2 px-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-ink-faint">
        速查卡
      </div>
      {references.map((item) => (
        <Link
          key={item.slug}
          to="/$"
          params={{ _splat: item.slug }}
          className={[
            'flex items-center justify-between gap-2 rounded-[7px] px-2.5 py-1.5 no-underline',
            pathname === `/${item.slug}` ? 'bg-[#ececea] font-semibold' : 'text-ink-soft hover:bg-subtle',
          ].join(' ')}
        >
          <span>{item.title}</span>
          <span className="text-[0.68rem] text-ink-faint">{item.badge}</span>
        </Link>
      ))}

      <ResetProgress />
    </aside>
  )
}

function ResetProgress() {
  const { ready, done, reset } = useProgress()
  if (!ready || done.size === 0) return null
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm('清空学习进度？（只影响本机的打勾记录）')) reset()
      }}
      className="mt-6 px-2.5 text-[0.72rem] text-ink-faint underline hover:text-ink"
    >
      清空进度（{done.size} 节）
    </button>
  )
}
