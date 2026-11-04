# agent-lab

一个前端工程师转型「前端 + Agent」方向的学习工作台。

```bash
git clone git@github.com:boom-10/agent-lab.git
```

---

## ⚠️ 先说清楚：这里的 AI 生成内容

**这个仓库有两类作者，我不想含糊。**

| 位置 | 谁写的 |
| --- | --- |
| `teach/src/content/` 课程内容（讲义、练习题、可交互演示） | **AI 生成** |
| `teach/` 站点代码（TanStack Start 应用） | AI 搭建，我审阅、调试、改布局 |
| `lab/toolkit/`、`lab/starters/` 脚手架与工具 | AI 搭建，我逐条跑验证 |
| **`lab/exercises/` 里的练习实现** | **我写的** |

具体说：**课程材料由 AI 生成 —— 它同时也是我的老师。**
练习是我自己写的，AI 负责评审；我犯的错和它犯的错都留在 git 历史里。

> **公开这个仓库是为了记录过程，不是把它当作品集。**
> 我的作品集是另外的仓库（在做）。
>
> 如果你在评估能力，请看两处：
> - `lab/exercises/` —— 我手写的实现
> - **git 历史** —— 真实的调试、翻车和修正，包括 AI 自己的错误

---

## 两个区

```
agent-lab/
├── teach/   课程站（TanStack Start + MDX，本地跑）
└── lab/     实验区：练习、工具、探针、脚手架
```

### `teach/` · 课程站

不是一份阅读清单，是一条动手路线。**交付单位是章**，不是节 —— 每章 2–4 小时能连续做完。

| | |
| --- | --- |
| 已写完 | 第 0 章《把机器接上》4 节：原生 API 的调用 / 流式 / 工具 / 账单 |
| 计划中 | 第 1–3 章（KV Cache、生产级客户端、从零手写 Agent Loop） |

```bash
cd teach
npm install
npm run dev        # http://localhost:3021
```

**技术选型有个实际理由**：这台机器 16GB，Next.js 的 Turbopack 冷编译会拉起几百个
postcss 子进程打满内存（见 `cloud-docs/AGENTS.md` 的实测记录）。Vite 走 esbuild，没这问题。
详见 `teach/README.md`。

### `lab/` · 实验区

所有动手的代码。**npm 命令都在这里跑。**

```bash
cd lab
nvm use            # 读 .nvmrc → Node 22（跑 .ts 需要 ≥22.18）
npm run check      # ★ 先跑这个：12 项环境自检，告诉你哪里没配好
```

```bash
npm run mock           # 终端 A：本地模拟 API，零成本试错
npm run ex:stream      # 终端 B：做第 0002 节的练习
```

| 命令 | 作用 |
| --- | --- |
| `npm run check` | 环境自检（只读，不花钱） |
| `npm run doctor` | **出问题时先跑这个** —— 从你当前 shell 把整条链路走一遍 |
| `npm run mock` | 本地模拟 API 服务器 —— **复刻了真 API 的校验和边界情况** |
| `npm run ex:stream` / `ex:tools` | 两个练习（自带自检，写完直接跑） |
| `npm run demo:naive` | 反面教材：看朴素 SSE 解析怎么**静默**丢掉 60% 内容 |
| `npm run api:basic` / `:stream` / `:tools` | 三个参考实现 |
| `npm run typecheck` | 类型检查（练习和参考实现都应该是零错误） |

#### 结构

```
exercises/   ← ★ 我写代码的地方
toolkit/     ← 工具和参考资料（mock 服务器、参考实现、探针台）
starters/    ← 脚手架
```

| 路径 | 是什么 |
| --- | --- |
| `exercises/01-raw-api/` | 练习：流式解析 + 工具调用往返（**我写的**） |
| `toolkit/mock-server.mjs` | 本地模拟 API。**保真度是刻意对齐过的**（见下） |
| `toolkit/reference/` | 三个参考实现 + `types.ts`（API 响应的完整类型） |
| `toolkit/demos/` | 反面教材 |
| `toolkit/cordis-probe/` | 插件机制探针台（7 个静默失败用例） |
| `starters/dsh-plugin-starter/` | DSH 插件脚手架 |
| `run.mjs` | 统一启动器：查 Node 版本 + 加载 .env + 判断 mock/真 API |

#### ⚠️ 不要用 `node --env-file=...`

`--env-file` **不覆盖** shell 里已有的环境变量。课程里的 curl 示例用了
`set -a; . ./.env; set +a`，那会把真 API 的地址和 key 导进当前 shell ——
之后 `--env-file=.env.mock` 会被**静默忽略**，请求打到真 API 上去。

`run.mjs` 是显式赋值的，不受影响。所以统一用 `npm run ex:*`。

#### 关于 `run.mjs`

直接用 `node --env-file=.env 文件.ts` 要求 Node ≥22.18，版本不对时报错完全看不懂：

```
Node 18  → node: bad option: --env-file=.env
Node 20  → node:internal/modules/esm/get_format:189
```

`run.mjs` 替你处理：**版本检查 → 加载 .env → 自动判断连 mock 还是真 API**。
所以命令就是 `npm run ex:stream`。

---

## 环境要求

- **Node ≥ 22.18**（`nvm use` 会读 `lab/.nvmrc`）
  - 跑 `.ts` 文件需要 ≥22.18（类型擦除默认开启）
  - 加载 `.env` 需要 ≥20.6
  - ⚠️ **`nvm` 的 default 常常指向 20 —— 那个版本跑不了 `.ts`**
- npm 源必须是公网（`.npmrc` 已配 `registry.npmjs.org`）
- `lab/.env` 里的 `DEEPSEEK_API_KEY`（`sk-` 开头）

```bash
cd lab
[ -f .env ] || cp .env.example .env    # ★ 幂等写法，别无条件 cp（会冲掉已填的 key）
```

---

## 相关

学习笔记沉淀在 Obsidian 里（不在这个仓库）。
