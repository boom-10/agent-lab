// ✅ 正确写法：Service 必须通过 apply 里的 ctx.plugin() 挂载
import { Service } from '@deepseek-ai/cordis'

export const name = 'service-provider'

class OrderService extends Service {
  constructor(ctx) {
    super(ctx, 'orderService')
    console.log('  [provider] Service 构造，注册 orderService')
  }
  hello() { return '来自 provider 的服务' }
}

export function apply(ctx) {
  console.log('  [provider] apply 执行')
  ctx.plugin(OrderService)          // ★ 这一行是关键，不能省
}
