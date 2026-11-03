import { createFileRoute, Link } from '@tanstack/react-router'
import { chapters, references, totalLessons, plannedLessons } from '@/content/manifest'
import { useProgress } from '@/lib/progress'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const { ready, isDone, count } = useProgress()
  const allSlugs = chapters.flatMap((c) => c.items.map((i) => i.slug))
  const doneN = ready ? count(allSlugs) : 0
  const pct = totalLessons ? Math.round((doneN / totalLessons) * 100) : 0

  return (
    <div className="prose">
      <div className="eyebrow">26 周 · 项目驱动 · TypeScript</div>
      <h1>
        从零到
        <br />
        Agent 工程师
      </h1>
      <p className="lede">
        这不是阅读清单，是一条动手路线。**交付单位是章** —— 每章 2–4 小时能连续做完，
        不用一节一节等。
      </p>

      {/* 进度条 */}
      <div className="not-prose mb-10 rounded-xl border border-line bg-panel px-4 py-3">
        <div className="mb-2 flex items-baseline justify-between text-[0.82rem]">
          <span className="font-semibold">你的进度</span>
          <span className="font-mono text-ink-faint">
            {ready ? `${doneN} / ${totalLessons} 节 · ${pct}%` : `共 ${totalLessons} 节已写`}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${ready ? Math.max(pct, 1) : 0}%` }}
          />
        </div>
      </div>

      {chapters.map((ch) => {
        const slugs = ch.items.map((i) => i.slug)
        const doneCh = ready ? count(slugs) : 0
        const written = ch.items.filter((i) => !i.wip)
        const planned = ch.items.length - written.length
        const plannedOnly = written.length === 0

        return (
          <section key={ch.id} className="not-prose mb-8">
            <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-line pb-2">
              <div>
                <h2 className="m-0 text-[1.15rem] font-bold tracking-tight">{ch.title}</h2>
                <p className="m-0 mt-0.5 text-[0.85rem] text-ink-soft">{ch.subtitle}</p>
              </div>
              <span className="shrink-0 font-mono text-[0.75rem] text-ink-faint">
                {plannedOnly ? `计划中 · ${planned} 节` : `${doneCh}/${written.length} 节`}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {ch.items.map((item) =>
                item.wip ? (
                  <div
                    key={item.slug}
                    className="rounded-xl border border-dashed border-line px-4 py-3 opacity-60"
                  >
                    <div className="text-[0.93rem] font-medium text-ink-soft">{item.title}</div>
                    <div className="mt-0.5 text-[0.76rem] text-ink-faint">
                      待写{plannedOnly ? ' · 本章还没开始' : ''}
                    </div>
                  </div>
                ) : (
                  <Link
                    key={item.slug}
                    to="/$"
                    params={{ _splat: item.slug }}
                    className="block rounded-xl border border-line bg-panel px-4 py-3 no-underline transition-colors hover:border-accent-line hover:bg-accent-soft"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className={`text-[0.8rem] ${ready && isDone(item.slug) ? 'text-ok' : 'text-line'}`}>
                        {ready && isDone(item.slug) ? '✓' : '○'}
                      </span>
                      <span className="text-[0.93rem] font-semibold text-ink">{item.title}</span>
                      {item.minutes && (
                        <span className="ml-auto shrink-0 font-mono text-[0.7rem] text-ink-faint">
                          {item.minutes}m
                        </span>
                      )}
                    </div>
                  </Link>
                ),
              )}
            </div>
          </section>
        )
      })}

      <section className="not-prose mb-8">
        <div className="mb-3 border-b border-line pb-2">
          <h2 className="m-0 text-[1.15rem] font-bold tracking-tight">速查卡</h2>
          <p className="m-0 mt-0.5 text-[0.85rem] text-ink-soft">不占章节，随时可查</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {references.map((item) => (
            <Link
              key={item.slug}
              to="/$"
              params={{ _splat: item.slug }}
              className="block rounded-xl border border-line bg-panel px-4 py-3 no-underline transition-colors hover:border-accent-line hover:bg-accent-soft"
            >
              <span className="text-[0.93rem] font-semibold text-ink">{item.title}</span>
            </Link>
          ))}
        </div>
      </section>

      <h2>怎么用这个站</h2>
      <ul>
        <li>
          <strong>一次做一章。</strong>每章 2–4 小时，是能一口气做完的量。做完再找我要下一章。
        </li>
        <li>
          <strong>每节做完点「标记本节完成」。</strong>进度只存你本机（localStorage），不上传。
        </li>
        <li>
          <strong>灰掉的是还没写的。</strong>你在侧栏看到的「待写」就是我还没生成的部分 —— 不用等，
          先把当前章做完。
        </li>
      </ul>

      <h2>这个站本身</h2>
      <p>
        <strong>TanStack Start + Vite + MDX</strong>，源码在 <code>agent-lab/teach/</code>。
        选 TanStack 而不是 Next.js 的原因很实际：这台机器 16GB，Next 的 Turbopack 冷编译会拉起
        几百个 postcss 子进程打满内存（见 <code>cloud-docs/AGENTS.md</code> 的实测记录）；
        Vite 走 esbuild，没这个问题。
      </p>
      <p className="text-[0.9rem] text-ink-faint">
        共 {plannedLessons} 节已规划，{totalLessons} 节已写。
      </p>
    </div>
  )
}
