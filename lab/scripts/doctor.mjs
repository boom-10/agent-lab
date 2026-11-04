#!/usr/bin/env node
/**
 * 体检 —— 从【你当前这个 shell】把整条链路走一遍。
 *
 * 为什么需要：同一份代码，我在我的 shell 跑得通，你在你的跑不通。
 * 那差异一定在环境里（Node 版本、残留的环境变量、mock 进程的状态）。
 * 这个脚本把那些差异全打出来。
 *
 *   node scripts/doctor.mjs
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = process.env.MOCK_PORT ?? '39001'
const C = { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }
const ok = (m) => console.log(`  ${C.g}✅${C.x} ${m}`)
const no = (m) => console.log(`  ${C.r}❌${C.x} ${m}`)
const wn = (m) => console.log(`  ${C.y}⚠️${C.x}  ${m}`)
const head = (m) => console.log(`\n${C.b}${m}${C.x}`)

console.log(`${C.b}═══ 体检 ═══${C.x}  ${C.d}（从你当前这个 shell 跑）${C.x}`)

head('1. Node')
const [maj, min] = process.versions.node.split('.').map(Number)
const v = process.versions.node
if (maj > 22 || (maj === 22 && min >= 18)) ok(`Node ${v}`)
else no(`Node ${v} 太旧 —— 跑 .ts 需要 ≥22.18，--env-file 需要 ≥20.6`)
console.log(`  ${C.d}  ${process.execPath}${C.x}`)

head('2. 残留的环境变量（★ 最可能的原因）')
// --env-file【不覆盖】已经存在的环境变量。
// 课程里让你跑过 `set -a; . ./.env; set +a` —— 那会把真 API 的地址和 key
// 导进这个 shell。之后 --env-file=.env.mock 就【盖不住】它们了。
const leftovers = ['DEEPSEEK_BASE_URL', 'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL']
let found = false
for (const k of leftovers) {
  if (process.env[k] !== undefined) {
    found = true
    const val = k.includes('KEY') ? `${process.env[k].slice(0, 8)}…（${process.env[k].length} 字符）` : process.env[k]
    console.log(`  ${C.r}❌${C.x} ${k} = ${val}`)
  }
}
if (found) {
  console.log(`\n  ${C.y}★ 就是这个原因。${C.x}`)
  console.log(`     --env-file 不会覆盖 shell 里已有的变量，所以 .env.mock 失效了。`)
  console.log(`     修：开一个新终端，或者跑 ${C.b}unset DEEPSEEK_BASE_URL DEEPSEEK_API_KEY${C.x}`)
} else {
  ok('干净（没有会干扰 --env-file 的残留变量）')
}

head(`3. mock 在跑吗（端口 ${PORT}）`)
let pids = []
try {
  pids = execSync(`lsof -ti:${PORT} -sTCP:LISTEN`, { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString().trim().split('\n').filter(Boolean)
} catch { /* 没有 */ }
if (pids.length) ok(`有进程在监听（PID ${pids.join(', ')}）`)
else no(`没有进程监听 ${PORT} —— 另开一个终端跑 npm run mock`)

head('4. mock 对「带 tools 的请求」返回什么')
try {
  const r = await fetch(`http://127.0.0.1:${PORT}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer sk-mock' },
    body: JSON.stringify({
      model: 'deepseek-flash', thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: '...' }],
      tools: [{ type: 'function', function: { name: 'count_chars', description: 'd',
        parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } } }],
    }),
    signal: AbortSignal.timeout(5000),
  })
  const d = await r.json()
  const c = (d.choices ?? [])[0]
  const tc = c?.message?.tool_calls
  if (tc?.length) ok(`返回了 tool_calls：${tc[0].function.name}  args=${tc[0].function.arguments}`)
  else no(`没返回 tool_calls！finish_reason=${c?.finish_reason}  content=${JSON.stringify(c?.message?.content)?.slice(0, 80)}`)
} catch (e) {
  no(`连不上：${e.message}`)
}

head('5. .env.mock 的内容')
const f = join(HERE, '.env.mock')
if (!existsSync(f)) no('.env.mock 不存在')
else {
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue
    const [k, ...rest] = line.split('=')
    const val = k.includes('KEY') ? `${rest.join('=').slice(0, 8)}…` : rest.join('=')
    console.log(`  ${C.d}${k} = ${val}${C.x}`)
  }
}

console.log(`\n${C.d}提示：这个脚本只做只读检查 + 一次本地 mock 请求，不花钱。${C.x}\n`)
