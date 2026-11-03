// 故意在 apply 里抛异常。
// 实测结果：异常被吞掉，无报错，插件仍出现在 registry 里。
export const name = 'throwing-plugin'
export function apply(ctx) {
  console.log('👉 [throwing] apply 进入了')
  throw new Error('boom from apply')
}
