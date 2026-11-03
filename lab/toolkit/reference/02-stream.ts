/**
 * 参考实现 02 · 流式（SSE）+ TTFT / TPOT 测量
 *
 * ⚠️ 规则：先自己写，写完再对照。
 *
 * 运行：node 02-stream.ts
 *
 * 这一版的重点不是"能打印"，而是**能测量**。
 * P1-W2 的实验 2 要用同一套逻辑测不同输入长度，所以这里把测量抽成了函数。
 */

const BASE = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
const KEY = process.env.DEEPSEEK_API_KEY
if (!KEY) { console.error('缺少 DEEPSEEK_API_KEY'); process.exit(1) }

/** 造一段"不重复"的填充文本 —— 重复内容会命中缓存，污染延迟测量 */
function filler(n: number): string {
  return Array.from({ length: n }, (_, i) =>
    `第${i}条：${Math.random().toString(36).slice(2, 10)}`).join('。')
}

export interface Metrics {
  ttftMs: number | null      // 首 token 延迟
  tpotMs: number | null      // 每 token 平均间隔
  totalMs: number
  chunks: number
  contentChars: number
  usage: any | null
  finishReason: string | null
}

export async function measure(promptTokens: number, maxTokens = 64): Promise<Metrics> {
  const t0 = Date.now()
  let tFirst: number | null = null
  let tLast: number | null = null
  let chunks = 0, contentChars = 0
  let usage: any = null
  let finishReason: string | null = null

  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: 'deepseek-flash',
      messages: [
        { role: 'system', content: '你是简洁的助手。' },
        { role: 'user', content: `${filler(promptTokens)}\n\n请只回复"收到"两个字。` },
      ],
      thinking: { type: 'disabled' },   // ← 测延迟必须关 thinking，否则 reasoning token 会干扰
      temperature: 0,
      max_tokens: maxTokens,
      stream: true,
      // ★ 关键：打开后每个 chunk 都带 usage 字段（除最后一个外都是 null）
      stream_options: { include_usage: true },
    }),
  })

  if (!res.ok) { console.error(res.status, await res.text()); process.exit(1) }

  // ---- 解析 SSE ----
  // 官方格式：`data: {...}\n\n`，以 `data: [DONE]` 结束
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    // 按空行切分事件；保留最后一段不完整的数据
    const parts = buf.split('\n\n')
    buf = parts.pop() ?? ''

    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()

      if (payload === '[DONE]') continue   // 流结束标记，不是 JSON

      let chunk: any
      try { chunk = JSON.parse(payload) }
      catch { console.error('解析失败，原始片段:', payload.slice(0, 200)); continue }

      chunks++
      const delta = chunk.choices?.[0]?.delta?.content
      if (delta) {
        if (tFirst === null) tFirst = Date.now() - t0
        tLast = Date.now() - t0
        contentChars += delta.length
      }
      // 官方说明：最后一个内容 chunk 带 finish_reason 和 usage
      if (chunk.choices?.[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason
      if (chunk.usage) usage = chunk.usage
    }
  }

  const totalMs = Date.now() - t0
  const tpotMs = (tFirst !== null && tLast !== null && chunks > 1)
    ? (tLast - tFirst) / (chunks - 1)
    : null

  return { ttftMs: tFirst, tpotMs, totalMs, chunks, contentChars, usage, finishReason }
}

// ---- 直接运行时：跑一组对照 ----
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('输入规模 → TTFT / TPOT / 总耗时\n')
  console.log('  token(约)   TTFT      TPOT     总耗时   chunks  cache_hit')
  for (const n of [10, 200, 1000, 4000]) {
    const m = await measure(n)
    console.log(
      `  ${String(n).padEnd(11)}` +
      `${String(m.ttftMs).padStart(5)}ms  ` +
      `${m.tpotMs ? m.tpotMs.toFixed(1).padStart(6) + 'ms' : '     -'}  ` +
      `${String(m.totalMs).padStart(6)}ms  ` +
      `${String(m.chunks).padStart(6)}  ` +
      `${m.usage?.prompt_cache_hit_tokens ?? '-'}`
    )
  }
  console.log('\n观察要点：')
  console.log('  1. TTFT 随输入变长怎么变？（prefill 是 compute-bound）')
  console.log('  2. TPOT 变了吗？（decode 主要受显存带宽限制，与已生成长度相关）')
  console.log('  3. cache_hit 那一列——第二次跑同一个 n 时数字会变吗？为什么？')
}
