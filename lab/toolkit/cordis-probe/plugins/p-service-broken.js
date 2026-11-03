// ❌ 错误写法：只 export class，没有 apply
// 实测结果：插件【完全不在 registry 里】，且无任何报错 —— 静默失败
import { Service } from '@deepseek-ai/cordis'

export const name = 'service-broken'

export class BrokenService extends Service {
  constructor(ctx) {
    super(ctx, 'brokenService')
    console.log('  [broken] 如果这行出现了，说明它加载了')
  }
}
