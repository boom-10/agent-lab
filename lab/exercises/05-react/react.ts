#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  练习 07 · ReAct：用文本协议让模型「边想边做」                            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * 对应课程：第 0013–0014 节
 *
 *   # 终端 1
 *   npm run mock
 *   # 终端 2
 *   npm run ex:react
 *
 * ── 字段速查 ──
 *
 * 这一节没有 tool_calls。模型返回的是一段**普通文本**，你要自己从里面抠出字段：
 *
 *   需要工具时：
 *     Thought: 我需要查询天气
 *     Action: get_weather
 *     Action Input: {"city": "Ada"}
 *
 *   可以回答时：
 *     Thought: 我已经拿到结果了
 *     Final Answer: Ada 今天晴，22°C
 *
 * 三个关键差异（和原生 tool_calls 比）：
 *
 *   ① 工具调用藏在**文本**里 → 必须解析，模型写歪一行你就解析不出来
 *   ② 工具结果塞回去时，role 是 'user'，内容以 "Observation: " 开头
 *      （原生是 role: 'tool' + tool_call_id）
 *   ③ 没有结构化校验 → 模型可以「假装」调用了工具，你无法区分
 *
 * ── 要写什么 ──
 *   TODO 1  parseReAct()  从文本里抠出 Thought / Action / Action Input / Final Answer
 *   TODO 2  runReAct()    循环：问 → 解析 → 执行 → 把 Observation 塞回去 → 再问
 *
 * ── 怎么调试 ──
 * 先单独调 parseReAct 试三种输入（要工具、给答案、写坏），再跑循环。
 *
 * ── 常见错误对照 ──
 *   解析结果永远是 error        → 正则没考虑换行（模型输出里是 \n 分隔）
 *   第二轮模型还是调工具        → Observation 没以 "Observation: " 开头
 *   Action Input 解析不出来     → 值是 JSON 字符串，别忘了 JSON.parse
 *   循环停不下来                → 没判断 kind === 'final'
 */

const BASE = process.env.MOCK_BASE ?? 'http://127.0.0.1:39001'

export type StopReason = 'done' | 'max-steps' | 'repeated'

export type ReactResult = {
  answer: string
  steps: number
  toolCalls: number
  stopReason: StopReason
}

/** 解析结果：要么是「要调工具」，要么是「给答案」，要么是「解析失败」 */
export type Parsed =
  | { kind: 'action'; thought: string; action: string; input: Record<string, unknown> }
  | { kind: 'final'; thought: string; answer: string }
  | { kind: 'error'; reason: string }

/** 工具定义 + 真实执行（和练习 06 一样，不联网） */
function executeTool(name: string, args: Record<string, unknown>): string {
  if (name === 'get_weather') return `${String(args.city ?? '未知')}：晴，22°C`
  return `未知工具：${name}`
}

// ══════════════════════════════════════════════════════════════════════════
//  TODO 1 · 从文本里抠字段
// ══════════════════════════════════════════════════════════════════════════
//
// 输入是模型的整段 content，形如：
//
//   "Thought: 我需要查询天气\nAction: get_weather\nAction Input: {\"city\": \"Ada\"}"
//   "Thought: 已经拿到结果了\nFinal Answer: Ada 今天晴，22°C"
//
// 要求：
//   · 找到 Final Answer → { kind: 'final', thought, answer }
//   · 找到 Action + Action Input → { kind: 'action', thought, action, input }
//     input 要 JSON.parse；解析失败就走 error 分支
//   · 两个都没有 → { kind: 'error', reason: '没说清楚要做什么' }
//
// 提示：按行切比正则更稳。先 split('\n')，再逐行看前缀。
//
// 还没写时请 throw new Error('还没写')，不要返回 undefined。

export function parseReAct(text: string): Parsed {
  throw new Error('还没写')
}

// ══════════════════════════════════════════════════════════════════════════
//  TODO 2 · ReAct 循环
// ══════════════════════════════════════════════════════════════════════════
//
// 和练习 06 的结构一样，但有三处不同：
//
//   1. 请求地址带 ?react=1（让 mock 用文本协议回答），**不要传 tools**
//   2. 用 parseReAct 解析 content，而不是读 tool_calls
//   3. 把结果塞回去时：assistant 的 content 是模型原文，
//      紧跟一条 user 消息，内容必须以 "Observation: " 开头
//
//   循环：
//     messages = [{ role:'user', content: question }]
//     重复：
//       调模型 → parseReAct(content)
//       kind === 'final' → return { answer, steps, toolCalls, stopReason:'done' }
//       kind === 'error' → return { answer: '', ..., stopReason:'done' }（或自己定义）
//       kind === 'action' → 护栏（重复/步数）→ 执行 → 追加两条消息 → 继续
//
// 返回 undefined 表示「还没写」——不，这次请 throw new Error('还没写')。

export async function runReAct(
  question: string,
  opts: { maxSteps?: number; url?: string } = {},
): Promise<ReactResult> {
  const maxSteps = opts.maxSteps ?? 6
  const url = opts.url ?? `${BASE}/chat/completions?react=1`

  const messages: Array<Record<string, unknown>> = [{ role: 'user', content: question }]
  let steps = 0
  let toolCalls = 0
  let lastKey = ''

  while (steps < maxSteps) {
    steps++

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-flash',
        messages,
        thinking: { type: 'disabled' },
      }),
    })
    const data = (await res.json()) as {
      choices: [{ finish_reason: string; message: { content: string | null } }]
    }
    const text = data.choices[0].message.content ?? ''

    // ← 你写：解析 text，按 kind 分支处理
    //   提示：action 分支里要做 ① 重复检测 ② 执行工具 ③ push 两条消息 ④ toolCalls++
  }

  return { answer: '', steps, toolCalls, stopReason: 'max-steps' }
}

// ══════════════════════════════════════════════════════════════════════════
//  自检 —— 不用改
// ══════════════════════════════════════════════════════════════════════════

const checks: { name: string; pass: boolean; detail: string }[] = []
const ok = (name: string, pass: boolean, detail: string) => checks.push({ name, pass, detail })

// 还没写的话，给个友好提示而不是崩一堆栈
try {
  parseReAct('Thought: 试探\nFinal Answer: ok')
} catch {
  console.log('\n  ⏳ 还没开始写 —— parseReAct() 还抛「还没写」。')
  console.log('     写完再跑 npm run ex:react。\n')
  process.exit(0)
}

const ACT = 'Thought: 我需要查天气\nAction: get_weather\nAction Input: {"city": "Ada"}'
const FIN = 'Thought: 已经拿到结果\nFinal Answer: Ada 今天晴，22°C'
const BAD = '我想想啊……好像应该查一下天气？'

// ① 解析「要工具」
try {
  const p = parseReAct(ACT)
  ok('解析出 Action', p.kind === 'action' && p.action === 'get_weather', JSON.stringify(p).slice(0, 80))
  ok('解析出 Thought', p.kind === 'action' && p.thought.includes('查天气'), p.kind === 'action' ? p.thought : '-')
  ok('Action Input 变成对象', p.kind === 'action' && p.input.city === 'Ada', p.kind === 'action' ? JSON.stringify(p.input) : '-')
} catch (e) {
  ok('解析出 Action', false, String((e as Error).message))
}

// ② 解析「给答案」
try {
  const p = parseReAct(FIN)
  ok('解析出 Final Answer', p.kind === 'final' && p.answer.includes('晴'), p.kind === 'final' ? p.answer : '-')
} catch (e) {
  ok('解析出 Final Answer', false, String((e as Error).message))
}

// ③ 写坏了要能报错，而不是瞎猜
try {
  const p = parseReAct(BAD)
  ok('说胡话时归为 error', p.kind === 'error', `kind=${p.kind}`)
} catch (e) {
  ok('说胡话时归为 error', false, String((e as Error).message))
}

// ④ 完整循环
try {
  const r = await runReAct('Ada 今天天气怎么样？')
  ok('ReAct 循环两步结束', r.steps === 2 && r.stopReason === 'done', `steps=${r.steps} stopReason=${r.stopReason}`)
  ok('拿到答案', r.answer.includes('晴'), r.answer.slice(0, 40))
  ok('执行了 1 次工具', r.toolCalls === 1, `toolCalls=${r.toolCalls}`)
} catch (e) {
  ok('ReAct 循环两步结束', false, String((e as Error).message))
}

console.log('\n  ─────────── 自检 ───────────\n')
for (const c of checks) console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}  —  ${c.detail}`)
const failed = checks.filter((c) => !c.pass).length
console.log()
if (failed === 0) {
  console.log('  🎉 全部通过。现在你已经手写过两种协议了——下一节把它们摆在一起比。\n')
  process.exit(0)
}
console.log(`  ${failed} 项没过。对照文件开头的「常见错误对照」排查。\n`)
process.exit(1)
