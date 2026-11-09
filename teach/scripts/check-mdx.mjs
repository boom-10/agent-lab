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

  // 尖括号自动链接：MDX 会把 <https://...> 当成 JSX 标签，构建时才报错。
  // 这个错我们踩过三次，所以在检查阶段就拦住，报出准确行号。
  text.split('\n').forEach((line, i) => {
    const m = line.match(/^\s*(?:[-*]\s+)?.*<https?:\/\//)
    if (m) {
      err(`${slug}.mdx:${i + 1}: 用了 <https://…> 尖括号链接，MDX 不支持。改成 [描述](网址)`)
    }
  })

  // 标题锚点重复（rehype-slug 会给重复的加 -1 后缀，TOC 就会跳错）
  const heads = [...text.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => m[1].trim())
  const seen = new Set()
  for (const h of heads) {
    if (seen.has(h)) warn(`${slug}.mdx: 标题「${h}」重复，右侧 TOC 可能出现两个同名条目`)
    seen.add(h)
  }
}

/* ── 5：bookRef 的键必须存在 ── */
// 表写坏了（比如只剩一条）时，页面会在渲染期抛错 → 500。
// 这类错误必须在检查阶段暴露，不能等到线上。
{
  const tableKeys = (name) => {
    const m = src.match(new RegExp(`const ${name}[^=]*= \\{([\\s\\S]*?)\\n\\}`))
    if (!m) return null
    return new Set([...m[1].matchAll(/^\s{2}([A-Za-z0-9_]+):\s*\{/gm)].map((x) => x[1]))
  }
  const tables = { waylandz: tableKeys('WAYLANDZ'), 'hello-agents': tableKeys('HELLO_AGENTS') }
  if (!tables.waylandz || !tables['hello-agents']) {
    err('manifest.ts: 找不到 WAYLANDZ 或 HELLO_AGENTS 表，无法校验 bookRef')
  } else {
    for (const [name, keys] of Object.entries(tables)) {
      if (keys.size === 0) err(`manifest.ts: ${name.toUpperCase()} 表是空的（bookRef 会在渲染期抛错）`)
    }
    for (const m of src.matchAll(/bookRef\('([^']+)',\s*'([^']+)'/g)) {
      const [, book, key] = m
      const table = tables[book]
      if (!table) err(`manifest.ts: bookRef 的书名 "${book}" 不认识（只支持 waylandz / hello-agents）`)
      else if (!table.has(key)) err(`manifest.ts: bookRef('${book}', '${key}') 指向不存在的章节`)
    }
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
