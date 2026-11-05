#!/usr/bin/env node
/**
 * 参数实验（对应第 0001 节）：max_tokens、thinking、temperature 各改变了什么。
 * 调真 API，花费几分钱。
 *
 *   npm run probe:sampling
 *
 * 只打印结果，不下结论。结论请你自己从数字里读出来。
 */

const KEY = process.env.DEEPSEEK_API_KEY
const BASE = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
if (!KEY) {
  console.error('\n  ❌ 没读到 DEEPSEEK_API_KEY。请用 npm run probe:sampling 运行，它会替你读 .env。\n')
  process.exit(1)
}

async function chat(body) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: 'deepseek-flash', ...body }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

const short = (s, n = 40) => (s ?? '').replace(/\n/g, '↵').slice(0, n)

console.log('\n═══ 0. API 是无状态的：第二次请求不带历史，模型还记得第一句吗 ═══')
{
  const a = await chat({ messages: [{ role: 'user', content: '我叫小明，请记住。' }], thinking: { type: 'disabled' }, max_tokens: 60 })
  const noHistory = await chat({ messages: [{ role: 'user', content: '我叫什么名字？' }], thinking: { type: 'disabled' }, max_tokens: 60 })
  const withHistory = await chat({
    messages: [
      { role: 'user', content: '我叫小明，请记住。' },
      { role: 'assistant', content: a.choices[0].message.content ?? '' },
      { role: 'user', content: '我叫什么名字？' },
    ],
    thinking: { type: 'disabled' },
    max_tokens: 60,
  })
  console.log(`  不带历史：「${short(noHistory.choices[0].message.content, 50)}」`)
  console.log(`  带上历史：「${short(withHistory.choices[0].message.content, 50)}」`)
  console.log(`  prompt_tokens：不带历史 ${noHistory.usage.prompt_tokens}，带历史 ${withHistory.usage.prompt_tokens}`)
}

console.log('\n═══ 1. max_tokens 太小，会发生什么 ═══')
{
  const d = await chat({
    messages: [{ role: 'user', content: '请详细介绍一下大模型推理的两个阶段。' }],
    thinking: { type: 'disabled' },
    max_tokens: 5,
  })
  const c = d.choices[0]
  console.log(`  finish_reason = ${c.finish_reason}   completion_tokens = ${d.usage.completion_tokens}`)
  console.log(`  内容 = 「${short(c.message.content)}」`)
}

console.log('\n═══ 2. thinking 默认是开着的吗（这次不传 thinking 参数）═══')
{
  const d = await chat({
    messages: [{ role: 'user', content: '17 乘以 23 等于多少？只给结果。' }],
    max_tokens: 800,
  })
  const m = d.choices[0].message
  const reasoningTokens = d.usage.completion_tokens_details?.reasoning_tokens ?? 0
  console.log(`  reasoning_content 字段: ${m.reasoning_content ? `有（${m.reasoning_content.length} 字符）` : '没有'}`)
  console.log(`  reasoning_tokens = ${reasoningTokens}   completion_tokens = ${d.usage.completion_tokens}`)
  console.log(`  finish_reason = ${d.choices[0].finish_reason}   正文 = 「${short(m.content, 30)}」`)
}

console.log('\n═══ 3. temperature：同一个问题，每个温度跑三次 ═══')
const q = '用一句话描述秋天。'
for (const t of [0, 1.5]) {
  const outs = []
  for (let i = 0; i < 3; i++) {
    const d = await chat({
      messages: [{ role: 'user', content: q }],
      thinking: { type: 'disabled' },
      temperature: t,
      max_tokens: 60,
    })
    outs.push(d.choices[0].message.content ?? '')
  }
  const same = outs.every((o) => o === outs[0])
  console.log(`  temperature = ${t}：${same ? '三次完全相同' : '三次不一样'}`)
  outs.forEach((o, i) => console.log(`    第 ${i + 1} 次：「${short(o, 60)}」`))
}
console.log()
