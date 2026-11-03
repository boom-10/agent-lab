/* ============================================================
   course-data.js — 课程目录清单
   新增一课：在对应 section 的 items 里加一行，其余不用管。
   注意：用 .js 而不是 .json —— 课程是 file:// 打开的，fetch JSON 会被 CORS 挡。
   ============================================================ */
window.COURSE = {
  title: 'Agent 学习',
  subtitle: '26 周 · 项目驱动',
  sections: [
    {
      title: '阶段 0 · 原生 API',
      items: [
        { file: 'lessons/0001-first-api-call.html', title: '第一次 API 调用', done: false },
        { file: 'lessons/0002-streaming.html',      title: '流式与 SSE',       done: false, wip: true },
      ],
    },
    {
      title: '速查卡',
      items: [
        { file: 'reference/api-response.html', title: 'Chat Completions 响应', kind: 'ref' },
      ],
    },
    {
      title: '工作区',
      items: [
        { file: '../MISSION.md', title: 'MISSION · 为什么学' },
        { file: '../NOTES.md',   title: 'NOTES · 进度与偏好' },
        { file: '../RESOURCES.md', title: 'RESOURCES · 资料源' },
      ],
    },
  ],
}
