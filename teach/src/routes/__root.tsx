/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import { MDXProvider } from '@mdx-js/react'
import { DocShell } from '@/components/DocShell'
import { mdxComponents } from '@/mdx-components'
import appCss from '@/styles/app.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Agent 学习' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <MDXProvider components={mdxComponents}>
        <DocShell />
      </MDXProvider>
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
