import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import mdx from '@mdx-js/rollup'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import rehypeSlug from 'rehype-slug'
import rehypePrettyCode from 'rehype-pretty-code'

// 为什么是 Vite 而不是 webpack/Turbopack：
// 本机 16GB，且装了 codex-node-guard（>150 node 进程或 >12GB RSS 会 SIGTERM）。
// cloud-docs 的 AGENTS.md 记录了 Turbopack 冷编译拉起约 320 个 postcss 子进程、
// 合计 ~16.4GB RSS 被守护脚本杀掉的事故。Vite 走 esbuild + Rollup，没有这个问题。
export default defineConfig({
  server: { port: 3021, strictPort: false },
  resolve: { tsconfigPaths: true },
  plugins: [
    // MDX 必须排在 React 之前，否则 JSX 转译顺序不对
    mdx({
      remarkPlugins: [remarkFrontmatter, remarkGfm],
      rehypePlugins: [
        rehypeSlug, // 给标题加 id，右侧 TOC 靠它
        [rehypePrettyCode, { theme: 'github-light', keepBackground: false }],
      ],
      providerImportSource: '@mdx-js/react',
    }),
    tailwindcss(),
    tanstackStart(),
    // React 插件必须在 Start 之后
    viteReact(),
  ],
})
