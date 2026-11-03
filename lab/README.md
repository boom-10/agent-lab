# lab/ · 实验区

**这里只有一个规则：**

```
exercises/   ← ★ 你写代码的地方（只有你的东西）
toolkit/     ← 我给你的工具和参考资料（一般不用改）
starters/    ← 脚手架（要改就复制出去，别原地改）
```

> 觉得目录乱的时候，回来看这三行就够了。

---

## 你写代码 → `exercises/`

按学习阶段编号，一个实验一个目录：

```
exercises/
└── 01-raw-api/          ← P0 任务 0.3：原生 API 调用
    └── （你在这里写）
```

> [!warning] **`exercises/01-raw-api/` 现在是空的** —— 那正是留给你的。
> 我给你的参考实现**不在这里**，在 `toolkit/reference/`。
> 这样你就不会分不清「哪些是我写的、哪些是给我的」。

---

## 我给你的东西

### `toolkit/` —— 工具与参考资料

| 路径 | 是什么 | 什么时候用 |
|---|---|---|
| `toolkit/reference/` | **三个参考实现**（basic / stream / tools） | **先自己写，卡住再对照**。直接抄等于没学 |
| `toolkit/mock-server.mjs` | 本地模拟 API 服务器 | 零成本试错。**故意制造 SSE 分包、UTF-8 截断、arguments 分片** |
| `toolkit/demos/naive-parser-demo.mjs` | 反面教材：朴素 SSE 解析 | 跑一下看它怎么**静默丢 60% 数据** |
| `toolkit/cordis-probe/` | Cordis 插件机制探针台 | 7 个用例演示**静默失败**语义 |

### `starters/` —— 脚手架

| 路径 | 是什么 |
|---|---|
| `starters/dsh-plugin-starter/` | 插件脚手架，**Node 半边 + 手写的客户端半边**（不需要构建工具） |

改脚手架时**复制一份出去改**，保持原始版本干净。

---

## 命令

```bash
cd ~/Desktop/Personal/agent-lab/lab
nvm use 22

npm run check          # ★ 先跑这个：环境自检（只读，不花钱）
```

| 命令 | 作用 | 花不花钱 |
|---|---|---|
| `npm run check` | 环境自检 | 免费 |
| `npm run mock` | 启动模拟 API 服务器（**另开一个终端**） | 免费 |
| `npm run demo:naive` | 反面教材：看朴素 SSE 解析怎么坏 | 免费 |
| `npm run api:basic` | 参考实现 · 普通调用 | 真调，约 $0.00002 |
| `npm run api:stream` | 参考实现 · 流式 | 真调 |
| `npm run api:tools` | 参考实现 · 工具调用 | 真调 |
| `npm run api:basic:mock` 等 | 同上三个，但打本地 mock | **免费** |
| `npm run probe` / `probe:service` / `probe:no-apply` | 插件机制探针 | 免费 |
| `npm run plugin:dump` | 验证脚手架挂进 DSH 组合配置 | 免费 |

> **推荐节奏**：先 `npm run mock` 起服务，用 `api:*:mock` 免费调试；
> 只在最后确认真实行为时跑一次真 API。

---

## 两个务必注意的坑

```bash
# ① 忘了 --env-file 不会报错，只会看到 undefined，然后 401 看起来像 key 有问题
node --env-file=.env 你的脚本.ts     # ✅
node 你的脚本.ts                     # ❌

# ② 补建 .env 用幂等写法，别无条件 cp（会冲掉已填的 key）
[ -f .env ] || cp .env.example .env
```

---

## 环境要求（实测踩坑记录）

| 项 | 要求 | 为什么 |
|---|---|---|
| Node | **≥ 22.19** | DSH 依赖 `@earendil-works/pi-ai` / `undici` 要求 ≥22.19 |
| npm 源 | 见 `.npmrc` | 内网镜像 `npm.shopee.io` 版本滞后，会 `ETARGET` |
| 语言 | **TypeScript 为主** | DSH 本身是 TS；Python 只用于读别人的示例 |

```bash
nvm use 22          # 本机已有 v22.23.2
node --version      # v22.23.2
```

**Node 22 原生支持 `.ts`**（类型擦除默认开启），不需要编译、不需要 `ts-node`。

---

## 学习资料在哪

沉淀在 `~/Documents/Obsidian Vault/obsidian/Job/agent-transition/`（28 个文件）。
**不要通读。** 从 `从这里开始.md` 开始，20 分钟看全貌，其余按需查。

课程在 `../teach/lessons/`。

## 练习（exercises/）

**每个练习文件我都建好了**，你只需要填 TODO。文件开头的注释里有：

- **怎么跑** —— 两条命令，以及两个会浪费你半小时的坑
- **怎么调试** —— 「常见报错 → 病因」对照表
- **验收标准** —— 自检脚本会检查什么

### 自检

每个练习结尾都有一段自检。用 mock 跑时会拿你的输出和期望值比对：

```bash
cd ~/Desktop/Personal/agent-lab/lab
npm run mock                                    # 终端 A
node --env-file=.env.mock exercises/01-raw-api/stream.ts   # 终端 B
```

全绿就过了。没过它会告诉你**先打印什么、按什么顺序排查**。

### 编辑器里不该有红波浪线

`lab/` 有 `tsconfig.json`（`types: ["node"]`，strict 开启）。
如果你看到「找不到名称 process」之类的报错：

```bash
cd ~/Desktop/Personal/agent-lab/lab
npm i -D typescript @types/node     # 如果还没装
npm run typecheck                    # 应该零错误
```

练习文件在你**没写完时也没有类型错误** —— 见下面的「为什么是 main()」。

### 为什么练习写成 `main()` 函数

第一版我把 TODO 散在模块顶层，自检里写 `typeof fullText === 'undefined'`
来判断「你写完了没」。**这在 TypeScript 里是编译错误** ——
`fullText` 是你才要声明的，静态分析当然找不到。66 个红波浪线。

现在的结构：

```ts
async function main(): Promise<StreamResult | undefined> {
  // 你的代码写这里，变量是你自己的局部变量
  return undefined   // ← 写完改成 return { ... }
}

const result = await main()
if (!result) { /* 友好提示「还没写完」 */ }
```

好处：**类型定义在那儿，TypeScript 会主动帮你补全和纠错**。少个字段它会说。

### 现有练习

| 文件 | 对应课程 | 练什么 |
|---|---|---|
| `01-raw-api/stream.ts` | 第 0002 节 | 跨 read 的缓冲区、TTFT 测量 |
| `01-raw-api/tools.ts` | 第 0003 节 | 工具调用往返、tool_call_id 透传 |

`toolkit/reference/types.ts` 是 **API 响应的完整类型定义** ——
`await res.json()` 返回 `unknown`，不标注的话编辑器里一路报错。
它同时是一份「响应里到底有什么」的速查，每个字段都有注释。

> `tools.ts` 的 mock **支持你自己的工具** —— 它用你声明的第一个工具来造 tool_call，
> `arguments` 按你 schema 里的 `required` 字段生成。所以你定义什么都能跑通。
