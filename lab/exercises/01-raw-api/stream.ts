#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  练习 01 · 流式解析与 TTFT                                                ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * 对应课程：第 0002 节《流式：为什么回答是一个字一个字蹦出来的》
 * 对应任务：P0 任务 0.3 —— 原生 API 调用的第二个动作
 *
 * 你只需要填 main() 里的 4 个 TODO。写完直接跑，脚本会自检。
 *
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  怎么跑
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 【推荐】先用本地 mock 调 —— 免费、无限次、而且它会故意给你制造边界情况
 *
 *   终端 A:  cd ~/Desktop/Personal/agent-lab/lab && npm run mock
 *   终端 B:  cd ~/Desktop/Personal/agent-lab/lab && node --env-file=.env.mock exercises/01-raw-api/stream.ts
 *
 * 最后确认真实行为时，调一次真 API：
 *
 *   cd ~/Desktop/Personal/agent-lab/lab
 *   node --env-file=.env exercises/01-raw-api/stream.ts
 *
 * 用 run.mjs 跑，它会替你处理三件事：
 *
 *   ① 检查 Node 版本（跑 .ts 要 ≥22.18；你默认的 node 是 18，会报 bad option）
 *   ② 加载 .env（不用 --env-file，也就没有「当前目录不对」的坑）
 *   ③ 自动判断该连 mock 还是真 API（mock 在跑就用 mock）

 * 想直接用 node 也行，但要自己保证 Node ≥22.18 且带对 --env-file。
 *
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  开发中怎么调试（重要）
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **直接在 main() 里 console.log 就行。** 那是你自己的代码，随时可以加。
 *
 * 你会看到自己的输出，后面跟一句「ℹ️ 自检已跳过」——
 * **那不是报错**，只是因为 main() 还没 return 结果，自检没东西可检。
 *
 * 为什么这么设计：自检读的是 **main() 的返回值**，不是你打印了什么。
 * 这样它才能判断「你有没有真的拼出那段文本」，而不是「你有没有跑起来」。
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  怎么调试
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 先打印再判断。遇到问题时，最快的定位方式是**把每一步的中间状态打出来**：
 *
 *   • 怀疑请求有问题     → 打印 body 和 res.status
 *   • 怀疑事件切分有问题  → 打印每次 read 拿到的**原始字符串**，看它长什么样
 *   • 怀疑拼接丢了内容    → 打印每次「切出去的事件」和「留回的残片」
 *
 * ── 常见报错对照表（先看这里，能省你半小时）────────────────────────────────
 *
 *   看到什么                                    病因
 *   ──────────────────────────────────────────  ──────────────────────────────
 *   SyntaxError: Unexpected end of JSON input   你把**半条**事件当完整事件解析了。
 *                                               → 缓冲区没做对。见 TODO 3 的 ①
 *
 *   中文变乱码                                   TextDecoder 少了 { stream: true }
 *                                               → 见 TODO 3 的 ②
 *
 *   文本少了几个字，但不报错                     有事件被丢掉。
 *                                               → 检查是不是每轮都把 buffer 清空了
 *
 *   usage 是 null                               stream_options.include_usage 没开
 *
 *   401 / Authentication Fails                  KEY 没读到。见上面坑 ①
 *
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 💡 想看「静默丢数据」长什么样，跑一下反面教材：
 *      npm run demo:naive
 *    那个版本加了 try/catch，所以**不报错、退出码 0**，只是安静地丢掉 60% 的内容。
 *    生产环境里最难查的就是那种 —— 没有报错，只有用户说「回答怎么怪怪的」。
 *
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  验收标准（脚本会自动检查）
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   1. 不用任何 SDK，只用 Node 原生 fetch
 *   2. 跑 mock 时能**完整拼出文本**，一字不差
 *   3. 拿到 TTFT、总耗时、chunk 数、usage
 *
 * 💡 这个文件在你没写完时**没有类型错误**。填的过程中 TypeScript 会提示你
 *    main() 该返回什么 —— 用得上就用，那是白送的。
 */

// ══════════════════════════════════════════════════════════════════════════
//  0 · 配置与前置检查（已经写好，不用改）
// ══════════════════════════════════════════════════════════════════════════

const BASE = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
const KEY = process.env.DEEPSEEK_API_KEY;

// 这就是坑 ①：忘了 --env-file 时 Node 不报错，只给你 undefined。
// 不检查的话，你会带着空 key 发请求，拿到 401，然后怀疑是 key 的问题。
if (!KEY) {
  console.error(
    "\n  ❌ 没读到 DEEPSEEK_API_KEY\n\n" +
      "     八成是忘了 --env-file。正确写法：\n" +
      "       mock:  node --env-file=.env.mock exercises/01-raw-api/stream.ts\n" +
      "       真 API: node --env-file=.env      exercises/01-raw-api/stream.ts\n\n" +
      "     而且必须在 lab/ 目录下跑（--env-file 是相对当前目录的）。\n",
  );
  process.exit(1);
}

const IS_MOCK = BASE.includes("127.0.0.1") || BASE.includes("localhost");

/** mock 会返回一句固定的话；自检靠它比对（已验证两次输出完全一致） */
const MOCK_EXPECTED =
  "【我只收到 1 条消息】你说的是「用一句话说明什么是流式输出」。" +
  "我看不到之前的任何对话，所以如果这句是追问，我无法知道你在问什么。";

/** 你要发的这句话。别改 —— mock 的返回值依赖它 */
const QUESTION = "用一句话说明什么是流式输出";

// ══════════════════════════════════════════════════════════════════════════
//  类型定义（已经写好，不用改）
// ══════════════════════════════════════════════════════════════════════════
//
// main() 要返回这些东西。TypeScript 会拿它检查你 —— 少一个字段会报错，
// 字段类型不对也会报错。这是好事，不是麻烦。

type Usage = {
  prompt_tokens: number;
  prompt_cache_hit_tokens: number;
  prompt_cache_miss_tokens: number;
};

type StreamResult = {
  /** 拼出来的完整文本 */
  fullText: string;
  /** 收到多少个 TCP 片段（不是事件数，是 read() 的次数） */
  chunks: number;
  /** 第一个 token 的延迟，毫秒 */
  ttftMs: number;
  /** 从发请求到流结束，毫秒 */
  elapsedMs: number;
  /** 最后一个非 null 的 usage */
  usage: Usage | null;
};

// ══════════════════════════════════════════════════════════════════════════
//  ★ 你的代码写在这里
// ══════════════════════════════════════════════════════════════════════════

async function main(): Promise<StreamResult | undefined> {
  // ────────────────────────────────────────────────────────────────────────
  //  TODO 1 · 构造请求体
  // ────────────────────────────────────────────────────────────────────────
  //
  // 需要 5 个字段：
  //   model            —— 用 'deepseek-flash'
  //   messages         —— 一条 user 消息，内容是上面的 QUESTION
  //   thinking         —— 关掉它。为什么？见第 0001 节的「已知陷阱」
  //   stream           —— 这次要流式，所以要 true
  //   stream_options   —— ★ 不开这个，整条流里**拿不到任何 token 统计**
  //
  // 提示：第 0001 / 0002 节里都有完整的请求体样例。想不起来就回去翻。
  //
  const body = {
    model: "deepseek-flash",
    messages: [{ role: "user", content: QUESTION }],
    thinking: { type: "disabled" },
    stream: true,
    stream_options: { include_usage: true },
  };

  // ────────────────────────────────────────────────────────────────────────
  //  TODO 2 · 发请求，并记录 TTFT 要用的时间点
  // ────────────────────────────────────────────────────────────────────────
  //
  // - 端点：`${BASE}/chat/completions`
  // - 请求头：Content-Type、Authorization（Bearer ${KEY}）
  // - 失败时**先看原始 body** 再下结论：`await res.text()`，不要猜
  //
  // ★ TTFT 怎么测：
  //   发请求前记 T0；**收到第一个有内容的 delta** 时记 T1；T1 - T0 就是 TTFT。
  //   注意不是「收到第一个 chunk」—— 第一个 chunk 的 content 是空字符串
  //   （它只带 role）。这个坑我踩过。
  //
  const startedAt = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify(body),
  });

  // ────────────────────────────────────────────────────────────────────────
  //  TODO 3 · ★ 核心：把字节流拼成事件
  // ────────────────────────────────────────────────────────────────────────
  //
  // 这里是整个练习的重点，也是第 0002 节的全部内容。
  //
  // 三件必须做对的事：
  //
  //   ① **跨 read 的缓冲区**
  //      每次 read 拿到的不是一条事件，可能只是半条。
  //      你要把「还没等到分隔符的残片」留到下一轮。
  //      → 第 0002 节有可点的演示，忘了就回去点一遍
  //
  //   ② **TextDecoder 的 { stream: true }**
  //      少了它，被切断的中文会变乱码。
  //      注意这和 ① 是**两个不同层面**的问题：
  //      ① 是「事件被切断」，② 是「字符被切断」。
  //
  //   ③ **过滤空 delta 和 [DONE]**
  //      每个 chunk 的 delta.content 可能是空的（第一个 chunk 就是）。
  //      拼进文本前要判空，否则会多出看不见的字符。
  //
  let fullText = "";
  let chunks = 0;
  let usage: Usage | null = null;
  let firstTokenAt: number | undefined;
  let buffer = ""; // ★ 跨 read 的缓冲区
  const decoder = new TextDecoder();
  //
  for await (const piece of res.body as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(piece, { stream: true });

    const parts = buffer.split("\n\n") || [""];
    // 处理完整的事件
    for (let i = 0; i < parts.length - 1; i++) {
      const line = parts[i] || "";
      if (line.length > 0 && line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") {
          // 流结束
          break;
        }
        if (!firstTokenAt && JSON.parse(data).choices[0].delta.content !== "") {
          firstTokenAt = Date.now() - startedAt;
        }
        try {
          const chunk = JSON.parse(data);
          if (chunk.usage) {
            usage = chunk.usage;
          }
          // 处理 chunk
          chunks++;
          fullText += chunk.choices[0].delta.content || "";
        } catch (e) {
          console.error("解析 chunk 失败:", e);
        }
      }
    }
    // 保留不完整的最后一部分
    buffer = parts[parts.length - 1] || "";
  }

  // ────────────────────────────────────────────────────────────────────────
  //  TODO 4 · 返回结果（顺便打印给人看）
  // ────────────────────────────────────────────────────────────────────────
  //
  // 自检靠**返回值**，不靠打印。但打印出来你自己看得见，建议留着：
  //
  console.log(`  TTFT        ${firstTokenAt} ms`);
  console.log(`  总耗时       ${Date.now() - startedAt} ms`);
  console.log(`  chunk 数     ${chunks}`);
  console.log(
    `  usage       hit=${usage?.prompt_cache_hit_tokens} miss=${usage?.prompt_cache_miss_tokens}`,
  );
  console.log(`  文本        ${fullText}`);

  return {
    fullText,
    chunks,
    ttftMs: firstTokenAt ?? 0,
    elapsedMs: Date.now() - startedAt,
    usage,
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  自检 —— 不用改，也不用删
// ══════════════════════════════════════════════════════════════════════════

const result = await main();

if (!result) {
  // 学习者常常误以为这是报错。它不是 ——
  // 他自己的 console.log 已经打完了，这里只是说「自检没东西可检」。
  console.log("")
  console.log("  ℹ️  自检已跳过（main() 还没 return 结果）—— 这不是报错。")
  console.log("     你上面的输出都是正常的。")
  console.log("     写完 4 个 TODO 并把最后一行改成 return { ... }，自检就会跑。")
  console.log("")
  process.exit(0)
}

type CheckResult = { name: string; pass: boolean; detail?: string };
const results: CheckResult[] = [];
const check = (name: string, pass: boolean, detail?: string): void => {
  results.push({ name, pass, detail });
};

check(
  "拼出的文本非空",
  result.fullText.length > 0,
  `长度 ${result.fullText.length}`,
);
check("chunk 数 > 0", result.chunks > 0, `${result.chunks} 个片段`);
check("TTFT 已测量", result.ttftMs > 0, `${result.ttftMs} ms`);

if (IS_MOCK) {
  check(
    "★ 文本与期望值一字不差",
    result.fullText === MOCK_EXPECTED,
    result.fullText === MOCK_EXPECTED
      ? "完全一致"
      : `\n       期望: ${JSON.stringify(MOCK_EXPECTED)}\n       实际: ${JSON.stringify(result.fullText)}`,
  );
  check(
    "usage 拿到了（说明 stream_options 开对了）",
    result.usage !== null,
    result.usage
      ? `hit=${result.usage.prompt_cache_hit_tokens}`
      : "没拿到 —— 检查 stream_options.include_usage",
  );
} else {
  check(
    "（真 API 模式）文本非空即通过",
    result.fullText.length > 10,
    `长度 ${result.fullText.length}`,
  );
}

console.log("\n  ─────────── 自检 ───────────\n");
for (const r of results) {
  console.log(
    `  ${r.pass ? "✅" : "❌"} ${r.name}${r.detail ? `  —  ${r.detail}` : ""}`,
  );
}
const failed = results.filter((r) => !r.pass).length;
console.log();

if (failed === 0) {
  console.log(
    "  🎉 全部通过。把这几个数字记进你的 README，然后进第 0003 节。\n",
  );
  if (IS_MOCK) {
    console.log("     最后调一次真 API 确认真实行为一致（停掉 mock 再跑）：");
    console.log("       npm run ex:stream\n");
  }
  process.exit(0);
} else {
  console.log(`  ${failed} 项没过。\n`);
  if (IS_MOCK) {
    console.log("  排查顺序建议：");
    console.log(
      "    1. 先打印每次 read 拿到的原始字符串 —— 确认你看到了「被切断的事件」",
    );
    console.log(
      "    2. 再打印每轮的「切走」和「留回」—— 确认残片真的留到了下一轮",
    );
    console.log("    3. 对照文件开头的「常见报错对照表」\n");
  }
  process.exit(1);
}
