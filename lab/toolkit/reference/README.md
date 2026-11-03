# 参考实现（P0 任务 0.3）

> [!warning] 使用规则
> **先自己写，写完再对照这里。**
> 看这个的目的不是抄，是**看到差异后问自己为什么**。
> 如果先看了，这一课就白上了——而 P1 的手写 Agent Loop 完全建立在这一课之上。

---

## 怎么跑

`agent-lab` 的 Node 22 **原生支持 TypeScript**（类型擦除默认开启），**不需要任何构建工具**。
`.env` 用 Node 自带的 `--env-file` 加载，**不需要 dotenv**。

```bash
cd ~/Desktop/Personal/agent-lab/lab
nvm use 22

# 先复制 .env.example 为 .env，填入真实 key
node --env-file=.env toolkit/reference/01-basic.ts
node --env-file=.env toolkit/reference/02-stream.ts
node --env-file=.env toolkit/reference/03-tools.ts
```

或直接用 npm scripts（已配好）：
```bash
npm run api:basic
npm run api:stream
npm run api:tools
```

---

## ★ 零成本试错：本地模拟服务器

写自己的实现时你肯定要反复调试。**不用每次都真调 API 花钱** —— 我做了个模拟服务器。

```bash
# 终端 A：启动模拟服务器
npm run mock

# 终端 B：用模拟服务器跑参考实现
npm run api:basic:mock
npm run api:stream:mock
npm run api:tools:mock

# 或者把你自己的脚本指过去
DEEPSEEK_BASE_URL=http://127.0.0.1:39001 DEEPSEEK_API_KEY=sk-mock node 你的脚本.ts
```

### 它严格按官方规范构造响应

字段名与格式都来自我核实过的官方文档：

| 规范 | 模拟服务器的行为 |
|---|---|
| SSE 格式 | `data: {...}\n\n`，以 `data: [DONE]` 结束 |
| `stream_options.include_usage: true` | 每个 chunk 都带 `usage`（除最后一个外都是 `null`） |
| 最后一个内容 chunk | 同时带 `finish_reason` 和 `usage`，**不单独发 usage-only chunk** |
| `usage` 等式 | `prompt_tokens` = `prompt_cache_hit_tokens` + `prompt_cache_miss_tokens` |
| `tool_calls[].function.arguments` | 是**字符串**，且**分片下发**（真实行为） |
| `finish_reason` | `stop` / `tool_calls` 都能触发 |

### ★ 它故意制造了三个难点

用来压力测试你的解析器 —— **如果你能扛住，真实 API 就不在话下**：

1. **把一个 SSE 事件从中间劈开**分多次 `write` —— 真实 TCP 分包就是这样
2. **跨包的多字节 UTF-8 字符** —— 中文被切断在两次 write 之间
3. **`tool_calls.arguments` 分片下发** —— 需要自己拼接字符串

### 环境变量文件的用法

仓库里有 `.env.mock`（已 gitignore），指向模拟服务器：

```bash
# 用真 API
npm run api:basic

# 用模拟服务器（免费、可无限次）
npm run api:basic:mock
```

> [!tip] 推荐的工作流
> 1. **先用 mock 把机制跑通**（免费、可无限试错、故意给你制造边界情况）
> 2. **再用真 API 跑一次对照** —— 确认真实响应和 mock 一致
> 3. 之后所有调试都在 mock 上做
>
> 这样你的 API 花费基本只有「最后确认」那几次。

---

## ⚠️ 五个已核实的参数陷阱（官方文档原文，别踩）

> 来源：`api-docs.deepseek.com/api/create-chat-completion` + `/quick_start/pricing`，2026-11-02 核实

### ① `thinking` 默认是**开启**的

| 写法 | 效果 |
|---|---|
| 不传 `thinking`，也不传 `reasoning_effort` | **thinking 开启**（默认） |
| `thinking: {type: "enabled"}` | thinking 开启 |
| `thinking: {type: "disabled"}` | **非 thinking** |
| `reasoning_effort: "none"` | 关闭 thinking |
| `reasoning_effort: "low" \| "high" \| "max"` | 开启 thinking，默认 `high` |

传了 `thinking` 对象时，**`type` 必填，且优先于 `reasoning_effort`**。
兼容值：`minimal` → `low`；`medium` / `xhigh` → `high`。

### ② `temperature` **在 thinking 模式下完全无效**

官方原文：*"Has no effect in thinking mode."*

→ **做 P1-W2 实验 4（采样参数）时必须先关 thinking**，否则你会测出「改 temperature 没变化」并得出错误结论。

### ③ `top_p` 在 flash 上基本不可用

| 模式 | `deepseek-flash` 的行为 |
|---|---|
| thinking | 默认 1.0；**低于 0.95 的值一律当 0.95** |
| **非 thinking** | **固定 1.0，你传什么都被忽略** |

→ **不要用 `top_p` 做实验**。用 `temperature`。

### ④ `tool_choice: "required"` 或指定工具 —— thinking 模式下 **400 错误**

官方原文：*"`required` and named tool choices are not supported in thinking mode; the API returns a 400 error. Disable thinking mode first to use them."*

→ **用工具时必须 `thinking: {type: "disabled"}`**。

### ⑤ `max_tokens` 默认值随模式变

| 模式 | 默认 |
|---|---|
| 非 thinking | **8K** |
| thinking | **64K**（`reasoning_effort: "max"` 时 128K） |

---

## 已核实的响应结构

### `usage` 对象（这是 P1-W2 的核心数据源）

```
usage
├── prompt_tokens              = prompt_cache_hit_tokens + prompt_cache_miss_tokens
├── completion_tokens
│   └── completion_tokens_details.reasoning_tokens   ← 思考消耗的 token（thinking 模式才有）
├── total_tokens
├── prompt_cache_hit_tokens        ★ 缓存命中
├── prompt_cache_miss_tokens       ★ 缓存未命中
└── prompt_tokens_details.cached_tokens   （与 prompt_cache_hit_tokens 同值）
```

**真实验例**（官方文档给的）：
```json
"usage": {
  "prompt_tokens": 7, "completion_tokens": 11, "total_tokens": 18,
  "prompt_tokens_details": { "cached_tokens": 0 },
  "prompt_cache_hit_tokens": 0, "prompt_cache_miss_tokens": 7
}
```

### `finish_reason` 的全部取值

`stop` · `length` · `content_filter` · **`tool_calls`** · `insufficient_system_resource` · `aborted`

> [!tip] 后两个值值得注意
> `insufficient_system_resource` 和 `aborted` —— **生产环境必须处理**。
> 你的 Agent Loop 如果只判断 `stop` 和 `tool_calls`，遇到这两个会静默出错。
> 这正是「对正确性要求高」的具体体现。

### 流式（SSE）格式

- `stream: true` → **data-only SSE**，以 **`data: [DONE]`** 结束
- `stream_options: {include_usage: true}` → **每个 chunk 都带 `usage` 字段**（除最后一个外都是 `null`）
- **不传 `stream_options`** → `usage` **只出现在最后一个 chunk**
- ⚠️ 官方特别说明：**不单独发一个 usage-only chunk**。统计数据挂在**最后一个内容 chunk** 上，它的 `choices` 数组恰好一个元素、**不带新内容、且 `finish_reason` 非 null**

→ 这就是参考实现 02 里为什么要同时检查 `delta.content` 和 `finish_reason`。

### 工具调用

```
message.tool_calls[0]
├── id                        ★ 回注结果时必须带上
├── type                      "function"
└── function
    ├── name
    └── arguments             ⚠️ 是**字符串**，要自己 JSON.parse
```

**回注结果的三条规则**（最容易错）：
1. assistant 那条消息必须**原样**带上 `tool_calls`，不能只放 `content`
2. 工具结果的 `role` 是 **`"tool"`**（不是 `user`），且必须带 `tool_call_id`
3. `content` 必须是**字符串**，对象要自己 `JSON.stringify`

**Beta 特性**：给 function 加 `strict: true`，API 会用严格模式保证输出符合 JSON Schema。

---

## 我会怎么评审你的版本

对照检查这几项：

| 项 | 合格标准 |
|---|---|
| 不用 SDK | 只用了 `fetch`（Node 内置）或 `http`，没有任何 `openai` / `@anthropic-ai/sdk` |
| **SSE 解析正确** | 按 `\n\n` 切事件、处理跨 chunk 的半条数据、正确识别 `[DONE]` |
| 错误处理 | 非 2xx 时打印**原始 body**，不吞错 |
| 工具往返完整 | `tool_calls` → 执行 → `role:"tool"` + `tool_call_id` → 二次调用 |
| usage 逐字段打印 | 至少打印 hit / miss / completion / total |
| **成本量化** | 每次调用算一遍成本（这是从 P1 开始的固定动作） |

**加分项**：
- 测量了 TTFT / TPOT，并说明了测量方法如何处理网络抖动
- 观察到「第二次跑同样输入，cache_hit 变大了」并写进 README
- 试过故意传错 `tool_call_id`，并记录了报错

---

## 留给你的三个问题（写在你的 README 里，不要写在这里）

1. `tool_calls` 的 `arguments` 为什么是**字符串**而不是对象？
2. 第二轮请求如果不带 `tools` 参数会发生什么？
3. 如果把 `tool_call_id` 写错会怎样？

> [!note] 这三个问题没有标准答案
> 我要看的是**你去试了没有**、以及**你怎么描述观察到的现象**。
> 这正是 JD 原文「习惯用测试、数据和可复核证据验证方案」的意思。

---

## 文件说明

| 文件 | 覆盖 |
|---|---|
| `01-basic.ts` | 非流式调用 + 完整响应逐字段拆解 + usage + 成本 |
| `02-stream.ts` | SSE 解析 + TTFT / TPOT 测量（导出 `measure()` 供实验复用） |
| `03-tools.ts` | 工具定义 → 调用 → 执行 → 回注 → 二次调用 + 消息数组增长过程 |

---

相关：[[P0-环境搭建与基线自评]] · [[P1-W2-LLM推理机制与KV-Cache]]
