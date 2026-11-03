import { useState } from 'react'

/**
 * 缓冲区演示 —— 一步步看清「切走完整的，留下残片」是什么意思。
 *
 * 为什么需要这个：光用文字讲「残片」太抽象。这个演示把
 * 每一次 read() 之后 buffer 里到底有什么、哪部分能确定、哪部分不能，
 * 直接画出来。
 *
 * 数据是刻意设计的：连 "data" 这个单词本身都被切在第 1、2 次 read 之间。
 */

/** 服务端实际发出的完整字节流 */
const STREAM = 'data: A\n\ndata: BBB\n\ndata: CC\n\ndata: [DONE]\n\n'

/** 网络把它切成的片 —— 边界和事件的边界毫无关系 */
const CHUNKS = [
  'data: A\n\nda', // 切在 "data" 后面一个字
  'ta: BBB\n\ndata: C', // "da" + "ta" = "data"，切在 "CC" 中间
  'C\n\ndata: [DONE]\n\n',
]

type Step = {
  chunk: string
  buffer: string // 拼上这一片之后的 buffer
  complete: string // buffer 里能确定完整的部分
  tail: string // 不确定的残片
  emitted: string[] // 这一步切出去的事件
  outAll: string[] // 累计输出
}

function run(): Step[] {
  const steps: Step[] = []
  let buf = ''
  let out: string[] = []
  for (const chunk of CHUNKS) {
    buf += chunk
    const idx = buf.lastIndexOf('\n\n')
    const complete = idx >= 0 ? buf.slice(0, idx + 2) : ''
    const tail = idx >= 0 ? buf.slice(idx + 2) : buf

    const emitted = complete
      .split('\n\n')
      .filter((p) => p.startsWith('data: '))
      .map((p) => p.slice(6))
    out = [...out, ...emitted]

    steps.push({ chunk, buffer: buf, complete, tail, emitted, outAll: [...out] })
    buf = tail // ★ 关键：只把残片留回去
  }
  return steps
}

const STEPS = run()

/**
 * 把字符串渲染成可见形式。
 *
 * 换行必须画出来 —— 否则「空行」（也就是分隔符）在屏幕上完全看不见，
 * 而它正是这一节的全部重点。但也不能太抢眼，所以用淡色小符号。
 */
function Vis({ s }: { s: string }) {
  const lines = s.split('\n')
  return (
    <>
      {lines.map((seg, i) => (
        <span key={i}>
          {seg}
          {i < lines.length - 1 && (
            <span className="text-[0.7em] text-ink-faint/70 select-none">↵</span>
          )}
          {i < lines.length - 1 ? '\n' : ''}
        </span>
      ))}
    </>
  )
}

export function BufferDemo() {
  const [i, setI] = useState(-1) // -1 = 还没开始
  const step = i >= 0 ? STEPS[i] : null
  const done = i >= STEPS.length - 1

  // 展示用的 buffer：第 i 步是「拼上这一片之后」，
  // 第 0 步之前 buffer 是空的
  const prevTail = i > 0 ? STEPS[i - 1].tail : ''

  return (
    <div className="not-prose my-6 rounded-xl border border-line bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[0.8rem] font-semibold text-ink-soft">缓冲区演示</span>
        <span className="font-mono text-[0.72rem] text-ink-faint">
          第 {Math.max(i + 1, 0)} / {STEPS.length} 次 read
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setI((n) => Math.min(n + 1, STEPS.length - 1))}
            disabled={done}
            className="rounded-lg border border-line bg-ink px-3 py-1.5 text-[0.82rem] font-semibold text-white transition-colors hover:bg-black disabled:opacity-40"
          >
            {i < 0 ? '开始 ▶' : '下一次 read() ▶'}
          </button>
          <button
            type="button"
            onClick={() => setI(-1)}
            className="rounded-lg border border-line px-3 py-1.5 text-[0.82rem] text-ink-soft transition-colors hover:bg-subtle"
          >
            重来
          </button>
        </div>
      </div>

      {/* 服务端一共发了什么 */}
      <div className="mb-3 rounded-lg border border-line-soft bg-code px-3 py-2">
        <div className="mb-1 text-[0.72rem] font-semibold text-ink-faint">
          服务端一次发出的完整字节流
        </div>
        <pre className="m-0 overflow-x-auto font-mono text-[0.74rem] leading-relaxed whitespace-pre-wrap text-ink-soft">
          <Vis s={STREAM} />
        </pre>
      </div>

      {i < 0 ? (
        <p className="m-0 py-4 text-center text-[0.88rem] text-ink-faint">
          点「开始」，看每一次 <code>read()</code> 到底拿到什么
        </p>
      ) : (
        <>
          {/* 这一步收到了什么 */}
          <div className="mb-3 rounded-lg border border-accent-line bg-accent-soft px-3 py-2">
            <div className="mb-1 text-[0.72rem] font-semibold text-accent">
              第 {i + 1} 次 read() 拿到
            </div>
            <pre className="m-0 overflow-x-auto font-mono text-[0.76rem] leading-relaxed whitespace-pre-wrap text-ink">
              <Vis s={step!.chunk} />
            </pre>
          </div>

          {/* buffer 的两段 */}
          <div className="mb-3 rounded-lg border border-line px-3 py-2">
            <div className="mb-1.5 flex flex-wrap items-baseline gap-x-1.5 text-[0.72rem]">
              <span className="font-semibold text-ink-soft">buffer =</span>
              {prevTail && (
                <>
                  <span className="font-mono text-ink-faint">
                    上次留下的 {JSON.stringify(prevTail)}
                  </span>
                  <span className="text-ink-faint">+</span>
                </>
              )}
              <span className="font-mono text-ink-faint">这一次的</span>
            </div>

            <pre className="m-0 overflow-x-auto font-mono text-[0.76rem] leading-relaxed whitespace-pre-wrap">
              <span className="rounded bg-ok-bg px-0.5 text-ok"><Vis s={step!.complete} /></span>
              <span className="rounded bg-warn-bg px-0.5 text-warn"><Vis s={step!.tail} /></span>
            </pre>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.74rem]">
              <span className="text-ok">
                ▮ 绿色 = 有 <code className="text-ok">↵↵</code> 收尾，能确定完整 → 切走
              </span>
              {step!.tail && (
                <span className="text-warn">▮ 黄色 = 还没等到收尾符 → 留着等下一片</span>
              )}
            </div>
          </div>

          {/* 结果 */}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-ok/30 bg-ok-bg px-3 py-2">
              <div className="text-[0.72rem] font-semibold text-ok">这一步切出去的事件</div>
              <div className="mt-1 font-mono text-[0.8rem] text-ok">
                {step!.emitted.length ? step!.emitted.join('  ·  ') : '（没有完整的，全部留着）'}
              </div>
            </div>
            <div className="rounded-lg border border-line bg-subtle px-3 py-2">
              <div className="text-[0.72rem] font-semibold text-ink-soft">留回 buffer</div>
              <div className="mt-1 font-mono text-[0.8rem] text-ink">
                {step!.tail ? JSON.stringify(step!.tail) : '（空）'}
              </div>
            </div>
          </div>

          {/* 累计输出 */}
          <div className="mt-3 rounded-lg border border-line bg-code px-3 py-2">
            <div className="text-[0.72rem] font-semibold text-ink-faint">
              拼起来给用户看的文本
            </div>
            <div className="mt-1 font-mono text-[0.92rem] text-ink">
              {step!.outAll.filter((x) => x !== '[DONE]').join('') || '（还没有）'}
            </div>
          </div>

          {done && (
            <p className="mt-3 mb-0 rounded-lg border border-ok/30 bg-ok-bg px-3 py-2 text-[0.82rem] text-ok">
              ✅ 四次事件全部还原，一字不差。注意 <code>data</code> 这个词本身在第 1、2 次
              read 之间被切成了 <code>da</code> + <code>ta</code> —— 缓冲区把它拼回来了。
            </p>
          )}
        </>
      )}
    </div>
  )
}
