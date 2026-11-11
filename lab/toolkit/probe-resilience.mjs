#!/usr/bin/env node
/**
 * 实测：超时、取消、429、5xx、断流，在 Node 里各自抛出什么。
 *
 * 先启动故障服务器：npm run fault:server
 * 再跑：npm run probe:resilience
 */

const BASE = process.env.FAULT_BASE ?? 'http://127.0.0.1:39002'
const url = (scenario) => `${BASE}/chat/completions?${scenario}`

async function call(urlStr, { timeoutMs, controller } = {}) {
  const signal = controller?.signal ?? (timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined)
  const res = await fetch(urlStr, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'x', stream: true, messages: [{ role: 'user', content: 'hi' }] }),
    signal,
  })
  return res
}

function desc(e) {
  return `${e?.name ?? typeof e}: ${e?.message ?? e}${e?.code ? ` (code=${e.code})` : ''}`
}

async function timed(label, fn) {
  const t0 = Date.now()
  try {
    const v = await fn()
    console.log(`  ${label.padEnd(30)} ✅ ${v}   ${Date.now() - t0} ms`)
  } catch (e) {
    console.log(`  ${label.padEnd(30)} ❌ ${desc(e)}   ${Date.now() - t0} ms`)
  }
}

console.log('\n═══ 1. 非 2xx 状态码：fetch 会抛错吗 ═══')
await timed('429（带 Retry-After）', async () => {
  const res = await call(url('scenario=429'))
  return `res.ok=${res.ok} status=${res.status} Retry-After=${res.headers.get('retry-after')}（fetch 不抛错，要自己判断）`
})
await timed('500', async () => {
  const res = await call(url('scenario=500'))
  return `res.ok=${res.ok} status=${res.status}`
})

console.log('\n═══ 2. 超时：AbortSignal.timeout 抛什么 ═══')
await timed('慢响应 2000ms，超时设 300ms', async () => {
  await call(url('scenario=slow&ms=2000'), { timeoutMs: 300 })
  return '不该走到这里'
})

console.log('\n═══ 3. 手动取消（AbortController）═══')
await timed('请求阶段就取消', async () => {
  const c = new AbortController()
  setTimeout(() => c.abort(), 100)
  await call(url('scenario=slow&ms=2000'), { controller: c })
  return '不该走到这里'
})
await timed('拿到响应后、读流中途取消', async () => {
  const c = new AbortController()
  const res = await call(url('scenario=slowbody&ms=300'), { controller: c })
  let got = ''
  setTimeout(() => c.abort(), 700)
  try {
    for await (const piece of res.body) {
      got += new TextDecoder().decode(piece, { stream: true })
    }
    return `读完了（意外）：${got.length} 字节`
  } catch (e) {
    return `读到 ${got.length} 字节后抛错 → ${desc(e)}`
  }
})

console.log('\n═══ 4. 断流：服务器中途 destroy ═══')
await timed('drop（读到一半连接断了）', async () => {
  const res = await call(url('scenario=drop'))
  let got = ''
  try {
    for await (const piece of res.body) {
      got += new TextDecoder().decode(piece, { stream: true })
    }
    return `读完了（意外）：${got.length} 字节`
  } catch (e) {
    return `读到 ${got.length} 字节后抛错 → ${desc(e)}`
  }
})

console.log('\n═══ 5. 取消之后，还能复用这个 AbortController 吗 ═══')
await timed('已 abort 的 signal 再发请求', async () => {
  const c = new AbortController()
  c.abort()
  const res = await call(url('scenario=ok'), { controller: c })
  return `没抛错？status=${res.status}`
})

console.log('\n═══ 6. AbortSignal.any 能不能把「超时」和「用户取消」合成一个 ═══')
{
  const hasAny = typeof AbortSignal.any === 'function'
  console.log(`  AbortSignal.any 存在: ${hasAny}   AbortSignal.timeout 存在: ${typeof AbortSignal.timeout === 'function'}`)
  if (hasAny) {
    await timed('any([用户取消, 超时])，用户先取消', async () => {
      const user = new AbortController()
      const signal = AbortSignal.any([user.signal, AbortSignal.timeout(2000)])
      setTimeout(() => user.abort(), 80)
      const res = await fetch(url('scenario=slow&ms=1500'), { method: 'POST', signal })
      return `status=${res.status}`
    })
    await timed('any([用户取消, 超时])，超时先生效', async () => {
      const user = new AbortController()
      const signal = AbortSignal.any([user.signal, AbortSignal.timeout(200)])
      await fetch(url('scenario=slow&ms=1500'), { method: 'POST', signal })
      return '不该走到这里'
    })
  }
}

console.log('\n═══ 7. 超时和手动取消，怎么区分开 ═══')
{
  try {
    await fetch(url('scenario=slow&ms=1500'), { method: 'POST', signal: AbortSignal.timeout(200) })
  } catch (e) {
    console.log(`  超时 → name=${e.name}  signal.reason.name=${AbortSignal.timeout(1) && e.name}`)
  }
  const c = new AbortController()
  setTimeout(() => c.abort(), 100)
  try {
    await fetch(url('scenario=slow&ms=1500'), { method: 'POST', signal: c.signal })
  } catch (e) {
    console.log(`  手动取消 → name=${e.name}  报文: ${e.message}`)
  }
}
console.log('\n═══ 8. 中途取消：省下了多少时间、多少内容 ═══')
{
  // slowbody 每 300ms 吐一个字，共 10 个 → 完整跑完约 3 秒
  const t0 = Date.now()
  const res = await fetch(url('scenario=slowbody&ms=300'), { method: 'POST' })
  let buf = ''
  let chars = 0
  for await (const piece of res.body) {
    buf += new TextDecoder().decode(piece, { stream: true })
    for (const part of buf.split('\n\n')) {
      if (!part.startsWith('data: ') || part.slice(6) === '[DONE]') continue
      try {
        chars += JSON.parse(part.slice(6)).choices?.[0]?.delta?.content?.length ?? 0
      } catch { /* 半个事件，忽略 */ }
    }
    buf = buf.split('\n\n').pop() ?? ''
  }
  console.log(`  完整跑完：用时 ${Date.now() - t0} ms，收到 ${chars} 个字符`)

  const t1 = Date.now()
  const c = new AbortController()
  const res2 = await fetch(url('scenario=slowbody&ms=300'), { method: 'POST', signal: c.signal })
  let buf2 = ''
  let chars2 = 0
  setTimeout(() => c.abort(), 700)
  try {
    for await (const piece of res2.body) {
      buf2 += new TextDecoder().decode(piece, { stream: true })
      for (const part of buf2.split('\n\n')) {
        if (!part.startsWith('data: ') || part.slice(6) === '[DONE]') continue
        try {
          chars2 += JSON.parse(part.slice(6)).choices?.[0]?.delta?.content?.length ?? 0
        } catch { /* 半个事件 */ }
      }
      buf2 = buf2.split('\n\n').pop() ?? ''
    }
  } catch (e) {
    console.log(`  700ms 时取消：用时 ${Date.now() - t1} ms，已收到 ${chars2} 个字符，抛出 ${e.name}`)
    console.log(`  → 省下约 ${(chars - chars2)} 个字符的生成时间（按 ${300} ms/字 估算约 ${(chars - chars2) * 300} ms）`)
  }
}

console.log()
