import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { getDoc } from '@/lib/content'
import { findLesson, chapterOf, neighbours } from '@/content/manifest'
import { useProgress } from '@/lib/progress'
import { BookRefs } from '@/components/BookRefs'

/**
 * 内容路由（catch-all）。
 *
 * 一个路由文件接管所有内容页：/lessons/0001-first-api-call
 * 就去 src/content/lessons/0001-first-api-call.mdx 取内容。
 *
 * 加一节 = 写一个 .mdx + 在 manifest 的某一章里加一行，不用碰路由。
 *
 * 注意：组件在渲染期同步取，**不要放进 loader 返回值** ——
 * TanStack Start 会序列化 loader 数据，函数没法序列化（见 lib/content.ts 的注释）。
 */
export const Route = createFileRoute('/$')({
  component: DocPage,
  notFoundComponent: NotFound,
  loader: ({ params }) => {
    const slug = (params as { _splat?: string })._splat ?? ''
    if (!getDoc(slug)) throw notFound()
    return { slug }
  },
  head: ({ loaderData }) => {
    const doc = loaderData ? findLesson(loaderData.slug) : undefined
    return { meta: [{ title: doc ? `${doc.title} · Agent 学习` : 'Agent 学习' }] }
  },
})

function DocPage() {
  const { slug } = Route.useLoaderData()
  const mod = getDoc(slug)
  const { prev, next, index } = neighbours(slug)
  const ch = chapterOf(slug)
  const lesson = findLesson(slug)

  if (!mod) return <NotFound />
  const Content = mod.default
  const isRef = !ch

  return (
    <article className="prose">
      {/* 章节面包屑：让人知道「我在整条路的哪里」 */}
      {ch && (
        <div className="no-print mb-8 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-line bg-panel px-3.5 py-2.5 text-[0.82rem]">
          <span className="font-semibold text-ink">{ch.title}</span>
          <span className="text-ink-faint">·</span>
          <span className="text-ink-soft">
            第 {index + 1} 节 / 共 {ch.items.length} 节
          </span>
          <span className="ml-auto text-ink-faint">
            {lesson?.minutes ? `约 ${lesson.minutes} 分钟` : ''}
          </span>
        </div>
      )}

      {/* 对应的书：读完对应章节再做这一节 */}
      <BookRefs books={lesson?.books ?? []} />

      <Content />

      {/* 完成按钮 */}
      {!isRef && <DoneButton slug={slug} />}

      {/* 上一节 / 下一节 */}
      <nav className="no-print mt-8 flex justify-between gap-4 border-t border-line pt-6 text-[0.9rem]">
        {prev ? (
          <Link to="/$" params={{ _splat: prev.slug }} className="no-underline">
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to="/$" params={{ _splat: next.slug }} className="no-underline">
            {next.title} →
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <div className="no-print mt-10 rounded-xl border border-accent-line bg-accent-soft px-5 py-4 text-[0.9rem]">
        <strong>我是你的老师，随时打断我。</strong>
        <br />
        命令报错了、某个字段看不懂、「为什么设计成这样」—— 任何问题都可以直接问。卡住不问才是真正的浪费。
      </div>
    </article>
  )
}

function DoneButton({ slug }: { slug: string }) {
  const { ready, isDone, markDone } = useProgress()
  const done = ready && isDone(slug)

  return (
    <div className="no-print mt-14 flex items-center gap-3 rounded-xl border border-line bg-panel px-5 py-4">
      <button
        type="button"
        disabled={!ready}
        onClick={() => markDone(slug, !done)}
        className={[
          'rounded-lg px-4 py-2 text-[0.9rem] font-semibold transition-colors disabled:opacity-50',
          done
            ? 'border border-ok/40 bg-ok-bg text-ok'
            : 'border border-line bg-ink text-white hover:bg-black',
        ].join(' ')}
      >
        {done ? '✓ 已完成' : '标记本节完成'}
      </button>
      <span className="text-[0.85rem] text-ink-faint">
        {done ? '侧栏已打勾。再点一次可取消。' : '进度只存在你本机，不上传任何地方。'}
      </span>
    </div>
  )
}

function NotFound() {
  return (
    <div className="prose">
      <h1>这一页还不存在</h1>
      <p>可能是链接过期，或者这节课还没写。</p>
      <p>
        <Link to="/">← 回首页</Link>
      </p>
    </div>
  )
}
