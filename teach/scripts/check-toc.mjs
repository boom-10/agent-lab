#!/usr/bin/env node
/**
 * 检查右侧目录在【客户端路由】切换后是否跟得上。
 *
 * 为什么单独测这个：目录永远慢一整页 —— 因为 TanStack Router 的
 * pathname 先更新（urgent）、路由内容后更新（transition），
 * 只依赖 [pathname] 的 effect 会读到上一页的 DOM。
 *
 * 这个 bug 有个恶劣的性质：**整页刷新时完全正常**。
 * 所以手动点几下很容易漏掉；只有连续客户端跳转才暴露。
 *
 *   npm run check:toc      （需要 dev server 在 http://localhost:3021）
 */
import { chromium } from 'playwright'

const BASE = process.env.TOC_BASE ?? 'http://localhost:3021'
const SLUGS = ['0001-first-api-call', '0002-streaming', '0003-tool-calls', '0004-usage-and-cost', '0005-prefill-decode', '0006-kv-cache', '0007-ttft-budget', '0008-llm-client', '0009-cancel-retry']

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1680, height: 1000 } })

const readPage = () =>
  p.evaluate(() => {
    const rail = [...document.querySelectorAll('.doc-rail')][1]
    const links = [...(rail?.querySelectorAll('a[href^="#"]') ?? [])]
    return {
      title: document.querySelector('.prose h1')?.textContent?.replace(/\s+/g, '') ?? '',
      count: links.length,
      first: links[0]?.textContent?.trim() ?? '',
      // 目录第一项应该等于正文第一个 h2 的文字
      firstHeading: document.querySelector('.prose h2')?.textContent?.trim() ?? '',
    }
  })

await p.goto(`${BASE}/lessons/${SLUGS[0]}`, { waitUntil: 'networkidle' })
await p.waitForTimeout(500)

let fail = 0
const seen = new Set()
console.log(`[check-toc] 客户端连续跳转 ${SLUGS.length} 次`)

for (const slug of SLUGS) {
  if (seen.size) {
    await p.locator(`.doc-rail a[href="/lessons/${slug}"]`).first().click()
    await p.waitForTimeout(600)
  }
  seen.add(slug)

  const { count, first, firstHeading, title } = await readPage()
  // 目录首项必须等于正文第一个 h2 —— 这是「跟上了」的硬判据
  const ok = count > 0 && first && first === firstHeading
  if (!ok) fail++
  console.log(
    `  ${ok ? '✅' : '❌'} ${slug.padEnd(22)} ${String(count).padStart(2)} 项  ` +
      `标题「${title.slice(0, 12)}」  目录首项「${first.slice(0, 16)}」`,
  )
  if (!ok) console.log(`       正文第一个 h2 是「${firstHeading.slice(0, 16)}」—— 对不上`)
}

console.log()
if (fail) {
  console.log(`[check-toc] ❌ ${fail} 处对不上 —— 目录没跟上客户端路由`)
  process.exit(1)
}
console.log('[check-toc] ✅ 通过（每次跳转目录都和正文一致）')
await b.close()
