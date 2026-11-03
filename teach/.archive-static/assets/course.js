/* ============================================================
   course.js — 注入顶栏 / 左侧课程目录 / 右侧本页目录

   用法（每个 lesson 只要这三行）：
     <script src="../assets/course-data.js"></script>
     <script src="../assets/course.js"></script>
     <script src="../assets/quiz.js"></script>

   右侧目录从正文的 <h2 id> 自动生成，不用手写。
   ============================================================ */
(() => {
  const C = window.COURSE
  if (!C) return

  const here = location.pathname.split('/').slice(-2).join('/')   // 例如 lessons/0001-....html

  /* ─────────── 顶栏 ─────────── */
  const bar = document.createElement('header')
  bar.className = 'topbar'
  bar.innerHTML = `
    <a class="brand" href="${rel(C.sections[0]?.items[0]?.file)}">
      <span class="brand-mark">◇</span>
      <span class="brand-name">${esc(C.title)}</span>
    </a>
    <nav class="topnav">
      <a href="${rel(C.sections[0]?.items[0]?.file)}">课程</a>
      <a href="${rel('reference/api-response.html')}">速查</a>
      <a href="${rel('../MISSION.md')}">MISSION</a>
    </nav>
    <div class="topactions">
      <span class="chip">${esc(C.subtitle)}</span>
      <a class="btn-dark" href="https://api-docs.deepseek.com" target="_blank" rel="noopener">API 文档</a>
    </div>`
  document.body.prepend(bar)

  /* ─────────── 左侧课程目录 ─────────── */
  const nav = document.createElement('aside')
  nav.className = 'sidenav'
  let html = `<div class="nav-search"><span>课程目录</span><kbd>${countItems()}</kbd></div>`
  for (const sec of C.sections) {
    html += `<div class="nav-sec"><div class="nav-sec-title">${esc(sec.title)}</div>`
    for (const it of sec.items) {
      const active = it.file && here.endsWith(it.file.split('/').pop()) ? ' active' : ''
      const cls = 'nav-item' + active + (it.kind === 'ref' ? ' is-ref' : '')
      const flag = it.done ? '<span class="tick">✓</span>' : (it.wip ? '<span class="wip">待做</span>' : '')
      html += `<a class="${cls}" href="${rel(it.file)}"><span>${esc(it.title)}</span>${flag}</a>`
    }
    html += `</div>`
  }
  nav.innerHTML = html

  /* ─────────── 右侧本页目录 ─────────── */
  const toc = document.createElement('aside')
  toc.className = 'pagetoc'
  const heads = [...document.querySelectorAll('main.content h2[id], main.content h3[id]')]
  if (heads.length) {
    toc.innerHTML = `<div class="pagetoc-title"><span class="pagetoc-ico">≡</span>本页内容</div>` +
      heads.map((h) => `<a class="${h.tagName === 'H3' ? 'lvl3' : ''}" href="#${h.id}">${esc(h.textContent)}</a>`).join('')
  }

  /* ─────────── 组装三栏 ─────────── */
  const content = document.querySelector('main.content')
  if (!content) return
  const layout = document.createElement('div')
  layout.className = 'layout'
  content.parentNode.insertBefore(layout, content)
  layout.append(nav, content, toc)

  /* ─────────── 滚动高亮 ─────────── */
  if (heads.length) {
    const links = [...toc.querySelectorAll('a')]
    const seen = new Set()
    const update = () => {
      const line = scrollY + innerHeight / 3
      let cur = null
      for (const h of heads) if (h.offsetTop <= line) cur = h
      links.forEach((a) => {
        const on = cur && a.getAttribute('href') === '#' + cur.id
        a.classList.toggle('on', !!on)
        if (on) seen.add(a)
        else if (seen.has(a)) a.classList.add('done')
      })
    }
    let raf = 0
    addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update) }, { passive: true })
    addEventListener('resize', update, { passive: true })
    update()
  }

  /* ─────────── 工具 ─────────── */
  function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) }
  function countItems() { return C.sections.reduce((n, s) => n + s.items.length, 0) + ' 项' }
  // 从 lessons/ 出发算相对路径
  function rel(target) {
    if (!target) return '#'
    if (target.startsWith('../') || target.startsWith('http')) return target
    return '../' + target
  }
})()
