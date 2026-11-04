// 探针：只观察，不干预。
//
// 目的：回答「这三个控制点到底什么时候触发、payload 长什么样」。
// 官方文档说了它们能做什么，但没说清调用时机与顺序 —— 那是实测才能知道的。

export const name = 'probe-turn-hooks'

const T0 = Date.now()
const ts = () => String(Date.now() - T0).padStart(6) + 'ms'
const log = (...a) => console.log(`[probe ${ts()}]`, ...a)

/** payload 可能很大，只描述形状，不打印全部 */
function shape(o, depth = 0) {
  if (o === null) return 'null'
  if (o === undefined) return 'undefined'
  if (typeof o !== 'object') return typeof o
  if (depth > 1) return '…'
  if (Array.isArray(o)) return `[${o.length} × ${o[0] ? shape(o[0], depth + 1) : '?'}]`
  const keys = Object.keys(o)
  return `{ ${keys.slice(0, 10).join(', ')}${keys.length > 10 ? ', …' : ''} }`
}

export function apply(ctx) {
  log('插件已加载')

  // ── 观察：生命周期 ──
  ctx.on('agent/created', (p) => log('agent/created      ', shape(p)))
  ctx.on('agent/disposed', (p) => log('agent/disposed     ', shape(p)))
  ctx.on('agent/status', (p) => log('agent/status       ', shape(p)))

  // ── ★ 三个控制点 ──
  // serial：在「本来已完成的回合关闭前」运行，可以 steer 让它保持打开
  ctx.on('agent/turn-stopping', (p) => {
    log('★ turn-stopping    turn=', p?.turn, ' keys=', shape(p))
  })
  // waterfall：可拒绝一个 proposed step，或替换进入它的 messages
  ctx.on('agent/pre-step', (p) => log('★ pre-step         ', shape(p)))
  // 可重试失败的模型请求
  ctx.on('agent/request-error', (p) => log('★ request-error    ', shape(p)))

  // ── 观察：流与会话 ──
  ctx.on('agent/assistant-stream', (p) => log('assistant-stream   ', shape(p)))
  ctx.on('session/created', (p) => log('session/created    ', shape(p)))
  ctx.on('session/event', (p) => log('session/event      ', shape(p)))

  ctx.on('dispose', () => log('插件卸载'))
}
