#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  练习 04 · 测你自己的 TTFT 曲线                                            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * 对应课程：第 0005 节《Prefill 与 Decode》
 *
 * 必须调真 API。mock 没有真实的 prefill 耗时，测出来没有意义。
 *   npm run ex:ttft
 * 总成本约 0.2 元（5 个尺寸 × 3 次，最大一档约 2.9 万 token）。
 *
 * ── 要测什么 ──
 * 输入越长，首字（TTFT）越晚。这就是 prefill 的代价。
 * 不要盯某个绝对数字，它会随时段漂移。要看的是「输入长度 → TTFT」的相对关系。
 *
 * ── 三件必须做的事 ──
 * ① 每次请求都在 system 最前面放一个随机 nonce，强制缓存 miss。
 *    不这么做，第 2、3 次会命中缓存，测出来的是「缓存后」的数字。
 * ② TTFT = 从发请求到收到第一个【有内容】的 delta 的时间。
 *    第一个 chunk 通常 content 是空串（只带 role），不能算进去。
 * ③ 每个尺寸跑 3 次，取最小值。网络抖动只会让数字变大，最小值更接近真实耗时。
 *
 * ── 怎么调试 ──
 * 先把 SIZES 改成只有 [0]，确认能拿到 TTFT，再恢复。
 * SSE 解析直接复用你在 stream.ts 里写的缓冲区逻辑。
 *
 * ── 常见错误对照 ──
 *   hit 不是 0           → nonce 没放在 system 最前面，或者没有真的随机
 *   TTFT 是 0 或极小      → 把第一个空 chunk 当成了首字
 *   各尺寸 TTFT 差不多    → 输入没真的变长。看 promptTokens 是否随 lines 增长
 */

export type Once = { ttftMs: number; promptTokens: number; hitTokens: number };
export type Row = {
  lines: number;
  promptTokens: number;
  ttftMinMs: number;
  hitTokens: number;
};

const SIZES = [0, 50, 200, 800, 1250]; // 资料条数。每条约 24 个 token
const RUNS = 3;
const KEY = process.env.DEEPSEEK_API_KEY;
const BASE = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";

if (!KEY) {
  console.error(
    "\n  ❌ 没读到 DEEPSEEK_API_KEY。请用 npm run ex:ttft 跑，它会替你读 .env。\n",
  );
  process.exit(1);
}

/** 造输入：lines 条资料。句式和第 0005 节的数据用的是同一种，方便你对照 */
function filler(lines: number): string {
  return Array.from(
    { length: lines },
    (_, i) =>
      `第 ${i + 1} 条资料：本系统的模块 ${i + 1} 负责数据校验，失败时返回结构化错误。`,
  ).join("\n");
}

// ══════════════════════════════════════════════════════════════════════════
//  TODO 1 · 测一次：发一个 lines 条资料的流式请求，返回 TTFT 与 usage
// ══════════════════════════════════════════════════════════════════════════
//
// 请求体要点（和 stream.ts 一样，外加一个 nonce）：
//   messages：system 里放 `[${nonce}] 无论收到什么资料，都只回答「一二三四五」。`
//             user 里放 filler(lines) + 「只回答「一二三四五」。」
//   thinking: { type: "disabled" }   ← 注意：写成 thinking: false 会被服务端 422 拒绝
//   stream: true；stream_options: { include_usage: true }
//   （少了 stream，服务端返回的是一整段 JSON，按 SSE 切会得到 0 个事件，usage 永远是 null）
//   max_tokens: 16（输出很短，所以 TTFT 几乎只由 prefill 决定）
//
// 返回值三个字段：
//   ttftMs      第一个【有内容】的 delta 的时间（毫秒），不是第一个 chunk 的时间
//   promptTokens  usage.prompt_tokens
//   hitTokens     usage.prompt_cache_hit_tokens   ← 注意不是 completion_tokens，那是输出 token 数
//
// 返回 undefined 表示「还没写」。

const body = (lines: number, nonce: string) => ({
  model: "deepseek-flash",
  messages: [
    {
      role: "system",
      content: `[${nonce}] 无论收到什么资料，都只回答「一二三四五」。`,
    },
    {
      role: "user",
      content: filler(lines) + "只回答「一二三四五」。",
    },
  ],
  thinking: false,
});
export async function measureOnce(
  _lines: number,
  _nonce: string,
): Promise<Once | undefined> {
  const nonce = Math.random().toString(36).slice(2, 10);
  const startedAt = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify(body(_lines, nonce)),
  });

  // 先检查状态码。不检查的话，4xx 的错误 JSON 会被当成 SSE 去切，
  // 结果是一个事件都切不出来，最后在 usage 上抛一个毫不相干的 TypeError。
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}\n${text.slice(0, 400)}`);
  }

  let firstTokenAt = 0;
  let buffer = "";
  let fullText = "";
  let chunks = 0;
  let usage: any = null;
  const decoder = new TextDecoder();

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
  if (!usage) {
    throw new Error(
      "没有收到 usage。按顺序检查：\n" +
        "  ① 请求体里有没有 stream: true\n" +
        "  ② 有没有 stream_options: { include_usage: true }\n" +
        "  ③ response 的 Content-Type 是 text/event-stream 吗（如果是 application/json，说明没走流式）",
    );
  }

  // ← 你的代码
  return {
    ttftMs: firstTokenAt,
    promptTokens: usage.prompt_tokens,
    hitTokens: usage.completion_tokens,
  }; // ← 写完替换这一行
}

// ══════════════════════════════════════════════════════════════════════════
//  TODO 2 · 对每个尺寸跑 RUNS 次，取最小 TTFT，返回一张表
// ══════════════════════════════════════════════════════════════════════════

export async function main(): Promise<Row[] | undefined> {
  const rows: Row[] = [];
  for (const lines of SIZES) {
    const runs: Once[] = [];
    for (let i = 0; i < RUNS; i++) {
      const nonce = Math.random().toString(36).slice(2, 10); // ★ 每次都不一样
      const r = await measureOnce(lines, nonce);
      if (!r) return undefined; // 还没写完
      runs.push(r);
    }
    rows.push({
      lines,
      promptTokens: runs[0]!.promptTokens,
      ttftMinMs: Math.min(...runs.map((r) => r.ttftMs)),
      hitTokens: Math.max(...runs.map((r) => r.hitTokens)),
    });
  }
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════
//  自检 —— 不用改
// ══════════════════════════════════════════════════════════════════════════

const rows = await main();

if (!rows) {
  console.log("\n  ⏳ 还没写完 —— measureOnce 还返回 undefined。");
  console.log("     写完 TODO 1，再跑 npm run ex:ttft。\n");
  process.exit(0);
}

console.log("\n  lines   promptTokens   TTFT(min/3)   边际 ms/千token   hit");
console.log("  " + "─".repeat(66));
rows.forEach((r, i) => {
  const prev = rows[i - 1];
  const marginal =
    prev && r.promptTokens > prev.promptTokens
      ? String(
          Math.round(
            ((r.ttftMinMs - prev.ttftMinMs) /
              (r.promptTokens - prev.promptTokens)) *
              1000,
          ),
        )
      : "—";
  console.log(
    `  ${String(r.lines).padStart(5)}   ${String(r.promptTokens).padStart(11)}   ` +
      `${String(r.ttftMinMs).padStart(9)}ms   ${marginal.padStart(14)}   ${r.hitTokens}`,
  );
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
checks.push({
  name: "测了 5 个尺寸",
  pass: rows.length === SIZES.length,
  detail: `${rows.length} 行`,
});

const maxT = Math.max(...rows.map((r) => r.promptTokens));
const minT = Math.min(...rows.map((r) => r.promptTokens));
checks.push({
  name: "尺寸跨度够大（最大 ÷ 最小 ≥ 10 倍）",
  pass: minT > 0 ? maxT / minT >= 10 : maxT >= 1000,
  detail: `${minT} → ${maxT} tokens`,
});
checks.push({
  name: "每个尺寸都是 miss（hit = 0）",
  pass: rows.every((r) => r.hitTokens === 0),
  detail: rows.map((r) => r.hitTokens).join(", "),
});
checks.push({
  name: "TTFT 都是正数",
  pass: rows.every((r) => r.ttftMinMs > 0),
  detail: rows.map((r) => r.ttftMinMs).join(", ") + " ms",
});
const first = rows[0]!;
const last = rows[rows.length - 1]!;
checks.push({
  name: "最大尺寸的 TTFT 比最小尺寸的大",
  pass: last.ttftMinMs > first.ttftMinMs,
  detail: `${first.ttftMinMs} → ${last.ttftMinMs} ms`,
});

console.log("\n  ─────────── 自检 ───────────\n");
for (const c of checks)
  console.log(`  ${c.pass ? "✅" : "❌"} ${c.name}  —  ${c.detail}`);
const failed = checks.filter((c) => !c.pass).length;
console.log();
if (failed === 0) {
  console.log(
    "  🎉 全部通过。把你的曲线和第 0005 节的表放在一起看：趋势应该一致，绝对值可以不同。\n",
  );
  process.exit(0);
}
console.log(`  ${failed} 项没过。对照文件开头的「常见错误对照」排查。\n`);
process.exit(1);
