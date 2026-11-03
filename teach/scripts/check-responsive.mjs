import { chromium } from 'playwright'

const SIZES = [
  { w: 1920, h: 1000, name: 'FHD 1920' },
  { w: 1680, h: 1000, name: '你的屏 1680' },
  { w: 1440, h: 900,  name: 'MacBook 1440' },
  { w: 1280, h: 900,  name: '1280 临界' },
  { w: 1100, h: 900,  name: '1100 中屏' },
  { w: 1024, h: 900,  name: '1024 临界' },
  { w: 900,  h: 900,  name: '900 平板' },
  { w: 375,  h: 812,  name: '375 手机' },
]

const b = await chromium.launch()
const p = await b.newPage()
console.log('  屏幕           侧栏  TOC   正文宽  侧栏→正文  横向溢出')
console.log('  ' + '─'.repeat(64))
for (const s of SIZES) {
  await p.setViewportSize({ width: s.w, height: s.h })
  await p.goto('http://localhost:3021/lessons/0004-usage-and-cost', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(280)
  const m = await p.evaluate(() => {
    const R = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), vis: b.width > 0 && getComputedStyle(el).display !== 'none' } }
    const rails = [...document.querySelectorAll('.doc-rail')].map(R)
    const inner = R(document.querySelector('.doc-main-inner'))
    const nav = rails[0], toc = rails[1]
    return {
      navVis: !!(nav && nav.vis), tocVis: !!(toc && toc.vis),
      innerW: inner?.w ?? 0,
      navGap: nav && nav.vis && inner ? inner.l - nav.r : null,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }
  })
  console.log(
    `  ${s.name.padEnd(16)} ${(m.navVis?'有':'—').padEnd(5)} ${(m.tocVis?'有':'—').padEnd(5)} ` +
    `${String(m.innerW).padStart(5)}px  ${String(m.navGap ?? '—').padStart(6)}px  ${m.overflow ? '❌ 有' : '✅ 无'}`
  )
}
await b.close()
