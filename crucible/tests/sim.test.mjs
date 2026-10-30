import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/sim.js';

test('mixed precision Adam is 16 bytes per parameter before sharding', () => {
  const a = E.ARCH['core-8b'];
  const m = E.trainMemory(a, { hw: 'h100', tp: 1, pp: 1, cp: 1, dp: 1, micro: 1, accum: 1, zero: 0, recompute: 'full', seq: 1024, chunkedLoss: true });
  assert.equal(m.weights + m.grads + m.optim, 16 * a.params);
});

test('ZeRO-3 divides weights, grads and optimizer state by DP', () => {
  const a = E.ARCH['core-8b'], c = { hw: 'h100', tp: 1, pp: 1, cp: 1, dp: 64, micro: 1, accum: 1, recompute: 'full', seq: 1024, chunkedLoss: true };
  const z3 = E.trainMemory(a, { ...c, zero: 3 });
  assert.ok(Math.abs(z3.weights + z3.grads + z3.optim - 16 * a.params / 64) < 1);
});

test('pipeline bubble follows (p-1)/(v·m+p-1)', () => {
  const r = E.trainStep(E.ARCH['core-70b'], { hw: 'h100', tp: 8, pp: 4, cp: 1, dp: 8, micro: 1, accum: 8, zero: 1, recompute: 'selective', vpp: 1, seq: 4096 });
  assert.ok(Math.abs(r.bubbleFrac - 3 / 11) < 1e-9);
});

test('planner only returns layouts that fit and ranks by throughput', () => {
  const r = E.plan(E.ARCH['core-70b'], { hw: 'h100', gpus: 1024, seq: 8192 });
  assert.ok(r.best.length > 0);
  for (const x of r.best) assert.ok(x.mem.total <= 80e9 * 0.92);
  for (let i = 1; i < r.best.length; i++) assert.ok(r.best[i - 1].perf.tps >= r.best[i].perf.tps);
});

test('70B does not fit on one 80 GB GPU in BF16 for serving', () => {
  assert.equal(E.serveCapacity(E.ARCH['core-70b'], { hw: 'h100', tp: 1, quant: 'bf16', kvq: 'bf16', prompt: 1000, out: 200 }).fits, false);
  assert.equal(E.serveCapacity(E.ARCH['core-70b'], { hw: 'h100', tp: 4, quant: 'fp8', kvq: 'fp8', prompt: 1000, out: 200 }).fits, true);
});

test('KV per token: Llama-style 70B in BF16 is 320 KB', () => {
  assert.equal(E.kvPerToken(E.ARCH['core-70b'], 'bf16'), 327680);
});

test('decode step grows with batch and FP8 halves the weight read', () => {
  const a = E.ARCH['core-70b'], c = { hw: 'h100', tp: 4, quant: 'bf16', kvq: 'bf16' };
  assert.ok(E.decodeStep(a, c, 64, 2000) > E.decodeStep(a, c, 1, 2000));
  assert.ok(E.decodeStep(a, { ...c, quant: 'fp8' }, 1, 2000) < E.decodeStep(a, c, 1, 2000));
});

test('speculative decoding expected tokens', () => {
  assert.ok(Math.abs(E.specTokens(3, 0.7) - (1 - 0.7 ** 4) / 0.3) < 1e-12);
});

test('goodput is the last rate inside both SLOs', () => {
  const r = E.serveCurve(E.ARCH['core-8b'], { hw: 'h100', tp: 1, quant: 'fp8', kvq: 'fp8', prompt: 1400, out: 220, prefixHit: 0.7 }, { ttft: 0.6, itl: 0.025 });
  assert.ok(r.goodput > 0);
  for (const row of r.rows.filter((x) => x.rate <= r.goodput)) assert.ok(row.ttft <= 0.6 && row.itl <= 0.025 || !row.ok);
});

test('Young/Daly interval', () => {
  assert.equal(E.ckptInterval(2, 3600), Math.sqrt(14400));
});

test('seeded fleet: every training job fits its GPUs', () => {
  const F = new E.Fleet();
  for (const j of F.jobs.filter((x) => x.kind !== 'eval')) assert.ok(F.mem(j).total <= E.HW[j.cfg.hw].mem * 1e9, j.id);
});
