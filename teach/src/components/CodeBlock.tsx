import { useEffect, useRef, useState } from 'react'

/**
 * 代码块 —— 覆盖 MDX 的 `pre`，在右上角加一个「复制」按钮。
 *
 * 三个设计上的坑，都是踩过才知道的：
 *
 *   ① 按钮必须在 <pre> **外面**。
 *      放里面的话 `pre.textContent` 会把「复制」两个字也带进剪贴板。
 *
 *   ② 必须是 React 组件，不能是 useEffect 里手动 appendChild。
 *      路由切换时 MDX 内容会重渲染，手动插的 DOM 会被 React 抹掉。
 *
 *   ③ 必须有降级路径。
 *      `navigator.clipboard` 只在**安全上下文**（https / localhost）可用。
 *      用 IP 访问（比如 127.0.0.1 之外的局域网调试）时它是 undefined。
 */
export function CodeBlock({ children, ...props }: React.ComponentPropsWithoutRef<'pre'>) {
  const ref = useRef<HTMLPreElement>(null)
  const [state, setState] = useState<'idle' | 'ok' | 'err'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 卸载时清掉 pending 的定时器，避免在已卸载组件上 setState
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  async function copy() {
    const text = ref.current?.textContent ?? ''
    if (!text) return

    let ok = false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        ok = true
      } else {
        ok = legacyCopy(text)
      }
    } catch {
      ok = legacyCopy(text)
    }

    setState(ok ? 'ok' : 'err')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 1600)
  }

  return (
    <div className="code-block">
      <button
        type="button"
        className="code-copy"
        onClick={copy}
        data-state={state}
        aria-label={state === 'ok' ? '已复制到剪贴板' : '复制这段代码'}
      >
        {state === 'ok' ? '✓ 已复制' : state === 'err' ? '✗ 复制失败' : '复制'}
      </button>

      <pre ref={ref} {...props}>
        {children}
      </pre>
    </div>
  )
}

/** 老办法：clipboard API 不可用时的退路（非安全上下文、老浏览器） */
function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    // 固定在视口外，避免点下去时页面跳动
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}
