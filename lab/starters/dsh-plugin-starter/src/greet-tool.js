// 注册一个模型可以调用的工具。
// 关键点：export const inject = ['tools'] 让 Cordis 等工具注册表就绪后
// 才调用 apply —— 这就是「依赖声明」，位置顺序不保证加载顺序。

export const name = 'greet-tool'
export const inject = ['tools']

export function apply(ctx) {
  ctx.tools.register({
    name: 'greet',
    description: 'Greet someone by name.',
    parameters: {
      name: { type: 'string', required: true, description: 'The name to greet' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      return `Hello, ${args.name}!`
    },
  })
}
