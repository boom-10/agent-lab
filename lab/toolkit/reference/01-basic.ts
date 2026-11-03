/**
 * 参考实现 01 · 原生 HTTP 调用（不用任何 SDK）
 *
 * ⚠️ 规则：先自己写，写完再对照这个。
 * 看这个的目的不是抄，是「看到差异后问自己为什么」。
 *
 * 运行：node 01-basic.ts
 * 前置：agent-lab/lab/.env 里有 DEEPSEEK_API_KEY
 */

import type { DeepSeekResponse } from './types.ts'

// ── 关于下面那些 `!` ──
// tsconfig 开了 noUncheckedIndexedAccess，所以 `choices[0]` 的类型是
// `Choice | undefined`。这里加 `!` 是在断言「响应一定符合文档说的形状」。
// 生产代码里你应该真的校验（而不是断言）—— 但那是另一个话题，不在这节课范围。

const BASE = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
const KEY = process.env.DEEPSEEK_API_KEY

if (!KEY) {
  console.error('缺少 DEEPSEEK_API_KEY。请先创建 agent-lab/lab/.env')
  process.exit(1)
}

const body = {
  model: 'deepseek-flash',
  messages: [
    { role: 'system', content: '你是一个简洁的助手。' },
    { role: 'user', content: '用一句话解释什么是 KV Cache。' },
  ],
  // 关掉思考模式：否则 temperature 无效、max_tokens 默认 64K、还会多出 reasoning_content
  thinking: { type: 'disabled' },
  temperature: 0,
  max_tokens: 200,
  stream: false,
}

const started = Date.now()
const res = await fetch(`${BASE}/chat/completions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${KEY}`,
  },
  body: JSON.stringify(body),
})
const elapsed = Date.now() - started

console.log('HTTP', res.status, `${elapsed}ms`)

if (!res.ok) {
  // ⚠️ 出错时先看原始 body，不要猜
  console.error(await res.text())
  process.exit(1)
}

const data = (await res.json()) as DeepSeekResponse

console.log('\n===== 完整响应（逐字段看）=====')
console.log(JSON.stringify(data, null, 2))

console.log('\n===== 拆解 =====')
console.log('finish_reason :', data.choices[0]!.finish_reason)
console.log('content       :', data.choices[0]!.message.content)
console.log('reasoning?    :', data.choices[0]!.message.reasoning_content ?? '(无，因为关了 thinking)')

const u = data.usage
console.log('\n----- usage 逐字段 -----')
console.log('prompt_tokens            :', u.prompt_tokens)
console.log('  ├ prompt_cache_hit_tokens :', u.prompt_cache_hit_tokens)
console.log('  └ prompt_cache_miss_tokens:', u.prompt_cache_miss_tokens)
console.log('    （官方：prompt_tokens = hit + miss） 验证:',
  u.prompt_cache_hit_tokens + u.prompt_cache_miss_tokens === u.prompt_tokens ? '✅ 成立' : '❌ 不成立')
console.log('completion_tokens        :', u.completion_tokens)
console.log('  └ reasoning_tokens      :', u.completion_tokens_details?.reasoning_tokens ?? '(未提供)')
console.log('total_tokens             :', u.total_tokens)
console.log('prompt_tokens_details.cached_tokens:', u.prompt_tokens_details?.cached_tokens)

console.log('\n===== 立刻算成本（低峰价，$ / 1M token）=====')
const HIT = 0.003, MISS = 0.15, OUT = 0.6
const cost =
  (u.prompt_cache_hit_tokens * HIT + u.prompt_cache_miss_tokens * MISS + u.completion_tokens * OUT) / 1e6
console.log(`本次请求成本 ≈ $${cost.toFixed(8)}`)
console.log('（养成习惯：每次调用都算一遍，面试时才能当场报出量级）')
