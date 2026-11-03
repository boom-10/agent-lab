// 裸 Cordis 启动器 —— 隔离验证插件机制，不碰 ~/.dsh 的会话与状态。
// 相比官方 bin.js，这里多了：enableLogs、错误钩子、registry 打印、延时等待。
// 用法：node probe.mjs
process.on('unhandledRejection', (e) => console.log('🔴 unhandledRejection:', e?.message ?? e))
process.on('uncaughtException',  (e) => console.log('🔴 uncaughtException:',  e?.message ?? e))

import { Context } from '@deepseek-ai/cordis'
import { pathToFileURL } from 'node:url'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'

const ctx = new Context()
ctx.baseUrl = pathToFileURL(process.cwd()).href + '/'
await ctx.plugin(Loader)
await ctx.plugin(Include, { path: './cordis.yml', initial: [], enableLogs: true })

// 给异步加载留时间，然后打印存活插件
await new Promise(r => setTimeout(r, 1500))
console.log('--- registry ---')
try {
  console.log([...ctx.registry.values()].map(p => p?.name ?? String(p)))
} catch (e) { console.log('读取 registry 失败:', e.message) }
