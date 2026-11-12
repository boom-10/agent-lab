#!/usr/bin/env node
/**
 * 把「各种情况下的数据形状」真实打印出来。
 *
 *   npm run fault:server    # 终端 1
 *   npm run probe:shapes    # 终端 2
 *
 * 这个脚本是速查卡的出处：文档里写的字段，都来自这里的实测输出。
 */

const BASE = process.env.FAULT_BASE ?? 'http://127.0.0.1:39002'
const u = (s) => `${BASE}/chat/completions?${s}`

const show = (label, obj) => {
  console.log(`\n── ${label} ──`)
  for (const [k, v] of Object.entries(obj)) {
    const t = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v
    console.log(`  ${k.padEnd(14)} ${t.padEnd(10)} ${JSON.stringify(v)?.slice(0, 90)}`)
  }
}

/* ① Response 对象有哪些字段能用 */
const res = await fetch(u('scenario=429'), { method: 'POST' })
console.log('═══ ① fetch 返回的 Response（429 的情况）═══')
console.log('  能直接读的:', ['status', 'ok', 'statusText', 'headers', 'body', 'url', 'redirected', 'type'].join(', '))
show('Response 上的值', {
  status: res.status,
  ok: res.ok,
  statusText: res.statusText,
  'headers.get("retry-after")': res.headers.get('retry-after'),
  'headers.get("content-type")': res.headers.get('content-type'),
  'body 是什么': res.body ? 'ReadableStream（可 for await）' : null,
})
await res.text()

/* ② 四种失败：字段在哪 */
console.log('\n═══ ② 四种失败，字段在哪 ═══')

try {
  await fetch(u('scenario=slow&ms=800'), { method: 'POST', signal: AbortSignal.timeout(150) })
} catch (e) {
  show('超时 ThrowError 的真实字段', {
    'e.name': e.name, 'e.message': e.message, 'e.code': e.code,
    'e instanceof DOMException': e instanceof DOMException, 'e instanceof Error': e instanceof Error,
  })
}

{
  const c = new AbortController()
  setTimeout(() => c.abort(), 100)
  try {
    await fetch(u('scenario=slow&ms=800'), { method: 'POST', signal: c.signal })
  } catch (e) {
    show('用户取消 AbortError 的真实字段', { 'e.name': e.name, 'e.message': e.message, 'e.code': e.code })
  }
  show('signal 自己的字段', {
    'signal.aborted': c.signal.aborted,
    'signal.reason?.name': c.signal.reason?.name,
    'signal.reason?.message': c.signal.reason?.message,
  })
}

try {
  const r = await fetch(u('scenario=drop'), { method: 'POST' })
  for await (const _ of r.body) { /* 读到断开为止 */ }
} catch (e) {
  show('断流 TypeError 的真实字段', {
    'e.name': e.name, 'e.message': e.message,
    'e.cause?.name': e.cause?.name, 'e.cause?.message': String(e.cause?.message ?? '').slice(0, 60),
  })
}

/* ③ 自己的 ClientError 该带什么 */
console.log('\n═══ ③ 你自己定义的 ClientError 应该带什么 ═══')
console.log('  kind         "retry" | "fatal" | "cancel"   ← 自检读这个')
console.log('  message      给人看的说明')
console.log('  status       HTTP 状态码（429 / 500 …），网络类错误没有')
console.log('  retryAfterMs 429 时服务端要求等多少毫秒（从 retry-after 头换算）')

/* ④ 流式事件里，内容到底在哪 */
console.log('\n═══ ④ 流式事件（SSE）里，内容在哪 ═══')
{
  const r = await fetch(u('scenario=ok'), { method: 'POST', body: JSON.stringify({ stream: true }) })
  let buf = ''
  let n = 0
  for await (const piece of r.body) {
    buf += new TextDecoder().decode(piece, { stream: true })
    const lines = buf.split('\n\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ') || line.slice(6) === '[DONE]') continue
      const d = JSON.parse(line.slice(6))
      n++
      if (n <= 2 || d.usage) {
        console.log(`\n  第 ${n} 个事件（${d.usage ? '带 usage' : '普通内容块'}）:`)
        console.log('    choices[0].delta.content =', JSON.stringify(d.choices?.[0]?.delta?.content))
        console.log('    choices[0].finish_reason =', JSON.stringify(d.choices?.[0]?.finish_reason))
        if (d.usage) console.log('    usage =', JSON.stringify(d.usage))
      }
    }
  }
  console.log(`\n  一共 ${n} 个事件（不含 [DONE]）`)
}
console.log()
