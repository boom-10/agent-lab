// DSH 插件的最小形态。
// 一个插件 = 一个导出了 apply(ctx) 的模块。框架在加载时调用 apply，
// 你通过 ctx 注册自己贡献的一切（工具、命令、事件、服务……）。
// 通过 ctx 注册的东西，在插件卸载时会被框架自动清理。

export const name = 'starter-plugin'

export function apply(ctx) {
  console.log('[starter-plugin] 插件已加载！')

  // 演示 ctx.effect：需要显式清理的资源（定时器/连接）这样写。
  // 返回的函数会在插件卸载时执行。
  ctx.effect(() => {
    const t = setInterval(() => {}, 60_000)
    return () => clearInterval(t)
  })
}
