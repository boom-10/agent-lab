#!/usr/bin/env node
/**
 * 练习启动器 —— 一条命令，帮你把三件事都办了
 * ==========================================
 *
 *   node run.mjs exercises/01-raw-api/stream.ts
 *
 * 它替你处理：
 *   1. 检查 Node 版本（不够就告诉你确切怎么修，而不是甩一句 bad option）
 *   2. 加载 .env（不用 --env-file，也就没有「当前目录不对」的坑）
 *   3. 判断该连 mock 还是真 API（mock 在跑就自动用 mock）
 *
 * 为什么需要它：`--env-file` 要 Node ≥20.6，跑 .ts 要 ≥22.18。
 * 直接用 node 跑，版本不对时报错信息完全看不懂（实测过）：
 *   v18 → node: bad option: --env-file=.env.mock
 *   v20 → node:internal/modules/esm/get_format:189
 *
 * 用法：
 *   node run.mjs <文件.ts>            自动判断 mock / 真 API
 *   node run.mjs <文件.ts> --mock     强制用 mock
 *   node run.mjs <文件.ts> --real     强制用真 API
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const C = { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }

// ─────────────────────────── 1. Node 版本
const MIN = [22, 18] // 22.18 起 .ts 的类型擦除默认开启
const [maj, min] = process.versions.node.split('.').map(Number)

if (maj < MIN[0] || (maj === MIN[0] && min < MIN[1])) {
  console.error(`\n${C.r}  ❌ Node ${process.versions.node} 太旧，跑不了这个练习${C.x}\n`)
  console.error(`     需要 Node ≥ ${MIN[0]}.${MIN[1]}。两个原因：`)
  console.error(`       • 跑 .ts 文件            → 需要 ≥ 22.18`)
  console.error(`       • 加载 .env（--env-file）→ 需要 ≥ 20.6`)
  console.error(`\n${C.b}     怎么修（你机器上已经有 v22.23.2 和 v24.20.0）：${C.x}\n`)
  console.error(`       cd ~/Desktop/Personal/agent-lab/lab`)
  console.error(`       nvm use                 ${C.d}# 读 .nvmrc，自动选 22${C.x}`)
  console.error(`       node run.mjs <你的文件>\n`)
  console.error(`     ${C.d}注意：光跑 \`nvm use\` 不够 —— nvm 的 default 指向 20，`)
  console.error(`     而 20 能加载 .env 但跑不了 .ts。所以这个目录放了 .nvmrc。${C.x}\n`)
  console.error(`     ${C.d}永久解决：nvm alias default 22${C.x}\n`)
  process.exit(1)
}

// ─────────────────────────── 2. 目标文件
const args = process.argv.slice(2)
const force = args.find((a) => a === '--mock' || a === '--real')
const target = args.find((a) => !a.startsWith('--'))

if (!target) {
  console.error(`\n  用法：node run.mjs <文件.ts> [--mock|--real]\n`)
  console.error(`  例：  node run.mjs exercises/01-raw-api/stream.ts\n`)
  process.exit(1)
}
const targetPath = resolve(process.cwd(), target)
if (!existsSync(targetPath)) {
  console.error(`\n  ❌ 找不到 ${targetPath}\n`)
  process.exit(1)
}

// ─────────────────────────── 3. 加载 .env
/** 解析 .env：支持注释、空行、引号。已存在的环境变量优先（不覆盖） */
function loadEnv(file) {
  if (!existsSync(file)) return 0
  let n = 0
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    // ★ 用 [ \t]* 而不是 \s* —— \s 会跨行，把下一行也吃进来（我踩过这个坑）
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*(.*)$/)
    if (!m) continue
    const key = m[1]
    const val = m[2].trim().replace(/^["']|["']$/g, '')
    if (process.env[key] === undefined) {
      process.env[key] = val
      n++
    }
  }
  return n
}

// ★ 只加载 .env（真凭据）。
//   千万不要顺手把 .env.mock 也 loadEnv 进来 —— 它里面的 DEEPSEEK_API_KEY=sk-mock
//   会先占住那个位置，而 loadEnv 不覆盖已有值，于是 .env 里的真 key 被静默跳过，
//   真 API 拿到 sk-mock 直接 401。这个 bug 我自己踩过一次。
//   mock 模式的值在下面【显式覆盖】，不依赖文件加载顺序。
const realFile = resolve(HERE, '.env')
loadEnv(realFile)

// ─────────────────────────── 4. 判断 mock 还是真 API
async function mockIsUp() {
  try {
    await fetch('http://127.0.0.1:39001/models', { signal: AbortSignal.timeout(400) })
    return true
  } catch {
    return false
  }
}

const up = await mockIsUp()
const useMock = force === '--mock' ? true : force === '--real' ? false : up

if (useMock) {
  // 显式覆盖，不看文件里写了什么
  process.env.DEEPSEEK_BASE_URL = 'http://127.0.0.1:39001'
  process.env.DEEPSEEK_API_KEY = 'sk-mock'
  if (!up) {
    console.error(`\n${C.y}  ⚠️  mock 没在跑${force === '--mock' ? '（你指定了 --mock）' : ''}。${C.x}`)
    console.error(`     另开一个终端：${C.b}npm run mock${C.x}`)
    console.error(`     或者调真 API：${C.b}node run.mjs <文件> --real${C.x}\n`)
    process.exit(1)
  }
} else {
  delete process.env.DEEPSEEK_BASE_URL
  const k = process.env.DEEPSEEK_API_KEY
  if (!k) {
    console.error(`\n${C.r}  ❌ .env 里没有 DEEPSEEK_API_KEY，也没检测到 mock${C.x}\n`)
    console.error(`     两条路选一条：`)
    console.error(`       1. 用 mock（免费）：${C.b}npm run mock${C.x} 然后重跑`)
    console.error(`       2. 填真 key：编辑 ${C.d}${relative(HERE, realFile)}${C.x}\n`)
    process.exit(1)
  }
  // 万一还是 mock 的 key，早点拦住（否则真 API 给你一个看不懂的 401）
  if (k.startsWith('sk-mock')) {
    console.error(`\n${C.r}  ❌ 真 API 模式下拿到了 mock 的 key（${k}）${C.x}`)
    console.error(`     检查 ${relative(HERE, realFile)} 里的 DEEPSEEK_API_KEY\n`)
    process.exit(1)
  }
}

// ─────────────────────────── 5. 跑
console.log(
  `${C.d}  Node ${process.versions.node} · ${useMock ? 'mock（免费，可无限次）' : '真 API（会花钱）'} · ${relative(HERE, targetPath)}${C.x}`,
)

const r = spawnSync(process.execPath, [targetPath], { stdio: 'inherit', cwd: process.cwd(), env: process.env })
process.exit(r.status ?? 1)
