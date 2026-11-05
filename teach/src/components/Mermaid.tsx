import { useEffect, useId, useRef, useState } from 'react'

/**
 * 流程图 / 时序图：把 ```mermaid 代码块渲染成 SVG。
 *
 * 为什么在浏览器里渲染：mermaid 要读 DOM、测量文字宽度，不能在服务端跑。
 * 所以这里是客户端组件，mermaid 用动态 import，只有页面里真有流程图时才加载。
 *
 * 三条降级规则：
 *   ① 渲染前先占位，不让页面跳动；
 *   ② 渲染失败时显示错误和源码，不让页面空白；
 *   ③ 源码始终放在折叠区里，学习者可以对照语法。
 */

// 颜色取自 app.css 的变量，保证流程图和正文配色一致
const MERMAID_CONFIG = {
  startOnLoad: false,
  securityLevel: 'strict' as const,
  theme: 'base' as const,
  fontFamily: 'inherit',
  // 流程图：加宽换行宽度，节点文字不会被切成很多行；间距略大，箭头更好辨认
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    wrappingWidth: 300,
    nodeSpacing: 36,
    rankSpacing: 44,
    padding: 14,
    curve: 'basis' as const,
  },
  themeVariables: {
    fontFamily: 'inherit',
    fontSize: '15px',
    primaryColor: '#fdf4ff',
    primaryBorderColor: '#a21caf',
    primaryTextColor: '#18181b',
    secondaryColor: '#f4f4f2',
    secondaryBorderColor: '#e6e6e2',
    secondaryTextColor: '#18181b',
    tertiaryColor: '#ffffff',
    lineColor: '#71717a',
    textColor: '#18181b',
    mainBkg: '#fdf4ff',
    nodeBorder: '#a21caf',
    clusterBkg: '#f8f8f6',
    clusterBorder: '#e6e6e2',
    edgeLabelBackground: '#ffffff',
    noteBkgColor: '#fef7ec',
    noteBorderColor: '#b45309',
    noteTextColor: '#18181b',
    actorBkg: '#fdf4ff',
    actorBorder: '#a21caf',
    actorTextColor: '#18181b',
    signalColor: '#52525b',
    signalTextColor: '#18181b',
  },
}

export function Mermaid({ source }: { source: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    // 每次渲染用一个新的 id：严格模式会双调用 effect，固定 id 会冲突
    const svgId = `mmd${reactId}${Math.random().toString(36).slice(2, 8)}`

    setStatus('loading')
    ;(async () => {
      try {
        const { default: mermaid } = await import('mermaid')
        mermaid.initialize(MERMAID_CONFIG)
        const { svg } = await mermaid.render(svgId, source)
        if (cancelled || !hostRef.current) return
        hostRef.current.innerHTML = svg
        setStatus('ready')
      } catch (e) {
        if (cancelled) return
        setMessage(e instanceof Error ? e.message : String(e))
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [source, reactId])

  return (
    <figure className="mermaid-block" data-state={status}>
      <div ref={hostRef} className="mermaid-host" role="img" aria-label="流程图" />
      {status === 'loading' && <div className="mermaid-status">流程图渲染中……</div>}
      {status === 'error' && (
        <div className="mermaid-error">
          <div>流程图渲染失败：{message}</div>
          <pre>{source}</pre>
        </div>
      )}
      <details className="mermaid-source">
        <summary>查看 Mermaid 源码</summary>
        <pre>{source}</pre>
      </details>
    </figure>
  )
}
