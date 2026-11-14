#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  练习 06 · 最小 Agent Loop                                                ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * 对应课程：第 0010–0012 节
 *
 * 不花钱，全部打本地 mock。
 *
 *   # 终端 1
 *   npm run mock
 *   # 终端 2
 *   npm run ex:loop
 *
 * ── 字段速查（这一节要碰的所有形状）──
 *
 * 请求 messages 里，三种角色长得不一样：
 *
 *   { role: 'system',    content: '你是…' }
 *   { role: 'user',      content: '北京天气怎么样' }
 *   { role: 'assistant', content: null, tool_calls: [ { id, type: 'function', function: { name, arguments } } ] }
 *   { role: 'tool',      tool_call_id: 'call_xxx', content: '晴，22°C' }
 *
 * 响应（非流式）里：
 *
 *   choices[0].finish_reason         'stop' | 'tool_calls' | 'length' | …
 *   choices[0].message.content       文本答案；调工具时是 null
 *   choices[0].message.tool_calls    数组；只有 finish_reason 为 'tool_calls' 时才有
 *   tool_calls[i].id                 务必原样带回到 tool 消息的 tool_call_id
 *   tool_calls[i].function.name      工具名
 *   tool_calls[i].function.arguments **字符串**，不是对象 → 要 JSON.parse
 *   usage                            token 统计
 *
 * 三个最容易写错的地方：
 *   ① arguments 是字符串，而且可能是非法 JSON
 *   ② tool 消息必须带 tool_call_id，且要和 assistant 里那个 id 一模一样
 *   ③ assistant 的那条消息（带 tool_calls）必须原样放回 messages，不能只放 content
 *
 * ── 要写什么 ──
 *   TODO 1  parseArgs()  把 arguments 字符串安全地变成对象
 *   TODO 2  runAgent()   循环：问 → 模型 → 调工具 → 塞回结果 → 再问，直到有答案
 *                        并加两道护栏：最大步数、重复调用检测
 *
 * ── 怎么调试 ──
 * 先把 maxSteps 设成 1 跑一次，看 steps 和 stopReason 是不是符合预期；
 * 再放开，观察「模型第二次就给了答案」这件事（mock 的行为）。
 *
 * ── 常见错误对照 ──
 *   steps 一直涨到 maxSteps  → 你的循环没识别 finish_reason === 'stop'
 *   第二次请求报 400          → tool 消息缺 tool_call_id，或者 id 对不上
 *   answer 里是「我只收到 1 条消息」 → assistant 那条带 tool_calls 的消息没放回 messages
 *   parseArgs 直接崩          → 没 try/catch，arguments 是字符串不是对象
 */

const BASE = process.env.MOCK_BASE ?? 'http://127.0.0.1:39001'

export type StopReason = 'done' | 'max-steps' | 'repeated'

export type RunResult = {
  answer: string
  /** 调了几次模型 */
  steps: number
  /** 执行了几次工具 */
  toolCalls: number
  stopReason: StopReason
}

/** 工具定义：给模型看的说明书 */
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: '查询指定城市的天气',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string', description: '城市名' } },
        required: ['city'],
      },
    },
  },
]

/** 真的执行工具（这里用假数据，不联网） */
function executeTool(name: string, args: Record<string, unknown>): string {
  if (name === 'get_weather') return `${String(args.city ?? '未知')}：晴，22°C`
  return `未知工具：${name}`
}

// ══════════════════════════════════════════════════════════════════════════
//  TODO 1 · 把 arguments 字符串安全地变成对象
// ══════════════════════════════════════════════════════════════════════════
//
// 输入是 tool_calls[0].function.arguments，一个**字符串**，形如 '{"city":"Ada"}'。
// 它可能是非法 JSON（模型偶尔会写坏），所以必须 try/catch。
//
// 成功：{ ok: true, args: {...} }
// 失败：{ ok: false, error: '一句说明' }
//
// 返回 undefined 表示「还没写」。

export function parseArgs(
  raw: string,
):
  | { ok: true; args: Record<string, unknown> }
  | { ok: false; error: string }
  | undefined {
  return undefined
}

// ══════════════════════════════════════════════════════════════════════════
//  TODO 2 · 最小循环 + 两道护栏
// ══════════════════════════════════════════════════════════════════════════
//
// 循环长这样（骨架已经摆好，逻辑你来填）：
//
//   1. messages = [{ role:'user', content: question }]
//   2. 第 steps 步：把 messages + tools 发给模型
//   3. finish_reason 不是 'tool_calls' → 结束，返回 message.content（可能为 null）
//   4. 是 'tool_calls'：
//        a. 【护栏一】如果这一步的调用和上一步完全相同 → 停，stopReason='repeated'
//        b. 解析 arguments（用 TODO 1）→ 执行工具 → 把结果作为 role:'tool' 追加
//        c. 【护栏二】如果 steps 已经等于 maxSteps → 停，stopReason='max-steps'
//        d. 回到第 2 步
//
// 返回 undefined 表示「还没写」。
//
// 提示：比较「是不是重复」用工具名 + 原始 arguments 字符串拼一个 key 就够了。

export async function runAgent(
  question: string,
  opts: { maxSteps?: number; url?: string } = {},
): Promise<RunResult | undefined> {
  const maxSteps = opts.maxSteps ?? 6
  const url = opts.url ?? `${BASE}/chat/completions`

  const messages: Array<Record<string, unknown>> = [{ role: 'user', content: question }]
  let steps = 0
  let toolCalls = 0
  let lastKey = ''

  while (steps < maxSteps) {
    steps++
    // ← 你写：发请求，拿 finish_reason 和 message
    // ← 你写：不是 tool_calls 就 return { answer, steps, toolCalls, stopReason: 'done' }
    // ← 你写：是 tool_calls 就做护栏判断 + 执行 + 追加消息
  }

  return { answer: '', steps, toolCalls, stopReason: 'max-steps' }
}

// ══════════════════════════════════════════════════════════════════════════
//  自检 —— 不用改
// ══════════════════════════════════════════════════════════════════════════

const checks: { name: string; pass: boolean; detail: string }[] = []
const ok = (name: string, pass: boolean, detail: string) => checks.push({ name, pass, detail })

if (parseArgs('{"city":"Ada"}') === undefined) {
  console.log('\n  ⏳ 还没开始写 —— TODO 1 的 parseArgs() 还返回 undefined。')
  console.log('     写完再跑 npm run ex:loop。\n')
  process.exit(0)
}

// ① parseArgs
{
  const good = parseArgs('{"city":"Ada"}')
  ok('parseArgs 能吃合法 JSON', good?.ok === true, JSON.stringify(good))
  const bad = parseArgs('{city: Ada')
  ok('parseArgs 能挡住非法 JSON', bad?.ok === false, JSON.stringify(bad))
}

// ② 正常两轮：模型第一次要工具，第二次给答案
{
  const r = await runAgent('北京天气怎么样？')
  if (r) {
    ok('正常流程两步结束', r.steps === 2 && r.stopReason === 'done', `steps=${r.steps} stopReason=${r.stopReason}`)
    ok('执行了 1 次工具', r.toolCalls === 1, `toolCalls=${r.toolCalls}`)
    // mock 会数消息条数：user + assistant(tool_calls) + tool = 3 条
    ok('历史拼对了（mock 应该看到 3 条消息）', r.answer.includes('3 条消息'), `answer=${r.answer.slice(0, 40)}`)
  }
}

// ③ 护栏一：最大步数（用 vary 让每次参数不同，避免触发重复检测）
{
  const r = await runAgent('天气', { maxSteps: 4, url: `${BASE}/chat/completions?loop=1&vary=1` })
  if (r) {
    ok('卡死时由「最大步数」兜住', r.stopReason === 'max-steps' && r.steps === 4, `steps=${r.steps} stopReason=${r.stopReason}`)
  }
}

// ④ 护栏二：重复调用（参数相同）
{
  const r = await runAgent('天气', { maxSteps: 10, url: `${BASE}/chat/completions?loop=1` })
  if (r) {
    ok('同样的调用重复出现就停', r.stopReason === 'repeated' && r.steps === 2, `steps=${r.steps} stopReason=${r.stopReason}`)
  }
}

console.log('\n  ─────────── 自检 ───────────\n')
for (const c of checks) console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}  —  ${c.detail}`)
const failed = checks.filter((c) => !c.pass).length
console.log()
if (failed === 0) {
  console.log('  🎉 全部通过。这个循环就是所有 Agent 框架的核心，剩下的都是它的武装。\n')
  process.exit(0)
}
console.log(`  ${failed} 项没过。对照文件开头的「常见错误对照」排查。\n`)
process.exit(1)
