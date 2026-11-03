# Agent 学习 · 课程站

> ### ⚠️ AI 生成声明
>
> **`src/content/` 下的课程内容由 AI 生成。**
> 站点代码（TanStack Start 应用）由 AI 搭建、学习者审阅调试。
>
> 这是学习记录，不是作品集。完整声明见仓库根 `README.md`。

从零到 Agent 工程师的课程内容站。**TanStack Start + Vite + MDX。**

```bash
nvm use 24
npm install
npm run dev          # http://localhost:3021
```

## 技术栈

| | |
|---|---|
| 框架 | **TanStack Start** 1.169 + TanStack Router 1.170（类型安全路由） |
| 构建 | **Vite 8**（esbuild + Rollup） |
| 内容 | **MDX** via `@mdx-js/rollup` + `remark-gfm` + `rehype-pretty-code`(Shiki) |
| 样式 | **Tailwind CSS v4**（`@theme` token） |

### ★ 为什么不用 Next.js

这台机器 16GB，装了 `codex-node-guard`（>150 node 进程或 >12GB RSS 会 SIGTERM）。
`cloud-docs/AGENTS.md` 记录了 Turbopack 冷编译拉起约 **320 个 postcss 子进程、合计 ~16.4GB RSS**
被守护脚本杀掉的事故。

**实测对比：**

| | Next.js + Nextra | **TanStack Start + Vite** |
|---|---|---|
| 依赖数 | 739 包 | **293 包** |
| 安装 | 2 分钟 | **42 秒** |
| dev 启动 | 数十秒 | **1.8 秒** |
| 生产构建 | 分钟级 | **315ms + 130ms** |

另外 TanStack Router 的**类型安全路由**是当下 React 生态的差异化标签，
比「又一个 Next 站」更能说明前端工程能力。

## 目录结构

```
src/
├── routes/
│   ├── __root.tsx           ← 外壳挂载点（MDXProvider + DocShell）
│   ├── index.tsx            ← 首页（课程卡片）
│   └── $.tsx                ← ★ catch-all：所有内容页由它接管
├── content/
│   ├── manifest.ts          ← ★ 课程清单：侧栏顺序的唯一来源
│   ├── lessons/*.mdx        ← 课程正文
│   └── reference/*.mdx      ← 速查卡
├── components/
│   ├── DocShell.tsx         ← 顶栏 + 左（课程目录）+ 右（本页内容）
│   ├── Toc.tsx              ← 右侧 TOC + 滚动高亮
│   └── Quiz.tsx             ← 测验组件
├── mdx-components.tsx       ← MDX 里可直接用的组件映射
├── lib/content.ts           ← MDX 加载（见下方「踩过的坑」）
└── styles/app.css           ← Tailwind v4 token + 排版
scripts/
└── check-mdx.mjs            ← prebuild 跑的内容检查
```

## 加一课

**两步，不用碰路由：**

```bash
# 1. 写内容
$EDITOR src/content/lessons/0002-streaming.mdx

# 2. 加进清单（去掉 wip: true）
$EDITOR src/content/manifest.ts
```

侧栏、上一课/下一课、首页卡片、页面标题**全部自动**。

> `check-mdx` 会双向校验：manifest 里有的必须有文件，有文件的必须进 manifest。
> 漏一步 build 就会失败并告诉你漏在哪。

## MDX 里能用的组件

```mdx
<Eyebrow>第 0001 课 · 约 15 分钟</Eyebrow>

# 标题

<Lede>导语，字号大一点、颜色浅一点。</Lede>

<Callout kind="do" title="现在就做">…</Callout>     {/* kind: note | do | warn | good */}

<Quiz
  n={1} of={3}
  q="题干"
  options={['选项甲', '选项乙', '选项丙']}
  answer={1}
  ok="答对时的解释"
  no="答错时的引导"
/>
```

**Quiz 的三条约定**（别破坏，否则会从格式上泄露答案）：
选项字数尽量等长 · 正确项位置打散 · 不用粗体或排序暗示。

## 命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器 :3021 |
| `npm run build` | 生产构建（自动跑 `check:mdx`） |
| `npm run preview` | 预览构建产物 |
| `npm run check:mdx` | 内容检查（manifest 对齐 / 站内链接 / 锚点重复） |
| `npm run check:responsive` | Playwright 实测 8 个视口，打印正文宽与间隙 |
| `npm run typecheck` | `tsc --noEmit` |

## 布局：为什么是这三个宽度

三栏的每个数值都**算过**，不是随手定的。核心约束是**正文阅读宽必须 ≥704px**：
中文一行少于 35 字读起来断断续续，多于 42 字会串行。实测当前 **36–38 字/行**。

| 视口 | 列 | rail | gap | 正文 | 侧栏→正文 |
|---|---|---|---|---|---|
| 1024 | 2 | 12rem | 2rem | 704 | 80px |
| 1280 | 3 | **13rem** | 2rem | 704 | 56px |
| 1440 | 3 | 15rem | 3rem | 704 | 104px |
| 1680+ | 3 | 15rem | 4rem | 704 | **120px** |

> ⚠️ **1280 那档特意用 13rem 而不是 15rem。**
> 最初用 240px rail，实测正文被挤到 **672px**（低于舒适区下限），
> 而侧栏到正文只剩 40px —— 外面留白 190px 却挤里面。改窄 rail 后正文回到 704。

**一个刻意的取舍**：窗口变宽时，多出来的空间给**间隙**，不给正文。
所以你会看到 1680 和 1920 的正文一样宽，只是两侧更松。长行比宽边距更伤阅读。

同一原则也用在容器上：`max-width: 92rem`（1472px）。定这个值是为了让
侧栏到正文的间隙落在 100–130px —— **明显分开，但不至于断成两块**。

验证方式不是肉眼看，是跑：

```bash
npm run check:responsive     # Playwright 实测 8 个视口，打印正文宽与间隙
```

它会输出每个尺寸下的栏位可见性、正文宽、间隙、横向溢出。

## 可访问性

`.prose` 与侧栏的全部文字都过了 WCAG AA：

| 元素 | 对比度 | 要求 |
| --- | --- | --- |
| 正文 / 链接 / 代码 | 7.5 – 17.1 | 4.5 |
| 侧栏小字 / TOC 未选中 | 4.7 | 4.5 |
| 强调色 | 6.1 | 3 |

> 三级灰阶刻意排开：`ink` 17.1 / `ink-soft` 7.5 / `ink-faint` 4.7。
> `ink-faint` 原来是 `#8b8b96`（3.25:1，**不合格**），换成 `#71717a` 才过线。

另外：`:focus-visible` 有 2px 强调色焦点环（键盘导航可见）、
`prefers-reduced-motion` 被尊重、数字统一 `tabular-nums`（这门课通篇是测量值，
`1536` 和 `242` 要能一眼扫出量级差）。

## 字体：为什么不用 webfont

`ui-ux-pro-max` 的数据库推荐 `JetBrains Mono + IBM Plex Sans`，**没有采用**，两个原因：

1. **Google Fonts 在国内不可用** —— 加载会失败，页面回退得不可预期。
2. 中文字体的 webfont 体积以 MB 计，对本地课程站不值得。

正文用系统栈（macOS 的 PingFang SC 在中文屏上质量很高）；
等宽只用于**数据**（代码、token 数、百分比）—— 这一门课通篇在讲测量值，
用等宽是内容决定的，不是装饰。

## 踩过的坑

**① loader 里不能返回 React 组件**

第一版把 MDX 组件放进路由 loader 的返回值，SSR 报：

```
SerovalUnsupportedTypeError: Seroval Error (specific: 1)
value: [Function: MDXContent]
```

TanStack Start 要**序列化 loader 数据**传给客户端，函数不能序列化。
现在改成 `import.meta.glob(..., { eager: true })`，组件在服务端和客户端各自解析。

代价是所有内容进首包（当前 gzip 111 kB）。课程量级完全可接受；
真要优化，再按路由做代码分割。

**② 端口**

`cloud-docs` 占了 3020，本站用 **3021**。

**③ 右侧 TOC 是客户端渲染的**

它扫渲染后的 DOM 生成，SSR 阶段拿不到。所以 `curl` 看不到「本页内容」，
浏览器里正常。这是刻意取舍：作者不用维护任何标题清单。
