export const name = 'probe-timer'
export const inject = ['timer']
export function apply(ctx) {
  console.log('✅ [probe-timer] apply 启动，ctx.timer =', typeof ctx.timer)
}
