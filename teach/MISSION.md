# Mission: 从前端工程师转型为「前端 + Agent」复合型工程师

## Why

我在 Shopee 做了多年前端（SVX 组件库、性能优化、插件体系）。我想把下一步的职业生涯放在 Agent 方向，
目标公司是 **DeepSeek**。他们有两个岗位我都能投：**Harness 研发工程师**（Agent 运行时/评测）和
**Agent 前端工程师**（Agent 产品交互）。

我不想丢掉前端积累，也不想只做个「会调 API 的前端」——
我想成为**既能做 Agent 全链路、又能把模型的不确定性做成可读可控可信任的交互**的人。

## Success looks like

- **第 8 周**：投出第一份简历（前端岗保底），此时已有 1 个公开的开源作品
- **第 26 周**：能投 Harness 岗，简历上有一个**被真实使用过的 DSH 插件**
- 面试时能白板画出 Agent Loop 并解释每步的失败模式
- 能当场报出成本与延迟量级（「这个方案每天 100 万次请求约 X 元，P95 约 Y 秒」）
- 能读懂 DSH 源码，说得出「Harness 和 LangChain 的本质区别」

## Constraints

- **每周 10–15 小时**（有全职工作）
- **6 个月后投递**，时间盒是硬的
- **TypeScript 是主力**，Python 只要求「能读」——不要先花时间变成 Python 工程师
- 已有资产：两个 TypeScript MCP Server（其中一个已发布 npm），但都还没公开
- 环境已配好：Node 22 / dsh CLI / DeepSeek API key 可调通
- **学习偏好**：项目驱动。给我任务书 + 评审，我自己写代码。不要大段讲解替代动手

## Out of scope

- ML 训练、微调、从零实现 Transformer（面试几乎不问，见调研结论）
- Python 后端工程化（FastAPI 等）——不是 DeepSeek 的门槛
- 通用 Agent 市场要求的 RAG 深度（前期不做，等 P2）
- 框架的系统学习（LangChain/LangGraph）——先手写，再对照
