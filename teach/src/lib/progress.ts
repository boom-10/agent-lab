import { useEffect, useState } from 'react'

/**
 * 学习进度 —— 存在 localStorage，不上传任何地方。
 *
 * 用一个极简的订阅式 store，让侧栏、章节进度、正文底部按钮共用同一份状态。
 * 没引状态库：这里只有「一个字符串集合」这一种状态，用不着。
 */

const KEY = 'agent-course:done:v1'

let cache: Set<string> | null = null
const listeners = new Set<() => void>()

function read(): Set<string> {
  if (cache) return cache
  if (typeof localStorage === 'undefined') return (cache = new Set())
  try {
    const raw = localStorage.getItem(KEY)
    cache = new Set<string>(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    cache = new Set()
  }
  return cache
}

function write(next: Set<string>) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]))
  } catch {
    /* 隐私模式下写不进去也不该崩 */
  }
  listeners.forEach((fn) => fn())
}

export function markDone(slug: string, done = true) {
  const s = new Set(read())
  if (done) s.add(slug)
  else s.delete(slug)
  write(s)
}

export function isDone(slug: string) {
  return read().has(slug)
}

/** 订阅进度。SSR 首帧返回空集合，避免 hydration 不一致。 */
export function useProgress() {
  const [ready, setReady] = useState(false)
  const [, bump] = useState(0)

  useEffect(() => {
    setReady(true)
    const fn = () => bump((n) => n + 1)
    listeners.add(fn)
    // 其它标签页改了进度也同步
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        cache = null
        bump((n) => n + 1)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(fn)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const done = ready ? read() : new Set<string>()
  return {
    ready,
    done,
    isDone: (slug: string) => done.has(slug),
    count: (slugs: string[]) => slugs.filter((s) => done.has(s)).length,
    markDone,
    reset: () => write(new Set()),
  }
}
