/**
 * 课程结构 —— 侧栏、进度、上一课/下一课的唯一来源。
 *
 * 组织单位是【章】，不是【节】。
 * 一章 = 一次能连续做完的量（2–4 小时），写完一整章再交给学习者，
 * 避免「看完一节就得等人生成下一节」。
 *
 * 每节仍保持「一个能拿在手里的成果」的粒度 —— 短是认知单位，章是交付单位。
 */

export type Lesson = {
  slug: string
  title: string
  /** 预计分钟数，显示在侧栏和节标题旁 */
  minutes?: number
  /** 右侧小标记 */
  badge?: string
  /** 计划中但还没写 */
  wip?: boolean
}

export type Chapter = {
  id: string
  title: string
  /** 一章在讲什么，一句话 */
  subtitle: string
  items: Lesson[]
}

/** 主线章节：按学习顺序 */
export const chapters: Chapter[] = [
  {
    id: 'ch0',
    title: '第 0 章 · 把机器接上',
    subtitle: '原生 API 的四个动作：调用、流式、工具、账单',
    items: [
      { slug: 'lessons/0001-first-api-call', title: '第一次 API 调用', minutes: 15 },
      { slug: 'lessons/0002-streaming', title: '流式与 SSE', minutes: 25 },
      { slug: 'lessons/0003-tool-calls', title: '工具调用', minutes: 35 },
      { slug: 'lessons/0004-usage-and-cost', title: '读懂账单', minutes: 25 },
    ],
  },
  {
    id: 'ch1',
    title: '第 1 章 · 推理的成本结构',
    subtitle: 'prefill 与 decode、KV cache 的显存、TTFT 的预算',
    items: [
      { slug: 'lessons/0005-prefill-decode', title: 'Prefill 与 Decode', minutes: 35 },
      { slug: 'lessons/0006-kv-cache', title: 'KV Cache 与显存', minutes: 40 },
      { slug: 'lessons/0007-ttft-budget', title: 'TTFT 的预算', minutes: 35 },
    ],
  },
  {
    id: 'ch2',
    title: '第 2 章 · 能扛的客户端',
    subtitle: '超时、重试、取消、限流，以及故障注入测试',
    items: [
      { slug: 'lessons/0008-llm-client', title: '生产级 LLM 客户端', minutes: 35, wip: true },
      { slug: 'lessons/0009-cancel-retry', title: '取消与重试', minutes: 30, wip: true },
    ],
  },
  {
    id: 'ch3',
    title: '第 3 章 · Agent 的本质与最小循环',
    subtitle: '大脑、手脚、记忆、主见；三道上限的最小 loop',
    items: [
      { slug: 'lessons/0010-agent-essence', title: 'Agent 的本质', minutes: 25, wip: true },
      { slug: 'lessons/0011-agent-loop', title: '最小 Agent Loop', minutes: 40, wip: true },
      { slug: 'lessons/0012-loop-guardrails', title: '三道上限与重复检测', minutes: 30, wip: true },
    ],
  },
  {
    id: 'ch4',
    title: '第 4 章 · ReAct 与工具调用基础',
    subtitle: 'Thought、Action、Observation；ReAct 与原生 tool_calls 的对比',
    items: [
      { slug: 'lessons/0013-react', title: 'ReAct 循环', minutes: 35, wip: true },
      { slug: 'lessons/0014-react-vs-native', title: 'ReAct 与原生 tool_calls 对比', minutes: 35, wip: true },
    ],
  },
  {
    id: 'ch5',
    title: '第 5 章 · Agent 前端',
    subtitle: '流式渲染、工具调用的可视化、审批、取消',
    items: [
      { slug: 'lessons/0015-stream-ui', title: '流式渲染与 tool_call 拼装', minutes: 40, wip: true },
      { slug: 'lessons/0016-approval-cancel', title: '审批与取消', minutes: 35, wip: true },
      { slug: 'lessons/0017-agent-panel', title: '聊天面板（作品）', minutes: 90, wip: true },
    ],
  },
  {
    id: 'ch6',
    title: '第 6 章 · MCP、Skills 与 Hooks',
    subtitle: '工具协议、技能包、事件钩子',
    items: [
      { slug: 'lessons/0018-mcp-protocol', title: 'MCP 协议与 TypeScript SDK', minutes: 35, wip: true },
      { slug: 'lessons/0019-skills-hooks', title: 'Skills 与 Hooks', minutes: 35, wip: true },
      { slug: 'lessons/0020-mcp-server', title: '最小 MCP server（实验）', minutes: 45, wip: true },
    ],
  },
  {
    id: 'ch7',
    title: '第 7 章 · 上下文工程、记忆与压缩',
    subtitle: '上下文预算、记忆架构、摘要压缩、工具结果预算',
    items: [
      { slug: 'lessons/0021-context-engineering', title: '上下文工程', minutes: 40, wip: true },
      { slug: 'lessons/0022-memory-architecture', title: '记忆架构', minutes: 35, wip: true },
      { slug: 'lessons/0023-compression-budget', title: '压缩与工具结果预算', minutes: 45, wip: true },
    ],
  },
  {
    id: 'ch8',
    title: '第 8 章 · 规划、反思与思维链',
    subtitle: 'Planning、Reflection、Chain-of-Thought，同一任务的对比',
    items: [
      { slug: 'lessons/0024-planning-reflection', title: 'Planning 与 Reflection', minutes: 40, wip: true },
      { slug: 'lessons/0025-paradigm-compare', title: '范式对比实验', minutes: 45, wip: true },
    ],
  },
  {
    id: 'ch9',
    title: '第 9 章 · 评测与可观测',
    subtitle: 'trace 记录、Token 预算、能发现回退的回归评测',
    items: [
      { slug: 'lessons/0026-observability', title: '可观测性与 trace', minutes: 35, wip: true },
      { slug: 'lessons/0027-token-budget', title: 'Token 预算控制', minutes: 30, wip: true },
      { slug: 'lessons/0028-eval-regression', title: '回归评测', minutes: 50, wip: true },
    ],
  },
  {
    id: 'ch10',
    title: '第 10 章 · 编排与多智能体',
    subtitle: '编排基础、Handoff，一个两角色的 demo',
    items: [
      { slug: 'lessons/0029-orchestration', title: '编排基础', minutes: 35, wip: true },
      { slug: 'lessons/0030-handoff-demo', title: 'Handoff demo', minutes: 45, wip: true },
    ],
  },
  {
    id: 'ch11',
    title: '第 11 章 · Harness 运行时',
    subtitle: '三层架构、策略与安全、持久化、超时、卡循环检测、并行工具',
    items: [
      { slug: 'lessons/0031-harness-architecture', title: 'Harness 的三层架构', minutes: 40, wip: true },
      { slug: 'lessons/0032-loop-engineering', title: 'Agent Loop 工程', minutes: 50, wip: true },
      { slug: 'lessons/0033-mini-harness', title: '最小 Harness（实验）', minutes: 60, wip: true },
    ],
  },
  {
    id: 'ch12',
    title: '第 12 章 · DSH 插件',
    subtitle: '读 DSH 的架构地图，发布一个真正被使用的插件',
    items: [
      { slug: 'lessons/0034-dsh-map', title: 'DSH 阅读地图', minutes: 40, wip: true },
      { slug: 'lessons/0035-plugin-release', title: '发布插件', minutes: 60, wip: true },
    ],
  },
  {
    id: 'ch13',
    title: '第 13 章 · 综合项目：深度研究智能体',
    subtitle: '多步检索、引用、预算、审批、评测，接入 DSH',
    items: [
      { slug: 'lessons/0036-deep-research-design', title: '项目设计', minutes: 45, wip: true },
      { slug: 'lessons/0037-deep-research-build', title: '项目实现与录屏', minutes: 120, wip: true },
    ],
  },
  {
    id: 'ch14',
    title: '第 14 章 · 面试冲刺',
    subtitle: '八股追问链、手撕清单、项目深挖',
    items: [
      { slug: 'lessons/0038-interview-chain', title: '八股追问链', minutes: 60, wip: true },
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
