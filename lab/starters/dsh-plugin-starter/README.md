# DSH 插件最小脚手架

> **用途**：这是**教具，不是你的项目**。先把 DSH 插件的机制跑通、拆开看明白，再去设计你自己的插件。
> **状态**：本目录的挂载已用 `dsh --dump-config` 实测通过（2026-11-02）。
> **官方文档**：[[官方文档学习地图]] 的 `user/develop/` 一节

---

## 一、三个必须先解决的环境问题（实测踩出来的）

### ⚠️ 问题 1：Node 版本不够

你当前是 **v18.17.0**，但 DSH 的依赖要求更高：

| 依赖 | 要求 |
|---|---|
| `@earendil-works/pi-ai` | `>=22.19.0` |
| `undici@8.11.2` | `>=22.19.0` |
| `commander@15` | `>=22.12.0` |
| `sharp` / `chokidar@5` / `open@11` / `@modelcontextprotocol/client` | `>=20` |

**结论：需要 Node ≥ 22.19。**

好消息是你已经装好了：
```bash
nvm use 22        # 你机器上有 v22.23.2
node -v           # 应显示 v22.23.2
```

### ⚠️ 问题 2：npm 源是内网镜像，版本滞后

你的 npm registry 是 **`https://npm.shopee.io/`**（Shopee 内网镜像）。

实测差异：
| 源 | `@deepseek-ai/dsh` 的 latest |
|---|---|
| `npm.shopee.io`（你的默认） | **0.2.1-rc.2** |
| `registry.npmjs.org`（公网） | **0.2.1-rc.5** |

内网镜像同步滞后，`npx @deepseek-ai/dsh@0.2.1-rc.5` 会直接报 `ETARGET notarget`。

**解决办法**：加一个 **项目级 `.npmrc`**，或者每次带 `--registry`。

> [!warning] 实测踩到的坑：光有 `.npmrc` 不够
> npm **必须在目录里看到 `package.json`**，才会把该目录当作项目根、读取它的 `.npmrc`。
> 我一开始只放了 `.npmrc`，`npm config get registry` 依然返回内网源。
> 补上 `package.json` 后立刻生效，`npm config list` 会显示：
> ```
> ; registry = "https://npm.shopee.io/" ; overridden by project
> ; "project" config from .../agent-lab/lab/.npmrc
> registry = "https://registry.npmjs.org/"
> ```

```bash
# 方式 A：项目级（推荐）—— .npmrc + package.json 两个都要有
cd /Users/jiangdong.chen/Desktop/Personal/agent-lab/lab   # 该目录已有 package.json 和 .npmrc
npm config get registry        # 应输出 https://registry.npmjs.org/

# 方式 B：单次命令绕过
npx --yes --registry=https://registry.npmjs.org/ @deepseek-ai/dsh --help
```

**排查命令**：`npm config list | grep -iE 'project|registry'`
看到 `"project" config from .../.npmrc` 才算生效。

> [!warning] 这个坑不止影响 DSH
> 你以后装任何**刚发布不久**的公开 npm 包都可能撞上。养成习惯：装不上时先 `npm view <pkg> versions` 对比一下公网。

### ⚠️ 问题 3：不需要克隆 345MB 仓库

官方教程让你 `git clone` + `pnpm install` 整个 DSH 仓库。**实测不必。**

`@deepseek-ai/dsh` 本身只有 **0.1MB**（86 个依赖），而且有 `bin` 入口，可以直接用 npx 跑。

---

## 二、验证过的命令

```bash
# 0. 切 Node
nvm use 22

# 1. 【推荐】先验证插件挂载，不启动 UI —— 秒级返回
npx --yes --registry=https://registry.npmjs.org/ @deepseek-ai/dsh \
  --profile web \
  --patch /Users/jiangdong.chen/Desktop/Personal/agent-lab/lab/starters/dsh-plugin-starter/cordis.local.yml \
  --dump-config

# 2. 启动 Web UI，实际调用工具
npx --yes --registry=https://registry.npmjs.org/ @deepseek-ai/dsh \
  web --patch /Users/jiangdong.chen/Desktop/Personal/agent-lab/lab/starters/dsh-plugin-starter/cordis.local.yml
# 打开 http://127.0.0.1:3080
# 然后输入：Use the greet tool to greet Ada.
```

**`--dump-config` 实测输出**（这就是「挂载成功」的样子）：
```
# == .../dsh-plugin-starter/cordis.local.yml
- id: starter
    file:///Users/.../dsh-plugin-starter/src/index.js
- id: greet
    file:///Users/.../dsh-plugin-starter/src/greet-tool.js
```

> [!tip] `--dump-config` 是你以后的调试主力
> 插件没生效时，**先跑 `--dump-config`**，看它有没有出现在组合后的配置树里。
> 这一步比启动 UI 快得多，能立刻区分「插件没挂上」和「插件逻辑有问题」。

**其他有用的 dsh 参数**（实测自 `--help`）：

| 命令 | 用途 |
|---|---|
| `dsh --dump-config-schema` | 打印 profile 条目与 patch 的 JSON Schema |
| `dsh --dump-default-config` | 打印不含用户层与 overlay 的 profile 树 |
| `dsh headless "run the tests"` | 跑一个任务、打印结果、退出 |
| `dsh plugin --profile <name> add <pkg>` | 把插件装进某个 profile |
| `dsh rescue --from-default-profile web` | 配置搞坏了，重建 |

---

## 三、目录结构与每个文件的作用

```
dsh-plugin-starter/
├── package.json         ← 声明 dsh.bundle manifest（发布用）
├── cordis.patch.yml     ← 发布用 patch：按【包名】引用
├── cordis.local.yml     ← 本地开发用 overlay：按【绝对路径】引用  ★ 你先用这个
├── src/
│   ├── index.js         ← 最小插件（只打印一行）
│   └── greet-tool.js    ← 注册一个模型可调用的工具
└── README.md
```

### 插件的最小形态

```js
export const name = 'starter-plugin'
export function apply(ctx) {
  // 你通过 ctx 注册自己贡献的一切
}
```

**就这么多。** 一个插件 = 一个导出 `apply(ctx)` 的模块。框架在加载时调用它。

> [!warning] ★ `apply` 是**唯一入口**（2026-11-02 实测）
> 这条我实测过，而且**官方教程第 1 章的示例容易误导**：
>
> | 写法 | 结果 |
> |---|---|
> | `export function apply(ctx) {}` | ✅ 加载 |
> | `export default class X extends Service {}` | ✅ 加载 |
> | **`export class X extends Service {}`（只有类）** | ❌ **静默不加载**，无报错，registry 里都没有 |
>
> **类形式的 Service 必须在 `apply` 里用 `ctx.plugin()` 挂载**：
> ```js
> import { Service } from '@deepseek-ai/cordis'
> export const name = 'greeter'
>
> class GreeterService extends Service {
>   constructor(ctx) { super(ctx, 'greeter') }
>   greet(who) { return `Hello, ${who}!` }
> }
>
> export function apply(ctx) {
>   ctx.plugin(GreeterService)      // ★ 不能省
> }
> ```
>
> **为什么容易踩**：官方教程第 1 章为了展示「插件的三种形态」，只写了
> `export class MyService extends Service { ... }` 并注明「covered in chapter 3」。
> 只看第 1 章照着写就会卡住——**而失败是静默的**，你会以为是自己别的地方错了。
>
> 可复现：`cd ../cordis-probe && npm run probe:no-apply`

### 两种 patch 的区别（官方文档明确说明）

| 文件 | `name` 写什么 | 什么时候用 |
|---|---|---|
| `cordis.local.yml` | **绝对源码路径** | 本地开发（`--patch`） |
| `cordis.patch.yml` | **npm 包名** | 发布后（`dsh plugin add`） |

原因：patch 文件本身不改变 loader 解析模块路径的基准目录，所以本地开发必须用绝对路径。

### 依赖声明：`inject`

```js
export const name = 'greet-tool'
export const inject = ['tools']       // ← 等 tools 服务就绪后才调用 apply
export function apply(ctx) {
  ctx.tools.register({ /* ... */ })
}
```

> [!important] 一个容易误解的点
> `cordis.yml` 里的**条目顺序不保证加载顺序**。
> 真正的顺序由**服务依赖**（`inject`）决定，不是文件里的位置。
> 这是 Cordis 的设计：插件描述自己贡献什么，配置负责组合。

### 自动清理：`ctx.effect`

通过 `ctx` 注册的东西（事件、工具、定时器）在插件卸载时会**自动清理**。
需要显式清理的资源（网络连接等）用 `ctx.effect(() => { ...; return () => cleanup() })`。

### ★ 两个 manifest 键（2026-11-02 实测补全）

`package.json` 的 `dsh` 字段下**不止 `bundle`**：

```json
{
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },          // ← Node 侧（宿主）
    "client": {                                            // ← ★ 浏览器侧（我原先不知道）
      "inject": ["@deepseek-ai/dsh-client-locale", "@deepseek-ai/dsh-client-ui-slots"],
      "platform": "web"
    }
  }
}
```

| 键 | 作用 |
|---|---|
| `dsh.bundle.patch` | **Node/宿主侧**：声明这个包贡献哪一层 patch |
| **`dsh.client`** | **浏览器侧**：声明客户端半边要注入什么、跑在哪个平台 |

> [!important] 这是做带 UI 的插件的必需项
> 如果你的插件要往界面里插东西（用 [[DSH前端扩展地图]] 的插槽），
> **光有 `dsh.bundle` 不够，还需要 `dsh.client`**。
> 实测来源：`dsh-plugin@2.2.2` 的 manifest。

---

## 三·补、★ 发布与安装路径（2026-11-02 端到端实测）

我之前只写了「`dsh plugin add <package>`」。**实测这条命令会失败。**

### 坑：必须加 `-w`

| 命令 | 结果 |
|---|---|
| `dsh plugin --profile web add dsh-plugin` | ❌ `ERR_PNPM_ADDING_TO_ROOT` |
| `dsh plugin --profile web add **-w** dsh-plugin` | ✅ 成功 |

**原因**：profile 目录本身是一个 **pnpm workspace root**，往根上加依赖需要显式确认。

> [!warning] 官方文档和插件精选列表里写的都是**不带 `-w`** 的形式
> 比如 `dsh plugin --profile web add dshmarket`。
> **照抄会失败。** 加上 `-w` 就行。

### 完整的验证过的安装流程

```bash
# ① 装（-w 不能省）
dsh plugin --profile web add -w <包名>

# ② 它做了两件事：
#    a) 在 profile 目录执行 pnpm add -w <包名>
#    b) ★ 自动把这个包加进 profile 的 dsh.profile.bundles
cat ~/.dsh/profiles/web/package.json
# → "dsh": { "profile": { "bundles": [..., "<包名>"] } }

# ③ 验证它进了组合配置
dsh --profile web --dump-config | grep -A1 "<你的插件 id>"
```

**实测结果**（我用隔离 `DSH_HOME` 跑的，没碰你的真实配置）：
```
$ dsh plugin --profile web add -w dsh-plugin
dependencies:
+ dsh-plugin 2.2.2
Done in 2.3s

$ cat profiles/web/package.json
"bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-plugin"]   ← 自动加的

$ dsh --profile web --dump-config | grep dsh-plugin
    name: 'dsh-plugin'        ← 它的 patch 生效了
```

### ★ 隔离测试技巧（很有用）

**`DSH_HOME` 环境变量被尊重。** 所以你可以这样安全地试错，**不碰真实配置**：

```bash
DSH_HOME=/tmp/dsh-sandbox dsh --profile web --dump-config     # 会自动创建隔离 profile
DSH_HOME=/tmp/dsh-sandbox dsh plugin --profile web add -w <包名>
```

**装坏了直接 `rm -rf /tmp/dsh-sandbox` 重来。** 我推荐你以后所有插件安装测试都这么干。

### 分层顺序（官方 schema 里写着）

```
Bundle → profile → home → CLI
```
即：**包的 patch 先应用，然后是 profile、home、最后是命令行 overlay**。

---

## 三·补·二、★★ 客户端半边可以手写（推翻文档里的一条限制）

> **背景**：官方 `cookbook/adding-a-settings-card.zh.md` 里写着：
> > 生成它的 `clientBundle` tsdown 预设位于 `packages/client/tsdown.client.ts`，
> > 而**不在任何已发布的包里**，因此**仓库之外的包要自己复刻这一步构建**。
>
> 我核实了：`tsdown.client.ts` **确实在仓库里**（HTTP 200），发布的 npm 包里**确实没有**
> （`dsh-client-modules` 包里只有 5 个 `.d.ts` + 3 个 `.js`，无构建预设）。
>
> **但这句话不等于「必须用 tsdown」。** 我实测：**简单插件可以手写客户端半边。**

### 实测结论（端到端验证）

| 步骤 | 结果 |
|---|---|
| 手写 `client/client.js`（lazy-CJS 格式） | ✅ `node --check` 通过 |
| `package.json` 声明 `exports["./client"]` + `dsh.client` | ✅ |
| `dsh plugin add -w` 安装进隔离 profile | ✅ |
| **主机识别到 `dsh.client` 并注册进 boot graph** | ✅ `{"id":"dsh-plugin-starter","url":"plugins/??dsh-plugin-starter/client.js&rev=6846a5c23061"}` |
| **通过 combo 路由能取到内容** | ✅ **HTTP 200 / 1230 B**，内容含 `__ModuleLoader__` 与包名 |

### 手写格式（本目录的 `client/client.js` 就是能跑的实例）

```js
window.__ModuleLoader__.load({
  id: 'dsh-plugin-starter',      // ★ 必须是【裸包名】，与 package.json 的 name 完全一致
  factory: (require) => {
    const module = { exports: {} }
    const React = require('react')          // react 在 platform seed table 里，可直接 require
    // 在这里 slots.register / slots.inject …
    module.exports = { /* 你的导出 */ }
    return module.exports
  },
})
```

**关键规则**（来自 `packages/client/modules/README.md`）：
- 执行 bundle **只是注册 factory**；模块副作用在 materialization 时才跑
- `require()` 解析顺序：**platform seed table → 已 memoize 的记录 → boot graph 行 → 已注册的 factory**
- 两个 `client*.js` 输出之间**不能同步 require**
- **`dsh.client` 只挂在「说明符恰为裸包名」的那一行上**。从子路径导出挂载的行永远不带半侧

### 什么时候还是要用构建工具

| 场景 | 手写够吗 |
|---|---|
| 简单插槽注册、一次性 UI 片段 | ✅ 够 |
| 要 import 第三方库 / 拆多文件 | ⚠️ 需要打包（因为只能 require 平台表里的东西） |
| 要 `import()` 懒加载自己的 chunk | ⚠️ 需要 tsdown 生成的 `require.async` 格式 |
| 复杂 JSX 工程 | ⚠️ 手写会很难受（没有 JSX 编译） |

> [!important] 对你的选题意味着什么
> **如果做「轻 UI」的插件（往某个插槽挂一个面板/标签），你可以手写，不需要 345MB 仓库。**
> 这正好匹配「8 周内做出可用版本」的约束。
> 但如果要做重前端工程（多组件、路由、状态管理），还是得配构建。

---

## 四、跑通之后做什么

按官方 `docs/user/develop/` 的顺序往下走（全部有中文版）：

| 顺序 | 文档 | 内容 |
|---|---|---|
| 1 | `basic/index.zh.md` | 你的第一个插件 |
| 2 | `basic/config.zh.md` | 让插件可配置 |
| 3 | `basic/tool.zh.md` | **注册工具**（本目录的 `greet-tool.js` 就是它的简化版） |
| 4 | `basic/publish.zh.md` | **打包发布**（`dsh.bundle` manifest 的完整规则） |
| 5 | `framework/service.zh.md` | 服务 |
| 6 | `framework/events.zh.md` | 事件 |
| 7 | `practice/llm-adapter.zh.md` | **LLM 适配器** |
| 8 | `practice/dynamic-cordis.zh.md` | 动态 Cordis |

链接前缀：`https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/`

**进阶参考**：
- `cookbook/adding-a-tool.zh.md` —— 嵌套 schema、规范值、后台工作、策略钩子、UI 卡片
- `docs/subsystems/*.zh.md` —— 67 个子系统内部文档

---

## 五、练习（做完再来找我评审）

1. **改一行**：把 `src/index.js` 的 console.log 改成你的名字，跑 `--dump-config` 确认挂载，再启动 UI 看终端输出
2. **加一个工具**：在 `greet-tool.js` 里加第二个工具（比如 `add`，接收两个数字返回和），让模型调用它
3. **搞坏它**：把 `cordis.local.yml` 的路径改成错的，看报错长什么样；再用 `--dump-config` 确认你能从输出里看出问题
4. **回答三个问题**（写进你的 `01-raw-api/README.md` 或新开文件）：
   - 为什么 `cordis.local.yml` 必须用绝对路径，而 `cordis.patch.yml` 用包名？
   - `inject = ['tools']` 去掉会发生什么？为什么？
   - 条目顺序为什么不影响加载顺序？那顺序由什么决定？

---

## 六、参考

- 官方仓库：`github.com/deepseek-ai/deepseek-harness`
- 开发文档：`docs/user/develop/{basic,framework,practice}/`
- 插件精选列表：`github.com/awesome-dsh-plugin/awesome-dsh-plugin`
- 学习地图：[[官方文档学习地图]]
- 生态缺口分析：[[DSH插件生态缺口分析]]
