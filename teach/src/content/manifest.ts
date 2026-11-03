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
    title: '第 1 章 · 模型在想什么',
    subtitle: 'KV Cache、推理成本、为什么前缀稳定能省钱',
    items: [
      { slug: 'lessons/0005-kv-cache', title: 'KV Cache 与推理机制', minutes: 40, wip: true },
      { slug: 'lessons/0006-prompt-cache', title: '前缀缓存实验', minutes: 40, wip: true },
      { slug: 'lessons/0007-cost-model', title: '成本模型', minutes: 30, wip: true },
    ],
  },
  {
    id: 'ch2',
    title: '第 2 章 · 能扛的客户端',
    subtitle: '错误分类、重试退避、三个超时、并发控制',
    items: [
      { slug: 'lessons/0008-llm-client', title: '生产级 LLM 客户端', minutes: 50, wip: true },
      { slug: 'lessons/0009-resilience', title: '重试与超时', minutes: 40, wip: true },
    ],
  },
  {
    id: 'ch3',
    title: '第 3 章 · 从零手写 Agent Loop',
    subtitle: '本阶段的核心。不借助任何框架',
    items: [
      { slug: 'lessons/0010-agent-loop', title: '最小 Agent Loop', minutes: 60, wip: true },
      { slug: 'lessons/0011-guardrails', title: '三道上限与重复检测', minutes: 45, wip: true },
      { slug: 'lessons/0012-checkpoint', title: '检查点与恢复', minutes: 40, wip: true },
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
