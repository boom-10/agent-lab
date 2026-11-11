#!/usr/bin/env node
/**
 * 实验：重试到底能把成功率救回多少？
 *
 *   npm run probe:retry-gain
 *
 * 做法：故障服务器按 rate 的概率返回 500（unstable 场景）。
 * 分别用「不重试」「最多 3 次」「最多 5 次」各跑 N 个请求，数成功了多少。
 * 理论值：每个请求成功概率 = 1 − rate^尝试次数。
 */

const BASE = process.env.FAULT_BASE ?? 'http://127.0.0.1:39002'
const N = Number(process.env.N ?? 40)
const RATE = Number(process.env.RATE ?? 0.5)

async function one(attempts) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(`${BASE}/chat/completions?scenario=unstable&rate=${RATE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'x', stream: false, messages: [{ role: 'user', content: 'hi' }] }),
    })
    if (res.ok) {
      await res.text()
      return true
    }
    await res.text()
    // 不睡：这里只关心「最终成功没有」，退避时长另说
  }
  return false
}

console.log(`\n  每个请求失败概率 ${RATE}，每个策略跑 ${N} 次\n`)
console.log('  最多尝试次数   成功次数 / 总次数    实测成功率   理论成功率 1−p^n')
console.log('  ' + '─'.repeat(64))
for (const attempts of [1, 3, 5]) {
  let okCount = 0
  for (let i = 0; i < N; i++) if (await one(attempts)) okCount++
  const actual = okCount / N
  const theory = 1 - RATE ** attempts
  console.log(
    `  ${String(attempts).padStart(12)}   ${String(okCount).padStart(8)} / ${String(N).padEnd(8)}    ${(actual * 100).toFixed(0).padStart(8)}%   ${(theory * 100).toFixed(1).padStart(10)}%`,
  )
}
console.log('\n  注意：成功率上去了，代价是失败请求要等更久、并占用更多并发。\n')
