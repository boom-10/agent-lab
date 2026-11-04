#!/usr/bin/env node
/**
 * 放开 mock 端口 —— `npm run mock` 会先跑这个。
 *
 * 为什么需要：改了 mock-server.mjs 之后，上一次启动的进程还占着端口、
 * 用的还是旧代码。你以为在测新逻辑，其实在测旧的。
 * 这个坑我自己踩过，学习者也踩过一次。
 *
 * 跨平台，且「没有旧进程」时安静退出 —— 不打印任何东西。
 */
import { execSync } from 'node:child_process'

const PORT = process.env.MOCK_PORT ?? '39001'

function pidsOnPort() {
  try {
    const out = execSync(`lsof -ti:${PORT} -sTCP:LISTEN`, { stdio: ['ignore', 'pipe', 'ignore'] })
    return out.toString().trim().split('\n').filter(Boolean)
  } catch {
    return [] // lsof 找不到东西时返回非零
  }
}

const pids = pidsOnPort()
if (!pids.length) process.exit(0)

console.log(`[mock] 端口 ${PORT} 上有 ${pids.length} 个旧进程（PID ${pids.join(', ')}），先清掉`)
for (const pid of pids) {
  try {
    process.kill(Number(pid), 'SIGTERM')
  } catch {
    /* 已经没了 */
  }
}

await new Promise((r) => setTimeout(r, 300))
console.log('[mock] 已清理，启动新的')
