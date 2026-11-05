# NOTES

> 工作笔记与偏好记录。给未来的教学会话提供上下文。**不是计划**（计划在 `MISSION.md`）。

## 学习者画像

- 前端工程师，Shopee，多年经验。985 本科。
- 技术栈：React / TypeScript / Node，做过组件库（SVX）、性能优化、插件体系与 manifest/MCP。
- **有 TypeScript 功底，没有后端/并发/评测经验。**
- 学习偏好：**项目驱动**。要任务书 + 代码评审，不要大段讲解替代动手。
- 明确说过：不要为了学机制而先花几周学 Python。

## 当前进度（2026-11-02）

| 项 | 状态 |
|---|---|
| 环境（Node 22 / npm 公网源 / dsh CLI） | ✅ 配好，自检 10/10 |
| DeepSeek API key | ✅ 已配，真调通过 |
| **P0 任务 0.3（原生 API 调用）** | ⬜ **未开始** —— 这是卡住的地方 |
| 01-raw-api/ 自己的实现 | ⬜ 无 |
| DSH 插件选题 | ⬜ 未提候选 |

**目录结构（2026-11-03 重排）**：

```
agent-lab/
├── teach/                     ← 本工作区
└── lab/                       ← 实验区
    ├── check-setup.mjs          （入口：npm run check）
    ├── exercises/               ★★ 学习者写代码的地方（现在只有空的 01-raw-api）
    ├── toolkit/                 我给的：reference/ mock-server demos/ cordis-probe
    └── starters/                脚手架：dsh-plugin-starter
```

**一条规则**：`exercises/` 是他的，`toolkit/` `starters/` 是我的。
之前混在一起，他明确说「结构看起来有点乱，不知道代码该写哪」——所以重排了。

跑命令前先 `cd ~/Desktop/Personal/agent-lab/lab && nvm use 22`。

## 已核实的技术事实（省得重复查）

**DeepSeek API**
- `thinking` **默认开启** → 开着时 `temperature` 无效、`max_tokens` 默认 64K、响应多 `reasoning_content`
- 流式要拿 `usage` 必须显式传 `stream_options: {include_usage: true}`
- `finish_reason` 六个取值：`stop` / `length` / `content_filter` / `tool_calls` / `insufficient_system_resource` / `aborted`
- `prompt_tokens` = `prompt_cache_hit_tokens` + `prompt_cache_miss_tokens`
- `tool_call_id` 必须从模型的 `tool_calls[].id` **原样透传**，否则 400（已探到报错原文）
- 缓存命中要求**完整匹配一个缓存前缀单元**，单元划分是**延迟的**（不是 TTL 机制）

**DSH**
- `apply` 是插件的**唯一入口**。只 `export class` 而不写 `apply` → **静默不加载**，无报错
- `dsh plugin add` **必须加 `-w`**，官方文档没写
- 实际有 **114 个服务 / 65 个事件 / 98 个槽位**（文档版分别是 26 / ~35 / ~40，差得多）
- UI 插件的客户端半边**可以手写** lazy-CJS，不需要 tsdown 构建预设
- 隔离测试：`DSH_HOME=/tmp/xxx` 被尊重，装坏了 `rm -rf` 重来

## 踩过的坑（别再犯）

1. **`cp .env.example .env` 是无条件覆盖** —— 会冲掉已填的 key。用 `[ -f .env ] || cp ...`
2. **`node 文件.ts` 忘了 `--env-file=.env` 不报错**，只会看到 `undefined`，然后 401 看起来像 key 有问题
3. **DeepSeek key 以 `sk-` 开头**。填成 UUID（会话 ID）会 401
4. **SSE 朴素解析会静默丢数据**：每 read 直接 `split('\n\n')` 会丢 60% 内容，但不抛异常

## 教学方式备忘

- ⚠️ **不要在对方动手期间持续产出文档**。之前 10 分钟发了 5 条长消息，造成信息过载，
  学习者提出「先暂停」。任务交付后应停止主动播报，只做：回答问题、评审提交、发现会害到他的缺陷时短提醒。
- 评审标准见 `~/Documents/Obsidian Vault/obsidian/Job/agent-transition/02-学习路径/P0-任务0.3-评审标准.md`
- 每次评审最多指出 3 个问题（多了吸收不了）

## 课程载体：从静态 HTML → TanStack Start 文档站（2026-11-03）

### 演进过程（三次返工，都是学习者提的）

1. **静态 HTML 单页**，打印优先窄栏 → 反馈「观感不好，我主要在电脑上学」
2. **静态 HTML 双栏**（正文 + 右侧目录）→ 反馈「还是很奇怪」+ 给了参考站截图
3. **静态 HTML 三栏**（顶栏 + 左栏 + 右栏），照参考站做 → 反馈「改成文档站形式，参考 cloud-doc」
4. **当前：TanStack Start + Vite + MDX 文档站**

### 现在的技术栈

| | |
|---|---|
| 框架 | TanStack Start 1.169 + TanStack Router 1.170 |
| 构建 | Vite 8 |
| 内容 | MDX（`@mdx-js/rollup` + `remark-gfm` + `rehype-pretty-code`/Shiki）|
| 样式 | Tailwind v4（`@theme` token）|

**选 TanStack 不选 Next.js 的理由（实测）**：本机 16GB + `codex-node-guard`，
Turbopack 冷编译会拉起 ~320 个 postcss 子进程打满内存（见 `cloud-docs/AGENTS.md`）。
对比：依赖 739→293 包、安装 2min→42s、dev 启动数十秒→**1.8s**、构建分钟级→**445ms**。

### 关键文件

```
src/routes/$.tsx          catch-all，所有内容页由它接管
src/content/manifest.ts   课程清单 —— 侧栏顺序的唯一来源
src/lib/content.ts        MDX 加载（**eager glob**，有坑，见文件注释）
src/components/DocShell.tsx  三栏外壳
src/components/Quiz.tsx      测验
scripts/check-mdx.mjs     prebuild 内容检查
```

### ⚠️ 一个必须记住的坑

**TanStack Start 的 loader 返回值会被序列化，不能放 React 组件。**
第一版就这么写的，SSR 报 `SerovalUnsupportedTypeError: [Function: MDXContent]`。
现在用 `import.meta.glob(..., { eager: true })`，组件在两端各自解析。

### 静态 HTML 版去哪了

`.archive-static/`（`lessons/*.html` + `assets/` + `reference/`）。
内容已全部迁到 `src/content/*.mdx`，存档只为以防万一。

### 和 teach skill 的约定有偏离

teach skill 期望 `./lessons/*.html`。现在是 `src/content/lessons/*.mdx`。
**MISSION.md / NOTES.md / RESOURCES.md 仍在根目录**，skill 的状态部分不变；
只有课程载体换了形式。`learning-records/` 继续按 skill 的格式写。

---

## ⚠️ 给带教者的一条提醒

学习者在「搭课程站」上花了 **4 个回合**，而 Agent 学习仍停在第一课的**第一条命令**。

搭站是他擅长的事（前端），做起来舒服 —— 但**那不是通往 DeepSeek 的路**。
MISSION 里写得很清楚：胜负手是**被真实使用过的 DSH 插件**，不是课程站。

**下次他再提「站点还能怎么改」时，先把这条摆出来，再决定要不要做。**

## 布局与样式：一次系统性的修正（2026-11-03）

### 触发

学习者问：「左侧目录那么大的空间为什么一定要贴着正文呢？」

**他是个前端，一眼看出来了。** 实测确实是个缺陷：

```
改之前  容器 1288px 居中 → 两侧各空 190px（浪费 23% 屏幕）
        侧栏→正文 仅 40px  ← 「贴着」就是这个
```

**矛盾**：外面空 390px，里面只给 40px 间隙。

### 用了两个 skill

- **`ui-ux-pro-max`**：取机械数据（间距/字号/对比度规则、断点清单）。它的
  `--design-system` 推荐了 `Baloo 2 + Comic Neue`（儿童字体）—— 因为 query 里有
  "learning platform" 被误路由到 "kids, education"。换关键词重查才对。
- **`frontend-design`**：管审美方向，并规定其反默认规则**高于**数据库匹配。

### 三个改动

**① 布局**：容器 1288 → **1472px**，正文列在中间格里**居中**，
多出来的空间给间隙。侧栏→正文 **40 → 120px**，正文阅读宽**保持 704px 不变**。

> 核心原则：**窗口变宽时，空间给间隙，不给正文。**
> 长行比宽边距更伤阅读（中文 >42 字会串行）。

**② 断点算过才写**：最初 1280 档用 240px rail，正文被挤到 **672px**。
用 Playwright 实测 8 个视口才发现。改成 13rem rail 后回到 704。

**③ 可访问性**（skill 列为 CRITICAL 优先级）：`ink-faint` 原为 `#8b8b96`，
对比度只有 **3.25:1**（要求 4.5）—— 侧栏小字、TOC 未选中项全不合格。
换成 `#71717a`（4.67:1）。另加 `:focus-visible` 焦点环、`prefers-reduced-motion`、
`tabular-nums`。

### 关于字体：**没有**采纳数据库的推荐

它推荐 `JetBrains Mono + IBM Plex Sans`。**Google Fonts 在国内不可用**，
加载会失败；中文字体 webfont 又是 MB 级。所以正文继续用系统栈，
等宽只用于数据（这一门课通篇是测量值，等宽是内容决定的）。

### 工具沉淀

`scripts/check-responsive.mjs` + `npm run check:responsive` ——
Playwright 实测 8 个视口，输出栏位可见性 / 正文宽 / 间隙 / 横向溢出。

**这比肉眼可靠**：布局的 bug 只在特定宽度出现。上一版就是在 1280 和 1024
两个临界点上坏了，而在我自己 1680 的屏上完全看不出来。

### 顺带修的内容 bug

第 4 节有个小标题写的是「② 改动**任何位置**都会让那个单元失效」——
但正文早已更正为「失效的是被改动所在的单元」。**标题没跟着改**，
而它又被右侧目录直接引用，等于把错的结论放在了最显眼的位置。

## ★ 教学法修正：练习文件要**我建好**，把「怎么调试」写进注释（2026-11-03）

### 学习者的话

> 「这种内容我觉得你可以把文件创建好，怎么调试怎么写都在注释中写清楚」

**他说得对，而且这是个更好的教学法。**

我原来在「你的产出」里只写三条要求（不用 SDK / 不丢字 / 打印三个数字），
让他对着空白文件自己想办法。**这制造了不必要的摩擦** ——
真正要练的是**缓冲区逻辑**，不是「猜该把文件放哪、怎么跑」。

### 改法：给过程，不给答案

| 给 | 不给 |
|---|---|
| 文件放哪、怎么跑（两条命令） | **核心逻辑**（缓冲区怎么切、事件怎么解析）|
| **「常见报错 → 病因」对照表** | 直接能抄的完整实现 |
| 要填哪几个 TODO、每个 TODO 做什么 | |
| **自检脚本** —— 写完跑一下就知道过没过 | |

这是教学设计里的「**完成问题策略**」：先给半成品范例，
脚手架随能力增长逐步撤掉。**不是把题做掉。**

### 关键：自检要能真的跑

- 先验证 mock 输出**确定性**（跑两次比对，一致）→ 才能硬编码期望值
- 自检分三档：非空 / 数值合理 / **和期望值一字不差**
- **失败路径必须测** —— 我用「朴素解析器」跑了一遍，发现它不是静默丢数据而是
  `SyntaxError: Unexpected end of JSON input` 崩溃。于是补了一张报错对照表。

### 顺手改进了 mock

原来 mock 写死返回 `greet` 工具调用，学习者一旦定义自己的工具就跑不通。
改成 **`pickToolCall()`：用客户端声明的第一个工具**，`arguments` 按 schema 的
`required` 字段生成占位值（string → "Ada"，number → 42，boolean → true）。

实测：`greet` → `{"name":"Ada"}`；`read_file` → `{"path":"Ada","lines":42}`；无参工具 → `{}`。

### 又一个实测发现

给练习文件挂错误诊断时，`process.on('unhandledRejection')` **没有触发**。
单独测了一下：

```js
process.on('unhandledRejection', () => console.log('unhandledRejection'))
process.on('uncaughtException',  () => console.log('uncaughtException'))
await Promise.reject(new Error('boom'))
// 输出：uncaughtException
```

**顶层 `await` 抛错在 ESM 里走的是 `uncaughtException`，不是 `unhandledRejection`。**
两个都挂才管事。

现在把 `tool_call_id` 写错，学习者看到的不是堆栈，是：

```text
  ❌ 请求失败
      An assistant message with 'tool_calls' must be followed by tool messages
      responding to each 'tool_call_id' ... call_WRONG

  💡 病因：tool_call_id 和上一轮 tool_calls[].id 对不上。
     ★ 必须原样透传 call.id，不能自己重新生成。
```

诊断认得出三种最常见错误：id 对不上、忘了塞回 assistant 消息、key 没读到。

## ★ 学习者报了类型错误，暴露我脚手架的结构缺陷（2026-11-03）

### 他的话

> 「在文件中有很多类型报错 找不到名称"process"… 是否需要安装 Node.js 的类型定义?」

### 表层问题：lab/ 没有 tsconfig

`lab/` 里**根本没有 `tsconfig.json`**，编辑器用默认推断，认不出 Node 全局。
`@types/node` 其实已经在 `node_modules` 里（`@deepseek-ai/dsh` 的传递依赖），
但没配 `types` 就没生效。

修：装 `typescript` + `@types/node`，写 tsconfig（`types: ["node"]`，strict），
加 `npm run typecheck`，并接进 `check-setup.mjs` 第 8 节。

### ★ 真正的问题：我的脚手架设计是错的

我为了做「没写完时的友好提示」，在自检里写了：

```ts
if (typeof fullText === 'undefined') { /* 还没写完 */ }
```

而 `fullText` 是**学习者才要声明的**变量。**这在 TypeScript 里必然是
`Cannot find name`** —— 我拿一个静态分析看得见的作用域，去做运行时的存在性判断。

一开 tsc，**66 个错误**。

### 改法：你的代码进 `main()`，自检读返回值

```ts
type StreamResult = { fullText: string; chunks: number; ttftMs: number; ... }

async function main(): Promise<StreamResult | undefined> {
  // 学习者的代码在这里，变量是他自己的局部变量
  return undefined   // ← 写完改成 return { ... }
}

const result = await main()
if (!result) { /* 还没写完 */ }
```

**这个结构比原来好，不只是「不报错」**：

1. **类型定义成了脚手架的一部分** —— 学习者少写一个字段，TS 直接告诉他
2. **变量作用域干净** —— 他写 `const buffer = ''` 不会和任何东西冲突
3. **自检不再猜** —— 有返回值就是写完了，没有就是没写完

### 顺手修的

- `toolkit/reference/` 的两个参考实现也有 10 个错误（`res.json()` 是 `unknown`）
- 新增 `toolkit/reference/types.ts` —— **API 响应的完整类型定义**，
  每个字段带注释。它本身也是有用的参考产物。
- strict 模式抓出真问题：`choices[0]` 可能 undefined、我漏了 `prompt_tokens_details`

### 一条给自己的教训

**我写脚手架时没跑过 tsc。** 我跑了 `node xxx.ts`（类型擦除，不做检查），
全绿，就以为没事了。

→ **写了 TypeScript 就要跑 `tsc --noEmit`。** `node file.ts` 通过 ≠ 类型正确。
这条已经加进 check-setup 的第 8 节，以后环境自检会替我盯着。

## ★ 右侧目录永远慢一整页 —— 框架时序 bug（2026-11-04）

### 学习者发现的

> 「右侧导航是不是有缓存？我切换章节还是这个目录还是没变」

截图里他在第 0003 节（工具调用），右侧列的全是 0004 节（读懂账单）的标题。

### 复现

```
硬跳转 0003      → ✅ 正确
点侧栏 → 0004    → ❌ 显示 0003 的标题
点侧栏 → 0003    → ❌ 显示 0004 的标题
```

**永远慢一整页。**

### 根因：framework 的 commit 时序

TanStack Router 的客户端导航里：
- `pathname` **先**更新（urgent）
- 路由内容 **后**更新（transition）

我原来的 effect 只依赖 `[pathname]`，所以它跑的时候 DOM 里还是**上一页**的标题。
等内容真的换了，`pathname` 没再变 → effect 不重跑 → 目录就停在那儿了。

**这个 bug 最恶劣的地方：整页刷新（硬导航）完全正常。**
所以手动点几下很容易漏掉，只有**连续客户端跳转**才暴露。

### 修法：别只信路由状态，直接看 DOM

挂一个 `MutationObserver` 盯住 `main.doc-main`（它在路由切换间常驻，
`.prose` 本身会被换掉）。内容一换就重扫。

关键细节：
- 观察 `main` 而不是 `.prose` —— 后者每次导航都被替换，observer 会跟着失效
- `setHeads` 里做**相等性检查**，否则 observer 会被自己的 setState 触发成死循环
- 用 `requestAnimationFrame` 合并高频 mutation
- 标题变了要把 `active` 清空 —— 否则高亮会停在上一页那个已不存在的 id 上

### 沉淀成回归测试

`scripts/check-toc.mjs` + `npm run check:toc`。

判据是硬的：**目录首项必须等于正文第一个 h2 的文字**。
比「肉眼看一眼」可靠 —— 这个 bug 就是肉眼漏掉的。

### 一条教训

**跨组件依赖「另一个组件渲染了什么」时，不要用路由状态当时钟。**
路由状态反映的是「导航开始了」，不是「内容上屏了」。
要观察的就是那个东西本身。

## ★ 路线 V2 与第 1 章交付（2026-11-05）

**路线**：参考 hello-agents（16 章）和 waylandz 第 01 章，重新编排为 12 章三阶段。
完整依据见 vault：`02-学习路径/学习路线-V2-参考hello-agents与waylandz重编排.md`。

**已确认**：低代码、Agentic-RL、赛博小镇移出主线；综合项目选深度研究智能体（第 14 章）。

**第 1 章的数据口径**（写进课程，也写在练习文件头）：
- 单次会话测的，绝对值会漂移。同样短的请求在两次实验里是 757 ms 和 350 ms。只讲相对关系。
- 强制 miss 用随机 nonce 放在 system 最前面。每个点取 3 次最小值。
- A/B 交替测缓存，避免「跑久了变快」的漂移。
- 参考解法跑过一次真 API：中间一档（800 行）比 200 行快，这是噪声。课里已经写明，建议改 RUNS=5 再看。
- 「假想的标准多头」只用来说明量级，不是 DeepSeek-V3 的真实存法。
- 「缓存只能削 prefill」是推断。网络、排队、固定开销没有单独测。

**下一步**：等学习者提交 `ex:ttft` 的表、`ex:kv` 的自检结果、0007 的 TTFT 预算说明，再写第 2 章「能扛的客户端」。
