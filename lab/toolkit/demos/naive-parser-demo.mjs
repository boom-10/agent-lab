/**
 * ⚠️ 反面教材 —— 故意写错的 SSE 解析器。
 *
 * 跑它之前先启动 mock：  npm run mock
 * 然后跑：              npm run demo:naive
 *
 * 你会看到：它【不报错】、【拿到了 [DONE]】、【拿到了 usage】，
 *           但拼出来的文本是【残缺的】。
 *
 * 这就是为什么 SSE 解析必须做【缓冲】——一个事件可能被 TCP 切成几段，
 * 你不能假设每次 read() 拿到的就是一整条 `data: {...}\n\n`。
 *
 * 你的任务（P0 追问 5）：写出【正确】的版本，让它跟 mock 对打还能读出完整文本。
 */

const res = await fetch('http://127.0.0.1:39001/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer sk-mock' },
  body: JSON.stringify({
    model: 'deepseek-flash',
    stream: true,
    stream_options: { include_usage: true },
    messages: [{ role: 'user', content: '你好' }],
  }),
})

const EXPECTED = '这是模拟服务器返回的一段流式文本，用来验证 SSE 解析是否正确。'

let text = ''
let parseFailures = 0
let fragments = 0
let sawDone = false
let usage = null

const decoder = new TextDecoder()
for await (const piece of res.body) {
  fragments++
  const s = decoder.decode(piece, { stream: true })

  // ★★★ 这里就是 bug ★★★
  // 直接按 \n\n 切，假设每次 read 拿到的都是完整事件。
  // TCP 不保证这件事。
  for (const part of s.split('\n\n')) {
    if (!part.startsWith('data: ')) continue
    const payload = part.slice(6)
    if (payload === '[DONE]') { sawDone = true; continue }
    try {
      const j = JSON.parse(payload)
      const delta = j.choices?.[0]?.delta?.content
      if (delta) text += delta
      if (j.usage) usage = j.usage
    } catch {
      parseFailures++      // JSON 被切断了
    }
  }
}

const ok = text === EXPECTED
console.log('\n  ───── 反面教材的运行结果 ─────\n')
console.log(`  收到的 TCP 片段数 : ${fragments}`)
console.log(`  JSON 解析失败次数 : ${parseFailures}   ${parseFailures ? '← 有事件被切断了' : ''}`)
console.log(`  拿到 [DONE] 了吗  : ${sawDone ? '✅ 拿到了' : '❌ 没拿到'}`)
console.log(`  拿到 usage 了吗   : ${usage ? `✅ hit=${usage.prompt_cache_hit_tokens}` : '❌ 丢了'}`)
console.log()
console.log(`  期望文本 : ${JSON.stringify(EXPECTED)}`)
console.log(`  实际文本 : ${JSON.stringify(text)}`)
console.log(`  完整吗   : ${ok ? '✅' : '❌ 【丢字了】'}`)
console.log()
if (!ok) {
  console.log('  ⚠️ 注意它【没有抛异常】、【退出码是 0】、【[DONE] 和 usage 都拿到了】。')
  console.log('     它只是安静地丢掉了 60% 的内容。')
  console.log('     生产环境里这种 bug 最难查 —— 没有报错，只有用户说「回答怎么怪怪的」。')
  console.log()
  console.log('  → 你的任务：写一个正确的版本，让「完整吗」变成 ✅')
  console.log('     提示：你需要一个跨 read 的缓冲区。想想该在什么时候清空它。')
}
console.log()
