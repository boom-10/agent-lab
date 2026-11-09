/**
 * 课程结构 —— 侧栏、进度、上一课/下一课的唯一来源。
 *
 * 组织单位是【章】，不是【节】。
 * 一章 = 一次能连续做完的量（2–4 小时），写完一整章再交给学习者，
 * 避免「看完一节就得等人生成下一节」。
 *
 * 每节仍保持「一个能拿在手里的成果」的粒度 —— 短是认知单位，章是交付单位。
 */

/** 对应的书章节：课程页上显示为阅读入口 */
export type BookRef = {
  title: string
  href: string
  note?: string
}

export type Lesson = {
  slug: string
  title: string
  /** 预计分钟数，显示在侧栏和节标题旁 */
  minutes?: number
  /** 右侧小标记 */
  badge?: string
  /** 计划中但还没写 */
  wip?: boolean
  /** 对应的书章节，课程页上显示为阅读入口 */
  books?: BookRef[]
}

export type Chapter = {
  id: string
  title: string
  /** 一章在讲什么，一句话 */
  subtitle: string
  items: Lesson[]
}

/** 主线章节：按学习顺序 */
/** ── 对应的书 ─────────────────────────────────────────────
 *  waylandz《AI Agent 架构模式与实战》的章节导航：只放链接，不转载正文。
 *  章节名和链接取自书的目录页，已逐个核实返回 200。
 *  用法：bookRef('ch3')；需要备注时：bookRef('ch39', '备注')。
 */
const BOOK = {
  preface: { title: '前言：如何读这本书', href: 'https://waylandz.com/ai-agent-book/%E5%89%8D%E8%A8%80/' },
  ch1: { title: '第 1 章：Agent 的本质', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC01%E7%AB%A0-Agent%E7%9A%84%E6%9C%AC%E8%B4%A8/' },
  ch2: { title: '第 2 章：ReAct 循环', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC02%E7%AB%A0-ReAct%E5%BE%AA%E7%8E%AF/' },
  ch3: { title: '第 3 章：工具调用基础', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC03%E7%AB%A0-%E5%B7%A5%E5%85%B7%E8%B0%83%E7%94%A8%E5%9F%BA%E7%A1%80/' },
  ch4: { title: '第 4 章：MCP 协议详解', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC04%E7%AB%A0-MCP%E5%8D%8F%E8%AE%AE%E8%AF%A6%E8%A7%A3/' },
  ch5: { title: '第 5 章：Skills 技能系统', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC05%E7%AB%A0-Skills%E6%8A%80%E8%83%BD%E7%B3%BB%E7%BB%9F/' },
  ch6: { title: '第 6 章：Hooks 与事件系统', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC06%E7%AB%A0-Hooks%E4%B8%8E%E4%BA%8B%E4%BB%B6%E7%B3%BB%E7%BB%9F/' },
  ch7: { title: '第 7 章：上下文工程', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC07%E7%AB%A0-%E4%B8%8A%E4%B8%8B%E6%96%87%E5%B7%A5%E7%A8%8B/' },
  ch8: { title: '第 8 章：记忆架构', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC08%E7%AB%A0-%E8%AE%B0%E5%BF%86%E6%9E%B6%E6%9E%84/' },
  ch9: { title: '第 9 章：多轮对话设计', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC09%E7%AB%A0-%E5%A4%9A%E8%BD%AE%E5%AF%B9%E8%AF%9D%E8%AE%BE%E8%AE%A1/' },
  ch10: { title: '第 10 章：Planning 模式', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC10%E7%AB%A0-Planning%E6%A8%A1%E5%BC%8F/' },
  ch11: { title: '第 11 章：Reflection 模式', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC11%E7%AB%A0-Reflection%E6%A8%A1%E5%BC%8F/' },
  ch12: { title: '第 12 章：Chain-of-Thought', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC12%E7%AB%A0-Chain-of-Thought/' },
  ch13: { title: '第 13 章：编排基础', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC13%E7%AB%A0-%E7%BC%96%E6%8E%92%E5%9F%BA%E7%A1%80/' },
  ch14: { title: '第 14 章：DAG 工作流', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC14%E7%AB%A0-DAG%E5%B7%A5%E4%BD%9C%E6%B5%81/' },
  ch15: { title: '第 15 章：Swarm 模式', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC15%E7%AB%A0-Swarm%E6%A8%A1%E5%BC%8F/' },
  ch16: { title: '第 16 章：Handoff 机制', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC16%E7%AB%A0-Handoff%E6%9C%BA%E5%88%B6/' },
  ch17: { title: '第 17 章：Tree-of-Thoughts', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC17%E7%AB%A0-Tree-of-Thoughts/' },
  ch18: { title: '第 18 章：Debate 模式', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC18%E7%AB%A0-Debate%E6%A8%A1%E5%BC%8F/' },
  ch19: { title: '第 19 章：Research-Synthesis', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC19%E7%AB%A0-Research-Synthesis/' },
  ch20: { title: '第 20 章：三层架构设计', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC20%E7%AB%A0-%E4%B8%89%E5%B1%82%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1/' },
  ch21: { title: '第 21 章：Temporal 工作流', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC21%E7%AB%A0-Temporal%E5%B7%A5%E4%BD%9C%E6%B5%81/' },
  ch22: { title: '第 22 章：可观测性', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC22%E7%AB%A0-%E5%8F%AF%E8%A7%82%E6%B5%8B%E6%80%A7/' },
  ch23: { title: '第 23 章：Token 预算控制', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC23%E7%AB%A0-Token%E9%A2%84%E7%AE%97%E6%8E%A7%E5%88%B6/' },
  ch24: { title: '第 24 章：策略治理', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC24%E7%AB%A0-%E7%AD%96%E7%95%A5%E6%B2%BB%E7%90%86/' },
  ch25: { title: '第 25 章：安全执行', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC25%E7%AB%A0-%E5%AE%89%E5%85%A8%E6%89%A7%E8%A1%8C/' },
  ch26: { title: '第 26 章：多租户设计', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC26%E7%AB%A0-%E5%A4%9A%E7%A7%9F%E6%88%B7%E8%AE%BE%E8%AE%A1/' },
  ch27: { title: '第 27 章：Deep Research', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC27%E7%AB%A0-Deep-Research/' },
  ch28: { title: '第 28 章：Computer Use', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC28%E7%AB%A0-Computer-Use/' },
  ch29: { title: '第 29 章：Agentic Coding', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC29%E7%AB%A0-Agentic-Coding/' },
  ch30: { title: '第 30 章：Background Agents', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC30%E7%AB%A0-Background-Agents/' },
  ch31: { title: '第 31 章：分层模型策略', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC31%E7%AB%A0-%E5%88%86%E5%B1%82%E6%A8%A1%E5%9E%8B%E7%AD%96%E7%95%A5/' },
  ch32: { title: '第 32 章：OpenClaw 时代', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC32%E7%AB%A0-OpenClaw%E6%97%B6%E4%BB%A3/' },
  ch33: { title: '第 33 章：Building on the Harness — Kocoro', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC33%E7%AB%A0-Building-on-the-Harness-ShanClaw/' },
  ch34: { title: '第 34 章：从 DAG 到 Agent Loop', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC34%E7%AB%A0-%E4%BB%8EDAG%E5%88%B0Agent-Loop/' },
  ch35: { title: '第 35 章：上下文压缩', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC35%E7%AB%A0-%E4%B8%8A%E4%B8%8B%E6%96%87%E5%8E%8B%E7%BC%A9/' },
  ch36: { title: '第 36 章：Tool Result 预算与外溢', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC36%E7%AB%A0-Tool-Result%E9%A2%84%E7%AE%97%E4%B8%8E%E5%A4%96%E6%BA%A2/' },
  ch37: { title: '第 37 章：分层压缩', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC37%E7%AB%A0-%E5%88%86%E5%B1%82%E5%8E%8B%E7%BC%A9/' },
  ch38: { title: '第 38 章：Deferred Tool Loading 与 Tool Search', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC38%E7%AB%A0-Deferred-Tool-Loading%E4%B8%8ETool-Search/' },
  ch39: { title: '第 39 章：Prompt Cache 稳定性', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC39%E7%AB%A0-Prompt-Cache%E7%A8%B3%E5%AE%9A%E6%80%A7/' },
  ch40: { title: '第 40 章：持久化 Agent Loop', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC40%E7%AB%A0-%E6%8C%81%E4%B9%85%E5%8C%96Agent-Loop/' },
  ch41: { title: '第 41 章：运行中操控 Agent', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC41%E7%AB%A0-%E8%BF%90%E8%A1%8C%E4%B8%AD%E6%93%8D%E6%8E%A7Agent/' },
  ch42: { title: '第 42 章：Agent 超时与 Watchdog', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC42%E7%AB%A0-Agent%E8%B6%85%E6%97%B6%E4%B8%8EWatchdog/' },
  ch43: { title: '第 43 章：卡循环检测', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC43%E7%AB%A0-%E5%8D%A1%E5%BE%AA%E7%8E%AF%E6%A3%80%E6%B5%8B/' },
  ch44: { title: '第 44 章：并行工具执行', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC44%E7%AB%A0-%E5%B9%B6%E8%A1%8C%E5%B7%A5%E5%85%B7%E6%89%A7%E8%A1%8C/' },
  ch45: { title: '第 45 章：Computer Use 上下文管理', href: 'https://waylandz.com/ai-agent-book/%E7%AC%AC45%E7%AB%A0-Computer-Use%E4%B8%8A%E4%B8%8B%E6%96%87%E7%AE%A1%E7%90%86/' },
  appA: { title: '附录 A：术语表', href: 'https://waylandz.com/ai-agent-book/%E9%99%84%E5%BD%95A-%E6%9C%AF%E8%AF%AD%E8%A1%A8/' },
  appB: { title: '附录 B：模式选择指南', href: 'https://waylandz.com/ai-agent-book/%E9%99%84%E5%BD%95B-%E6%A8%A1%E5%BC%8F%E9%80%89%E6%8B%A9%E6%8C%87%E5%8D%97/' },
  appC: { title: '附录 C：常见问题 FAQ', href: 'https://waylandz.com/ai-agent-book/%E9%99%84%E5%BD%95C-%E5%B8%B8%E8%A7%81%E9%97%AE%E9%A2%98FAQ/' },
} as const

function bookRef(key: keyof typeof BOOK, note?: string): BookRef {
  return { ...BOOK[key], note }
}

export const chapters: Chapter[] = [
  {
    id: 'ch0',
    title: '第 0 章 · 把机器接上',
    subtitle: '原生 API 的四个动作：调用、流式、工具、账单',
    items: [
      { slug: 'lessons/0001-first-api-call', title: '第一次 API 调用', minutes: 30, books: [bookRef('preface', '读书入口：前言里有三条阅读路线')] },
      { slug: 'lessons/0002-streaming', title: '流式与 SSE', minutes: 35 },
      { slug: 'lessons/0003-tool-calls', title: '工具调用', minutes: 45, books: [bookRef('ch3')] },
      { slug: 'lessons/0004-usage-and-cost', title: '读懂账单', minutes: 35, books: [bookRef('ch23', '预算控制的工程实现'), bookRef('ch39', '缓存为什么会失效')] },
    ],
  },
  {
    id: 'ch1',
    title: '第 1 章 · 推理的成本结构',
    subtitle: 'prefill 与 decode、KV cache 的显存、TTFT 的预算',
    items: [
      { slug: 'lessons/0005-prefill-decode', title: 'Prefill 与 Decode', minutes: 45, books: [bookRef('ch39', '缓存命中的工程规则，决定 prefill 成本')] },
      { slug: 'lessons/0006-kv-cache', title: 'KV Cache 与显存', minutes: 50 },
      { slug: 'lessons/0007-ttft-budget', title: 'TTFT 的预算', minutes: 45, books: [bookRef('ch22', '把延迟做成指标（P95/P99）'), bookRef('ch23', '预算控制的工程实现')] },
    ],
  },
  {
    id: 'ch2',
    title: '第 2 章 · 能扛的客户端',
    subtitle: '超时、重试、取消、限流，以及故障注入测试',
    items: [
      { slug: 'lessons/0008-llm-client', title: '生产级 LLM 客户端', minutes: 35, wip: true, books: [bookRef('ch42')] },
      { slug: 'lessons/0009-cancel-retry', title: '取消与重试', minutes: 30, wip: true, books: [bookRef('ch42')] },
    ],
  },
  {
    id: 'ch3',
    title: '第 3 章 · Agent 的本质与最小循环',
    subtitle: '大脑、手脚、记忆、主见；三道上限的最小 loop',
    items: [
      { slug: 'lessons/0010-agent-essence', title: 'Agent 的本质', minutes: 25, wip: true, books: [bookRef('ch1')] },
      { slug: 'lessons/0011-agent-loop', title: '最小 Agent Loop', minutes: 40, wip: true, books: [bookRef('ch2'), bookRef('ch34')] },
      { slug: 'lessons/0012-loop-guardrails', title: '三道上限与重复检测', minutes: 30, wip: true, books: [bookRef('ch42'), bookRef('ch43')] },
    ],
  },
  {
    id: 'ch4',
    title: '第 4 章 · ReAct 与工具调用基础',
    subtitle: 'Thought、Action、Observation；ReAct 与原生 tool_calls 的对比',
    items: [
      { slug: 'lessons/0013-react', title: 'ReAct 循环', minutes: 35, wip: true, books: [bookRef('ch2')] },
      { slug: 'lessons/0014-react-vs-native', title: 'ReAct 与原生 tool_calls 对比', minutes: 35, wip: true, books: [bookRef('ch3')] },
    ],
  },
  {
    id: 'ch5',
    title: '第 5 章 · Agent 前端',
    subtitle: '流式渲染、工具调用的可视化、审批、取消',
    items: [
      { slug: 'lessons/0015-stream-ui', title: '流式渲染与 tool_call 拼装', minutes: 40, wip: true },
      { slug: 'lessons/0016-approval-cancel', title: '审批与取消', minutes: 35, wip: true, books: [bookRef('ch41'), bookRef('ch25')] },
      { slug: 'lessons/0017-agent-panel', title: '聊天面板（作品）', minutes: 90, wip: true },
    ],
  },
  {
    id: 'ch6',
    title: '第 6 章 · MCP、Skills 与 Hooks',
    subtitle: '工具协议、技能包、事件钩子',
    items: [
      { slug: 'lessons/0018-mcp-protocol', title: 'MCP 协议与 TypeScript SDK', minutes: 35, wip: true, books: [bookRef('ch4')] },
      { slug: 'lessons/0019-skills-hooks', title: 'Skills 与 Hooks', minutes: 35, wip: true, books: [bookRef('ch5'), bookRef('ch6')] },
      { slug: 'lessons/0020-mcp-server', title: '最小 MCP server（实验）', minutes: 45, wip: true, books: [bookRef('ch4')] },
    ],
  },
  {
    id: 'ch7',
    title: '第 7 章 · 上下文工程、记忆与压缩',
    subtitle: '上下文预算、记忆架构、摘要压缩、工具结果预算',
    items: [
      { slug: 'lessons/0021-context-engineering', title: '上下文工程', minutes: 40, wip: true, books: [bookRef('ch7')] },
      { slug: 'lessons/0022-memory-architecture', title: '记忆架构', minutes: 35, wip: true, books: [bookRef('ch8'), bookRef('ch9')] },
      { slug: 'lessons/0023-compression-budget', title: '压缩与工具结果预算', minutes: 45, wip: true, books: [bookRef('ch35'), bookRef('ch36'), bookRef('ch37')] },
    ],
  },
  {
    id: 'ch8',
    title: '第 8 章 · 规划、反思与思维链',
    subtitle: 'Planning、Reflection、Chain-of-Thought，同一任务的对比',
    items: [
      { slug: 'lessons/0024-planning-reflection', title: 'Planning 与 Reflection', minutes: 40, wip: true, books: [bookRef('ch10'), bookRef('ch11')] },
      { slug: 'lessons/0025-paradigm-compare', title: '范式对比实验', minutes: 45, wip: true, books: [bookRef('ch12')] },
    ],
  },
  {
    id: 'ch9',
    title: '第 9 章 · 评测与可观测',
    subtitle: 'trace 记录、Token 预算、能发现回退的回归评测',
    items: [
      { slug: 'lessons/0026-observability', title: '可观测性与 trace', minutes: 35, wip: true, books: [bookRef('ch22')] },
      { slug: 'lessons/0027-token-budget', title: 'Token 预算控制', minutes: 30, wip: true, books: [bookRef('ch23')] },
      { slug: 'lessons/0028-eval-regression', title: '回归评测', minutes: 50, wip: true, books: [bookRef('ch22', '书里没有专门讲评测的章节，这里是可观测性的相关章节')] },
    ],
  },
  {
    id: 'ch10',
    title: '第 10 章 · 编排与多智能体',
    subtitle: '编排基础、Handoff，一个两角色的 demo',
    items: [
      { slug: 'lessons/0029-orchestration', title: '编排基础', minutes: 35, wip: true, books: [bookRef('ch13'), bookRef('ch14')] },
      { slug: 'lessons/0030-handoff-demo', title: 'Handoff demo', minutes: 45, wip: true, books: [bookRef('ch16'), bookRef('ch15')] },
    ],
  },
  {
    id: 'ch11',
    title: '第 11 章 · Harness 运行时',
    subtitle: '三层架构、策略与安全、持久化、超时、卡循环检测、并行工具',
    items: [
      { slug: 'lessons/0031-harness-architecture', title: 'Harness 的三层架构', minutes: 40, wip: true, books: [bookRef('ch20'), bookRef('ch33')] },
      { slug: 'lessons/0032-loop-engineering', title: 'Agent Loop 工程', minutes: 50, wip: true, books: [bookRef('ch34'), bookRef('ch40'), bookRef('ch44')] },
      { slug: 'lessons/0033-mini-harness', title: '最小 Harness（实验）', minutes: 60, wip: true, books: [bookRef('ch24'), bookRef('ch25'), bookRef('ch43')] },
    ],
  },
  {
    id: 'ch12',
    title: '第 12 章 · DSH 插件',
    subtitle: '读 DSH 的架构地图，发布一个真正被使用的插件',
    items: [
      { slug: 'lessons/0034-dsh-map', title: 'DSH 阅读地图', minutes: 40, wip: true, books: [bookRef('ch33')] },
      { slug: 'lessons/0035-plugin-release', title: '发布插件', minutes: 60, wip: true },
    ],
  },
  {
    id: 'ch13',
    title: '第 13 章 · 综合项目：深度研究智能体',
    subtitle: '多步检索、引用、预算、审批、评测，接入 DSH',
    items: [
      { slug: 'lessons/0036-deep-research-design', title: '项目设计', minutes: 45, wip: true, books: [bookRef('ch27')] },
      { slug: 'lessons/0037-deep-research-build', title: '项目实现与录屏', minutes: 120, wip: true, books: [bookRef('ch27'), bookRef('ch28')] },
    ],
  },
  {
    id: 'ch14',
    title: '第 14 章 · 面试冲刺',
    subtitle: '八股追问链、手撕清单、项目深挖',
    items: [
      { slug: 'lessons/0038-interview-chain', title: '八股追问链', minutes: 60, wip: true, books: [bookRef('appA'), bookRef('appC')] },
      { slug: 'lessons/0039-handwrite-list', title: '手撕清单', minutes: 60, wip: true },
    ],
  },
]

/** 速查卡：不占章节，随时可查 */
export const references: Lesson[] = [
  { slug: 'reference/api-response', title: 'Chat Completions 响应', badge: '参考' },
]

/* ─────────── 派生数据 ─────────── */

export const flatLessons: Lesson[] = chapters.flatMap((c) => c.items)
export const allItems: Lesson[] = [...flatLessons, ...references]

export function findLesson(slug: string): Lesson | undefined {
  return allItems.find((d) => d.slug === slug)
}

export function chapterOf(slug: string): Chapter | undefined {
  return chapters.find((c) => c.items.some((i) => i.slug === slug))
}

/** 上一节 / 下一节（跨章连续，方便一路做下去） */
export function neighbours(slug: string) {
  const i = flatLessons.findIndex((d) => d.slug === slug)
  if (i < 0) return { prev: undefined, next: undefined, index: -1 }
  return {
    index: i,
    prev: i > 0 ? flatLessons[i - 1] : undefined,
    next: i < flatLessons.length - 1 ? flatLessons[i + 1] : undefined,
  }
}

export const totalLessons = flatLessons.filter((l) => !l.wip).length
export const plannedLessons = flatLessons.length
