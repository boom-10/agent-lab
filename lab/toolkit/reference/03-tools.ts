/**
 * 参考实现 03 · 工具调用（function calling）完整往返
 *
 * ⚠️ 规则：先自己写，写完再对照。
 *
 * 运行：node 03-tools.ts
 *
 * 这一版的重点是**消息数组怎么增长**——这是 Agent Loop 的地基。
 * 看不懂这个，后面手写 loop 会一直卡。
 */

import type { DeepSeekResponse } from './types.ts'

// ── 关于下面那些 `!` ──
// tsconfig 开了 noUncheckedIndexedAccess，所以 `choices[0]` 的类型是
// `Choice | undefined`。这里加 `!` 是在断言「响应一定符合文档说的形状」。
// 生产代码里你应该真的校验（而不是断言）—— 但那是另一个话题，不在这节课范围。

const BASE = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
const KEY = process.env.DEEPSEEK_API_KEY
if (!KEY) { console.error('缺少 DEEPSEEK_API_KEY'); process.exit(1) }

async function call(messages: unknown[], extra: Record<string, unknown> = {}): Promise<DeepSeekResponse> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: 'deepseek-flash',
      messages,
      // ⚠️ 官方原文：`required` 和指定工具的 tool_choice **在 thinking 模式下返回 400**
      //    所以用工具时先把 thinking 关掉
      thinking: { type: 'disabled' },
      temperature: 0,
      max_tokens: 300,
      ...extra,
    }),
  })
  if (!res.ok) { console.error('HTTP', res.status, await res.text()); process.exit(1) }
  return (await res.json()) as DeepSeekResponse
}

// ---- 1. 定义工具 ----
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: '查询指定城市的当前天气。',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名，例如「杭州」' },
          unit: { type: 'string', enum: ['celsius', 'fahrenheit'], description: '温度单位' },
        },
        required: ['city'],
      },
      // Beta：strict=true 会保证输出严格符合上面的 JSON Schema
      // strict: true,
    },
  },
]

// ---- 2. 第一轮：模型决定调工具 ----
const messages: any[] = [
  { role: 'system', content: '你可以调用工具来回答问题。' },
  { role: 'user', content: '杭州现在多少度？' },
]

console.log('===== 第 1 轮：发出去的消息 =====')
console.log(JSON.stringify(messages, null, 2))

const r1 = await call(messages, { tools })

console.log('\n===== 第 1 轮：模型返回 =====')
console.log('finish_reason:', r1.choices[0]!.finish_reason)   // 应为 "tool_calls"
console.log('message       :', JSON.stringify(r1.choices[0]!.message, null, 2))

const msg = r1.choices[0]!.message
if (!msg.tool_calls?.length) {
  console.log('\n模型没调工具，直接答了：', msg.content)
  process.exit(0)
}

const tc = msg.tool_calls![0]!
console.log('\n----- 拆解 tool_call -----')
console.log('id       :', tc.id)                       // ★ 后面回注结果时要带上
console.log('type     :', tc.type)
console.log('name     :', tc.function.name)
console.log('arguments:', tc.function.arguments)      // ★ 是**字符串**，不是对象！要自己 JSON.parse
console.log('解析后   :', JSON.parse(tc.function.arguments))

// ---- 3. 执行工具（这里用假数据；真实场景是你自己的函数）----
const args = JSON.parse(tc.function.arguments)
const result = { city: args.city, temp: 18, unit: args.unit ?? 'celsius', condition: '多云' }
console.log('\n本地执行工具，结果:', JSON.stringify(result))

// ---- 4. 把 assistant 的 tool_calls 和工具结果都追加进 messages ----
// ⚠️ 三条最容易错的规则：
//   ① assistant 那条消息必须**原样**带上 tool_calls，不能只放 content
//   ② 工具结果的 role 是 "tool"（不是 user），且必须带 tool_call_id
//   ③ content 必须是**字符串**，对象要自己 JSON.stringify
messages.push(msg)                                   // ① 原样追加 assistant 消息
messages.push({
  role: 'tool',                                      // ② role = "tool"
  tool_call_id: tc.id,                               // ③ 必须有 id 对应
  content: JSON.stringify(result),                   // ④ 字符串
})

console.log('\n===== 第 2 轮：发出去的消息（注意数组怎么长的）=====')
console.log(JSON.stringify(messages, null, 2))

const r2 = await call(messages, { tools })

console.log('\n===== 第 2 轮：模型返回 =====')
console.log('finish_reason:', r2.choices[0]!.finish_reason)   // 应为 "stop"
console.log('content      :', r2.choices[0]!.message.content)

// ---- 5. 成本对账 ----
const u = r2.usage
console.log('\n===== 第 2 轮 usage =====')
console.log('prompt_tokens:', u.prompt_tokens,
  `（其中 cache_hit=${u.prompt_cache_hit_tokens}, miss=${u.prompt_cache_miss_tokens}）`)
console.log('\n注意：第二轮 input 比第一轮**大**（多了 tool_calls + tool 结果），')
console.log('      但其中工具定义和前半段对话是**可缓存的前缀**。')
console.log('      → 这就是为什么 Agent 系统要把工具定义放在最前面且保持稳定。')

console.log('\n===== 留给你的三个问题 =====')
console.log('1. tool_calls 的 arguments 为什么是字符串而不是对象？')
console.log('2. 如果第二轮不带 tools 参数会发生什么？试一下。')
console.log('3. 如果 tool_call_id 写错会怎样？试一下，看报错长什么样。')
