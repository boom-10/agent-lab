/**
 * MDX 内容加载。
 *
 * ⚠️ 踩过的坑：一开始我把 MDX 组件放进路由 loader 的返回值里，
 * 结果 SSR 报 `SerovalUnsupportedTypeError: [Function: MDXContent]` ——
 * TanStack Start 要序列化 loader 数据传给客户端，**函数不能序列化**。
 *
 * 现在的做法：eager glob，组件在服务端和客户端各自独立解析，不走序列化。
 * 代价是所有课程内容都进首包；课程站的内容本身就是应用主体，
 * 20 课量级完全可接受。真要优化，再按路由做代码分割。
 */

export type DocModule = {
  default: React.ComponentType<Record<string, unknown>>
  frontmatter?: Record<string, unknown>
}

const pages = import.meta.glob<DocModule>('../content/**/*.mdx', { eager: true })

const PREFIX = '../content/'

/** 取一课的内容模块；不存在返回 null */
export function getDoc(slug: string): DocModule | null {
  return pages[`${PREFIX}${slug}.mdx`] ?? null
}

/** 所有内容的 slug（不含首页） */
export function allSlugs(): string[] {
  return Object.keys(pages)
    .map((k) => k.slice(PREFIX.length).replace(/\.mdx$/, ''))
    .filter((s) => s !== 'index')
    .sort()
}
