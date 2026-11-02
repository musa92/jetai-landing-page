/* Performance and capacity: kernel and memory-hierarchy dashboard (roofline,
   SM, L1/SMEM, L2, HBM, FlashAttention), the tenant placement optimizer, and
   tenant cost and chargeback. */
import { E, h, fmt, si, gb, ms, usd, ctx, S, VIEWS, ACTIONS, CLICKS, head, pill, glist, stack, seg, C, xyChart, can, me, toast, ui, p90 } from './core.js?v=20261102-2';

/* ───────────────────────── kernels and memory ───────────────────────── */

/* H100 SXM memory hierarchy. Capacities from the spec sheet; bandwidths are
   aggregate and approximate (measured microbenchmarks, reads). */
const HIER = [
  ['Registers', '256 KB per SM · 33.8 MB total', '~100 TB/s', 'Per-thread operands; spills go to L1'],
  ['Shared memory / L1', 'Up to 228 KB SMEM of 256 KB per SM', '~33 TB/s', 'Tiles staged by TMA; FlashAttention keeps Q, K, V blocks here'],
  ['L2 cache', '50 MB, two partitions', '~7 TB/s', 'Shared by all SMs; GEMM tile swizzling and persistence windows raise hit rate'],
  ['HBM3', '80 GB', '3.35 TB/s', 'Weights, KV cache, activations; decode lives or dies here'],
  ['NVLink 4', '18 links', '900 GB/s bidirectional', 'Tensor-parallel all-reduce inside the node'],
  ['InfiniBand NDR', '8 × 400 Gb/s per node', '~400 GB/s per node', 'Data-parallel and pipeline traffic across nodes'],
];

/* Kernels per workload: [name, time share, arithmetic intensity FLOP/B (0 = communication),
   achieved TFLOPS, occupancy %, L1 hit %, L2 hit %, HBM util %, bound, fix]. */
export const WORK = {
  pretrain: { name: 'Pretraining · Core 70B · FP8 · H100', peak: 1979, kernels: [
    ['GEMM FP8 (wgmma, TMA, persistent)', 46, 4100, 1290, 12, 0, 78, 31, 'compute', 'At 65% of FP8 peak. Larger tiles with 2-CTA clusters and TMA multicast reuse operands across SMs.'],
    ['FlashAttention-3 fwd + bwd', 19, 520, 620, 25, 0, 84, 22, 'compute', 'Warp-specialized producer and consumer warps, softmax overlapped with the next GEMM block.'],
    ['NCCL all-reduce (TP, NVLink)', 9, 0, 0, 6, 0, 0, 12, 'interconnect', 'Mostly exposed. Async TP overlaps it with the matmul; NVLS offloads the reduction to the switch.'],
    ['RMSNorm + residual (fused)', 4, 1.5, 4.4, 75, 62, 41, 88, 'memory', 'Already at 88% of HBM bandwidth. Fuse into the GEMM epilogue to remove the round trip.'],
    ['SwiGLU activation', 3, 0.5, 1.4, 81, 55, 38, 85, 'memory', 'Fuse into the up-projection epilogue: saves one write and one read of the MLP activation.'],
    ['Chunked cross-entropy', 2, 2.0, 6.0, 64, 70, 52, 80, 'memory', 'Never materializes full logits: 4 GB saved per sequence.'],
    ['Fused AdamW (multi-tensor)', 1, 0.3, 0.9, 88, 10, 12, 91, 'memory', 'Optimizer state streams once per step; nothing left.'],
    ['Idle: pipeline bubble and waits', 16, 0, 0, 0, 0, 0, 0, 'idle', 'Interleaved stages and replacing the slow GPU recover most of this.'],
  ] },
  decode: { name: 'Decode · Assistant 70B · FP8 · TP 4 · batch 44', peak: 1979, kernels: [
    ['GEMM FP8, skinny (M = 44)', 52, 88, 255, 50, 0, 18, 87, 'memory', 'Every step reads all weights for 44 tokens. Bigger batches or speculative decoding raise intensity.'],
    ['Paged attention decode (split-KV)', 27, 1.9, 5.4, 63, 22, 34, 82, 'memory', 'Reads each KV block once. FP8 KV halves the bytes; GQA already shares K and V across 8 query heads.'],
    ['Custom all-reduce (one-shot, TP 4)', 9, 0, 0, 4, 0, 0, 3, 'latency', '1 MB messages are latency-bound: one-shot all-reduce in NVLink-mapped memory beats NCCL ring here.'],
    ['RMSNorm, RoPE, sampling', 7, 1.0, 0.8, 30, 48, 60, 25, 'latency', 'Tiny kernels: launch overhead dominates. Captured in CUDA graphs; fuse RoPE into the QKV epilogue.'],
    ['CPU scheduling and launch', 5, 0, 0, 0, 0, 0, 0, 'idle', 'Overlap the scheduler with GPU execution (async scheduling) to hide it.'],
  ] },
  prefill: { name: 'Prefill · Assistant 70B · FP8 · 8K-token prompt', peak: 1979, kernels: [
    ['GEMM FP8 (M = 8,192)', 58, 2700, 1180, 12, 0, 74, 34, 'compute', 'Compute-bound as expected. Chunked prefill keeps chunks large enough to stay here.'],
    ['FlashAttention-3 prefill, causal', 27, 900, 590, 25, 0, 88, 18, 'compute', 'Causal masking skips half the blocks; prefix-cached tokens skip attention entirely.'],
    ['NCCL all-reduce (TP 4)', 8, 0, 0, 6, 0, 0, 10, 'interconnect', 'Larger messages here, so bandwidth-bound rather than latency-bound.'],
    ['Norms, RoPE, KV write to paged cache', 7, 1.2, 2.2, 70, 51, 44, 79, 'memory', 'Writes K and V into paged blocks; FP8 KV halves this write.'],
  ] },
  moe: { name: 'MoE 235B-A22B · FP8 · B200 · EP 8', peak: 4500, kernels: [
    ['Grouped GEMM, experts', 38, 610, 1950, 12, 0, 66, 41, 'compute', 'Hot experts unbalance the groups; replicate them (EPLB) so every GPU does equal work.'],
    ['All-to-all dispatch + combine (DeepEP)', 24, 0, 0, 8, 0, 0, 20, 'interconnect', 'FP8 on the wire; two micro-batches overlap one communicating while the other computes.'],
    ['FlashAttention (MLA-free GQA)', 15, 480, 1250, 25, 0, 82, 25, 'compute', 'Fine.'],
    ['Router top-k + permute', 6, 0.8, 1.1, 55, 40, 35, 70, 'memory', 'Fuse top-k, permutation and the dispatch layout into one kernel.'],
    ['Waiting on hot GPU', 12, 0, 0, 0, 0, 0, 0, 'idle', 'Expert load imbalance; see Mixture of experts.'],
    ['Norms, residual, sampling', 5, 1.0, 1.9, 60, 50, 40, 80, 'memory', 'Fused.'],
  ] },
};
const BOUND = { compute: ['ok', 'Compute'], memory: ['blue', 'HBM'], interconnect: ['purple', 'Interconnect'], latency: ['warn', 'Latency'], idle: ['', 'Idle'] };
const OPTS = [
  ['FlashAttention-3', 'Tiles Q, K, V into shared memory; online softmax; never writes the N×N score matrix to HBM', { pretrain: 'on', decode: 'on', prefill: 'on', moe: 'on' }, '2 to 4× attention speed, O(N) memory'],
  ['FP8 GEMMs (Transformer Engine)', 'E4M3 with per-tensor or per-block scales; BF16 master weights', { pretrain: 'on', decode: 'on', prefill: 'on', moe: 'on' }, '1.5 to 1.9× GEMM throughput'],
  ['TMA + warp specialization', 'Tensor Memory Accelerator copies tiles HBM → SMEM asynchronously while consumer warps compute', { pretrain: 'on', decode: 'on', prefill: 'on', moe: 'on' }, 'Hides load latency'],
  ['L2 tile swizzling', 'Rasterize GEMM tiles so neighbouring CTAs share operands in L2', { pretrain: 'on', decode: 'n/a', prefill: 'on', moe: 'on' }, 'L2 hit 60% → 78%'],
  ['L2 persistence window', 'Pin the shared system-prompt KV and router weights in L2 (cudaAccessPolicyWindow)', { pretrain: 'n/a', decode: 'try', prefill: 'try', moe: 'try' }, 'Est. 4% decode step time'],
  ['Thread block clusters + TMA multicast', 'One HBM load feeds several SMs through distributed shared memory', { pretrain: 'try', decode: 'n/a', prefill: 'try', moe: 'try' }, 'Est. 6% GEMM time'],
  ['CUDA graphs', 'Capture the decode step once, replay with one launch', { pretrain: 'n/a', decode: 'on', prefill: 'n/a', moe: 'on' }, 'Removes ~40 µs per layer of launches'],
  ['Epilogue fusion', 'Norm, activation, RoPE and residual inside GEMM epilogues', { pretrain: 'try', decode: 'try', prefill: 'try', moe: 'on' }, 'One HBM round trip saved per fusion'],
  ['FP8 KV cache', 'Halves KV bytes read every decode step', { pretrain: 'n/a', decode: 'on', prefill: 'on', moe: 'on' }, '2× KV capacity, ~20% faster decode attention'],
  ['Async tensor parallel', 'Overlap all-gather and reduce-scatter with the sharded matmul', { pretrain: 'try', decode: 'n/a', prefill: 'try', moe: 'n/a' }, 'Est. 5% step time'],
];

function roofline(ks, peak, bw) {
  const W = 760, H = 260, L = 56, R = 16, T = 14, B = 34;
  const lx = (v) => L + (Math.log10(v) + 1) / 5 * (W - L - R);       // 0.1 .. 10^4 FLOP/B
  const ly = (v) => T + (1 - (Math.log10(v) + 1) / 5) * (H - T - B);  // 0.1 .. 10^4 TFLOPS
  const ridge = peak / (bw / 1e12);
  let g = '';
  for (let e = -1; e <= 4; e++) { g += `<line x1="${lx(10 ** e)}" x2="${lx(10 ** e)}" y1="${T}" y2="${H - B}" class="gl"/><text x="${lx(10 ** e)}" y="${H - 18}" class="xl" text-anchor="middle">${10 ** e >= 1 ? fmt(10 ** e) : 10 ** e}</text>`; g += `<line x1="${L}" x2="${W - R}" y1="${ly(10 ** e)}" y2="${ly(10 ** e)}" class="gl"/><text x="${L - 6}" y="${ly(10 ** e) + 3}" class="yl">${10 ** e >= 1 ? fmt(10 ** e) : 10 ** e}</text>`; }
  g += `<path d="M${lx(0.1)},${ly(0.1 * bw / 1e12)} L${lx(ridge)},${ly(peak)} L${lx(1e4)},${ly(peak)}" fill="none" stroke="var(--ink)" stroke-width="1.6"/>`;
  g += `<text x="${lx(0.3)}" y="${ly(0.3 * bw / 1e12) - 8}" class="mk" transform="rotate(-27 ${lx(0.3)} ${ly(0.3 * bw / 1e12) - 8})">HBM ${(bw / 1e12).toFixed(2)} TB/s</text><text x="${lx(3000)}" y="${ly(peak) - 6}" class="mk" text-anchor="end">peak ${fmt(peak)} TFLOPS</text><text x="${lx(ridge)}" y="${H - B + 0}" class="xl" text-anchor="middle" dy="-4">ridge ${Math.round(ridge)}</text>`;
  const col = { compute: C.green, memory: C.blue, latency: C.amber };
  ks.filter((k) => k[2] > 0 && k[3] > 0).forEach((k, i) => { g += `<circle cx="${lx(k[2])}" cy="${ly(k[3])}" r="${4 + k[1] / 8}" fill="${col[k[8]] || C.gray}" fill-opacity=".75" stroke="var(--surface)" stroke-width="1.5"><title>${h(k[0])}: ${k[3]} TFLOPS at ${k[2]} FLOP/B</title></circle><text x="${lx(k[2]) + 8 + k[1] / 8}" y="${ly(k[3]) + 3}" class="mk">${h(k[0].split(' (')[0].split(',')[0])}</text>`; });
  g += `<text x="${W - R}" y="${H - 2}" class="xl" text-anchor="end">arithmetic intensity, FLOP per byte of HBM traffic (log)</text><text x="${L}" y="${T - 4}" class="xl">TFLOPS (log)</text>`;
  return `<div class="ts"><svg class="ts-svg xy" viewBox="0 0 ${W} ${H}">${g}</svg></div>`;
}

/* FlashAttention: HBM traffic for one head, standard vs tiled. FA paper: standard
   reads and writes the N×N scores; FlashAttention streams K,V once per Q block. */
function attnBytes(N, d = 128, sramElems = 100e3) {
  const std = 2 * (4 * N * d + 4 * N * N);                 // Q,K,V,O + write S, read S, write P, read P (bf16)
  const passes = Math.ceil(N / Math.floor(sramElems / (4 * d)));
  const fa = 2 * (2 * N * d + passes * 2 * N * d);        // Q,O once; K,V once per Q block
  return { std, fa };
}

S.kern = S.kern || { wl: 'decode' };
VIEWS.kernels = () => {
  const w = WORK[S.kern.wl], ks = w.kernels, hw = S.kern.wl === 'moe' ? E.HW.b200 : E.HW.h100;
  const busy = ks.filter((k) => k[8] !== 'idle').reduce((a, k) => a + k[1], 0);
  const wavg = (i) => ks.filter((k) => k[8] !== 'idle' && k[i] > 0).reduce((a, k) => a + k[1] * k[i], 0) / Math.max(1, ks.filter((k) => k[8] !== 'idle' && k[i] > 0).reduce((a, k) => a + k[1], 0));
  const tc = ks.reduce((a, k) => a + k[1] * (k[3] / w.peak), 0) / 100;
  const Ns = [2048, 8192, 32768, 131072];
  return head('Kernels and memory', 'Where GPU time goes inside each kernel: compute or memory bound, SM occupancy, L1, L2 and HBM traffic, and which optimizations are on. Captured by the profiler on one rank, 20 steps.', 'Every kernel sits on the roofline: below the slanted HBM line it is memory-bound (more bytes per FLOP than the GPU can feed), under the flat line it is compute-bound. Decode GEMMs have about 90 FLOP per byte, far left of the ridge at ~590, so the fix is fewer bytes (FP8, bigger batches, speculative decoding), not faster math. Training GEMMs sit far right and are limited by tensor-core peak. Counters come from Nsight Compute: achieved occupancy, L1 and L2 hit rates, DRAM throughput as a share of peak.') + `
  <div class="grid"><div class="card c12"><div class="row between">${seg('kwl', S.kern.wl, [['pretrain', 'Pretraining'], ['prefill', 'Prefill'], ['decode', 'Decode'], ['moe', 'MoE']])}<span class="note">${h(w.name)}</span></div></div>
    <div class="card c3 kpi"><b>${busy}%</b><span>SM busy</span><small>${100 - busy}% idle, bubbles or launch gaps</small></div>
    <div class="card c3 kpi"><b>${(tc * 100).toFixed(0)}%</b><span>Of tensor-core peak</span><small>${fmt(w.peak)} TFLOPS ${S.kern.wl === 'moe' ? 'FP8, B200' : 'FP8, H100'}</small></div>
    <div class="card c3 kpi"><b>${wavg(7).toFixed(0)}%</b><span>HBM bandwidth used</span><small>time-weighted, of ${(hw.bw / 1e12).toFixed(2)} TB/s</small></div>
    <div class="card c3 kpi"><b>${wavg(6).toFixed(0)}%</b><span>L2 hit rate</span><small>time-weighted, memory kernels and GEMMs</small></div>
    <div class="card c8"><h3>Roofline</h3>${roofline(ks, w.peak, hw.bw)}<div class="lin-foot"><span class="lg"><i style="background:${C.green}"></i>Compute-bound</span><span class="lg"><i style="background:${C.blue}"></i>Memory-bound</span><span class="lg"><i style="background:${C.amber}"></i>Latency-bound</span><span class="spacer"></span><span>Dot size = share of step time</span></div></div>
    <div class="card c4"><h3>Memory hierarchy, ${S.kern.wl === 'moe' ? 'B200 (same layout, larger)' : 'H100 SXM'}</h3><div class="hier">${HIER.map(([n, cap, bw, use], i) => `<div class="hl" style="--w:${100 - i * 9}%"><div><b>${n}</b><span>${cap}</span></div><em>${bw}</em><small>${use}</small></div>`).join('')}</div></div>
    <div class="card c12"><h3>Kernels by time</h3><div class="scroll-x"><table class="table"><thead><tr><th>Kernel</th><th class="num">Time</th><th class="num">FLOP/B</th><th class="num">TFLOPS</th><th class="num">Occupancy</th><th class="num">L1 hit</th><th class="num">L2 hit</th><th class="num">HBM BW</th><th>Bound by</th><th>Next step</th></tr></thead><tbody>${ks.map((k) => `<tr><td class="mono small">${h(k[0])}</td><td class="num"><div class="tbar"><i style="width:${k[1] * 2}%"></i></div>${k[1]}%</td><td class="num">${k[2] ? fmt(k[2], k[2] < 10 ? 1 : 0) : ''}</td><td class="num">${k[3] ? fmt(k[3], k[3] < 10 ? 1 : 0) : ''}</td><td class="num">${k[4] ? k[4] + '%' : ''}</td><td class="num">${k[5] ? k[5] + '%' : k[8] === 'compute' ? 'SMEM' : ''}</td><td class="num">${k[6] ? k[6] + '%' : ''}</td><td class="num">${k[7] ? k[7] + '%' : ''}</td><td>${pill(BOUND[k[8]][0], BOUND[k[8]][1])}</td><td class="small">${h(k[9])}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">Low occupancy on GEMMs and FlashAttention is by design: one large CTA per SM holds big tiles in shared memory and registers. Occupancy matters for memory-bound kernels, which need many warps in flight to cover HBM latency.</p></div>
    <div class="card c7"><h3>FlashAttention: HBM traffic per head</h3><table class="table"><thead><tr><th>Sequence</th><th class="num">Standard attention</th><th class="num">FlashAttention</th><th class="num">Less traffic</th><th class="num">Score matrix it avoids</th></tr></thead><tbody>${Ns.map((N) => { const b = attnBytes(N); return `<tr><td class="mono">${fmt(N)}</td><td class="num">${gb(b.std)}</td><td class="num">${gb(b.fa)}</td><td class="num"><b>${(b.std / b.fa).toFixed(0)}×</b></td><td class="num">${gb(2 * N * N)}</td></tr>`; }).join('')}</tbody></table>
      <p class="note">Standard attention writes the N×N score matrix to HBM and reads it back for softmax and the value product. FlashAttention loads a block of Q into shared memory, streams K and V blocks past it, and keeps a running max and sum (online softmax), so scores never leave the SM. Memory drops from O(N²) to O(N); backward recomputes scores instead of storing them.</p></div>
    <div class="card c5"><h3>Inside one FlashAttention block</h3><div class="fa">
      <div class="fa-row"><span class="fa-l">HBM</span><div class="fa-b">Q<small>N × d</small></div><div class="fa-b">K<small>N × d</small></div><div class="fa-b">V<small>N × d</small></div><div class="fa-b out">O<small>N × d</small></div></div>
      <div class="fa-arrow">TMA async copy ↓ one Q block, then K, V blocks in turn</div>
      <div class="fa-row smem"><span class="fa-l">SMEM</span><div class="fa-b">Q<sub>i</sub><small>128 × d</small></div><div class="fa-b">K<sub>j</sub><small>128 × d</small></div><div class="fa-b">V<sub>j</sub><small>128 × d</small></div></div>
      <div class="fa-arrow">tensor cores ↓ S = Q<sub>i</sub>K<sub>j</sub><sup>T</sup>, P = exp(S − m), O += P·V<sub>j</sub></div>
      <div class="fa-row reg"><span class="fa-l">Registers</span><div class="fa-b">S, P tile</div><div class="fa-b">m, ℓ running max and sum</div><div class="fa-b">O<sub>i</sub> accumulator</div></div>
      <p class="note">FA2 parallelizes over sequence blocks; FA3 (Hopper) adds producer and consumer warps, overlaps softmax with the next GEMM, and supports FP8. Decode uses split-KV (FlashDecoding) so a single query still fills all SMs.</p></div></div>
    <div class="card c12"><h3>Optimizations</h3><table class="table"><thead><tr><th>Technique</th><th>What it does</th><th>Status here</th><th>Effect</th></tr></thead><tbody>${OPTS.map(([n, d, st, eff]) => { const s = st[S.kern.wl]; return `<tr><td><b>${h(n)}</b></td><td class="small">${h(d)}</td><td>${s === 'on' ? pill('ok', 'On') : s === 'try' ? pill('blue', 'Candidate') : pill('', 'Not applicable')}</td><td class="small">${h(eff)}</td></tr>`; }).join('')}</tbody></table></div>
  </div>`;
};
CLICKS.push(['kwl', (k) => { S.kern.wl = k; }]);

/* ───────────────────────── tenant optimizer ───────────────────────── */

const REGIONS = { 'us-west': ['usw2-h100-a', 'usw2-b200-c'], 'us-east': ['use1-h200-b'], 'eu-west': ['euw1-l40s-d'] };
S.ten = S.ten || { tenant: 'search', arch: 'core-70b', prompt: 4000, out: 400, prefixHit: 0.4, ttft: 1.0, itl: 0.035, peak: 220, avgPeak: 0.62, split: 'global', eu: false, hw: { h100: true, h200: true, b200: true, l40s: true }, headroom: 1.3, pick: {} };
if (typeof S.ten.pick !== 'object') S.ten.pick = {};

function freeGpus() {
  const out = {};
  for (const cl of E.CLUSTERS) { const n = E.clusterNodes(cl, ctx.F.jobs); out[cl.id] = n.filter((x) => x.state === 'idle' || x.state === 'spare').length * 8 - n.filter((x) => x.state === 'spare').length * 4; }
  return out;
}
const SPLITS = { us: [['us-west', 0.55], ['us-east', 0.45]], global: [['us-west', 0.45], ['us-east', 0.35], ['eu-west', 0.2]], eu: [['eu-west', 1]] };
const cfgLabel = (c) => `${E.HW[c.hw].name} · TP ${c.tp} · ${c.quant.toUpperCase()}${c.disagg ? ` · +${c.disagg} prefill` : ''}${c.spec ? ' · spec' : ''}`;

/* Serving configurations that meet the SLO on one GPU type, with goodput. Cached per input. */
const CACHE = new Map();
function configsFor(T, hwk) {
  const key = [T.arch, hwk, T.prompt, T.out, T.prefixHit, T.ttft, T.itl].join('|');
  if (CACHE.has(key)) return CACHE.get(key);
  const a = E.ARCH[T.arch], out = [];
  for (const tp of [1, 2, 4, 8]) for (const quant of ['fp8', 'int4', 'bf16']) for (const spec of [null, { k: 3, alpha: 0.72, kind: 'EAGLE-3' }]) for (const disagg of [0, tp]) {
    const c = { hw: hwk, tp, quant, kvq: quant === 'bf16' ? 'bf16' : 'fp8', prompt: +T.prompt, out: +T.out, prefixHit: +T.prefixHit, spec, disagg, cudaGraphs: true };
    if (!E.serveCapacity(a, c).fits) continue;
    const cur = E.serveCurve(a, c, { ttft: +T.ttft, itl: +T.itl }, 14);
    if (cur.goodput) out.push({ c, cur });
  }
  CACHE.set(key, out);
  return out;
}

/* Per region: every config on hardware that exists there, sized for its share of traffic. */
export function optimizeTenant(T) {
  const a = E.ARCH[T.arch], free = freeGpus(), split = T.eu ? SPLITS.eu : SPLITS[T.split];
  return split.map(([reg, share]) => {
    const opts = [];
    for (const clId of REGIONS[reg]) {
      const cl = E.CLUSTERS.find((x) => x.id === clId);
      if (!T.hw[cl.hw]) continue;
      for (const { c, cur } of configsFor(T, cl.hw)) {
        const gpusPer = c.tp + c.disagg, reps = Math.max(2, Math.ceil(T.peak * share * T.headroom / (cur.goodput * 0.7)));
        const gpus = reps * gpusPer, monthly = gpus * E.HW[cl.hw].cost * 730 * T.avgPeak;
        const tok = T.peak * share * T.avgPeak * T.out * 3600 * 730;
        opts.push({ reg, cl: clId, c, cur, reps, gpus, monthly, per1m: monthly / (tok / 1e6), fits: gpus <= free[clId], free: free[clId], at: p90(E.servePoint(a, c, T.peak * share / reps)), label: cfgLabel(c) });
      }
    }
    opts.sort((x, y) => (y.fits - x.fits) || x.monthly - y.monthly);
    const chosen = opts.filter((o) => o.fits)[T.pick[reg] || 0] || null;
    return { reg, share, opts, chosen };
  });
}

VIEWS.tenant = () => {
  const T = S.ten, plan = optimizeTenant(T);
  const ok = plan.every((p) => p.chosen);
  const tot = plan.reduce((a, p) => ({ m: a.m + (p.chosen ? p.chosen.monthly : 0), g: a.g + (p.chosen ? p.chosen.gpus : 0), r: a.r + (p.chosen ? p.chosen.reps : 0) }), { m: 0, g: 0, r: 0 });
  const tokAll = T.peak * T.avgPeak * T.out * 3600 * 730;
  const worst = plan.filter((p) => p.chosen).reduce((a, p) => ({ ttft: Math.max(a.ttft, p.chosen.at.ttft), itl: Math.max(a.itl, p.chosen.at.itl) }), { ttft: 0, itl: 0 });
  const sel = (k, opts) => `<select data-bind="ten.${k}">${opts.map(([v, t]) => `<option value="${v}"${String(v) === String(T[k]) ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
  const ctxSweep = [1000, 4000, 16000, 32000, 64000].map((p) => { const pl = optimizeTenant({ ...T, prompt: p, pick: {} }); const done = pl.every((x) => x.chosen); return [p, done ? pl.reduce((a, x) => a + x.chosen.monthly, 0) / (tokAll / 1e6) : null]; });
  const colors = { 'us-west': C.blue, 'us-east': C.purple, 'eu-west': C.teal };
  return head('Tenant optimizer', 'Give a tenant\'s model, context length, latency targets, traffic and constraints. For each region the optimizer sweeps the GPUs that region has, tensor parallel, precision, speculative decoding and prefill disaggregation, keeps what meets the SLO, and picks the cheapest one that fits the idle capacity there.', 'For each candidate configuration the serving model sweeps request rate to find goodput per replica under the TTFT and ITL targets. Replicas in a region = ceil(peak share × headroom / (70% of goodput)), never fewer than 2 for availability. A candidate fits only if that cluster has enough idle GPUs. Monthly cost assumes forecast-driven scaling (average load over peak) at list GPU prices. EU residency moves all traffic onto EU capacity, where only L40S nodes exist, which is often the binding constraint.') + `
  <div class="grid"><div class="card c12"><div class="fields">
    <label class="field">Tenant${sel('tenant', Object.entries(E.TEAMS).map(([k, t]) => [k, t.name]))}</label>
    <label class="field">Model${sel('arch', Object.entries(E.ARCH).map(([k, x]) => [k, x.name]))}</label>
    <label class="field">Prompt tokens${sel('prompt', [500, 1000, 2000, 4000, 8000, 16000, 32000, 64000].map((n) => [n, fmt(n)]))}</label>
    <label class="field">Output tokens${sel('out', [50, 200, 400, 1000, 3000].map((n) => [n, fmt(n)]))}</label>
    <label class="field">Prefix reuse${sel('prefixHit', [0, 0.2, 0.4, 0.6, 0.8].map((n) => [n, n * 100 + '%']))}</label>
    <label class="field">TTFT p90${sel('ttft', [[0.3, '300 ms'], [0.6, '600 ms'], [1, '1 s'], [2, '2 s'], [5, '5 s']])}</label>
    <label class="field">ITL p90${sel('itl', [[0.015, '15 ms'], [0.025, '25 ms'], [0.035, '35 ms'], [0.05, '50 ms'], [0.1, '100 ms']])}</label>
    <label class="field">Peak requests/s${sel('peak', [20, 60, 120, 220, 500, 1000, 2000].map((n) => [n, fmt(n)]))}</label>
    <label class="field">Regions${sel('split', [['us', 'US only'], ['global', 'US + EU'], ['eu', 'EU only']])}</label>
    <label class="field">Headroom${sel('headroom', [[1.1, '10%'], [1.3, '30%'], [1.5, '50%']])}</label>
    <div class="field">Hardware allowed<div class="hwchk">${Object.entries(E.HW).map(([k, x]) => `<label><input type="checkbox" data-bind="ten.hw.${k}" data-num="no" ${T.hw[k] ? 'checked' : ''}> ${x.name}</label>`).join('')}</div></div>
    <div class="field">Data residency<label class="hwchk"><input type="checkbox" data-bind="ten.eu" data-num="no" ${T.eu ? 'checked' : ''}> EU data stays in EU</label></div></div></div>
    <div class="card c3 kpi ${ok ? 'good' : 'bad'}"><b>${ok ? usd(tot.m / 1e3) + 'K' : 'No plan'}</b><span>Per month</span><small>${ok ? `${fmt(tot.g)} GPUs at peak, scaled by forecast` : 'a region has no option that fits'}</small></div>
    <div class="card c3 kpi"><b>${ok ? usd(tot.m / (tokAll / 1e6)) : 'n/a'}</b><span>Per 1M output tokens</span><small>${si(T.peak * T.avgPeak * T.out)} tokens/s average</small></div>
    <div class="card c3 kpi"><b>${ok ? `${ms(worst.ttft)} · ${ms(worst.itl)}` : 'n/a'}</b><span>Worst-region TTFT · ITL p90</span><small>targets ${ms(+T.ttft)} · ${ms(+T.itl)}</small></div>
    <div class="card c3 kpi"><b>${ok ? tot.r : 0}</b><span>Replicas</span><small>${plan.length} region${plan.length > 1 ? 's' : ''}, at least 2 each</small></div>
    <div class="card c12"><h3>Placement for ${h(E.TEAMS[T.tenant].name)}</h3><table class="table"><thead><tr><th>Region</th><th class="num">Traffic</th><th>Chosen configuration</th><th>Cluster</th><th class="num">Replicas</th><th class="num">GPUs / idle</th><th class="num">TTFT · ITL p90</th><th class="num">$ / month</th></tr></thead><tbody>${plan.map((p) => p.chosen ? `<tr><td><b>${p.reg}</b></td><td class="num">${(p.share * 100).toFixed(0)}% · ${si(T.peak * p.share)} req/s</td><td>${h(p.chosen.label)}</td><td class="mono">${p.chosen.cl}</td><td class="num">${p.chosen.reps}</td><td class="num">${fmt(p.chosen.gpus)} / ${fmt(p.chosen.free)}</td><td class="num">${ms(p.chosen.at.ttft)} · ${ms(p.chosen.at.itl)}</td><td class="num">${usd(p.chosen.monthly)}</td></tr>` : `<tr class="bad"><td><b>${p.reg}</b></td><td class="num">${(p.share * 100).toFixed(0)}%</td><td colspan="6">${p.opts.length ? `Cheapest SLO-meeting option ${h(p.opts[0].label)} needs ${fmt(p.opts[0].gpus)} GPUs; ${fmt(p.opts[0].free)} idle on ${p.opts[0].cl}. Reserve capacity or raise the latency target.` : `No allowed GPU in ${p.reg} can meet these targets for this model${p.reg === 'eu-west' ? ' (only L40S there)' : ''}. Relax ITL/TTFT, quantize, or route this traffic elsewhere if residency allows.`}</td></tr>`).join('')}</tbody></table>
      <div class="row"><button class="btn primary" data-act="ten-apply" ${ok && can('platform', 'sre', 'manager', 'ml_engineer') ? '' : 'disabled'}>Reserve and deploy as canary</button><span class="note">Reserves GPUs against ${h(E.TEAMS[T.tenant].name)}'s quota and starts a 5% canary in each region.</span></div></div>
    ${plan.map((p) => `<div class="card ${plan.length === 1 ? 'c12' : plan.length === 2 ? 'c6' : 'c4'}"><h3>${p.reg} options <span class="right">${p.opts.filter((o) => o.fits).length} of ${p.opts.length} fit</span></h3><table class="table"><thead><tr><th>Configuration</th><th class="num">Reps</th><th class="num">$ / 1M</th></tr></thead><tbody>${p.opts.slice(0, 6).map((o) => { const i = p.opts.filter((x) => x.fits).indexOf(o); return `<tr class="${o.fits ? 'click' : ''}${o === p.chosen ? ' sel' : ''}" ${o.fits ? `data-tenpick="${p.reg}:${i}"` : ''}><td class="small">${h(o.label)}${o.fits ? '' : ' ' + pill('warn', 'no capacity')}</td><td class="num">${o.reps}</td><td class="num">${usd(o.per1m)}</td></tr>`; }).join('') || '<tr><td colspan="3" class="note">Nothing meets the SLO here.</td></tr>'}</tbody></table></div>`).join('')}
    <div class="card c7"><h3>Cost against latency, every option</h3>${xyChart(plan.map((p) => ({ name: p.reg, color: colors[p.reg], dots: true, pts: p.opts.map((o) => [o.at.itl * 1000, o.per1m]).sort((x, y) => x[0] - y[0]) })), { xl: 'ITL p90 at peak, ms', fy: (v) => '$' + v.toFixed(2), fx: (v) => Math.round(v), w: 760, hgt: 230, marks: plan.filter((p) => p.chosen).map((p) => ({ x: p.chosen.at.itl * 1000, y: p.chosen.per1m, color: C.green, label: p.reg })) })}</div>
    <div class="card c5"><h3>Cost as context grows</h3>${xyChart([{ name: '$ per 1M tokens', color: C.blue, dots: true, pts: ctxSweep.filter((x) => x[1]).map(([p, v]) => [p, v]) }], { xl: 'prompt tokens', fy: (v) => '$' + v.toFixed(2), w: 520, hgt: 230 })}<p class="note">Longer prompts cost prefill compute and KV memory, so the batch per replica falls.${ctxSweep.some((x) => !x[1]) ? ` No full plan at ${ctxSweep.filter((x) => !x[1]).map((x) => fmt(x[0])).join(', ')} tokens.` : ''}</p></div>
  </div>`;
};
CLICKS.push(['tenpick', (v) => { const [reg, i] = v.split(':'); S.ten.pick[reg] = +i; }]);
ACTIONS['ten-apply'] = () => {
  const T = S.ten, plan = optimizeTenant(T); if (!plan.every((p) => p.chosen)) return;
  const F = ctx.F, a = E.ARCH[T.arch];
  for (const p of plan) {
    const o = p.chosen, id = `${T.tenant}-${T.arch}-${p.reg}`.replace(/[^a-z0-9-]/g, '');
    if (F.dep(id)) continue;
    F.deps.push({ id, name: `${E.TEAMS[T.tenant].name} ${a.name.replace('Acme ', '')} ${p.reg}`, model: E.MODELS.find((m) => m.id === T.arch).versions[0][0], arch: T.arch, team: T.tenant, engine: 'vLLM', version: '0.11.1', region: p.reg, state: 'canary', cfg: { ...o.c }, replicas: o.reps, min: 2, max: o.reps * 2, slo: { ttft: +T.ttft, itl: +T.itl }, peak: T.peak * p.share, features: ['Placed by the tenant optimizer', `${o.reps} × ${o.cl}`], canary: { from: 'none', to: 'new', step: 1, steps: [5, 25, 50, 100], since: Date.now() } });
  }
  F.event(Date.now(), T.tenant, 'deploy', `${me().name} applied a tenant plan for ${E.TEAMS[T.tenant].name}: ${plan.map((p) => `${p.reg} ${p.chosen.label} × ${p.chosen.reps}`).join('; ')}.`);
  toast(`Plan applied in ${plan.length} region${plan.length > 1 ? 's' : ''}, canaries started`); ui.renderChrome();
};

/* ───────────────────────── tenants and cost ───────────────────────── */

VIEWS.tenants = () => {
  const F = ctx.F, rows = Object.entries(E.TEAMS).map(([k, t]) => {
    const train = F.jobs.filter((j) => j.team === k && j.state === 'running').reduce((a, j) => a + E.jobGpus(j), 0);
    const serve = F.deps.filter((d) => d.team === k).reduce((a, d) => a + d.replicas * (d.cfg.tp + (d.cfg.disagg || 0)), 0);
    const toks = F.deps.filter((d) => d.team === k).reduce((a, d) => a + F.servingNow(d).tpsAll, 0);
    const mtd = (train + serve) * 2.9 * 24 * 30 * 0.97;
    const budget = t.quota * 2.9 * 24 * 30 * 0.9;
    return { k, t, train, serve, toks, mtd, budget, eff: train ? 0.35 + (k.length % 5) * 0.04 : null, idle: Math.max(0, t.quota - train - serve) };
  });
  const total = rows.reduce((a, r) => a + r.mtd, 0);
  return head('Tenants and cost', 'Every team is a tenant with a GPU quota, a budget and an SLA tier. Spend is charged back from metered GPU-hours, and idle quota is visible so it can be lent.') + `<div class="grid">
    <div class="card c3 kpi"><b>${usd(total / 1e6)}M</b><span>Projected this month</span><small>all tenants, list price</small></div>
    <div class="card c3 kpi"><b>${fmt(rows.reduce((a, r) => a + r.idle, 0))}</b><span>Idle guaranteed GPUs</span><small>lendable at P2 right now</small></div>
    <div class="card c3 kpi"><b>${si(rows.reduce((a, r) => a + r.toks, 0))}/s</b><span>Tokens served</span><small>metered per tenant at the router</small></div>
    <div class="card c3 kpi"><b>99.95%</b><span>Gold SLA attainment</span><small>trailing 30 days</small></div>
    <div class="card c12"><div class="scroll-x"><table class="table"><thead><tr><th>Tenant</th><th>SLA</th><th class="num">Quota</th><th class="num">Training GPUs</th><th class="num">Serving GPUs</th><th class="num">Idle</th><th class="num">Tokens/s</th><th class="num">MFU</th><th class="num">Month to date</th><th>Budget</th></tr></thead><tbody>${rows.map((r) => `<tr><td><b>${h(r.t.name)}</b><span class="id">${h(r.t.lead)}</span></td><td>${pill(['assistant', 'search'].includes(r.k) ? 'ok' : r.k === 'foundation' ? 'blue' : '', ['assistant', 'search'].includes(r.k) ? 'Gold' : r.k === 'foundation' ? 'Silver' : 'Bronze')}</td><td class="num">${fmt(r.t.quota)}</td><td class="num">${fmt(r.train)}</td><td class="num">${fmt(r.serve)}</td><td class="num">${fmt(r.idle)}</td><td class="num">${r.toks ? si(r.toks) : ''}</td><td class="num">${r.eff ? (r.eff * 100).toFixed(0) + '%' : ''}</td><td class="num">${usd(r.mtd / 1e3)}K</td><td><div class="quota"><i class="${r.mtd > r.budget ? 'over' : ''}" style="width:${Math.min(100, r.mtd / r.budget * 100).toFixed(0)}%"></i></div><span class="id">${(r.mtd / r.budget * 100).toFixed(0)}% of ${usd(r.budget / 1e3)}K</span></td></tr>`).join('')}</tbody></table></div>
      <p class="note">GPU-hours are metered per pod from the scheduler; serving cost is split by tokens when a deployment is shared. SLA tiers: Gold (interactive, never preempted, two regions), Silver (P1), Bronze (P2, preemptible).</p></div>
    <div class="card c12"><h3>Plan a tenant</h3><p class="note">Size a new workload against latency, context length and regions, then reserve it.</p><div class="row"><button class="btn primary" data-go="tenant">Open the tenant optimizer</button></div></div></div>`;
};
