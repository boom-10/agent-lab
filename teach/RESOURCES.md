# Agent 工程 Resources

## Knowledge

### 一手权威（最高优先级）

- [DeepSeek Harness 官方文档](https://github.com/deepseek-ai/deepseek-harness/tree/master/docs)
  **本目标的头号资源。** MIT 开源、TypeScript。`docs/subsystems/` 有 207 个文件（69 个中文版），
  `docs/cordis-tutorial/` 7 章、`docs/cookbook/` 实操配方。
  用在哪：JD 的 11 个技术关键词（agent-lifecycle / compaction / tools / mcp / skills / subagent / plan / system-prompt / llm-streaming）全部 1:1 对应官方文档。
  ⚠️ 实测教训：**文档会滞后于代码**。我看到「26 个可注入服务」，实际运行时有 114 个。写代码前用 `cordis_inspect_query` 查实时契约。

- [DeepSeek API 文档](https://api-docs.deepseek.com)
  用在哪：原生 API 调用、流式、tool use、缓存计费。
  ⚠️ 实测陷阱：`thinking` 默认**开启**，开着时 `temperature` 无效、`max_tokens` 默认 64K。

- [Cordis 插件内核](https://github.com/cordiverse/cordis)
  DSH 的插件框架。用在哪：理解 `apply` 入口、`inject` 依赖、事件类型（waterfall/serial/emit）。

### 本地资料库（已核实，可直接查）

- **`~/Documents/Obsidian Vault/obsidian/Job/agent-transition/`**（28 个文件）
  前面调研的沉淀。**不要通读**，按需查：
  - `从这里开始.md` — 20 分钟看全貌
  - `01-目标岗位/` — JD 原文、官方情报、备选公司
  - `02-学习路径/` — P0 任务书、P1 全阶段任务书、官方文档地图
  - `04-项目实战/` — 选题三块底图（生态缺口 / 能力地图 / 前端扩展地图）
  - `06-面试冲刺/` — 30 题题单、简历翻译

- **`../../lab/`**（本仓库的实验代码）
  `01-raw-api/reference/` 三个参考实现 + `mock-server.mjs`（零成本试错）+ `cordis-probe/`（插件机制探针）

## Wisdom (Communities)

- ⚠️ **待确认**：用户尚未表示是否愿意参与社区。写入前先问。
  候选：DSH 的 GitHub Discussions、`dsh-plugin` 生态（插件需带 `dsh-plugin` topic 才能被收录）

## Gaps

- **没有找到中文的、系统的 Agent 工程课程**。调研了 15 个 JD 和多个课程平台，
  官方权威材料以英文 + Python 为主，而本目标主战场是 TypeScript + DSH。
  → 所以主要靠**官方文档 + 动手实验**，而不是现成课程。
- 用户已有资产（两个 TS MCP Server）尚未公开，没有社区反馈来源。
