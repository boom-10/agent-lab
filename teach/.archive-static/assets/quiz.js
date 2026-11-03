/* ============================================================
   quiz.js — 可复用测验组件

   用法：
     <div class="quiz" data-answer="2">
       <div class="qnum">问题 1 / 3</div>
       <div class="qtext">题干？</div>
       <ul class="opts">
         <li><button class="opt">选项 A</button></li>
         <li><button class="opt">选项 B</button></li>
         <li><button class="opt">选项 C</button></li>
       </ul>
       <div class="fb" data-ok="答对了，因为…" data-no="再想想：…"></div>
     </div>

   data-answer 是正确选项的【下标，从 0 开始】。
   反馈立刻出现 —— 反馈闭环越紧越好。
   ============================================================ */
document.querySelectorAll('.quiz').forEach((quiz, qi) => {
  const answer = Number(quiz.dataset.answer)
  const opts   = [...quiz.querySelectorAll('button.opt')]
  const fb     = quiz.querySelector('.fb')
  let done = false

  opts.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      if (done) return
      done = true

      opts.forEach((b, j) => {
        b.disabled = true
        if (j === answer) b.classList.add('correct')
        else if (j === i)  b.classList.add('wrong')
        else               b.classList.add('dim')
      })

      const right = i === answer
      fb.textContent = right ? fb.dataset.ok : fb.dataset.no
      fb.className = 'fb show ' + (right ? 'ok' : 'no')

      // 记分（整页共享）
      const w = quiz.closest('.wrap') || document
      w.__q = w.__q || { right: 0, total: 0 }
      w.__q.total++
      if (right) w.__q.right++
      document.querySelectorAll('.quiz-tally').forEach((el) => {
        el.textContent = `已答 ${w.__q.right} / ${w.__q.total} 题正确`
      })
    })
  })
})
