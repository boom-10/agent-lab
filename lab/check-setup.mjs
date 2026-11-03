#!/usr/bin/env node
/**
 * P0 自检 —— 一条命令告诉你环境哪里没配好。
 *
 * 用法：
 *   cd ~/Desktop/Personal/agent-lab/lab
 *   nvm use 22
 *   node check-setup.mjs
 *
 * 设计原则：每一项都给出「怎么修」，不只是「哪里错」。
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
let pass = 0, fail = 0, warn = 0

const C = { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }
const ok   = (m, fix) => { pass++; console.log(`${C.g}  ✅ ${m}${C.x}`) }
const bad  = (m, fix) => { fail++; console.log(`${C.r}  ❌ ${m}${C.x}`); if (fix) console.log(`${C.d}     → ${fix}${C.x}`) }
const warn_ = (m, fix) => { warn++; console.log(`${C.y}  ⚠️  ${m}${C.x}`); if (fix) console.log(`${C.d}     → ${fix}${C.x}`) }
const head = (m) => console.log(`\n${C.b}${m}${C.x}`)

console.log(`${C.b}═══ P0 环境自检 ═══${C.x}`)
console.log(`${C.d}   目录: ${HERE}${C.x}`)

// ─────────────────────────── 1. Node 版本
head('1. Node 版本')
{
  const v = process.versions.node
  const [maj, min] = v.split('.').map(Number)
  // 实测：DSH 依赖 @earendil-works/pi-ai / undici 要求 >= 22.19
  if (maj > 22 || (maj === 22 && min >= 19)) ok(`Node ${v}（要求 ≥ 22.19）`)
  else if (maj >= 20) warn_(`Node ${v} 可用，但低于 22.19`, 'DSH 的部分依赖要求 ≥22.19。执行 `nvm use 22`')
  else bad(`Node ${v} 太旧（要求 ≥ 22.19）`, '`nvm use 22` 或 `nvm use 24`（两个版本都行）')
}

// ─────────────────────────── 2. npm 源
head('2. npm 源（内网镜像会滞后）')
{
  const npmrc = resolve(HERE, '.npmrc')
  const pkg = resolve(HERE, 'package.json')
  if (!existsSync(npmrc)) {
    bad('缺少 .npmrc', 'echo "registry=https://registry.npmjs.org/" > .npmrc')
  } else {
    const body = readFileSync(npmrc, 'utf8')
    if (!body.includes('registry.npmjs.org')) warn_('.npmrc 未指向公网源', '改成 registry=https://registry.npmjs.org/')
    else if (!existsSync(pkg)) bad('有 .npmrc 但没有 package.json —— 项目配置不生效！', 'npm 需要目录里有 package.json 才认 .npmrc')
    else {
      let reg = ''
      try { reg = execSync('npm config get registry', { cwd: HERE, encoding: 'utf8' }).trim() } catch {}
      if (reg.includes('npmjs.org')) ok(`registry = ${reg}`)
      else bad(`registry 实际生效值是 ${reg}`, '检查 .npmrc 与 package.json 是否都在本目录；`npm config list | grep -i project`')
    }
  }
}

// ─────────────────────────── 3. .env 与 key
head('3. API key')
{
  const envPath = resolve(HERE, '.env')
  if (!existsSync(envPath)) {
    bad('缺少 .env', 'cp .env.example .env  然后填入 key（platform.deepseek.com 申请）')
  } else {
    const body = readFileSync(envPath, 'utf8')
    // ⚠️ 不能用 \s* —— 它会跨过换行，把下一行当成值（这就是之前的 bug）
    //    用 [ \t]* 限定在同一行内
    const m = body.match(/^DEEPSEEK_API_KEY[ \t]*=[ \t]*(.*)$/m)
    const key = (m?.[1] ?? '').trim()
    if (!key) {
      bad('.env 里 DEEPSEEK_API_KEY 为空', '去 platform.deepseek.com 申请后填入')
    } else if (key.includes('xxxx') || key.includes('你的')) {
      warn_('DEEPSEEK_API_KEY 看起来还是占位符', '填入真实 key')
    } else if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(key)) {
      // ★ 实测踩过：粘成了 UUID
      bad(`DEEPSEEK_API_KEY 是一个 UUID，不是 API key（${key.slice(0,8)}…）`,
          'DeepSeek 的 key 以 sk- 开头。你多半粘错了地方（UUID 通常是会话 ID / 请求 ID / 账号 ID）')
    } else if (!key.startsWith('sk-')) {
      bad(`DEEPSEEK_API_KEY 不以 'sk-' 开头（实际以 '${key.slice(0,4)}' 开头，长度 ${key.length}）`,
          'DeepSeek 的 API key 一定以 sk- 开头。去 platform.deepseek.com → API keys 重新复制')
    } else if (key.length < 20) {
      bad(`DEEPSEEK_API_KEY 太短（${key.length} 字符），像是被截断了`,
          '重新完整复制一次（key 只显示一次，不要只复制一部分）')
    } else {
      ok(`DEEPSEEK_API_KEY 格式正确（sk- 开头，长度 ${key.length}，值未显示）`)
    }

    // 防止再次被 cp 覆盖：比对是否与模板逐字节相同
    const tpl = resolve(HERE, '.env.example')
    if (existsSync(tpl)) {
      try {
        const a = readFileSync(envPath)
        const b = readFileSync(tpl)
        if (a.length === b.length && a.equals(b)) {
          bad('.env 与 .env.example 逐字节相同 —— 说明 key 从没填过，或【被 cp 覆盖了】',
              '重新填入 key。以后补建时用幂等写法：[ -f .env ] || cp .env.example .env')
        }
      } catch {}
    }

    // 安全：.env 必须被 gitignore
    // ★ 不要假设 .gitignore 就在当前目录 —— 直接问 git（它会向上找，这才是权威答案）
    let ignored = false, how = ''
    try {
      execSync('git check-ignore -q .env', { cwd: HERE, stdio: 'ignore' })
      ignored = true; how = 'git check-ignore'
    } catch (e) {
      if (e.status === 1) {
        // git 可用，但明确回答「没被忽略」
        ignored = false; how = 'git check-ignore'
      } else {
        // 不在 git 仓库里 / git 不可用 → 退化成向上找 .gitignore 文件
        let dir = HERE
        for (let i = 0; i < 5; i++) {
          const f = resolve(dir, '.gitignore')
          if (existsSync(f) && /^\s*[!]?\.env\s*$/m.test(readFileSync(f, 'utf8').replace(/^\s*!/gm, ''))) {
            ignored = true; how = f.replace(HERE, '.'); break
          }
          const up = resolve(dir, '..')
          if (up === dir) break
          dir = up
        }
      }
    }
    if (ignored) ok(`.env 已被排除（${how}）`)
    else bad('.env 没有被 .gitignore 排除 —— 有泄露风险', '在仓库根的 .gitignore 里加一行 .env')
  }
}

// ─────────────────────────── 4. dsh CLI
head('4. dsh CLI')
{
  const local = resolve(HERE, 'node_modules/.bin/dsh')
  if (existsSync(local)) ok('dsh 已本地安装（node_modules/.bin/dsh）')
  else if (existsSync(resolve(HERE, 'node_modules/@deepseek-ai/dsh'))) warn_('dsh 装了但 .bin 里没有', 'npm install')
  else bad('未安装 dsh', 'npm install（package.json 的 devDependencies 里已声明）')
}

// ─────────────────────────── 5. 关键文件
head('5. 学习资产')
{
  const want = [
    ['starters/dsh-plugin-starter/package.json', '插件脚手架'],
    ['starters/dsh-plugin-starter/client/client.js', '手写的客户端半边'],
    ['toolkit/cordis-probe/probe.mjs', '插件机制探针'],
    ['toolkit/reference/01-basic.ts', 'P0 任务 0.3 参考实现'],
  ]
  for (const [rel, name] of want) {
    if (existsSync(resolve(HERE, rel))) ok(`${name} 存在`)
    else warn_(`${name} 缺失（${rel}）`, '可能是被移动或删除了')
  }
}

// ─────────────────────────── 6. 你自己的产出
head('6. 你的产出（P0 要交的东西）')
{
  const artifacts = [
    ['exercises/01-raw-api/README.md', 'P0 任务 0.3 的 README（回答那 4 个问题）'],
    ['exercises/02-inference-lab', 'P1-W2 的实验目录'],
  ]
  for (const [rel, name] of artifacts) {
    if (existsSync(resolve(HERE, rel))) ok(`${name} ✅`)
    else console.log(`${C.d}  ⬜ ${name} —— 还没做${C.x}`)
  }
}

// ─────────────────────────── 7. 实网连通性（不花钱）
head('7. 网络连通性（不调用模型，不花钱）')
{
  try {
    const r = await fetch('https://api.deepseek.com/models', {
      method: 'GET',
      headers: { Authorization: 'Bearer sk-invalid-probe' },
      signal: AbortSignal.timeout(8000),
    })
    // 401 = 端点存在且可达（这是我们要确认的）
    if (r.status === 401) ok('api.deepseek.com 可达（返回 401 = 端点正常，只需有效 key）')
    else warn_(`api.deepseek.com 返回 ${r.status}`, '预期 401；若超时请检查网络或代理')
  } catch (e) {
    bad(`无法访问 api.deepseek.com：${e.message}`, '检查网络 / 代理设置')
  }
}

// ─────────────────────────── 8. TypeScript（编辑器里不报红）
head('8. TypeScript 配置')
{
  const ts = resolve(HERE, 'tsconfig.json')
  const tsc = resolve(HERE, 'node_modules', '.bin', 'tsc')
  const typesNode = resolve(HERE, 'node_modules', '@types', 'node')

  if (!existsSync(ts)) {
    bad('没有 tsconfig.json', '编辑器认不出 Node 全局（process / console / fetch），会满屏报红')
  } else {
    const cfg = JSON.parse(readFileSync(ts, 'utf8'))
    const hasNode = (cfg.compilerOptions?.types ?? []).includes('node')
    if (hasNode && existsSync(typesNode)) ok('tsconfig.json 配好了（types: [node]）')
    else if (!existsSync(typesNode)) bad('没装 @types/node', '`npm i -D @types/node`')
    else warn_('tsconfig.json 的 types 里没有 "node"', '编辑器会说「找不到名称 process」')
  }

  if (!existsSync(tsc)) {
    warn_('没装 typescript', '`npm i -D typescript`，然后可以跑 npm run typecheck')
  } else {
    try {
      execSync('node_modules/.bin/tsc --noEmit', { cwd: HERE, stdio: 'pipe' })
      ok('npm run typecheck 通过（练习和参考实现都零类型错误）')
    } catch (e) {
      const out = String(e.stdout ?? '')
      const n = (out.match(/error TS/g) ?? []).length
      warn_(`typecheck 有 ${n} 个错误`, '跑 `npm run typecheck` 看详情；多半是你正在写的练习填到一半')
    }
  }
}

// ─────────────────────────── 汇总
console.log(`\n${C.b}═══ 汇总 ═══${C.x}`)
console.log(`  ${C.g}通过 ${pass}${C.x}   ${C.y}警告 ${warn}${C.x}   ${C.r}失败 ${fail}${C.x}`)

if (fail === 0 && warn === 0) {
  console.log(`\n${C.g}${C.b}🎉 环境完全就绪。${C.x}`)
  console.log(`   下一步：npm run api:basic   （应看到完整响应 + usage 逐字段）`)
} else if (fail === 0) {
  console.log(`\n${C.y}环境基本可用，但有警告项。${C.x} 警告通常不影响开始，可以边做边修。`)
  console.log(`   下一步：npm run api:basic`)
} else {
  console.log(`\n${C.r}有 ${fail} 项必须修复。${C.x} 按上面的 → 提示逐条处理即可。`)
}

console.log(`\n${C.d}提示：本脚本只做只读检查 + 一次不带鉴权的连通性探测，不消耗你的额度。${C.x}\n`)
process.exit(fail > 0 ? 1 : 0)
