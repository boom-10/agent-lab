#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  练习 02 · 工具调用往返                                                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * 对应课程：第 0003 节《工具调用：从「会说话」到「能做事」》
 * 对应任务：P0 任务 0.3 —— 原生 API 调用的第三个动作
 *
 * 你只需要填 main() 里的 5 个 TODO。写完直接跑，脚本会自检。
 *
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  怎么跑
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 【推荐】先用本地 mock 调 —— 免费、无限次、而且它会故意给你制造边界情况
 *
 *   终端 A:  cd ~/Desktop/Personal/agent-lab/lab && npm run mock
 *   终端 B:  cd ~/Desktop/Personal/agent-lab/lab && node --env-file=.env.mock exercises/01-raw-api/tools.ts
 *
 * 最后确认真实行为时，调一次真 API（会花两次调用，约 $0.0001）：
 *
 *   cd ~/Desktop/Personal/agent-lab/lab
 *   node --env-file=.env exercises/01-raw-api/tools.ts
 *
 * 用 run.mjs 跑，它会替你处理 Node 版本、.env 加载、mock/真 API 判断。
 * 想直接用 node 也行，但要自己保证 Node ≥22.18 且带对 --env-file。
 *
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  怎么调试
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ── 常见报错对照表（先看这里）──────────────────────────────────────────────
 *
 *   看到什么                                        病因
 *   ──────────────────────────────────────────────  ──────────────────────────
 *   HTTP 400                                        ① tool_call_id 和上一轮
 *   Messages with role 'tool' must be a response      assistant 消息里的
 *   to a preceding message with 'tool_calls'          tool_calls[].id 对不上
 *                                                   → 见 TODO 4 的 ★
 *
 *   HTTP 400                                        同上。多半是你自己生成了
 *   An assistant message with 'tool_calls' must be    一个 id，而不是原样透传
 *   followed by tool messages ...
 *
 *   arguments 是字符串，不是对象                    这是对的，不是 bug。
 *                                                   → 见 TODO 3 的 ②
 *
 *   第二轮的回答和第一轮一样，没进展                 检查第一轮那条 assistant
 *                                                   消息有没有**原样**塞回去
 *
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 💡 mock 会故意做这些事，你的代码必须扛住：
 *
 *   1. 用**你声明的第一个工具**来造 tool_call（所以你定义什么工具都能跑通）
 *   2. arguments 按你 schema 里 `required` 的字段生成占位值
 *      （string → "Ada"，number → 42，boolean → true）
 *   3. 校验 tool_call_id —— 写错会返回**和真 API 一模一样**的 400
 *
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  验收标准（脚本会自动检查）
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   1. 定义你自己的工具（别用 get_weather，选个你真正想查的）
 *   2. 第一轮拿到 tool_calls，且 finish_reason 是 'tool_calls'
 *   3. 把 arguments 从**字符串**解析成对象，并真的执行工具
 *   4. 回填 role:'tool' + tool_call_id（**原样透传**），发第二轮
 *   5. 拿到最终回答
 */

// ══════════════════════════════════════════════════════════════════════════
//  0 · 配置与前置检查（已经写好，不用改）
// ══════════════════════════════════════════════════════════════════════════

const BASE = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
const KEY = process.env.DEEPSEEK_API_KEY

if (!KEY) {
  console.error(
    '\n  ❌ 没读到 DEEPSEEK_API_KEY\n\n' +
      '     八成是忘了 --env-file。正确写法：\n' +
      '       mock:  node --env-file=.env.mock exercises/01-raw-api/tools.ts\n' +
      '       真 API: node --env-file=.env      exercises/01-raw-api/tools.ts\n\n' +
      '     而且必须在 lab/ 目录下跑（--env-file 是相对当前目录的）。\n',
  )
  process.exit(1)
}

// ── 出错时给出可读诊断，而不是甩一堆堆栈 ──
// 注意：顶层 await 抛错在 ESM 里走的是 uncaughtException，不是 unhandledRejection，
// 所以两个都要挂（实测过）。
const diagnose = (e: unknown): never => {
  const err = e as { message?: string; raw?: string }
  console.error('\n  ❌ 请求失败\n')

  if (!err?.raw) {
    console.error('     ', err?.message ?? String(e), '\n')
    process.exit(1)
  }

  let msg = err.raw
  try {
    msg = (JSON.parse(err.raw) as { error?: { message?: string } }).error?.message ?? err.raw
  } catch {
    /* 不是 JSON 就用原文 */
  }

  console.error('     ', msg, '\n')

  if (/role 'tool' must be a response to a preceding/i.test(msg)) {
    console.error("  💡 病因：你发的 role:'tool' 消息，前面没有对应的 tool_calls。")
    console.error('     两个常见原因：')
    console.error('       1. 忘了把第一轮的 assistant 消息（连同 tool_calls）塞回 messages')
    console.error('          → messages.push(msg1)')
    console.error('       2. tool_call_id 是自己编的，不是从 call.id 原样透传的\n')
  } else if (/did not have response messages/i.test(msg)) {
    console.error('  💡 病因：tool_call_id 和上一轮 tool_calls[].id 对不上。')
    console.error('     ★ 必须原样透传 call.id，不能自己重新生成。\n')
  } else if (/401|Authentication Fails/i.test(msg)) {
    console.error('  💡 病因：KEY 没读到或无效。检查 --env-file，见文件开头的坑 ①。\n')
  }
  process.exit(1)
}
process.on('uncaughtException', diagnose)
process.on('unhandledRejection', diagnose)

// ══════════════════════════════════════════════════════════════════════════
//  类型定义（已经写好，不用改）
// ══════════════════════════════════════════════════════════════════════════

type ToolDef = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, { type: string; description?: string }>
      required?: string[]
    }
  }
}

type ChatMessage = Record<string, unknown>

type ToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

type ChatResponse = {
  choices: Array<{
    finish_reason: string
    message: { role: string; content: string | null; tool_calls?: ToolCall[] }
  }>
}

/** main() 要返回这些东西 —— TypeScript 会拿它检查你 */
type ToolResult = {
  /** 模型选了哪个工具 */
  toolName: string
  /** arguments 解析后的对象 */
  args: Record<string, unknown>
  /** 你执行工具得到的返回值（字符串） */
  toolReturn: string
  /** 第一轮的 finish_reason，应该是 'tool_calls' */
  finish1: string
  /** 第二轮的最终回答 */
  finalText: string
}

// ══════════════════════════════════════════════════════════════════════════
//  发请求的小工具（已经写好，不用改）
// ══════════════════════════════════════════════════════════════════════════
//
// ★ 它失败时会先打原始 body 再抛 —— 这是排查的铁律：不要猜，看原文。

async function chat(messages: ChatMessage[], tools: ToolDef[]): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: 'deepseek-flash',
      messages,
      tools,
      thinking: { type: 'disabled' },
      max_tokens: 300,
    }),
  })
  const raw = await res.text()
  if (!res.ok) {
    throw Object.assign(new Error(`HTTP ${res.status}`), { raw })
  }
  return JSON.parse(raw) as ChatResponse
}

// ══════════════════════════════════════════════════════════════════════════
//  ★ 你的代码写在这里
// ══════════════════════════════════════════════════════════════════════════

async function main(): Promise<ToolResult | undefined> {
  // ────────────────────────────────────────────────────────────────────────
  //  TODO 1 · 定义你自己的工具
  // ────────────────────────────────────────────────────────────────────────
  //
  // 别用 get_weather（课程里已经用过了）。选一个**你真正想查的东西**，比如：
  //
  //   • 统计一段文本的字符数 / 字节数
  //   • 读一个本地文件的前 N 行
  //   • 算两个数的某个运算
  //   • 查当前时间
  //
  // 结构就是上面 ToolDef 那个形状。TypeScript 会提示你每个字段。
  //
  // 💡 description 写得好不好直接决定模型会不会选对工具 ——
  //    这是可以拿来做实验的（后面讲「工具选对率」时会用到）。
  //
  // const tools: ToolDef[] = [ ... ]

  // ────────────────────────────────────────────────────────────────────────
  //  TODO 2 · 第一轮：让模型决定调不调工具
  // ────────────────────────────────────────────────────────────────────────
  //
  // 发一条 user 消息（内容要能让模型觉得「这件事需要调工具」），带上 tools。
  //
  // const messages: ChatMessage[] = [{ role: 'user', content: '...' }]
  // const data1 = await chat(messages, tools)
  // const msg1 = data1.choices[0]!.message
  // const call = msg1.tool_calls?.[0]!
  // const finish1 = data1.choices[0]!.finish_reason
  //
  // ⚠️ 如果 finish_reason 不是 'tool_calls'，说明模型认为**不需要**调工具。
  //    这时先改你的 user 消息，让它更像一个真的需要查数据的问题。

  // ────────────────────────────────────────────────────────────────────────
  //  TODO 3 · 解析参数并**真的执行**工具
  // ────────────────────────────────────────────────────────────────────────
  //
  // ① call.function.name —— 要调哪个工具
  //    ★ 如果你注册了多个工具，这里必须**按名字分发**，不能写死。
  //
  // ② call.function.arguments 是**字符串**！不是对象。
  //    必须 JSON.parse。这不是 bug，是协议设计 ——
  //    流式下这个字符串是分片下发的，服务端只能给你拼好的文本。
  //
  //    const args = JSON.parse(call.function.arguments) as Record<string, unknown>
  //
  // ③ 真的执行。别 `return 'ok'` 糊弄 —— 这一节的重点是「从会说话到能做事」。
  //    读文件、算数、查时间，随便哪个，但要**真的做**。
  //
  //    const toolReturn = '...'   // 必须是字符串
  //
  // 💡 想更真实的话，把结果做成 JSON 字符串：JSON.stringify({ ... })

  // ────────────────────────────────────────────────────────────────────────
  //  TODO 4 · 第二轮：把结果回填，让模型给出最终回答
  // ────────────────────────────────────────────────────────────────────────
  //
  // 这一步是整个练习最容易写错的地方。要往 messages 里追加**两条**：
  //
  //   ① 第一轮的 assistant 消息 —— **原样**塞回去（连同 tool_calls）
  //        messages.push(msg1 as unknown as ChatMessage)
  //
  //      ⚠️ 不能只塞 content。tool_calls 必须一起带上，
  //         否则服务端不知道你在回应哪个调用。
  //
  //   ② 一条 role:'tool' 的消息
  //        messages.push({
  //          role: 'tool',
  //          tool_call_id: call.id,     // ★★ 原样透传，不要自己生成
  //          content: toolReturn,
  //        })
  //
  // ★★ 关于 tool_call_id：
  //
  //    服务端**强制校验**这个 id —— 它不是建议，是硬约束。
  //    必须从模型返回的 `call.id` 原样透传，**不能自己重新生成**。
  //
  //    写错了会返回 400，报错原文是：
  //      An assistant message with 'tool_calls' must be followed by tool messages
  //      responding to each 'tool_call_id', The following tool_call_ids did not
  //      have response messages: call_WRONG_id
  //
  //    这条看起来是废话，但它是 Agent 实现里**最高频**的错误 ——
  //    尤其当你的工具要并发执行、结果异步回来的时候，
  //    「哪个结果对应哪个调用」就靠这个 id 串起来。
  //
  //    想亲眼看这个报错？把上面那行改成 tool_call_id: 'call_WRONG' 再跑一次。
  //    这个文件的诊断处理器会直接告诉你病因。
  //
  // const data2 = await chat(messages, tools)
  // const finalText = data2.choices[0]!.message.content ?? ''

  // ────────────────────────────────────────────────────────────────────────
  //  TODO 5 · 返回结果（顺便打印给人看）
  // ────────────────────────────────────────────────────────────────────────
  //
  // 自检靠**返回值**，不靠打印。但打印出来你自己看得见：
  //
  // console.log(`  工具名          ${call.function.name}`)
  // console.log(`  参数（解析后）    ${JSON.stringify(args)}`)
  // console.log(`  工具返回值        ${toolReturn}`)
  // console.log(`  第二轮 finish     ${data2.choices[0]!.finish_reason}`)
  // console.log(`  最终回答          ${finalText}`)
  //
  // return { toolName: call.function.name, args, toolReturn, finish1, finalText }

  return undefined // ← 写完就删掉这一行
}

// ══════════════════════════════════════════════════════════════════════════
//  自检 —— 不用改，也不用删
// ══════════════════════════════════════════════════════════════════════════

const result = await main()

if (!result) {
  console.log('\n  ⏳ 还没写完 —— main() 还返回 undefined。')
  console.log('     填完 5 个 TODO，把最后一行改成 return { ... }，再跑一次。\n')
  process.exit(0)
}

type CheckResult = { name: string; pass: boolean; detail?: string }
const results: CheckResult[] = []
const check = (name: string, pass: boolean, detail?: string): void => {
  results.push({ name, pass, detail })
}

check('第一轮 finish_reason 是 tool_calls', result.finish1 === 'tool_calls', `实际是 ${JSON.stringify(result.finish1)}`)
check('模型选择调用工具', result.toolName.length > 0, result.toolName || '（没拿到）')
check(
  'arguments 被解析成了对象',
  typeof result.args === 'object' && result.args !== null && !Array.isArray(result.args),
  typeof result.args === 'string' ? '❌ 还是字符串 —— 忘了 JSON.parse' : JSON.stringify(result.args),
)
check('工具真的被调用了（返回值非空）', result.toolReturn.length > 0, `${result.toolReturn.length} 字符`)
check('第二轮拿到最终回答', result.finalText.length > 0, `${result.finalText.length} 字符`)

console.log('\n  ─────────── 自检 ───────────\n')
for (const r of results) {
  console.log(`  ${r.pass ? '✅' : '❌'} ${r.name}${r.detail ? `  —  ${r.detail}` : ''}`)
}
const failed = results.filter((r) => !r.pass).length
console.log()

if (failed === 0) {
  console.log('  🎉 全部通过。你刚刚手写了一个完整的工具调用往返 —— 这就是 Agent Loop 的雏形。\n')
  console.log('  💡 下一步（选做，但很值）：把 tool_call_id 故意写错，看它返回什么。')
  console.log('     那条 400 报了名字，你能读懂它吗？\n')
  process.exit(0)
} else {
  console.log(`  ${failed} 项没过。\n`)
  console.log('  排查顺序建议：')
  console.log('    1. 先打印 msg1（第一轮的 assistant 消息）—— 确认 tool_calls 在里面')
  console.log('    2. 再打印你第二轮发出去的完整 messages —— 看最后两条长什么样')
  console.log('    3. 对照文件开头的「常见报错对照表」\n')
  process.exit(1)
}
