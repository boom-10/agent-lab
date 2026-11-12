#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  练习 05 · 能扛的客户端：超时、重试、取消                                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * 对应课程：第 0008、0009 节
 *
 * 不花钱。全部打在本地故障服务器上（故意 429 / 500 / 慢 / 断流）。
 *
 *   # 终端 1
 *   npm run fault:server
 *   # 终端 2
 *   npm run ex:client
 *
 * ── 三个 TODO ──
 * TODO 1  classify()   把一次失败归类成 retry / fatal / cancel
 * TODO 2  callOnce()   发一次请求，带超时，把「非 2xx」也变成错误
 * TODO 3  callWithRetry()  按分类重试，遵守 Retry-After，指数退避 + 抖动
 *
 * ── 必须做到的六件事（自检会逐条验）──
 * ① 429 和 500 要重试；400 这种「你发错了」不许重试
 * ② 超时要重试，但要受总的重试次数限制
 * ③ 用户取消（AbortSignal）一次都不许重试 —— 重试等于无视用户
 * ④ 429 带 Retry-After 时，等够它说的秒数再试
 * ⑤ 两次重试之间要退避（不能连发），并且要有上限
 * ⑥ 断流（读到一半连接没了）也算可重试，但已经吐出去的内容不能算数
 *
 * ── 怎么调试 ──
 * 先把 maxAttempts 设成 1 跑一遍，确认能拿到单次的错误类型；
 * 再放开重试，看 attempts 是不是按预期增长。
 *
 * ── 常见错误对照 ──
 *   attempts 一直是 1        → 你的 classify 把可重试的错误当成了 fatal
 *   取消之后还在重试          → 没区分 AbortError 和 TimeoutError
 *   Retry-After 被忽略        → 用的是固定 200ms 退避，没读响应头
 *   报 TypeError: terminated  → 断流没被 catch，或者被当成 fatal
 */

const BASE = process.env.FAULT_BASE ?? "http://127.0.0.1:39002";
const url = (scenario: string) => `${BASE}/chat/completions?${scenario}`;

export type Kind = "retry" | "fatal" | "cancel";

/** 客户端自己抛的错误，带上分类，方便上层决定怎么办 */
export class ClientError extends Error {
  kind: Kind;
  status?: number;
  retryAfterMs?: number;

  // 注意：这里不能用 constructor(public kind: Kind) 那种「参数属性」写法，
  // Node 的 --experimental-strip-types 只剥类型、不做语法转换，会直接报错。
  constructor(
    kind: Kind,
    message: string,
    status?: number,
    retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ClientError";
    this.kind = kind;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export type CallOk = { ok: true; text: string; attempts: number };

// ══════════════════════════════════════════════════════════════════════════
//  TODO 1 · 把一个未知错误归类
// ══════════════════════════════════════════════════════════════════════════
//
// 输入 e 可能是：DOMException、TypeError、你抛的 ClientError。
// 已经测出来的事实（第 0008 节有完整表）：
//   超时          → e.name === 'TimeoutError'
//   用户取消      → e.name === 'AbortError'
//   断流/连接没了  → TypeError，message 是 'terminated' 之类
//   你抛的 ClientError → 直接用它自己的 kind
//
// 返回 undefined 表示「还没写」。

export function classify(e: unknown): Kind | undefined {
  return e instanceof Error && e.name === "TimeoutError"
    ? "retry"
    : e instanceof Error && e.name === "AbortError"
      ? "cancel"
      : e instanceof TypeError && e.message.includes("terminated")
        ? "retry"
        : e instanceof ClientError
          ? e.kind
          : undefined;
}

// ══════════════════════════════════════════════════════════════════════════
//  TODO 2 · 发一次请求
// ══════════════════════════════════════════════════════════════════════════
//
// 要求：
//   · 用 fetch 打 `${url(scenario)}`，POST，body 带 { model:'x', stream:true, messages:[...] }
//   · 传入 signal（由调用方给，可能已经合了超时）
//   · 响应 res.ok 为 false 时，**自己抛 ClientError**：
//       - 429 → kind 'retry'，把 res.headers.get('retry-after') 秒数换算成毫秒存进 retryAfterMs
//       - 400 / 401 / 422 → kind 'fatal'
//       - 500 / 502 / 503 → kind 'retry'
//   · res.ok 为 true 时，把整个 SSE 流读完，返回 { text, status }
//       text 是所有 delta.content 拼起来的**纯内容**，不是原始 SSE 文本
//       （解析方式就是你在 01-raw-api/stream.ts 里写过的那套：按 \n\n 切事件、取 data: 后面的 JSON）
//   · 别忘了 Content-Type: application/json。故障服务器不在意，真 API 会拒
//
// 返回 undefined 表示「还没写」。

export async function callOnce(
  scenario: string,
  signal: AbortSignal,
): Promise<{ text: string; status: number } | undefined> {
  const response = await fetch(url(scenario), {
    method: "POST",
    body: JSON.stringify({ model: "x", stream: true, messages: [] }),
    signal,
  });
  return { text: await response.text(), status: response.status };
}

// ══════════════════════════════════════════════════════════════════════════
//  TODO 3 · 带重试的调用
// ══════════════════════════════════════════════════════════════════════════
//
// 契约（自检就是按这个验的，别搞错）：
//   成功   → 返回 { ok: true, text, attempts }
//   失败   → **抛出** ClientError，并带上正确的 kind。不要用返回值表示失败。
//   还没写 → 返回 undefined
//
// 为什么失败要抛而不是返回？因为调用方应该能用同一套 try/catch 处理
// 「网络异常」和「服务端拒绝」；一半靠返回值、一半靠异常，调用方就得写两套逻辑。
//
// 要求：
//   · 最多尝试 maxAttempts 次
//   · 每次等待：如果是 429 且拿到了 retryAfterMs，就用它；否则用指数退避
//       第 1 次重试等 baseMs，第 2 次等 baseMs*2，第 3 次等 baseMs*4……
//       加一点随机抖动，避免所有客户端同时重试
//   · 总等待时间有上限（比如 5 秒），超了就放弃
//   · classify 为 'fatal' 时立刻抛，不重试
//   · classify 为 'cancel' 时立刻抛，不重试（用户已经取消了）
//   · 把用到的尝试次数放在返回值里
//
// 返回 undefined 表示「还没写」。

export async function callWithRetry(
  scenario: string,
  opts: { timeoutMs: number; maxAttempts: number; baseMs?: number; signal?: AbortSignal },
): Promise<CallOk | undefined> {
  const baseMs = opts.baseMs ?? 200
  const MAX_WAIT_TOTAL = 5000
  let waited = 0 // 已经等了多少毫秒，用来守总预算

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    // ① 这次尝试用的 signal
    //    · 没传 opts.signal → 直接用 AbortSignal.timeout(opts.timeoutMs)
    //    · 传了 opts.signal → 用 AbortSignal.any([...]) 合成「用户取消」和「超时」
    //    ★ 每次循环都新建，不要提到循环外面（超时从创建那一刻开始算）
    const signal = undefined as unknown as AbortSignal // ← 你写

    try {
      // ② 发一次。callOnce 是 TODO 2，它负责把「非 2xx」变成 ClientError 抛出来
      const r = await callOnce(scenario, signal)
      if (!r) throw new Error('TODO 2 还没写')

      // ③ 成功：返回结果，并告诉调用方用了几次
      return { ok: true, text: r.text, attempts: attempt }
    } catch (e) {
      // ④ 这次失败是什么身份？classify 是 TODO 1
      const kind = classify(e) ?? 'fatal'

      // ⑤ 不该重试（fatal / cancel），或已经是最后一次 → 抛出去，别再循环
      //    ★ 必须抛 ClientError，自检读的是它的 kind
      if (kind !== 'retry' || attempt === opts.maxAttempts) {
        // ← 你写（抛 ClientError）
      }

      // ⑥ 该重试：算这次等多久
      //    · 429 且带 retryAfterMs → 用它
      //    · 否则 baseMs × 2^(attempt−1)，再加 ±20% 随机抖动
      const delay = 0 // ← 你写

      // ⑦ 守总预算：等下去会超过 MAX_WAIT_TOTAL 就放弃
      if (waited + delay > MAX_WAIT_TOTAL) {
        // ← 你写（抛 ClientError）
      }

      waited += delay
      await new Promise((r) => setTimeout(r, delay))
    }
  }

  // 兜底：理论上走不到（最后一次会在 ⑤ 抛）
  throw new ClientError('retry', '用完了重试次数')
}

// ══════════════════════════════════════════════════════════════════════════
//  自检 —— 不用改
// ══════════════════════════════════════════════════════════════════════════

// flaky 的计数在服务器上是全局的，每次跑自检前先清零
await fetch(`${BASE}/reset`).catch(() => {});

const checks: { name: string; pass: boolean; detail: string }[] = [];
const ok = (name: string, pass: boolean, detail: string) =>
  checks.push({ name, pass, detail });

async function expectError(fn: () => Promise<unknown>, want: Kind) {
  try {
    await fn();
    return { pass: false, detail: "没有抛错" };
  } catch (e) {
    return {
      pass: (e as ClientError)?.kind === want,
      detail: `kind=${(e as ClientError)?.kind ?? "?"}`,
    };
  }
}

const cl = classify;

if (cl(Object.assign(new Error("x"), { name: "TimeoutError" })) === undefined) {
  console.log("\n  ⏳ 还没开始写 —— TODO 1 的 classify() 还返回 undefined。");
  console.log("     写完之后再跑 npm run ex:client。\n");
  process.exit(0);
}

{
  // TODO 1 单独验：三个错误源
  const timeout = Object.assign(new Error("x"), { name: "TimeoutError" });
  const abort = Object.assign(new Error("x"), { name: "AbortError" });
  const term = new TypeError("terminated");
  ok(
    "classify(TimeoutError) = retry",
    cl(timeout) === "retry",
    `得到 ${cl(timeout)}`,
  );
  ok(
    "classify(AbortError) = cancel",
    cl(abort) === "cancel",
    `得到 ${cl(abort)}`,
  );
  ok(
    "classify(TypeError terminated) = retry",
    cl(term) === "retry",
    `得到 ${cl(term)}`,
  );
}

const r1 = await callWithRetry("scenario=ok", {
  timeoutMs: 3000,
  maxAttempts: 3,
});
if (r1) {
  ok("正常请求一次成功", r1.ok && r1.attempts === 1, `attempts=${r1.attempts}`);
  ok(
    "拿到了回复内容",
    r1.ok && r1.text.includes("一二三四五"),
    `text=${r1.ok ? r1.text : "-"}`,
  );
}

const r2 = await callWithRetry("scenario=flaky&times=2", {
  timeoutMs: 3000,
  maxAttempts: 4,
});
if (r2)
  ok(
    "500 连续两次后成功（应为 3 次尝试）",
    r2.ok && r2.attempts === 3,
    `attempts=${r2.attempts}`,
  );

const e400 = await expectError(
  () => callWithRetry("scenario=400", { timeoutMs: 3000, maxAttempts: 3 }),
  "fatal",
);
if (e400.detail !== "kind=?")
  ok("400 不重试，归为 fatal", e400.pass, e400.detail);

const e429 = await expectError(
  () => callWithRetry("scenario=429", { timeoutMs: 3000, maxAttempts: 2 }),
  "retry",
);
if (e429.detail !== "kind=?")
  ok("429 用完重试次数后放弃", e429.pass, e429.detail);

{
  const c = new AbortController();
  setTimeout(() => c.abort(), 100);
  const e = await expectError(
    () =>
      callWithRetry("scenario=slow&ms=1200", {
        timeoutMs: 5000,
        maxAttempts: 3,
        signal: c.signal,
      }),
    "cancel",
  );
  if (e.detail !== "kind=?") ok("用户取消后不再重试", e.pass, e.detail);
}

const eTimeout = await expectError(
  () =>
    callWithRetry("scenario=slow&ms=1200", { timeoutMs: 300, maxAttempts: 3 }),
  "retry",
);
if (eTimeout.detail !== "kind=?")
  ok("超时归类为 retry，并最终放弃", eTimeout.pass, eTimeout.detail);

console.log("\n  ─────────── 自检 ───────────\n");
for (const c of checks)
  console.log(`  ${c.pass ? "✅" : "❌"} ${c.name}  —  ${c.detail}`);
const failed = checks.filter((c) => !c.pass).length;
console.log();
if (failed === 0) {
  console.log(
    "  🎉 全部通过。这个客户端现在能进生产了（第 0009 节会讲它还有什么没解决）。\n",
  );
  process.exit(0);
}
console.log(`  ${failed} 项没过。对照文件开头的「常见错误对照」排查。\n`);
process.exit(1);
