#!/usr/bin/env node
/**
 * 分词实验（对应第 0001 节）：中文和英文，各需要多少 token？
 * 调真 API，几分钱。
 *
 *   npm run probe:tokens
 *
 * 方法：请求模板完全相同，只改变文本长度。
 * 用 prompt_tokens 对文本长度做线性回归：斜率就是「每个单位的 token 数」，
 * 截距是模板的固定开销（chat 模板本身占的部分）。
 * 文本用的是各不相同的汉字，和重复的英文单词，避免无意义的重复。
 */

const KEY = process.env.DEEPSEEK_API_KEY
const BASE = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
if (!KEY) {
  console.error('\n  ❌ 没读到 DEEPSEEK_API_KEY。请用 npm run probe:tokens 运行，它会替你读 .env。\n')
  process.exit(1)
}

async function promptTokens(text) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: 'deepseek-flash',
      messages: [{ role: 'user', content: text }],
      thinking: { type: 'disabled' },
      max_tokens: 1,
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return (await res.json()).usage.prompt_tokens
}

// 各不相同的汉字：从 U+4E00 起，步长 97，取模 2000，尽量避开重复
const cjk = (n) => Array.from({ length: n }, (_, i) => String.fromCodePoint(0x4e00 + ((i * 97) % 2000))).join('')
const WORDS = ['apple', 'river', 'mountain', 'candle', 'engine', 'garden', 'window', 'signal', 'pattern', 'vector',
  'planet', 'cloud', 'bridge', 'crystal', 'memory', 'horizon', 'lantern', 'orbit', 'ember', 'canyon']
const en = (n) => Array.from({ length: n }, (_, i) => WORDS[(i * 7) % WORDS.length]).join(' ')

function linreg(xs, ys) {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
  }
  const slope = sxy / sxx
  return { slope, intercept: my - slope * mx }
}

const N = [20, 60, 120, 240]

console.log('\n  ═══ 中文：汉字数 → prompt_tokens ═══')
const cy = []
for (const n of N) {
  const t = await promptTokens(cjk(n))
  cy.push(t)
  console.log(`  ${String(n).padStart(4)} 个汉字 → ${t} tokens`)
}
const c = linreg(N, cy)
console.log(`  斜率：每个汉字约 ${c.slope.toFixed(2)} 个 token（截距约 ${c.intercept.toFixed(0)}，是模板开销）`)

console.log('\n  ═══ 英文：单词数 → prompt_tokens ═══')
const ey = []
for (const n of N) {
  const t = await promptTokens(en(n))
  ey.push(t)
  console.log(`  ${String(n).padStart(4)} 个英文单词 → ${t} tokens`)
}
const e = linreg(N, ey)
console.log(`  斜率：每个英文单词约 ${e.slope.toFixed(2)} 个 token（截距约 ${e.intercept.toFixed(0)}）`)
console.log()
