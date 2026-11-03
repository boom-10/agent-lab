#!/usr/bin/env node
/**
 * 内容检查 —— build 前跑（prebuild）。
 *
 * 查四类问题，都是「加了课之后忘了改别的地方」导致的：
 *   1. manifest 里列了某课，但 .mdx 不存在
 *   2. .mdx 存在，但没进 manifest（侧栏里看不到 = 学生永远找不到）
 *   3. 站内链接指向不存在的内容
 *   4. 同一个页面里标题锚点重复（右侧 TOC 会跳错位置）
 *
 * 参考 cloud-docs/scripts/check-mdx.mjs 的定位：MDX 语法 + 内部链接 + 资源。
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = join(ROOT, 'src/content')
const MANIFEST = join(ROOT, 'src/content/manifest.ts')

const problems = []
const warn = (m) => problems.push({ level: 'warn', m })
const err = (m) => problems.push({ level: 'error', m })

/* ── 收集磁盘上的 .mdx ── */
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.mdx') ? [p] : []
  })
}
const onDisk = walk(CONTENT).map((p) => relative(CONTENT, p).replace(/\.mdx$/, ''))

/* ── 解析 manifest（正则足够，不引 TS 运行时）── */
const src = readFileSync(MANIFEST, 'utf8')
// 逐个 item 块解析，才能同时拿到 slug 和 wip 标记
const items = [...src.matchAll(/\{\s*slug:\s*'([^']+)'[^}]*\}/g)].map((m) => ({
  slug: m[1],
  wip: /\bwip:\s*true\b/.test(m[0]),
}))
const inManifest = items.map((i) => i.slug)

/* ── 1 & 2：双向对齐 ── */
for (const { slug, wip } of items) {
  if (onDisk.includes(slug)) continue
  if (wip) {
    // 标了 wip 的课是「计划中还没写」，文件缺失是预期的
    warn(`manifest 里的 "${slug}" 标记为 wip 但文件还没写（预期）`)
  } else {
    err(`manifest 里有 "${slug}"，但 src/content/${slug}.mdx 不存在`)
  }
}
for (const slug of onDisk) {
  if (slug === 'index') continue
  if (!inManifest.includes(slug)) err(`src/content/${slug}.mdx 存在，但没进 manifest（侧栏看不到）`)
}

/* ── 3 & 4：逐文件查链接与锚点 ── */
const linkRe = /\[([^\]]*)\]\(([^)\s]+)\)/g
for (const slug of onDisk) {
  const text = readFileSync(join(CONTENT, `${slug}.mdx`), 'utf8')

  // 站内链接：/lessons/xxx 形式
  for (const m of text.matchAll(linkRe)) {
    const href = m[2]
    if (!href.startsWith('/') || href.startsWith('//')) continue
    const target = href.slice(1).split('#')[0].replace(/\/$/, '')
    if (target && !onDisk.includes(target) && target !== '') {
      err(`${slug}.mdx: 链接 "${href}" 指向不存在的内容`)
    }
  }

  // 标题锚点重复（rehype-slug 会给重复的加 -1 后缀，TOC 就会跳错）
  const heads = [...text.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => m[1].trim())
  const seen = new Set()
  for (const h of heads) {
    if (seen.has(h)) warn(`${slug}.mdx: 标题「${h}」重复，右侧 TOC 可能出现两个同名条目`)
    seen.add(h)
  }
}

/* ── 输出 ── */
const errors = problems.filter((p) => p.level === 'error')
const warns = problems.filter((p) => p.level === 'warn')

console.log(`[check-mdx] ${onDisk.length} 个内容文件，manifest 收录 ${inManifest.length} 个`)
for (const p of warns) console.log(`  ⚠️  ${p.m}`)
for (const p of errors) console.log(`  ❌ ${p.m}`)

if (errors.length) {
  console.log(`\n[check-mdx] 失败：${errors.length} 个错误，${warns.length} 个警告`)
  process.exit(1)
}
console.log(`[check-mdx] ✅ 通过${warns.length ? `（${warns.length} 个警告）` : ''}`)
