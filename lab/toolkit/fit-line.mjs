#!/usr/bin/env node
/**
 * 最小二乘拟合一条直线：y = a + b·x
 *
 *   npm run fit -- 32:576 1183:648 4633:671 18432:1084 29286:1270
 *
 * 每对写成「x:y」。对 TTFT 曲线，x 用 token 数、y 用毫秒，
 * 输出的斜率就是 ms/千token，截距是与输入长度无关的固定开销。
 *
 * 加 --steps 会打印每一步的中间值（Σx、Σy、Σx²、Σxy、R² 的分子分母）。
 */

const args = process.argv.slice(2).filter((a) => a !== "--steps");
const steps = process.argv.includes("--steps");

const pairs = args.map((a) => {
  const [x, y] = a.split(":").map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    console.error(`\n  ❌ 看不懂这个参数：${a}（应写成 x:y，例如 1183:648）\n`);
    process.exit(1);
  }
  return [x, y];
});

if (pairs.length < 2) {
  console.error("\n  用法：npm run fit -- 32:576 1183:648 4633:671\n  至少两个点。\n");
  process.exit(1);
}

const n = pairs.length;
// x 换算成「千」，这样斜率直接是 ms/千token
const xs = pairs.map(([x]) => x / 1000);
const ys = pairs.map(([, y]) => y);

const Sx = xs.reduce((s, v) => s + v, 0);
const Sy = ys.reduce((s, v) => s + v, 0);
const Sxx = xs.reduce((s, v) => s + v * v, 0);
const Sxy = xs.reduce((s, v, i) => s + v * ys[i], 0);

const xb = Sx / n;
const yb = Sy / n;
const num = n * Sxy - Sx * Sy;
const den = n * Sxx - Sx * Sx;
const b = num / den;
const a = yb - b * xb;

const ssRes = xs.reduce((s, v, i) => s + (ys[i] - (a + b * v)) ** 2, 0);
const ssTot = ys.reduce((s, v) => s + (v - yb) ** 2, 0);
const r2 = 1 - ssRes / ssTot;

if (steps) {
  console.log("\n  ── 中间值 ──");
  console.log(`  n = ${n}`);
  console.log(`  Σx = ${Sx.toFixed(4)}   Σy = ${Sy}`);
  console.log(`  Σx² = ${Sxx.toFixed(4)}   Σxy = ${Sxy.toFixed(2)}`);
  console.log(`  x̄ = ${xb.toFixed(4)}   ȳ = ${yb.toFixed(2)}`);
  console.log(`  b = (${n}×${Sxy.toFixed(2)} − ${Sx.toFixed(4)}×${Sy}) / (${n}×${Sxx.toFixed(4)} − ${Sx.toFixed(4)}²)`);
  console.log(`    = ${num.toFixed(2)} / ${den.toFixed(2)} = ${b.toFixed(4)}`);
  console.log(`  a = ȳ − b·x̄ = ${yb.toFixed(2)} − ${b.toFixed(4)}×${xb.toFixed(4)} = ${a.toFixed(2)}`);
  console.log(`  SS_res = ${ssRes.toFixed(1)}   SS_tot = ${ssTot.toFixed(1)}`);
}

console.log(`\n  y ≈ ${a.toFixed(0)} + ${b.toFixed(1)}·x        （x 以「千」为单位）`);
console.log(`  换算：每千 token ${b.toFixed(1)} ms，prefill 吞吐约 ${(1000 / b).toFixed(1)} 千 token/秒`);
console.log(`  R² = ${r2.toFixed(4)}\n`);
console.log("      x(千)     实测 y     拟合 y     残差");
console.log("  " + "─".repeat(44));
pairs.forEach(([x, y], i) => {
  const fitY = a + b * xs[i];
  console.log(
    `  ${String(x).padStart(9)}  ${String(y).padStart(9)}  ${fitY.toFixed(0).padStart(9)}  ${(y - fitY).toFixed(0).padStart(8)}`,
  );
});
console.log();
