# cordis-probe · 插件机制隔离验证台

> **用途**：在**不碰你 DSH 实例**（不动 `~/.dsh` 的会话与状态）的前提下，秒级验证 Cordis 插件机制。
> **为什么需要它**：实测发现 **Cordis 的插件失败是「静默」的**——没有报错、exit 0、插件还在 registry 里，但 `apply` 就是不执行。
> 在真实 DSH 里调试这个问题会浪费几小时；在这里是几秒。

---

## 一、为什么需要这个工具（实测证据）

用同一个插件文件结构，只改 `inject` 的内容：

| 用例 | 内容 | 结果 |
|---|---|---|
| `case-a-ok` | 最小插件（无依赖） | `✅ [ok-plugin] apply 被调用` |
| `case-d-real-service` | `inject: ['timer']`（**存在**） | `✅ apply 启动，ctx.timer = object` |
| **`case-e-silent-fail`** | `inject: ['tools']`（**裸 Cordis 里不存在**） | **没有任何 apply 输出** ⚠️ |
| `case-b-missing-service` | `inject: ['totallyFakeService']` | **没有任何 apply 输出** ⚠️ |
| `case-c-throws` | `apply` 里抛异常 | **异常被吞掉**，只剩 throw 前那行 log ⚠️ |
| **`case-g-class-without-apply`** | **只 `export class`，没有 `export apply`** | **插件完全不在 registry 里**，无任何报错 ⚠️ |

**四种失败用例的关键共同点**：

```
--- registry ---
[ 'Loader', 'isolate', 'Include', 'probe-tools' ]     ← 插件「在里面」
```

或（case-g）：

```
--- registry ---
[ 'Loader', 'isolate', 'Include' ]                     ← 插件「根本不在里面」
```

**两种情况都 exit code = 0，都没有任何错误输出。**

---

## 一·补、★ 新发现：`apply` 是唯一入口（2026-11-02 实测）

这一条是我在验证另一个断言时**意外挖出来的**，而且官方教程第 1 章的示例**容易误导**。

### 实测三种写法

| 写法 | 结果 |
|---|---|
| `export class MyService extends Service { ... }`（**只有类**） | ❌ **不加载**，无报错，registry 里没有 |
| `export default class MyService extends Service { ... }` | ✅ 加载成功 |
| `export function apply(ctx) { ... }` | ✅ 加载成功 |

### 正确写法（官方第 3 章的实际用法）

```js
import { Service } from '@deepseek-ai/cordis'

export const name = 'greeter'

class GreeterService extends Service {
  constructor(ctx) { super(ctx, 'greeter') }
  greet(who) { return `Hello, ${who}!` }
}

// ★ 唯一入口：类形式的 Service 必须在 apply 里用 ctx.plugin() 挂载
export function apply(ctx) {
  ctx.plugin(GreeterService)
}
```

> [!warning] 最容易踩的坑
> **`apply` 是插件的唯一入口。** 只 `export class` 而不写 `apply` ——
> **插件会静默地完全不加载**（连 registry 都进不去），而且**没有任何报错**。
>
> 官方教程第 1 章为了展示「插件的三种形态」，只写了
> ```ts
> export class MyService extends Service { constructor(ctx) { super(ctx, 'x') } }
> ```
> 并注明「covered in chapter 3」。**如果你只看第 1 章就照着写，会卡在这里。**
> 第 3 章才给出完整写法（`apply` + `ctx.plugin()`）。

---

## 一·补·二、顺带验证了「顺序不影响加载顺序」

`case-f-service-inject` 故意把 **consumer 排在 provider 前面**：

```yaml
- name: './plugins/p-service-consumer.js'    # ← 写在第一行
- name: './plugins/p-service-provider.js'
```

**实测执行顺序**（与反过来写完全一致）：
```
  [provider] apply 执行
  [provider] Service 构造，注册 orderService
  [consumer] apply 执行，拿到服务: 来自 provider 的服务
```

**结论**：加载顺序由 **`inject` 服务依赖**决定，不是文件里的位置。✅ 文档里的说法成立。

> [!warning] 这推翻了官方文档的说法
> 官方 Cordis 教程原文：
> > *"A plugin that fails to load is a loud failure, not a skipped entry."*
> > （加载失败的插件是响亮的失败，不是被跳过的条目）
>
> **实测不成立。** 边界说明：本探针是**裸 Cordis 启动器**，DSH 真实 harness 可能有自己的日志/UI 错误上报层；但 **Cordis 内核行为就是上面测到的这样**。

---

## 二、用法

```bash
cd ~/Desktop/Personal/agent-lab/lab/toolkit/cordis-probe

# 跑某个用例（会把该用例的配置拷成 cordis.yml）
cp case-e-silent-fail.yml cordis.yml
node probe.mjs

# 或直接改 cordis.yml 指向你自己的插件
```

**前置**：Node ≥ 22.19（`nvm use 22`）。`node_modules` 由 `agent-lab/lab/` 提供（`toolkit/` 只是个分类目录），无需单独安装。

---

## 三、`probe.mjs` 比官方 `bin.js` 多做了什么

官方 `node_modules/@deepseek-ai/cordis/bin.js` 只有 15 行，**默认静默**。本探针加了四件事：

| 增强 | 为什么 |
|---|---|
| `enableLogs: true` | 打开 loader 的 apply / reload / unload 日志 |
| `unhandledRejection` / `uncaughtException` 钩子 | 确认有没有异步错误被吞 |
| **延时 1.5s 后打印 registry** | 让异步加载落定，并看到**插件到底进没进注册表** |
| 打印每个存活插件的 `name` | 区分「没加载」和「加载了但 apply 没跑」 |

**最后一条是关键**——正因为打印了 registry，才发现「在注册表里 ≠ apply 跑过」。

---

## 四、调试插件的标准流程

```
① node probe.mjs                    ← 隔离环境先跑通机制
      ↓ 没输出？
② 逐个注释 inject 里的服务            ← 定位是哪个服务不存在
      ↓ apply 跑了但报错？
③ 用 try/catch 包住并打印             ← 因为异常会被吞
      ↓ 机制通了
④ npm run plugin:dump               ← 在真实 DSH 里确认条目挂上
      ↓
⑤ npx dsh web --patch ...           ← 最后才启动 UI
```

> [!important] 不要跳步
> 新手最常见的错误：直接写业务逻辑 → 启动 UI → 调试「为什么没效果」。
> 而问题可能在第 ① 步就没过。**先用隔离环境把机制跑通，再写业务。**

---

## 五、写真实插件时，第一段永远长这样

见 `plugins/p-probe-template.js`：

```js
export const name = 'my-plugin'
export const inject = ['tools']          // ← 按需改

export function apply(ctx) {
  console.log('[my-plugin] apply 启动')          // ① 证明 apply 真跑了
  console.log('[my-plugin] tools =', typeof ctx.tools)  // ② 确认依赖拿到
  try {
    // ③ 业务逻辑
  } catch (e) {
    console.error('[my-plugin] 出错:', e)        // ④ 否则错误会被吞
  }
}
```

**四行成本，省掉几小时。**

---

## 六、文件说明

```
cordis-probe/
├── probe.mjs                        ← 带日志与错误钩子的启动器
├── cordis.yml                       ← 当前生效的配置（从下面某个 case 拷来）
├── case-a-ok.yml                    ← 正常插件
├── case-b-missing-service.yml       ← inject 不存在的服务
├── case-c-throws.yml                ← apply 抛异常
├── case-d-real-service.yml          ← inject 存在的服务（成功对照）
├── case-e-silent-fail.yml           ← ★ 静默失败（最重要的一课）
├── case-f-service-inject.yml        ← ★ Service + inject，验证加载顺序
├── case-g-class-without-apply.yml   ← ★ 只 export class → 静默不加载
└── plugins/
    ├── p-ok.js
    ├── p-missing-service.js
    ├── p-throws.js
    ├── p-probe-timer.js
    ├── p-probe-tools.js
    ├── p-service-provider.js        ← ✅ Service 正确写法
    ├── p-service-consumer.js        ← ✅ inject 消费方
    ├── p-service-broken.js          ← ❌ 只 export class（反面教材）
    └── p-probe-template.js          ← 复制这个去写你的插件
```

---

## 七、这件事本身的意义

这是 JD 原文「**对正确性和代码质量要求高，习惯用测试、数据和可复核证据验证方案，而不只满足于功能能够运行**」的直接实践。

**官方文档也会不准。** 面试时你能说：

> 「我实测发现 Cordis 的 `inject` 失败是静默的——插件会出现在 registry 里但 `apply` 不执行，且 exit code 为 0。这和官方文档描述的『loud failure』不符。所以我给自己写了个隔离探针……」

这比背一百条八股都有说服力。

---

相关：[[DSH插件能力地图]] · [[官方文档学习地图]] · [[DSH插件生态缺口分析]]
