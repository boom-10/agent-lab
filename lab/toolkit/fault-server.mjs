#!/usr/bin/env node
/**
 * 故障注入服务器（第 2 章用）。
 *
 *   npm run fault:server            # 启动，默认 39002 端口
 *
 * 和 mock-server 的区别：这个不是「正常返回」，而是按你的要求**故意失败**，
 * 这样重试、超时、取消才有东西可测，而且不花钱。
 *
 * 用法：调 /chat/completions 时带查询参数 ?scenario=xxx
 *
 *   scenario=ok            正常流式返回（对照组）
 *   scenario=429           返回 429，带 Retry-After: 1
 *   scenario=500           返回 500
 *   scenario=slow&ms=2000  延迟 ms 毫秒后才开始返回
 *   scenario=drop          返回几个事件后直接断开连接
 *   scenario=flaky&times=2 前 times 次失败（500），之后成功。计数按 scenario 记
 *   GET /reset             清空 flaky 的计数
 *
 * 响应体故意做得和 DeepSeek 的 SSE 一样，这样客户端代码不用改。
 */

import { createServer } from 'node:http'

const PORT = Number(process.env.FAULT_PORT ?? 39002)
const counters = new Map() // scenario key -> 已失败次数

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function sseChunk(obj) {
  return `data: ${JSON.stringify(obj)}\n\n`
}

function base(id) {
  return {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: 'fault-server',
    system_fingerprint: 'fault-1',
  }
}

/** 写入一段完整的流式回复（4 个内容块 + 结束块 + usage 块） */
function writeStream(res, text = '一二三四五', delayMs = 0) {
  const id = `chunk-${Date.now()}`
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  const pieces = Array.from(text)
  return (async () => {
    for (const ch of pieces) {
      if (delayMs) await sleep(delayMs)
      res.write(sseChunk({ ...base(id), choices: [{ index: 0, delta: { content: ch }, finish_reason: null }] }))
    }
    res.write(
      sseChunk({
        ...base(id),
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        usage: { prompt_tokens: 11, completion_tokens: pieces.length, total_tokens: 11 + pieces.length },
      }),
    )
    res.write('data: [DONE]\n\n')
    res.end()
  })()
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)

  if (url.pathname === '/reset') {
    counters.clear()
    res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"reset":true}')
    return
  }

  if (url.pathname === '/models') {
    // run.mjs 之类的探活会打这个
    res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"data":[]}')
    return
  }

  if (!url.pathname.includes('/chat/completions')) {
    res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"error":"not found"}')
    return
  }

  // 读掉请求体，避免连接挂住
  let raw = ''
  for await (const c of req) raw += c
  let body = {}
  try { body = JSON.parse(raw) } catch { /* 忽略 */ }

  const scenario = url.searchParams.get('scenario') ?? 'ok'
  console.log(`[fault] scenario=${scenario} stream=${!!body.stream}`)

  const fail = (status, extra = {}) => {
    const payload = { error: { message: `injected ${status}`, type: 'fault', code: status } }
    res.writeHead(status, { 'Content-Type': 'application/json', ...extra }).end(JSON.stringify(payload))
  }

  switch (scenario) {
    case 'ok':
      await writeStream(res, '一二三四五')
      return

    case '429':
      // Retry-After 是「多少秒后可以再试」，客户端应当遵守
      fail(429, { 'Retry-After': '1' })
      return

    case '500':
      fail(500)
      return

    case 'slow': {
      const ms = Number(url.searchParams.get('ms') ?? 2000)
      await sleep(ms)
      if (res.destroyed) return
      await writeStream(res, '一二三四五')
      return
    }

    case 'drop': {
      // 先正常发两个块，然后粗暴断开：客户端会在读流的中途抛错
      const id = `chunk-${Date.now()}`
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', Connection: 'keep-alive' })
      res.write(sseChunk({ ...base(id), choices: [{ index: 0, delta: { content: '一' }, finish_reason: null }] }))
      res.write(sseChunk({ ...base(id), choices: [{ index: 0, delta: { content: '二' }, finish_reason: null }] }))
      await sleep(120)
      res.destroy() // 不写结束块，也不写 [DONE]
      return
    }

    case 'unstable': {
      // 每个请求按 rate 的概率返回 500，用来测「重试能救回多少」
      const rate = Number(url.searchParams.get('rate') ?? 0.5)
      if (Math.random() < rate) {
        fail(500)
        return
      }
      await writeStream(res, '一二三四五')
      return
    }

    case 'flaky': {
      const times = Number(url.searchParams.get('times') ?? 2)
      const n = counters.get('flaky') ?? 0
      counters.set('flaky', n + 1)
      if (n < times) {
        console.log(`[fault] flaky 第 ${n + 1} 次 → 500`)
        fail(500)
        return
      }
      console.log(`[fault] flaky 第 ${n + 1} 次 → 成功`)
      await writeStream(res, '一二三四五')
      return
    }

    case 'slowbody': {
      // 慢慢发内容，给客户端「中途取消」留出时间窗口
      await writeStream(res, '一二三四五六七八九十', Number(url.searchParams.get('ms') ?? 300))
      return
    }

    default:
      fail(400)
  }
})

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  ❌ 端口 ${PORT} 已被占用。先跑 npm run fault:reset 或换 FAULT_PORT。\n`)
    process.exit(1)
  }
  throw e
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[fault] 故障注入服务器已启动: http://127.0.0.1:${PORT}`)
  console.log(`[fault] 场景：ok / 429 / 500 / slow?ms= / drop / flaky?times= / slowbody?ms=`)
})
