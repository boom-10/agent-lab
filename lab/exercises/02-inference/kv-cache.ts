#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  练习 03 · 手算 KV Cache 显存                                             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * 对应课程：第 0006 节《KV Cache 与显存》
 *
 * 纯计算，不需要 API key：
 *   npm run ex:kv
 *
 * ── 怎么做 ──
 * 1. 先算「每个 token、每一层」要存多少个数（元素个数）
 * 2. 乘以 层数 和 每个元素的字节数，得到「每个 token」的字节数
 * 3. 乘以上下文长度 和 batch，得到总字节数
 *
 * ── 怎么调试 ──
 * 每一步都 console.log 中间值。单位始终是字节，最后再换算成 KiB / MiB / GiB。
 *
 * ── 常见错误对照 ──
 *   结果差 2 倍          → 忘了 K 和 V 各存一份（MHA 要乘 2，已经写在公式里了）
 *   结果差 4 或 8 倍     → kvHeads 用成了 attention 头数。GQA 的关键就在 kvHeads
 *   MLA 结果大得离谱     → MLA 不存完整的 K 和 V，只存 latent 和 rope 两部分
 *   结果是 NaN           → 字段名拼错了。检查 Spec 的 kind 和字段名
 */

/** 模型的 KV 缓存规格。两种：标准多头（含 GQA），以及 MLA */
export type Spec =
  | { kind: 'mha'; layers: number; kvHeads: number; kDim: number; vDim: number; bytesPerElem: number }
  | { kind: 'mla'; layers: number; latentDim: number; ropeDim: number; bytesPerElem: number }

// ══════════════════════════════════════════════════════════════════════════
//  TODO 1 · 每个 token 在【所有层】里占多少字节？
// ══════════════════════════════════════════════════════════════════════════
//
// 提示：
//   MHA / GQA：每一层，K 有 kvHeads × kDim 个数，V 有 kvHeads × vDim 个数
//   MLA：      每一层，只有 latentDim + ropeDim 个数
//   然后乘以 layers，再乘以 bytesPerElem

export function kvBytesPerToken(spec: Spec): number | undefined {
  // ← 你的代码
  return undefined // ← 写完替换这一行
}

// ══════════════════════════════════════════════════════════════════════════
//  TODO 2 · 上下文长度 seqLen、batch 为 batch 时，总共占多少字节？
// ══════════════════════════════════════════════════════════════════════════

export function kvBytesForContext(spec: Spec, seqLen: number, batch = 1): number | undefined {
  // ← 你的代码（可以直接用 TODO 1 的结果）
  return undefined // ← 写完替换这一行
}

// ══════════════════════════════════════════════════════════════════════════
//  自检 —— 不用改
// ══════════════════════════════════════════════════════════════════════════

const KiB = 1024
const MiB = 1024 * KiB
const GiB = 1024 * MiB

const CASES = {
  llamaLike: { kind: 'mha', layers: 32, kvHeads: 32, kDim: 128, vDim: 128, bytesPerElem: 2 } as Spec,
  llamaGQA: { kind: 'mha', layers: 32, kvHeads: 8, kDim: 128, vDim: 128, bytesPerElem: 2 } as Spec,
  v3MLA: { kind: 'mla', layers: 61, latentDim: 512, ropeDim: 64, bytesPerElem: 2 } as Spec,
  // 假想：DeepSeek-V3 的维度，但用标准 MHA 存（128 头，K 维 192 = 128 nope + 64 rope，V 维 128）
  v3MHAHypo: { kind: 'mha', layers: 61, kvHeads: 128, kDim: 192, vDim: 128, bytesPerElem: 2 } as Spec,
}

type Check = { name: string; pass: boolean; detail: string }
const checks: Check[] = []

function expectNear(name: string, got: number | undefined, want: number, show: (n: number) => string): void {
  if (got === undefined) {
    checks.push({ name, pass: false, detail: '还没写（返回 undefined）' })
    return
  }
  const pass = Math.abs(got - want) < 1
  checks.push({ name, pass, detail: pass ? show(got) : `${show(got)}，应为 ${show(want)}` })
}

const fmtB = (n: number) => `${n.toLocaleString('en-US')} B`
const fmtMiB = (n: number) => `${(n / MiB).toFixed(0)} MiB`
const fmtGiB = (n: number) => `${(n / GiB).toFixed(2)} GiB`

expectNear('MHA 每 token = 512 KiB', kvBytesPerToken(CASES.llamaLike), 524288, fmtB)
expectNear('MHA 4K 上下文 = 2 GiB', kvBytesForContext(CASES.llamaLike, 4096), 2 * GiB, fmtGiB)
expectNear('GQA（8 个 KV 头）每 token = 128 KiB', kvBytesPerToken(CASES.llamaGQA), 131072, fmtB)
expectNear('GQA 4K 上下文 = 512 MiB', kvBytesForContext(CASES.llamaGQA, 4096), 512 * MiB, fmtMiB)
expectNear('DeepSeek-V3 MLA 每 token = 70,272 B', kvBytesPerToken(CASES.v3MLA), 70272, fmtB)
expectNear('DeepSeek-V3 MLA 128K 上下文 ≈ 8.58 GiB', kvBytesForContext(CASES.v3MLA, 131072), 9210691584, fmtGiB)
expectNear('假想 MHA（同维度）每 token ≈ 4.77 MiB', kvBytesPerToken(CASES.v3MHAHypo), 4997120, (n) => `${(n / MiB).toFixed(2)} MiB`)

const hypo = kvBytesPerToken(CASES.v3MHAHypo)
const mla = kvBytesPerToken(CASES.v3MLA)
if (hypo === undefined || mla === undefined) {
  checks.push({ name: '假想 MHA ÷ MLA ≈ 71 倍', pass: false, detail: '前面还没写完' })
} else {
  const ratio = hypo / mla
  checks.push({ name: '假想 MHA ÷ MLA ≈ 71 倍', pass: Math.abs(ratio - 71.1) < 0.2, detail: `${ratio.toFixed(1)} 倍` })
}

console.log('\n  ─────────── 自检 ───────────\n')
for (const c of checks) console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}  —  ${c.detail}`)
const failed = checks.filter((c) => !c.pass).length
console.log()
if (failed === 0) {
  console.log('  🎉 全部通过。你算出来的数字和第 0006 节一致。\n')
  process.exit(0)
}
console.log(`  ${failed} 项没过。对照文件开头的「常见错误对照」排查。\n`)
process.exit(1)
