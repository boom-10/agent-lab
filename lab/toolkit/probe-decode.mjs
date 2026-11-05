#!/usr/bin/env node
/**
 * decode 实验（对应第 0005 节）：输出变长，首字（TTFT）变不变？每个输出 token 要多久？
 * 调真 API，花费几分钱。
 *
 *   npm run probe:decode
 *
 * 测法：流式请求，TTFT = 第一个有内容的 delta 的时间；
 *       每个输出 token 的时间（TPOT）= (最后一个 delta 时间 - 第一个 delta 时间) ÷ (输出 token 数 - 1)。
 * 每档跑三次，报告中位数（TTFT 报最小值）。绝对数字会随时段漂移，看相对关系。
 */

const KEY = process.env.DEEPSEEK_API_KEY
const BASE = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
if (!KEY) {
  console.error('\n  ❌ 没读到 DEEPSEEK_API_KEY。请用 npm run probe:decode 运行，它会替你读 .env。\n')
  process.exit(1)
}

const PROMPT = '请用中文写一段关于流式输出原理的介绍，尽量详细，分三段。'

async function streamOnce(maxTokens) {
  const t0 = Date.now()
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: 'deepseek-flash',
      messages: [{ role: 'user', content: PROMPT }],
      thinking: { type: 'disabled' },
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: maxTokens,
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)

  let buf = ''
  let first = 0
  let last = 0
  let usage = null
  let finish = null
  const dec = new TextDecoder()
  for await (const piece of res.body) {
    buf += dec.decode(piece, { stream: true })
    const parts = buf.split('\n\n')
    buf = parts.pop() ?? ''
    for (const part of parts) {
      if (!part.startsWith('data: ') || part.slice(6) === '[DONE]') continue
      const d = JSON.parse(part.slice(6))
      const c = d.choices?.[0]
      if (c?.delta?.content) {
        const now = Date.now() - t0
        if (!first) first = now
        last = now
      }
      if (c?.finish_reason) finish = c.finish_reason
      if (d.usage) usage = d.usage
    }
  }
  const n = usage?.completion_tokens ?? 0
  const tpot = n > 1 ? (last - first) / (n - 1) : NaN
  return { ttft: first, total: last, n, tpot, finish }
}

const median = (xs) => {
  const s = [...xs].filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : NaN
}

console.log('\n  跑 2 档 × 3 次，请稍等……')
const table = {}
for (const m of [16, 256]) {
  table[m] = []
  for (let i = 0; i < 3; i++) table[m].push(await streamOnce(m))
}

console.log('\n  max_tokens   输出 token   TTFT(最小)   每 token 时间(中位)   总耗时(中位)   finish')
console.log('  ' + '─'.repeat(78))
for (const m of [16, 256]) {
  const rs = table[m]
  console.log(
    `  ${String(m).padStart(10)}   ${String(median(rs.map((r) => r.n))).padStart(10)}   ` +
      `${String(Math.min(...rs.map((r) => r.ttft))).padStart(8)} ms   ` +
      `${String(Math.round(median(rs.map((r) => r.tpot)))).padStart(15)} ms   ` +
      `${String(Math.round(median(rs.map((r) => r.total)))).padStart(10)} ms   ${rs[0].finish}`,
  )
}
console.log()
