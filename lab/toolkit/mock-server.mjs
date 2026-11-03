#!/usr/bin/env node
/**
 * 模拟 DeepSeek API 服务器 —— 用来在没有真 key 的情况下验证参考实现。
 *
 * 严格按官方规范构造响应（字段名与格式来自 api-docs.deepseek.com，2026-11-02 核实）：
 *   - SSE: `data: {...}\n\n`，以 `data: [DONE]` 结束
 *   - stream_options.include_usage: true → 每个 chunk 都带 usage（除最后一个外都是 null）
 *   - 最后一个内容 chunk 同时带 finish_reason 和 usage（不单独发 usage-only chunk）
 *   - usage: prompt_tokens = prompt_cache_hit_tokens + prompt_cache_miss_tokens
 *   - tool_calls[].function.arguments 是【字符串】
 *   - finish_reason 取值: stop | length | content_filter | tool_calls | insufficient_system_resource | aborted
 *
 * 用法：
 *   node mock-server.mjs                 # 默认 39001 端口
 *   DEEPSEEK_BASE_URL=http://127.0.0.1:39001 node --env-file=.env 02-stream.ts
 *
 * 故意设置的难点（用来压力测试解析器）：
 *   ★ 会把一个 SSE 事件【从中间劈开】分两次 write —— 真实的 TCP 分包就是这样
 *   ★ 会插入跨包的多字节 UTF-8 字符
 */

import { createServer } from 'node:http'

const PORT = Number(process.env.MOCK_PORT ?? 39001)

/** 把文本切成小块，模拟 token 流 */
function chunkText(text, size = 6) {
  const out = []
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size))
  return out
}

/**
 * 根据收到的消息条数构造回复 —— 让「追问 6（不带历史）」能被观察到。
 * 真实模型也是这个道理：它只能看到你发给它的东西。
 */
function mockReply(body) {
  const msgs = body.messages ?? []
  const nonSystem = msgs.filter((m) => m.role !== 'system')
  if (nonSystem.length <= 1) {
    const last = nonSystem[0]?.content ?? ''
    return `【我只收到 1 条消息】你说的是「${String(last).slice(0, 20)}」。` +
           `我看不到之前的任何对话，所以如果这句是追问，我无法知道你在问什么。`
  }
  return `【我收到 ${nonSystem.length} 条消息】` +
         `我看到了完整对话，包括最前面那句「${String(nonSystem[0].content ?? '').slice(0, 20)}」。` +
         `所以我能理解你的追问。`
}

/**
 * 用【客户端声明的第一个工具】造一个 tool_call。
 *
 * 为什么这么做：学习者会被要求定义「自己的」工具，写死 greet 就跑不通了。
 * arguments 按该工具 schema 里 required 的字段生成占位值。
 */
function pickToolCall(body) {
  const fn = body.tools?.[0]?.function ?? { name: 'unknown', parameters: { properties: {} } }
  const required = fn.parameters?.required ?? Object.keys(fn.parameters?.properties ?? {})
  const args = {}
  for (const k of required) {
    const type = fn.parameters?.properties?.[k]?.type ?? 'string'
    args[k] = type === 'number' || type === 'integer' ? 42 : type === 'boolean' ? true : 'Ada'
  }
  return {
    id: 'call_' + Math.random().toString(36).slice(2, 10),
    type: 'function',
    function: { name: fn.name, arguments: JSON.stringify(args) },
  }
}

function sseChunk(obj) {
  return `data: ${JSON.stringify(obj)}\n\n`
}

function base(id) {
  return { id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: 'deepseek-flash' }
}

const server = createServer(async (req, res) => {
  if (!req.url.includes('/chat/completions')) {
    res.writeHead(404).end('not found')
    return
  }

  // 读 body
  let raw = ''
  for await (const c of req) raw += c
  let body = {}
  try { body = JSON.parse(raw) } catch {}

  const auth = req.headers.authorization ?? ''
  console.log(`[mock] ${req.method} ${req.url}  stream=${!!body.stream}  tools=${body.tools?.length ?? 0}  msgs=${body.messages?.length ?? 0}`)

  // ─────────── 参数校验（复刻真实 API 的 400，用于练习「追问 7」）───────────
  const msgs = body.messages ?? []
  for (let i = 0; i < msgs.length; i++) {
    if (msgs[i].role !== 'tool') continue
    // 往前找最近的 assistant 消息，看它有没有 tool_calls
    const prev = msgs.slice(0, i).reverse().find((m) => m.role === 'assistant' && m.tool_calls?.length)
    if (!prev) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: {
        message: "Messages with role 'tool' must be a response to a preceding message with 'tool_calls' (request_id: mock)",
        type: 'invalid_request_error', param: null, code: 'invalid_request_error' } }))
      return
    }
    if (!prev.tool_calls.some((c) => c.id === msgs[i].tool_call_id)) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: {
        message: `An assistant message with 'tool_calls' must be followed by tool messages responding to each 'tool_call_id', The following tool_call_ids did not have response messages: ${msgs[i].tool_call_id} (request_id: mock)`,
        type: 'invalid_request_error', param: null, code: 'invalid_request_error' } }))
      return
    }
  }

  const id = 'mock-' + Math.random().toString(36).slice(2, 10)
  const hasTools = Array.isArray(body.tools) && body.tools.length > 0
  // 第二轮：消息里已经有 role:"tool" 的结果 → 返回最终答案
  const hasToolResult = (body.messages ?? []).some((m) => m.role === 'tool')

  // ─────────── 非流式 ───────────
  if (!body.stream) {
    if (hasTools && !hasToolResult) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        id, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: 'deepseek-flash',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [pickToolCall(body)],
          },
          logprobs: null,
          finish_reason: 'tool_calls',
        }],
        usage: {
          prompt_tokens: 120, completion_tokens: 18, total_tokens: 138,
          prompt_tokens_details: { cached_tokens: 96 },
          prompt_cache_hit_tokens: 96, prompt_cache_miss_tokens: 24,
        },
        system_fingerprint: 'mock-fp',
      }))
      return
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      id, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: 'deepseek-flash',
      choices: [{ index: 0, message: { role: 'assistant', content: mockReply(body) }, logprobs: null, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: 7, completion_tokens: 11, total_tokens: 18,
        prompt_tokens_details: { cached_tokens: 0 },
        prompt_cache_hit_tokens: 0, prompt_cache_miss_tokens: 7,
      },
      system_fingerprint: 'mock-fp',
    }))
    return
  }

  // ─────────── 流式 ───────────
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
  })

  const includeUsage = body.stream_options?.include_usage === true
  const pieces = []

  if (hasTools && !hasToolResult) {
    // 工具调用流：先发一段文本，再发 tool_calls 增量
    pieces.push({ choices: [{ index: 0, delta: { role: 'assistant', content: '我来调用工具。' }, finish_reason: null }] })
    const tc = pickToolCall(body)
    pieces.push({
      choices: [{
        index: 0,
        delta: { tool_calls: [{ index: 0, id: tc.id, type: 'function', function: { name: tc.function.name, arguments: '' } }] },
        finish_reason: null,
      }],
    })
    // arguments 分片下发（真实行为）—— 故意切碎，逼你把字符串拼接写对
    const argsStr = tc.function.arguments
    for (let i = 0; i < argsStr.length; i += 4) {
      const p = argsStr.slice(i, i + 4)
      pieces.push({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: p } }] }, finish_reason: null }] })
    }
  } else {
    const text = mockReply(body)
    // ★ 首块只带 role、content 是空字符串 —— 真 API 就是这样（我实测过）。
    //   不这么做，学习者会在第一块就记 TTFT，养成错的习惯。
    pieces.push({ choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] })
    for (const p of chunkText(text)) {
      pieces.push({ choices: [{ index: 0, delta: { content: p }, finish_reason: null }] })
    }
  }

  // 最后的内容 chunk：不带新内容 + 非 null finish_reason + usage
  const usage = {
    prompt_tokens: 120, completion_tokens: 24, total_tokens: 144,
    prompt_tokens_details: { cached_tokens: 96 },
    prompt_cache_hit_tokens: 96, prompt_cache_miss_tokens: 24,
  }
  pieces.push({
    choices: [{ index: 0, delta: {}, finish_reason: hasTools && !hasToolResult ? 'tool_calls' : 'stop' }],
    usage,
  })

  // ★ 组装成一个完整字符串，然后【故意在事件中间劈开】分多次 write
  let payload = ''
  pieces.forEach((p, i) => {
    const withUsage = includeUsage ? { ...base(id), ...p, usage: i === pieces.length - 1 ? p.usage : null } : { ...base(id), ...p }
    payload += sseChunk(withUsage)
  })
  payload += 'data: [DONE]\n\n'

  // 切成不等长的小段，制造「事件跨 TCP 包」的情况
  const cuts = [37, 91, 150, 260, 400, 620, 900]
  let prev = 0
  const writes = []
  for (const c of cuts) { if (c < payload.length) { writes.push(payload.slice(prev, c)); prev = c } }
  writes.push(payload.slice(prev))

  for (const w of writes) {
    res.write(w)
    await new Promise((r) => setTimeout(r, 8))   // 模拟网络间隔
  }
  res.end()
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock] 模拟 DeepSeek API 已启动: http://127.0.0.1:${PORT}`)
  console.log(`[mock] 用法: DEEPSEEK_BASE_URL=http://127.0.0.1:${PORT} DEEPSEEK_API_KEY=sk-mock node <脚本>`)
  console.log(`[mock] 按 Ctrl-C 退出`)
})
