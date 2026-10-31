/* Crucible engine: hardware, model architectures, first-principles cost models
   for training and serving, and the fleet the console renders. Pure functions
   plus one Fleet class; no DOM, so tests run under node. */

export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const GB = 1e9;

/* Accelerators. flops = dense bf16, fp8 = dense fp8, bw = HBM bytes/s,
   nvlink = per-GPU unidirectional, net = per-GPU scale-out (one NIC per GPU). */
export const HW = {
  h100: { name: 'H100 SXM', mem: 80, flops: 989e12, fp8: 1979e12, bw: 3.35e12, nvlink: 450e9, net: 50e9, cost: 2.9, perNode: 8 },
  h200: { name: 'H200 SXM', mem: 141, flops: 989e12, fp8: 1979e12, bw: 4.8e12, nvlink: 450e9, net: 50e9, cost: 3.7, perNode: 8 },
  b200: { name: 'B200', mem: 180, flops: 2250e12, fp8: 4500e12, bw: 8e12, nvlink: 900e9, net: 100e9, cost: 5.6, perNode: 8 },
  l40s: { name: 'L40S', mem: 48, flops: 362e12, fp8: 733e12, bw: 0.864e12, nvlink: 32e9, net: 25e9, cost: 1.1, perNode: 8 },
};

/* Model architectures (GQA everywhere; MoE counts total and active params). */
export const ARCH = {
  'edge-3b': { name: 'Acme Edge 3B', params: 3.2e9, layers: 28, hidden: 3072, heads: 24, kv: 8, hd: 128, vocab: 128256 },
  'core-8b': { name: 'Acme Core 8B', params: 8.0e9, layers: 32, hidden: 4096, heads: 32, kv: 8, hd: 128, vocab: 128256 },
  'coder-34b': { name: 'Acme Coder 34B', params: 33.7e9, layers: 48, hidden: 8192, heads: 64, kv: 8, hd: 128, vocab: 128256 },
  'core-70b': { name: 'Acme Core 70B', params: 70.6e9, layers: 80, hidden: 8192, heads: 64, kv: 8, hd: 128, vocab: 128256 },
  'moe-235b': { name: 'Acme MoE 235B-A22B', params: 235e9, active: 22e9, layers: 94, hidden: 4096, heads: 64, kv: 4, hd: 128, vocab: 151936, experts: 128, topk: 8 },
};
export const active = (a) => a.active || a.params;

/* ───────────────────────── training ───────────────────────── */

/* Activation bytes per layer per microbatch, per Korthikanti et al. with
   FlashAttention (no s² term): 34·s·b·h without recompute, about 18 with
   selective recompute, 2 (the layer input) with full recompute. */
const ACT = { none: 34, selective: 18, full: 2 };

/** Peak memory per GPU for one parallel layout. Bytes. */
export function trainMemory(arch, c) {
  const shard = arch.params / (c.tp * c.pp);
  const dp = c.dp * (c.cp || 1);
  const weights = 2 * shard / (c.zero >= 3 ? dp : 1);
  const grads = 2 * shard / (c.zero >= 2 ? dp : 1);
  const optim = 12 * shard / (c.zero >= 1 ? dp : 1);
  const s = c.seq / (c.cp || 1), sbh = s * c.micro * arch.hidden;
  const perLayer = ACT[c.recompute] * sbh / c.tp;
  const stageLayers = arch.layers / c.pp;
  const inflight = c.pp > 1 ? Math.min(c.pp, c.accum) : 1;
  let acts = perLayer * stageLayers * inflight;
  if (c.recompute === 'full') acts += 34 * sbh / c.tp;
  const logits = c.chunkedLoss ? 0 : 4 * s * c.micro * arch.vocab / c.tp;
  const gathered = c.zero >= 3 ? 2 * 2 * shard / stageLayers : 0; // two layers of unsharded params in flight
  const other = 2.5 * GB + 0.06 * (weights + grads + optim + acts);
  const total = weights + grads + optim + acts + logits + gathered + other;
  return { weights, grads, optim, acts, logits, gathered, other, total };
}

/** Step time and throughput for one layout. Times in seconds. */
export function trainStep(arch, c) {
  const hw = HW[c.hw];
  const gpus = c.tp * c.pp * c.dp * (c.cp || 1);
  const seqs = c.micro * c.accum * c.dp;
  const tokens = seqs * c.seq;
  const flopsPerToken = 6 * active(arch) + 12 * arch.layers * arch.hidden * c.seq;
  const peak = c.fp8 ? hw.fp8 * 0.55 : hw.flops;
  // Matmul efficiency drops when each GPU's slice of work gets small.
  const work = c.micro * c.seq / (c.cp || 1) * arch.hidden / c.tp;
  const kEff = 0.63 * Math.min(1, 0.55 + 0.45 * Math.min(1, work / 16.7e6));
  const recompute = c.recompute === 'full' ? 4 / 3 : c.recompute === 'selective' ? 1.04 : 1;
  const compute = tokens * flopsPerToken * recompute / (gpus * peak * kEff);
  const m = c.accum, v = c.vpp || 1;
  const bubbleFrac = c.pp > 1 ? (c.pp - 1) / (v * m + c.pp - 1) : 0;
  const bubble = compute * bubbleFrac / (1 - bubbleFrac);
  // Tensor parallel: 4 all-reduces (or RS+AG pairs) per layer per microbatch, mostly exposed.
  const intraTp = c.tp <= hw.perNode;
  const tpBw = intraTp ? hw.nvlink : hw.net;
  const arBytes = 2 * (c.seq / (c.cp || 1)) * c.micro * arch.hidden;
  const tpComm = c.tp > 1 ? 4 * (arch.layers / c.pp) * m * (2 * (c.tp - 1) / c.tp * arBytes / tpBw + 12e-6) * 0.55 : 0;
  // Data parallel: gradient reduce-scatter per step, plus param all-gathers per microbatch under ZeRO-3. Mostly overlapped.
  const shard = arch.params / (c.tp * c.pp);
  const dpSize = c.dp * (c.cp || 1);
  const dpBw = c.tp * c.pp >= hw.perNode ? hw.net : hw.nvlink * 0.6;
  const ring = dpSize > 1 ? (dpSize - 1) / dpSize : 0;
  const dpBytes = 2 * shard * ring * (c.zero >= 3 ? 1 + 2 * m : 2);
  const dpComm = dpBytes / dpBw;
  const dpExposed = Math.max(0, dpComm - 0.8 * compute) + 0.08 * dpComm;
  const cpComm = (c.cp || 1) > 1 ? compute * 0.06 : 0;
  const pp2p = c.pp > 1 ? 2 * m * v * arBytes / hw.net : 0;
  const optimizer = 16 * shard / (c.zero >= 1 ? dpSize : 1) / hw.bw * 3;
  const step = compute + bubble + tpComm + dpExposed + cpComm + pp2p + optimizer;
  const mfu = tokens * 6 * active(arch) / (step * gpus * hw.flops);
  return {
    gpus, tokens, step, mfu, tps: tokens / step,
    parts: { compute, bubble, tpComm, dpComm: dpExposed, cpComm: cpComm + pp2p, optimizer },
    bubbleFrac,
  };
}

/** Search layouts for a model on a GPU budget; rank feasible ones by throughput. */
export function plan(arch, { hw = 'h100', gpus = 256, seq = 8192, batchTokens = 4194304, fp8 = false, maxResults = 8 } = {}) {
  const H = HW[hw], cap = H.mem * GB * 0.92;
  const seqs = Math.max(1, Math.round(batchTokens / seq));
  const out = [], rejected = [];
  for (const tp of [1, 2, 4, 8, 16]) for (const pp of [1, 2, 4, 8, 16]) for (const cp of seq >= 32768 ? [1, 2, 4] : [1]) {
    if (arch.layers % pp || arch.heads % tp || arch.kv % Math.min(tp, arch.kv)) continue;
    if (gpus % (tp * pp * cp)) continue;
    const dp = gpus / (tp * pp * cp);
    for (const micro of [1, 2, 4]) {
      if (seqs % (micro * dp)) continue;
      const accum = seqs / (micro * dp);
      if (pp > 1 && accum < pp) continue;
      for (const zero of [1, 3]) for (const recompute of ['none', 'selective', 'full']) for (const vpp of pp > 1 ? [1, 2, 4] : [1]) {
        if ((arch.layers / pp) % vpp) continue;
        const c = { hw, tp, pp, cp, dp, micro, accum, zero, recompute, vpp, seq, fp8, chunkedLoss: true };
        const mem = trainMemory(arch, c);
        if (mem.total > cap) { rejected.push({ c, mem }); continue; }
        out.push({ c, mem, perf: trainStep(arch, c) });
      }
    }
  }
  out.sort((a, b) => b.perf.tps - a.perf.tps);
  const seen = new Set(), best = [];
  for (const r of out) { const k = `${r.c.tp}.${r.c.pp}.${r.c.cp}`; if (seen.has(k)) continue; seen.add(k); best.push(r); if (best.length >= maxResults) break; }
  rejected.sort((a, b) => a.mem.total - b.mem.total);
  return { best, considered: out.length + rejected.length, feasible: out.length, nearestOom: rejected[0] || null, seqs };
}

/** Chinchilla-style loss curve, Hoffmann et al. 2022 fit. */
export function lossAt(arch, tokens) {
  return 1.69 + 406.4 / Math.pow(active(arch), 0.34) + 410.7 / Math.pow(Math.max(tokens, 1e8), 0.28);
}

/** Young/Daly optimal checkpoint interval, seconds. */
export const ckptInterval = (saveSeconds, mtbfSeconds) => Math.sqrt(2 * saveSeconds * mtbfSeconds);

/* ───────────────────────── inference ───────────────────────── */

const WBYTES = { bf16: 2, fp8: 1, int4: 0.56 };
export const WBYTES_ = (q) => WBYTES[q];
export const kvPerToken = (arch, kvq = 'bf16') => 2 * arch.layers * arch.kv * arch.hd * (kvq === 'fp8' ? 1 : 2);

/** Static capacity of one replica. */
export function serveCapacity(arch, c) {
  const hw = HW[c.hw];
  const weights = arch.params * WBYTES[c.quant];
  const budget = hw.mem * GB * 0.9 * c.tp - weights - 1.5 * GB * c.tp;
  const kv = kvPerToken(arch, c.kvq);
  const kvTokens = Math.max(0, budget / kv);
  const ctx = c.prompt + c.out;
  return { weights, kvBytes: Math.max(0, budget), kvTokens, maxBatch: Math.floor(kvTokens / ctx), fits: budget > 0 && kvTokens >= ctx };
}

/** One decode step for a batch of B sequences with average context ctx. Seconds. */
export function decodeStep(arch, c, B, ctx, tokensPerSeq = 1) {
  const hw = HW[c.hw];
  const peak = (c.quant === 'fp8' ? hw.fp8 : hw.flops) * 0.5;
  const mem = (arch.params * WBYTES[c.quant] / c.tp + B * ctx * kvPerToken(arch, c.kvq) / c.tp) / (hw.bw * 0.78);
  const comp = B * tokensPerSeq * 2 * active(arch) / (c.tp * peak);
  const tpComm = c.tp > 1 ? 2 * arch.layers * (9e-6 + B * tokensPerSeq * arch.hidden * 2 / hw.nvlink) : 0;
  const launch = c.cudaGraphs === false ? arch.layers * 40e-6 : 0.6e-3;
  return Math.max(mem, comp) + 0.2 * Math.min(mem, comp) + tpComm + launch;
}

export const prefillTime = (arch, c, tokens) => {
  const hw = HW[c.hw], peak = (c.quant === 'fp8' ? hw.fp8 : hw.flops) * 0.55;
  return tokens * 2 * active(arch) / (c.tp * peak) + 2e-3;
};

/* Speculative decoding: expected tokens per verification step with k drafts
   and per-token acceptance α (Leviathan et al. 2023). */
export const specTokens = (k, a) => (1 - Math.pow(a, k + 1)) / (1 - a);

/**
 * Steady state of one replica at `rate` requests/s (Little's law fixed point).
 * Colocated prefill steals decode time; disaggregated runs prefill elsewhere.
 * Returns per-replica concurrency, ITL, TTFT, output tokens/s and saturation.
 */
export function servePoint(arch, c, rate) {
  const cap = serveCapacity(arch, c);
  const hit = c.prefixHit || 0;
  const pre = prefillTime(arch, c, c.prompt * (1 - hit));
  const ctx = c.prompt + c.out / 2;
  const spec = c.spec ? { E: specTokens(c.spec.k, c.spec.alpha), k: c.spec.k } : null;
  const itlOf = (B) => {
    if (!spec) return decodeStep(arch, c, B, ctx);
    const verify = decodeStep(arch, c, B, ctx, spec.k + 1);
    const draft = spec.k * decodeStep(arch, { ...c, tp: 1 }, B, ctx) * (c.spec.draftRatio ?? 0.06);
    return (verify + draft) / spec.E;
  };
  const busy = c.disagg ? 0 : rate * pre;
  if (busy >= 0.97) return { B: cap.maxBatch, itl: Infinity, ttft: Infinity, tps: 0, saturated: true, cap };
  let B = 1, itl = itlOf(1), ttft = pre;
  for (let i = 0; i < 60; i++) {
    itl = itlOf(Math.max(1, B)) / (1 - busy);
    ttft = pre / (1 - busy) + itl;
    const want = rate * (ttft + c.out * itl);
    B = B + 0.5 * (Math.min(want, cap.maxBatch) - B);
  }
  const want = rate * (ttft + c.out * itl);
  const saturated = want > cap.maxBatch * 1.001;
  if (saturated) {
    const drain = cap.maxBatch / (c.out * itl);
    ttft += Math.min(120, (want - cap.maxBatch) / Math.max(drain, 1e-6) * 0.5);
  }
  const tps = Math.min(rate, (cap.maxBatch / (c.out * itl))) * c.out;
  return { B, itl, ttft, tps, saturated, cap, pre };
}

/** Latency/throughput curve across request rates, plus goodput under an SLO. */
export function serveCurve(arch, c, slo = { ttft: 2, itl: 0.05 }, points = 28) {
  let lo = 0.01, hi = 0.01;
  while (hi < 1e4 && !servePoint(arch, c, hi).saturated && servePoint(arch, c, hi).itl < slo.itl * 4) hi *= 2;
  const rows = [];
  for (let i = 1; i <= points; i++) {
    const r = (hi * i) / points, p = servePoint(arch, c, r);
    // SLOs are p90; the mean-value model's tails: TTFT ×1.5 (queueing behind prefills), ITL ×1.2.
    rows.push({ rate: r, ...p, ok: !p.saturated && p.ttft * 1.5 <= slo.ttft && p.itl * 1.2 <= slo.itl });
  }
  const good = rows.filter((x) => x.ok).at(-1) || null;
  const gpus = c.tp + (c.disagg ? c.disagg : 0);
  const cost = good ? HW[c.hw].cost * gpus / (good.tps * 3600) * 1e6 : null;
  return { rows, goodput: good ? good.rate : 0, tpsAtGoodput: good ? good.tps : 0, cost, gpus, hiRate: hi };
}

/* ───────────────────────── fleet ───────────────────────── */

export const TEAMS = {
  foundation: { name: 'Foundation Models', lead: 'Maya Chen', quota: 2304 },
  assistant: { name: 'Assistant', lead: 'Dev Patel', quota: 640 },
  search: { name: 'Search', lead: 'Luis Ortega', quota: 256 },
  devtools: { name: 'Developer Tools', lead: 'Sofia Reyes', quota: 192 },
  research: { name: 'Research', lead: 'Hiro Tanaka', quota: 384 },
  platform: { name: 'Platform', lead: 'Priya Nair', quota: 128 },
};

export const ROLES = {
  researcher: { name: 'Maya Chen', title: 'Research scientist', team: 'foundation' },
  ml_engineer: { name: 'Dev Patel', title: 'ML engineer', team: 'assistant' },
  platform: { name: 'Priya Nair', title: 'Platform engineer', team: 'platform' },
  sre: { name: 'Jonas Weber', title: 'Site reliability engineer', team: 'platform' },
  manager: { name: 'Amara Okafor', title: 'Engineering manager', team: 'platform' },
};

export const CLUSTERS = [
  { id: 'usw2-h100-a', region: 'us-west', hw: 'h100', nodes: 384, fabric: 'InfiniBand NDR 400G, rail-optimized' },
  { id: 'use1-h200-b', region: 'us-east', hw: 'h200', nodes: 128, fabric: 'InfiniBand NDR 400G' },
  { id: 'usw2-b200-c', region: 'us-west', hw: 'b200', nodes: 64, fabric: 'InfiniBand XDR 800G' },
  { id: 'euw1-l40s-d', region: 'eu-west', hw: 'l40s', nodes: 48, fabric: 'RoCE v2 200G' },
];

const H = 36e5, D = 864e5;

/* Jobs: pretraining, post-training and eval. `cfg` is the parallel layout;
   progress is derived from start time and modeled throughput. */
function seedJobs(now) {
  return [
    { id: 'pt-core-70b-v3', name: 'Core 70B v3 pretraining', kind: 'pretrain', arch: 'core-70b', team: 'foundation', owner: 'Maya Chen', cluster: 'usw2-h100-a', state: 'running', priority: 'P0',
      cfg: { hw: 'h100', tp: 8, pp: 4, cp: 1, dp: 64, micro: 1, accum: 32, zero: 1, recompute: 'selective', vpp: 5, seq: 8192, fp8: true, chunkedLoss: true },
      targetTokens: 15e12, started: now - 31 * D, doneTokens: 6.92e12, goodput: 0.943, ckptEvery: 15 * 60, mix: 'mix-pretrain-v9' },
    { id: 'pt-edge-3b-distill', name: 'Edge 3B distillation from Core 70B', kind: 'pretrain', arch: 'edge-3b', team: 'foundation', owner: 'Hiro Tanaka', cluster: 'usw2-b200-c', state: 'running', priority: 'P1',
      cfg: { hw: 'b200', tp: 1, pp: 1, cp: 1, dp: 256, micro: 4, accum: 1, zero: 3, recompute: 'none', vpp: 1, seq: 4096, fp8: true, chunkedLoss: true },
      targetTokens: 2.4e12, started: now - 4 * D, doneTokens: 1.31e12, goodput: 0.968, ckptEvery: 10 * 60, mix: 'mix-distill-v2' },
    { id: 'rl-core-70b-reason', name: 'Core 70B reasoning RL (GRPO)', kind: 'rl', method: 'GRPO', arch: 'core-70b', team: 'foundation', owner: 'Maya Chen', cluster: 'use1-h200-b', state: 'running', priority: 'P0',
      cfg: { hw: 'h200', tp: 4, pp: 1, cp: 1, dp: 64, micro: 1, accum: 1, zero: 3, recompute: 'full', vpp: 1, seq: 16384, fp8: false, chunkedLoss: true },
      rl: { rolloutGpus: 256, trainGpus: 256, rmGpus: 0, verifiers: 2048, group: 16, promptsPerStep: 256, maxLen: 16384, async: 1, engine: 'vLLM 0.11', sync: 'NCCL broadcast, bucketed' },
      steps: 1200, started: now - 3.2 * D, step: 714, base: 'core-70b-sft-v3.2', dataset: 'math-code-verifiable-v4' },
    { id: 'dpo-core-8b-assist', name: 'Core 8B assistant DPO', kind: 'post', method: 'DPO', arch: 'core-8b', team: 'assistant', owner: 'Dev Patel', cluster: 'usw2-h100-a', state: 'running', priority: 'P1',
      cfg: { hw: 'h100', tp: 1, pp: 1, cp: 1, dp: 64, micro: 2, accum: 2, zero: 3, recompute: 'selective', vpp: 1, seq: 4096, fp8: false, chunkedLoss: true },
      steps: 2400, started: now - 7 * H, step: 1610, base: 'core-8b-sft-v5', dataset: 'assistant-prefs-v7' },
    { id: 'sft-core-8b-assist', name: 'Core 8B assistant SFT', kind: 'post', method: 'SFT', arch: 'core-8b', team: 'assistant', owner: 'Dev Patel', cluster: 'usw2-h100-a', state: 'succeeded', priority: 'P1',
      cfg: { hw: 'h100', tp: 1, pp: 1, cp: 1, dp: 64, micro: 1, accum: 4, zero: 3, recompute: 'selective', vpp: 1, seq: 8192, fp8: false, chunkedLoss: true },
      steps: 3000, started: now - 2.1 * D, ended: now - 1.4 * D, step: 3000, base: 'core-8b-base-v5', dataset: 'assistant-sft-v9' },
    { id: 'lora-coder-34b-ide', name: 'Coder 34B LoRA for IDE completions', kind: 'post', method: 'LoRA SFT', arch: 'coder-34b', team: 'devtools', owner: 'Sofia Reyes', cluster: 'usw2-h100-a', state: 'queued', priority: 'P2',
      cfg: { hw: 'h100', tp: 2, pp: 1, cp: 1, dp: 16, micro: 1, accum: 4, zero: 3, recompute: 'selective', vpp: 1, seq: 8192, fp8: false, chunkedLoss: true },
      steps: 1800, started: null, step: 0, base: 'coder-34b-v2', dataset: 'ide-completions-v3', wait: 42 * 60 },
    { id: 'eval-core-70b-sft32', name: 'Core 70B SFT v3.2 eval sweep', kind: 'eval', arch: 'core-70b', team: 'research', owner: 'Hiro Tanaka', cluster: 'use1-h200-b', state: 'running', priority: 'P2',
      cfg: { hw: 'h200', tp: 4, pp: 1, cp: 1, dp: 8, micro: 1, accum: 1, zero: 0, recompute: 'none', vpp: 1, seq: 8192, fp8: false },
      steps: 18, started: now - 50 * 60 * 1000, step: 11, base: 'core-70b-sft-v3.2', dataset: '18 suites' },
    { id: 'grpo-core-8b-tools', name: 'Core 8B tool use RL (GRPO)', kind: 'rl', method: 'GRPO', arch: 'core-8b', team: 'assistant', owner: 'Dev Patel', cluster: 'usw2-h100-a', state: 'failed', priority: 'P1',
      cfg: { hw: 'h100', tp: 1, pp: 1, cp: 1, dp: 32, micro: 2, accum: 2, zero: 3, recompute: 'selective', vpp: 1, seq: 8192, fp8: false, chunkedLoss: true },
      rl: { rolloutGpus: 32, trainGpus: 32, rmGpus: 0, verifiers: 512, group: 8, promptsPerStep: 256, maxLen: 8192, async: 0, engine: 'SGLang 0.5', sync: 'CUDA IPC, colocated' },
      steps: 600, started: now - 9 * H, ended: now - 5.5 * H, step: 233, base: 'core-8b-sft-v5', dataset: 'tool-tasks-v2',
      failure: 'Reward collapse at step 233: 61% of groups had identical rewards, so advantages were zero. Verifier sandbox timeouts returned 0 instead of an error.' },
  ];
}

/* Deployments: engine, layout and traffic. `rate` is req/s per replica at peak. */
function seedDeployments() {
  return [
    { id: 'assistant-70b', name: 'Assistant 70B', model: 'core-70b-sft-v3.1', arch: 'core-70b', team: 'assistant', engine: 'vLLM', version: '0.11.1', region: 'us-west, us-east', state: 'healthy',
      cfg: { hw: 'h100', tp: 4, quant: 'fp8', kvq: 'fp8', prompt: 1800, out: 350, prefixHit: 0.62, spec: { k: 3, alpha: 0.72, kind: 'EAGLE-3' }, cudaGraphs: true },
      replicas: 48, min: 24, max: 96, slo: { ttft: 1.2, itl: 0.04 }, peak: 410, features: ['Prefix caching', 'Chunked prefill', 'EAGLE-3 drafts', 'FP8 weights and KV'] },
    { id: 'assistant-8b', name: 'Assistant 8B', model: 'core-8b-dpo-v5.3', arch: 'core-8b', team: 'assistant', engine: 'SGLang', version: '0.5.2', region: 'us-west, us-east, eu-west', state: 'healthy',
      cfg: { hw: 'h100', tp: 1, quant: 'fp8', kvq: 'fp8', prompt: 1400, out: 220, prefixHit: 0.71, spec: null, cudaGraphs: true },
      replicas: 64, min: 16, max: 160, slo: { ttft: 0.6, itl: 0.025 }, peak: 1450, features: ['RadixAttention', 'Multi-LoRA (142 adapters)', 'FP8'] },
    { id: 'reasoning-70b', name: 'Reasoning 70B preview', model: 'core-70b-grpo-v0.9', arch: 'core-70b', team: 'foundation', engine: 'vLLM', version: '0.11.1', region: 'us-east', state: 'canary',
      cfg: { hw: 'h200', tp: 4, quant: 'fp8', kvq: 'fp8', prompt: 900, out: 3200, prefixHit: 0.2, spec: { k: 4, alpha: 0.66, kind: 'MTP heads' }, disagg: 4, cudaGraphs: true },
      replicas: 12, min: 8, max: 32, slo: { ttft: 2.5, itl: 0.03 }, peak: 55, features: ['Disaggregated prefill and decode', 'NIXL KV transfer', 'MTP speculative decoding'],
      canary: { from: 'core-70b-grpo-v0.8', to: 'core-70b-grpo-v0.9', step: 1, steps: [5, 25, 50, 100] } },
    { id: 'coder-34b', name: 'Coder 34B completions', model: 'coder-34b-v2', arch: 'coder-34b', team: 'devtools', engine: 'TensorRT-LLM', version: '1.1', region: 'us-west', state: 'degraded',
      cfg: { hw: 'h100', tp: 2, quant: 'int4', kvq: 'bf16', prompt: 3000, out: 60, prefixHit: 0.55, spec: { k: 5, alpha: 0.8, kind: 'N-gram lookup' }, cudaGraphs: true },
      replicas: 16, min: 8, max: 40, slo: { ttft: 0.35, itl: 0.02 }, peak: 160, features: ['AWQ int4', 'Prompt lookup decoding', 'In-flight batching'],
      issue: 'TTFT p90 above SLO since 09:40. Long-context requests from a new IDE plugin raised the average prompt to 5,800 tokens.' },
    { id: 'moe-235b', name: 'MoE 235B batch', model: 'moe-235b-a22b-v1', arch: 'moe-235b', team: 'research', engine: 'SGLang', version: '0.5.2', region: 'us-west', state: 'healthy',
      cfg: { hw: 'b200', tp: 8, quant: 'fp8', kvq: 'fp8', prompt: 2500, out: 900, prefixHit: 0.1, spec: null, cudaGraphs: true, ep: 8 },
      replicas: 4, min: 2, max: 8, slo: { ttft: 10, itl: 0.08 }, peak: 70, features: ['Expert parallel 8', 'Batch priority', 'Spot capacity'] },
    { id: 'edge-3b-eval', name: 'Edge 3B evaluation', model: 'edge-3b-distill-c41k', arch: 'edge-3b', team: 'foundation', engine: 'vLLM', version: '0.11.1', region: 'eu-west', state: 'healthy',
      cfg: { hw: 'l40s', tp: 1, quant: 'bf16', kvq: 'bf16', prompt: 800, out: 200, prefixHit: 0.3, spec: null, cudaGraphs: true },
      replicas: 6, min: 2, max: 12, slo: { ttft: 0.5, itl: 0.03 }, peak: 60, features: ['Internal only', 'Scale to zero overnight'] },
  ];
}

export const MODELS = [
  { id: 'core-70b', name: 'Acme Core 70B', versions: [
    ['core-70b-base-v3-c41k', 'Base checkpoint', 'pt-core-70b-v3', 'Training', 'mix-pretrain-v9 snapshot 8812'],
    ['core-70b-sft-v3.2', 'SFT', 'sft-core-70b-v3.2', 'Evaluating', 'reasoning-sft-v6'],
    ['core-70b-sft-v3.1', 'SFT', 'sft-core-70b-v3.1', 'Production', 'reasoning-sft-v5'],
    ['core-70b-grpo-v0.9', 'GRPO', 'rl-core-70b-reason', 'Canary', 'math-code-verifiable-v4'],
  ] },
  { id: 'core-8b', name: 'Acme Core 8B', versions: [
    ['core-8b-dpo-v5.3', 'DPO', 'dpo-core-8b-assist', 'Production', 'assistant-prefs-v6'],
    ['core-8b-sft-v5', 'SFT', 'sft-core-8b-assist', 'Registered', 'assistant-sft-v9'],
  ] },
  { id: 'coder-34b', name: 'Acme Coder 34B', versions: [['coder-34b-v2', 'SFT', 'sft-coder-34b-v2', 'Production', 'code-sft-v4']] },
  { id: 'edge-3b', name: 'Acme Edge 3B', versions: [['edge-3b-distill-c41k', 'Distillation', 'pt-edge-3b-distill', 'Evaluating', 'mix-distill-v2']] },
  { id: 'moe-235b', name: 'Acme MoE 235B-A22B', versions: [['moe-235b-a22b-v1', 'Base + SFT', 'pt-moe-235b-v1', 'Production', 'mix-pretrain-v8']] },
];

export const DATASETS = [
  { id: 'mix-pretrain-v9', kind: 'Pretraining mixture', tokens: 15.2e12, shards: 61440, format: 'MDS, zstd', snapshot: 8812, governance: 'Approved', sources: [['Web, filtered', 0.52], ['Code', 0.17], ['Books and papers', 0.09], ['Math', 0.06], ['Multilingual', 0.11], ['Synthetic', 0.05]] },
  { id: 'mix-distill-v2', kind: 'Distillation set', tokens: 2.4e12, shards: 9600, format: 'MDS + teacher logits (top 32)', snapshot: 211, governance: 'Approved', sources: [['Core 70B samples', 0.7], ['Web, filtered', 0.3]] },
  { id: 'assistant-sft-v9', kind: 'SFT', tokens: 2.1e9, shards: 128, format: 'Parquet, chat template', snapshot: 77, governance: 'Approved', sources: [['Human written', 0.35], ['Synthetic, reviewed', 0.65]] },
  { id: 'assistant-prefs-v7', kind: 'Preference pairs', tokens: 0.9e9, shards: 64, format: 'Parquet (prompt, chosen, rejected)', snapshot: 31, governance: 'Approved', sources: [['Human raters', 0.4], ['AI judge, audited', 0.6]] },
  { id: 'math-code-verifiable-v4', kind: 'RL prompts with verifiers', tokens: 0.2e9, shards: 32, format: 'JSONL + verifier spec', snapshot: 12, governance: 'Approved', sources: [['Math with answers', 0.55], ['Code with unit tests', 0.45]] },
  { id: 'ide-completions-v3', kind: 'SFT', tokens: 4.4e9, shards: 256, format: 'Parquet, FIM', snapshot: 9, governance: 'In review', sources: [['Licensed repositories', 0.8], ['Synthetic', 0.2]] },
];

/** Node states for a cluster grid, deterministic per cluster. */
export function clusterNodes(cl, jobs) {
  const r = mulberry32(cl.id.length * 7919 + cl.nodes);
  const nodes = [];
  const alloc = [];
  for (const j of jobs.filter((x) => x.cluster === cl.id && x.state === 'running')) {
    const g = jobGpus(j);
    alloc.push([j.id, Math.ceil(g / HW[cl.hw].perNode)]);
  }
  let i = 0;
  for (const [id, n] of alloc) for (let k = 0; k < n && i < cl.nodes; k++) nodes.push({ i: i++, job: id });
  const spares = Math.round(cl.nodes * 0.02);
  while (i < cl.nodes) {
    const x = r();
    nodes.push({ i: i++, job: null, state: x < 0.012 ? 'failed' : x < 0.03 ? 'draining' : nodes.length >= cl.nodes - spares ? 'spare' : 'idle' });
  }
  return nodes;
}

export const jobGpus = (j) => (j.rl ? j.rl.rolloutGpus + j.rl.trainGpus + j.rl.rmGpus : j.cfg.tp * j.cfg.pp * (j.cfg.cp || 1) * j.cfg.dp);

/* ───────────────────────── live fleet ───────────────────────── */

export class Fleet {
  constructor(now = Date.now()) {
    this.t0 = now;
    this.jobs = seedJobs(now);
    this.deps = seedDeployments();
    this.events = [];
    this.ckpts = {};
    this.seq = 1;
    for (const j of this.jobs) this.ckpts[j.id] = this.seedCkpts(j, now);
    this.job('pt-core-70b-v3').straggler = { node: 'usw2-a-n0311', gpu: 5, slow: 6.8, why: 'SM clock throttled to 1.59 GHz (thermal), 19% below peers. Every collective waits for this rank.' };
    for (const d of this.deps) d.replicas = d.issue ? d.max : this.desiredReplicas(d, now);
    this.event(now - 26 * 60e3, 'pt-core-70b-v3', 'recovered', 'Node usw2-a-n0217 lost (GPU XID 79). Hot spare joined; restored step from peer memory in 94 s.');
    this.event(now - 3 * H, 'coder-34b', 'alert', 'TTFT p90 above SLO. Average prompt rose to 5,800 tokens.');
    this.event(now - 5.5 * H, 'grpo-core-8b-tools', 'failed', 'Stopped by guardrail: reward variance near zero for 40 steps.');
    this.event(now - 50 * 60e3, 'reasoning-70b', 'deploy', 'Canary started: v0.9 at 5% of traffic.');
  }
  event(t, subject, kind, text) { this.events.push({ id: this.seq++, t, subject, kind, text }); this.events.sort((a, b) => b.t - a.t); }
  job(id) { return this.jobs.find((j) => j.id === id); }
  dep(id) { return this.deps.find((d) => d.id === id); }
  perf(j) { return trainStep(ARCH[j.arch], j.cfg); }
  mem(j) { return trainMemory(ARCH[j.arch], j.cfg); }

  seedCkpts(j, now) {
    if (j.kind !== 'pretrain' && j.kind !== 'rl' && j.kind !== 'post') return [];
    const out = [], every = (j.ckptEvery || 30 * 60) * 1000;
    const end = j.state === 'running' ? now : j.ended || now;
    if (!j.started) return out;
    const size = ARCH[j.arch].params * 16 / 1e12;
    for (let k = 0, t = end - (end % every); t > j.started && k < 8; k++, t -= every) {
      out.push({ t, step: Math.round(this.stepAt(j, t)), tier: k === 0 ? 'Peer memory + object store' : 'Object store', size, blocking: j.kind === 'pretrain' ? 3.1 : 1.8, upload: size * 1e12 / 120e9, status: 'Verified' });
    }
    return out;
  }

  /** Steps done at time t, from modeled throughput and goodput. */
  stepAt(j, t = Date.now()) {
    if (j.kind === 'pretrain') {
      const p = this.perf(j);
      const secs = (t - this.t0) / 1000;
      return (j.doneTokens + Math.max(0, secs) * p.tps * j.goodput) / p.tokens;
    }
    return j.step;
  }
  tokensAt(j, t = Date.now()) { return j.kind === 'pretrain' ? this.stepAt(j, t) * this.perf(j).tokens : null; }

  /** Live traffic for a deployment: diurnal shape, deterministic jitter. */
  trafficAt(d, t = Date.now()) {
    const hr = new Date(t).getUTCHours() + new Date(t).getUTCMinutes() / 60;
    const shape = 0.62 + 0.38 * Math.max(0, Math.sin(((hr - 13) / 24) * 2 * Math.PI) * 0.5 + 0.5);
    const jitter = 1 + 0.04 * Math.sin(t / 7000 + d.id.length);
    return d.peak * shape * jitter;
  }

  /** Per-replica operating point at the deployment's current load. */
  servingNow(d, t = Date.now()) {
    const arch = ARCH[d.arch], total = this.trafficAt(d, t);
    let cfg = d.cfg;
    if (d.issue) cfg = { ...cfg, prompt: 5800 };
    const per = total / d.replicas;
    const p = servePoint(arch, cfg, per);
    const gpus = d.replicas * (cfg.tp + (cfg.disagg || 0));
    const tps = p.tps * d.replicas;
    const kvActive = Math.min(0.99, p.B * (cfg.prompt + cfg.out / 2) / Math.max(1, p.cap.kvTokens));
    // Freed blocks keep their prefixes until evicted, so the cache sits mostly full.
    const kvCached = Math.min(0.97 - kvActive, (cfg.prefixHit || 0) * 0.9);
    return { total, per, ...p, gpus, tpsAll: tps, cost: HW[cfg.hw].cost * gpus / (Math.max(tps, 1) * 3600) * 1e6, kvActive, kvCached: Math.max(0, kvCached) };
  }

  /** Autoscaler: target 70% of goodput per replica, bounded by min and max. */
  desiredReplicas(d, t = Date.now()) {
    const c = serveCurve(ARCH[d.arch], d.issue ? { ...d.cfg, prompt: 5800 } : d.cfg, d.slo, 16);
    const per = Math.max(c.goodput * 0.7, 0.01);
    return Math.max(d.min, Math.min(d.max, Math.ceil(this.trafficAt(d, t) / per)));
  }

  /** RL iteration time breakdown, seconds, from the rollout and train models. */
  rlBreakdown(j) {
    const a = ARCH[j.arch], rl = j.rl;
    const engines = rl.rolloutGpus / 4;
    const seqs = rl.promptsPerStep * rl.group;
    const meanOut = Math.min(rl.maxLen, 900 + j.step * 2.2);
    const c = { hw: j.cfg.hw, tp: 4, quant: 'bf16', kvq: 'bf16' };
    const cap = serveCapacity(a, { ...c, prompt: 600, out: meanOut });
    const B = Math.max(1, Math.min(cap.maxBatch, Math.ceil(seqs / engines)));
    // The step waits for the longest sequence: the batch drains to a few stragglers at the tail.
    const tail = Math.min(rl.maxLen, meanOut * (rl.partial ? 1.35 : 3.2)); // partial rollouts carry stragglers into the next step
    const rollout = meanOut * decodeStep(a, c, B, 600 + meanOut / 2) + (tail - meanOut) * decodeStep(a, c, 4, 600 + tail);
    const tokens = seqs * (600 + meanOut);
    const train = tokens * 6 * active(a) * 1.33 / (rl.trainGpus * HW[j.cfg.hw].flops * 0.42) * 1.15;
    const reward = Math.max(4, seqs / rl.verifiers * 2.6);
    const ref = tokens * 2 * active(a) / (rl.trainGpus * HW[j.cfg.hw].flops * 0.45);
    const sync = a.params * 2 / (HW[j.cfg.hw].net * 8) + 3;
    const overlap = rl.async ? Math.min(rollout, train + ref) : 0;
    return { rollout, reward, ref, train, sync, total: rollout + reward + ref + train + sync - overlap, overlap, meanOut, tail, B, seqs };
  }
}

/** RL metrics at step s, smooth and deterministic. */
export function rlMetrics(s, failed) {
  const x = s / 1200;
  if (failed) return { reward: 0.31 + 0.12 * Math.min(1, s / 180) - (s > 190 ? (s - 190) * 0.004 : 0), kl: 0.004 + s * 0.00003, len: 700 + s * 1.1, zeroAdv: s > 190 ? Math.min(0.61, 0.12 + (s - 190) * 0.011) : 0.12 };
  return { reward: 0.31 + 0.33 * (1 - Math.exp(-3.1 * x)), kl: 0.045 * x ** 0.8, len: 900 + 2.2 * s, zeroAdv: 0.14 - 0.05 * x, entropy: 0.62 - 0.21 * x };
}
