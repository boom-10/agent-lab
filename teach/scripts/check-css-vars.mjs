#!/usr/bin/env node
/**
 * 检查所有 var(--x) 都在 CSS 里定义过。
 *
 * 为什么需要：**CSS 自定义属性未定义时不报错，只是静默失效。**
 *   top: var(--spacing-topbar)            → 无效 → top: auto
 *   max-height: calc(100vh - var(--x))    → 无效 calc → 整条丢弃
 *
 * 我踩过一次：重写 app.css 时删掉了 --spacing-topbar，
 * 结果右侧目录的 sticky 静默失效 —— 它跟着页面一起滚走了，
 * 但构建、类型检查、页面渲染全都正常，没有任何提示。
 *
 * 和 SSE 那个「静默丢 60% 数据」是同一类 bug。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|css)$/.test(p)) out.push(p)
  }
  return out
}

const files = walk(SRC)
const defined = new Set()
const used = new Map() // name -> [files]

for (const f of files) {
  const text = readFileSync(f, 'utf8')
  // 定义：--foo: value（在 CSS 里）
  if (f.endsWith('.css')) for (const m of text.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) defined.add(m[1])
  // 使用：var(--foo)
  for (const m of text.matchAll(/var\((--[a-zA-Z0-9-]+)/g)) {
    const rel = relative(ROOT, f)
    if (!used.has(m[1])) used.set(m[1], new Set())
    used.get(m[1]).add(rel)
  }
}

const missing = [...used.entries()].filter(([n]) => !defined.has(n)).sort()

console.log(`[check-css-vars] 定义 ${defined.size} 个变量，引用 ${used.size} 个`)

if (!missing.length) {
  console.log('[check-css-vars] ✅ 通过（没有未定义的引用）')
  process.exit(0)
}

console.log('')
for (const [name, fs] of missing) {
  console.log(`  ❌ ${name}`)
  for (const f of fs) console.log(`       被 ${f} 引用`)
}
console.log(`\n[check-css-vars] ❌ ${missing.length} 个变量未定义 —— CSS 会静默忽略这些声明`)
process.exit(1)
