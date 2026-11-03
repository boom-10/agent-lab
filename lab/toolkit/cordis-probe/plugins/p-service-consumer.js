// ✅ 消费方：用 inject 声明依赖，Cordis 会等到服务就绪后才调用 apply
export const name = 'service-consumer'
export const inject = ['orderService']       // ★ 依赖声明 —— 决定加载顺序的是它，不是文件里的位置

export function apply(ctx) {
  console.log('  [consumer] apply 执行，拿到服务:', ctx.orderService.hello())
}
