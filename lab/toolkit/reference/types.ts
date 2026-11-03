/**
 * DeepSeek Chat Completions API 的响应类型
 * ==========================================
 *
 * 为什么要手写这个：`await res.json()` 的返回类型是 `unknown`。
 * 不标注的话，编辑器里 `data.choices` 会一路报错，你也拿不到补全。
 *
 * 这也可以当成一份「响应里到底有什么」的速查 —— 每个字段我都写了注释。
 * 字段来源：官方 API 文档 + 我实际调用的响应（第 0001 节的原始 JSON）。
 */

/** token 统计。★ 只有开了 stream_options.include_usage 才有 */
export type DeepSeekUsage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  /** 命中缓存的部分 —— 价格是未命中的 1/50 */
  prompt_cache_hit_tokens: number
  /** 未命中的部分 */
  prompt_cache_miss_tokens: number
  completion_tokens_details?: {
    /** 思维链消耗的 token（关了 thinking 就没有） */
    reasoning_tokens?: number
  }
  /** 前缀缓存相关的细分统计（部分响应才有） */
  prompt_tokens_details?: {
    cached_tokens?: number
  }
}

/** 模型要求调用一个工具 */
export type DeepSeekToolCall = {
  /** ★ 服务端强制校验这个 id。回填结果时必须原样透传 */
  id: string
  type: 'function'
  function: {
    name: string
    /** ⚠️ 是**字符串**不是对象，要 JSON.parse。流式下它是分片下发的 */
    arguments: string
  }
}

export type DeepSeekMessage = {
  role: string
  content: string | null
  /** thinking 开启时才有。它和 content 是两个独立通道 */
  reasoning_content?: string | null
  tool_calls?: DeepSeekToolCall[]
}

/** 官方文档列的 6 种取值 */
export type FinishReason =
  | 'stop'
  | 'length'
  | 'tool_calls'
  | 'content_filter'
  | 'insufficient_system_resource'
  | null

export type DeepSeekChoice = {
  index: number
  message: DeepSeekMessage
  finish_reason: FinishReason
}

export type DeepSeekResponse = {
  id: string
  object: string
  created: number
  model: string
  choices: DeepSeekChoice[]
  usage: DeepSeekUsage
}

/* ── 流式 delta 的形状 ── */
export type DeepSeekDelta = {
  role?: string
  content?: string | null
  reasoning_content?: string | null
  tool_calls?: Array<{
    index: number
    id?: string
    type?: 'function'
    function?: { name?: string; arguments?: string }
  }>
}

export type DeepSeekStreamChunk = {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: DeepSeekDelta
    finish_reason: FinishReason
  }>
  /** ★ 只在最后一个 chunk 出现（且要开 include_usage） */
  usage?: DeepSeekUsage
}
