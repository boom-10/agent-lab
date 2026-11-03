// 手写的客户端半边（lazy-CJS factory 格式）—— 不需要构建工具。
//
// 依据：packages/client/modules/README.md 的「Lazy-CJS model」一节
//   执行 bundle 只是注册 factory；模块副作用在 materialization 时才跑。
//   require() 的解析顺序：platform seed table → 已 memoize 的记录 → boot graph 行 → 已注册的 factory。
//   react 在 platform seed table 里，所以可以 require('react')。
window.__ModuleLoader__.load({
  id: 'dsh-plugin-starter',          // ← 必须是【裸包名】，与 package.json 的 name 一致
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')

    // 演示：注册一个插槽。这里挂到 settings.section（高频槽位之一）。
    // 真实插件里你会用 slots.inject('你关心的槽位', () => slots.register({...}, Component))
    const inject = globalThis.__DSH_SLOT_INJECT__

    function Hello() {
      return React.createElement('div', null, '[starter] 客户端半边已加载')
    }

    module.exports = { Hello }
    return module.exports
  },
})
