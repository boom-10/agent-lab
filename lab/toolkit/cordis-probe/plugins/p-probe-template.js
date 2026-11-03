// ★ 探针模板：每个真实插件的第一段都该长这样。
export const name = 'my-plugin'
export const inject = ['tools']          // ← 按需改

export function apply(ctx) {
  console.log('[my-plugin] apply 启动')   // ① 证明 apply 真的跑了
  console.log('[my-plugin] tools =', typeof ctx.tools)  // ② 确认依赖拿到
  // ③ 业务逻辑写这里；建议用 try/catch 包住并打印，否则错误会被吞
}
