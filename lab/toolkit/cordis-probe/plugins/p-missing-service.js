// 故意 inject 一个不存在的服务。
// 实测结果：apply 静默不执行，无报错，但插件仍出现在 registry 里。
export const name = 'missing-service-plugin'
export const inject = ['totallyFakeService']
export function apply(ctx) { console.log('⚠️ [missing-service] apply 被调用') }
