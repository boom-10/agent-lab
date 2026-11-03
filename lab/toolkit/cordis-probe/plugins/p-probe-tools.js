export const name = 'probe-tools'
export const inject = ['tools']   // 裸 Cordis 没有 tools 服务 → apply 永不执行，且无任何报错
export function apply(ctx) {
  console.log('⚠️ [probe-tools] 如果这行出现了，说明 tools 服务存在')
}
