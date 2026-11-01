/* Runtime internals and operations: KV cache, mixture of experts, GPU
   telemetry, and demand forecasting that sizes serving and lends the rest. */
import { E, h, fmt, si, gb, ms, dur, ago, usd, ctx, S, VIEWS, ACTIONS, CLICKS, head, pill, glist, stack, seg, C, xyChart, can, me, toast, ui, p90 } from './core.js?v=20261101-2';
import { tsChart, RANGES } from './charts.js?v=20261101-2';

const rnd = (i, j = 0) => { const x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return x - Math.floor(x); };
const depSel = (attr, cur, filter = () => true) => `<div class="seg">${ctx.F.deps.filter(filter).map((d) => `<button class="${d.id === cur ? 'on' : ''}" data-${attr}="${d.id}">${h(d.name)}</button>`).join('')}</div>`;

/* ───────────────────────── KV cache ───────────────────────── */

S.kv = S.kv || { dep: 'assistant-70b', seq: 0 };
VIEWS.kv = () => {
  const F = ctx.F, d = F.dep(S.kv.dep) || F.deps[0], a = E.ARCH[d.arch], c = d.cfg, s = F.servingNow(d);
  const per = E.kvPerToken(a, c.kvq), blockTok = 16, blocks = Math.floor(s.cap.kvTokens / blockTok);
  const show = 480, active = Math.round(show * s.kvActive), cached = Math.round(show * s.kvCached);
  const seqs = Math.max(4, Math.min(24, Math.round(s.B)));
  const pal = [C.blue, C.indigo, C.purple, '#3a7bd5', '#5b8def', '#6e7bf2'];
  let cells = '';
  for (let i = 0; i < show; i++) {
    const r = rnd(i, 3), cls = i < active ? 'a' : i < active + cached ? 'c' : 'f';
    const own = cls === 'a' ? Math.floor(r * seqs) : -1;
    const col = cls === 'a' ? pal[own % pal.length] : cls === 'c' ? C.teal : 'var(--fill-2)';
    cells += `<i class="${own === S.kv.seq ? 'hl' : ''}" style="background:${col}" title="${cls === 'a' ? `block ${i}: sequence ${own}` : cls === 'c' ? `block ${i}: cached prefix, refcount 0` : `block ${i}: free`}"></i>`;
  }
  const table = Array.from({ length: 8 }, (_, k) => [k, Math.floor(rnd(k, S.kv.seq + 1) * blocks)]);
  const tiers = [['GPU HBM', (c.prefixHit || 0) * 0.86, C.blue], ['Host DRAM (offload)', (c.prefixHit || 0) * 0.14 + 0.06, C.teal], ['Recomputed', Math.max(0, 1 - (c.prefixHit || 0) - 0.06), 'var(--fill-2)']];
  const fp = E.serveCapacity(a, { ...c, kvq: 'fp8' }), bf = E.serveCapacity(a, { ...c, kvq: 'bf16' });
  const kvUse = Array.from({ length: 49 }, (_, i) => { const t = Date.now() - RANGES[S.range].ms + i * RANGES[S.range].ms / 48, x = F.servingNow(d, t); return [t, (x.kvActive + x.kvCached) * 100]; });
  return head('KV cache', 'Where every token of context lives: paged blocks in GPU memory, a prefix tree shared across requests, a host-memory tier, and the policy that decides what to evict.', 'Keys and values for every past token are kept so decode never recomputes them. Memory is split into fixed 16-token blocks (PagedAttention); each sequence has a block table mapping its logical blocks to physical ones, so there is no fragmentation and shared prefixes are stored once with a reference count. Blocks with refcount 0 stay as cache until LRU evicts them. When memory runs out the scheduler preempts the newest sequence and either swaps its blocks to host memory or recomputes them later.') + `
  <div class="grid"><div class="card c12">${depSel('kvdep', d.id)}</div>
    <div class="card c3 kpi"><b>${fmt(per / 1024)} KB</b><span>Per token</span><small>2 × ${a.layers} layers × ${a.kv} KV heads × ${a.hd} dims × ${c.kvq === 'fp8' ? 1 : 2} B</small></div>
    <div class="card c3 kpi"><b>${si(s.cap.kvTokens)}</b><span>Tokens per replica</span><small>${fmt(blocks)} blocks of 16 · ${gb(s.cap.kvBytes)}</small></div>
    <div class="card c3 kpi"><b>${((c.prefixHit || 0) * 100).toFixed(0)}%</b><span>Prefix hit rate</span><small>prefill skipped for cached tokens</small></div>
    <div class="card c3 kpi"><b>${s.kvActive > 0.85 ? '14' : '0.3'}/min</b><span>Preemptions</span><small>${s.kvActive > 0.85 ? 'memory pressure' : 'recompute policy, rare'}</small></div>
    <div class="card c8"><h3>Block pool, one replica <span class="right">${show} of ${fmt(blocks)} blocks shown</span></h3><div class="kvgrid">${cells}</div>
      <div class="lin-foot"><span class="lg"><i style="background:${C.blue}"></i>Active sequence</span><span class="lg"><i style="background:${C.teal}"></i>Cached prefix, refcount 0</span><span class="lg"><i style="background:var(--fill-2)"></i>Free</span><span class="spacer"></span><span>${(s.kvActive * 100).toFixed(0)}% active · ${(s.kvCached * 100).toFixed(0)}% cached</span></div></div>
    <div class="card c4"><h3>Block table, sequence <select data-bind="kv.seq">${Array.from({ length: Math.min(seqs, 12) }, (_, i) => `<option value="${i}"${i === S.kv.seq ? ' selected' : ''}>${i}</option>`).join('')}</select></h3><table class="table"><thead><tr><th>Logical</th><th>Physical</th><th>Tokens</th><th>Refs</th></tr></thead><tbody>${table.map(([l, p], i) => `<tr><td class="mono">${l}</td><td class="mono">${p}</td><td class="mono">${l * 16}–${l * 16 + 15}</td><td>${i < 3 ? pill('blue', i === 0 ? '214' : i === 1 ? '38' : '2') : '1'}</td></tr>`).join('')}</tbody></table><p class="note">The first blocks hold the shared system prompt, referenced by many sequences. Copy-on-write when a sequence diverges.</p></div>
    <div class="card c6"><h3>Prefix tree</h3><div class="tree">
      <div class="tn root"><b>System prompt v14</b><span>1,120 tokens · 214 live refs · hit 98%</span></div>
      <div class="tc"><div class="tn"><b>Tools schema</b><span>640 tokens · 121 refs</span></div><div class="tc"><div class="tn leaf"><b>Conversation turns</b><span>per user, 2 to 9 turns cached</span></div></div></div>
      <div class="tc"><div class="tn"><b>Few-shot: summarization</b><span>880 tokens · 38 refs</span></div></div>
      <div class="tc"><div class="tn"><b>RAG context</b><span>unique per request · rarely reused</span></div></div></div>
      <p class="note">The router hashes the first blocks of each request and sends it to the replica that already holds that prefix (consistent hashing with load bounds), so hits survive scale-out.</p></div>
    <div class="card c6"><h3>Where prefix tokens come from</h3>${stack(tiers, (v) => (v * 100).toFixed(0) + '%')}
      ${glist([['Eviction', 'LRU over refcount-0 blocks; leaves before shared roots'], ['Preemption', 'Recompute for short contexts, swap to host above 8K tokens'], ['Host tier', `${E.HW[c.hw].mem * 2} GB of DRAM per GPU, KV moved over PCIe at 50 GB/s`], ['KV precision', `${c.kvq.toUpperCase()}: ${si(fp.kvTokens)} tokens in FP8 vs ${si(bf.kvTokens)} in BF16`]])}</div>
    <div class="card c12"><h3>KV cache in use, ${RANGES[S.range].label.toLowerCase()}</h3>${tsChart([{ name: 'KV in use', color: C.teal, points: kvUse }], { range: S.range, w: 1120, height: 140, fmt: (v) => Math.round(v) + '%', area: true })}</div>
  </div>`;
};
CLICKS.push(['kvdep', (id) => { S.kv.dep = id; S.kv.seq = 0; }]);

/* ───────────────────────── mixture of experts ───────────────────────── */

S.moe = S.moe || { balanced: false };
VIEWS.moe = () => {
  const a = E.ARCH['moe-235b'], L = 12, X = 64, bal = S.moe.balanced;
  const load = (l, e) => { const hot = (e * 7 + l * 3) % 23 === 0 || (e + l) % 31 === 0; const base = 0.55 + 0.9 * rnd(l, e); return bal ? 0.85 + 0.3 * rnd(l, e + 99) : base * (hot ? 2.6 : 1); };
  let cells = '', max = 0, sum = 0;
  for (let l = 0; l < L; l++) for (let e = 0; e < X; e++) { const v = load(l, e); max = Math.max(max, v); sum += v; }
  const mean = sum / (L * X);
  for (let l = 0; l < L; l++) { cells += `<span class="ml">L${l * 8}</span>`; for (let e = 0; e < X; e++) { const v = load(l, e) / mean; cells += `<i style="background:${v > 1.8 ? C.red : v > 1.3 ? C.amber : `rgba(10,132,255,${(0.15 + 0.6 * Math.min(1, v / 1.3)).toFixed(2)})`}" title="layer ${l * 8}, expert ${e}: ${v.toFixed(2)}× mean"></i>`; } }
  const imb = max / mean;
  const gpuLoad = Array.from({ length: 8 }, (_, g) => { let t = 0; for (let l = 0; l < L; l++) for (let e = g * 8; e < g * 8 + 8; e++) t += load(l, e); return t; });
  const gmax = Math.max(...gpuLoad), gmean = gpuLoad.reduce((x, y) => x + y) / 8;
  // Each layer waits for its busiest GPU, so the cost is the per-layer max, not the total.
  let worst = 0;
  for (let l = 0; l < L; l++) { const g = Array.from({ length: 8 }, (_, k) => { let t = 0; for (let e = k * 8; e < k * 8 + 8; e++) t += load(l, e); return t; }); worst += Math.max(...g) / (g.reduce((x, y) => x + y) / 8); }
  const step = bal ? 1.04 : worst / L;
  const a2a = bal ? 0.17 : 0.24, drop = bal ? 0.02 : 0.61;
  return head('Mixture of experts', `${a.name}: ${a.experts} experts per layer, ${a.topk} routed per token, ${si(a.active)} of ${si(a.params)} parameters active. Expert parallel serving and training live or die by routing balance.`, 'A router picks the top 8 of 128 experts for each token. With expert parallelism the experts are spread across GPUs and tokens travel to them by all-to-all, twice per MoE layer (dispatch and combine). If some experts are hot, the GPUs holding them become stragglers for every layer. Balancing uses a bias on router logits during training (auxiliary-loss-free), a capacity factor that drops overflow tokens, and at serving time expert placement that replicates hot experts onto spare slots (EPLB).') + `
  <div class="grid">
    <div class="card c3 kpi ${bal ? 'good' : 'bad'}"><b>${imb.toFixed(2)}×</b><span>Hottest expert vs mean</span><small>${bal ? 'after rebalancing' : 'skewed by code and math traffic'}</small></div>
    <div class="card c3 kpi ${bal ? 'good' : ''}"><b>${step.toFixed(2)}×</b><span>Busiest GPU per layer vs mean</span><small>EP 8: every layer waits for it</small></div>
    <div class="card c3 kpi"><b>${(a2a * 100).toFixed(0)}%</b><span>Step time in all-to-all</span><small>dispatch + combine, NVLink</small></div>
    <div class="card c3 kpi ${drop > 0.1 ? 'bad' : 'good'}"><b>${drop.toFixed(2)}%</b><span>Tokens over capacity</span><small>capacity factor 1.25</small></div>
    <div class="card c12"><h3>Expert load by layer <span class="right">64 of 128 experts, every 8th layer · color = tokens vs mean</span></h3><div class="moegrid">${cells}</div>
      <div class="lin-foot"><span class="lg"><i style="background:rgba(10,132,255,.5)"></i>Near mean</span><span class="lg"><i style="background:${C.amber}"></i>1.3 to 1.8×</span><span class="lg"><i style="background:${C.red}"></i>Over 1.8×</span><span class="spacer"></span>${bal ? `<span>${pill('ok', 'EPLB placement applied')}</span>` : `<button class="btn primary" data-act="moe-balance" ${can('platform', 'sre', 'researcher') ? '' : 'disabled'}>Rebalance experts (EPLB)</button>`}</div></div>
    <div class="card c6"><h3>Tokens per GPU, expert parallel 8</h3>${gpuLoad.map((v, g) => `<div class="bar-row"><span>GPU ${g} · experts ${g * 16} to ${g * 16 + 15}</span><div class="track"><div class="fill ${v / gmean > 1.15 ? 'red' : ''}" style="width:${(v / gmax * 100).toFixed(0)}%"></div></div><span class="v">${(v / gmean).toFixed(2)}×</span></div>`).join('')}<p class="note">${bal ? '16 redundant slots now hold copies of the hottest experts; the router splits their tokens across copies.' : 'GPU loads differ because hot experts cluster on a few GPUs. Replicating them into 16 spare slots evens this out without retraining.'}</p></div>
    <div class="card c6"><h3>One MoE layer</h3>${stack([['Attention (TP)', 0.31, C.blue], ['Router + permute', 0.05, C.gray], ['All-to-all dispatch', a2a / 2, C.purple], ['Expert GEMMs (grouped)', bal ? 0.38 : 0.31 * step, C.indigo], ['All-to-all combine', a2a / 2, C.purple], ['Waiting on hot GPU', bal ? 0 : 0.12, C.red]], (v) => (v * 100).toFixed(0) + '%')}
      ${glist([['Dispatch', 'DeepEP-style kernels, FP8 activations on the wire'], ['Overlap', 'Two micro-batches interleave so one computes while the other communicates'], ['Experts', 'Grouped GEMM over all local experts in one kernel'], ['Training balance', 'Router bias updated each step (no auxiliary loss), sequence-level balance loss 1e-4']])}</div>
  </div>`;
};
ACTIONS['moe-balance'] = () => { S.moe.balanced = true; ctx.F.event(Date.now(), 'moe-235b', 'deploy', `Expert placement rebalanced by ${me().name}: hot experts replicated into 16 spare slots.`); toast('Expert placement rebalanced. Throughput up about 18%.'); };

/* ───────────────────────── GPU telemetry ───────────────────────── */

S.gpu = S.gpu || { job: 'pt-core-70b-v3', node: 0, metric: 'sm' };
const METRICS = {
  sm: ['SM active', '%', (j, g, t) => (j.kind === 'rl' ? 62 : 88) - (g === 5 && j.straggler ? 0 : 0) + 6 * Math.sin(t / 9e5 + g)],
  tensor: ['Tensor core active', '%', (j, g, t) => (j.kind === 'rl' ? 38 : 52) + 5 * Math.sin(t / 7e5 + g * 1.3)],
  hbm: ['HBM bandwidth used', '%', (j, g, t) => (j.kind === 'rl' ? 71 : 44) + 6 * Math.sin(t / 6e5 + g)],
  power: ['Power', 'W', (j, g, t) => (g === 5 && j.straggler ? 610 : 655) + 25 * Math.sin(t / 8e5 + g)],
  temp: ['Temperature', '°C', (j, g, t) => (g === 5 && j.straggler ? 86 : 64) + 2 * Math.sin(t / 9e5 + g)],
  clock: ['SM clock', 'MHz', (j, g, t) => (g === 5 && j.straggler ? 1590 : 1980) - 10 * Math.abs(Math.sin(t / 9e5 + g))],
  nvlink: ['NVLink throughput', 'GB/s', (j, g, t) => (j.cfg.tp > 1 ? 210 : 40) + 30 * Math.sin(t / 5e5 + g)],
  ib: ['InfiniBand throughput', 'GB/s', (j, g, t) => 21 + 6 * Math.sin(t / 4e5 + g)],
};
VIEWS.gpu = () => {
  const F = ctx.F, live = F.jobs.filter((j) => j.state === 'running');
  const j = F.job(S.gpu.job) || live[0], M = METRICS[S.gpu.metric];
  const bad = j.straggler && j.id === 'pt-core-70b-v3';
  const node = S.gpu.node;
  const series = Array.from({ length: 8 }, (_, g) => ({ name: `GPU ${g}`, color: g === 5 && bad && node === 311 % 256 ? C.red : [C.blue, C.indigo, C.purple, C.teal, '#3a7bd5', '#8e8e93', '#5e5ce6', '#30b0c7'][g], points: Array.from({ length: 61 }, (_, i) => { const t = Date.now() - 36e5 + i * 6e4; const sg = bad && node === 311 % 256 ? g : -1; return [t, M[2]({ ...j, straggler: sg === 5 ? j.straggler : null }, g, t) + rnd(i, g) * 1.5]; }) }));
  const nodes = Math.min(256, E.jobGpus(j) / 8);
  let heat = '';
  for (let n = 0; n < nodes; n++) { const v = bad && n === 311 % 256 ? 0.62 : 0.86 + 0.08 * rnd(n, 7); heat += `<i class="${n === node ? 'on' : ''}" data-gpunode="${n}" style="background:rgba(10,132,255,${(v - 0.4).toFixed(2)})" title="node ${n}: SM ${Math.round(v * 100)}%"></i>`; }
  const kernels = j.kind === 'rl' ? [['paged_attention_decode (vLLM)', 31], ['GEMM bf16 (cuBLASLt)', 24], ['flash_attn_varlen_fwd/bwd', 17], ['ncclKernel_Broadcast (weight sync)', 6], ['fused_rmsnorm + rope', 5], ['other', 17]] : [['GEMM fp8 (Transformer Engine)', 46], ['flash_attn_fwd/bwd (FA3)', 19], ['ncclKernel_AllReduce (TP)', 9], ['ncclKernel_ReduceScatter / AllGather (DP)', 4], ['fused_rmsnorm, swiglu, rope', 7], ['idle (pipeline bubble, waits)', 15]];
  return head('GPU telemetry', 'DCGM counters for every GPU, joined to the job that owns it. The fleet view finds the slow node; the node view finds the slow GPU; a profile finds the slow kernel.', 'Collected every 10 s by dcgm-exporter into Prometheus, plus NCCL and engine metrics. SM active and tensor-core active say whether the GPU is busy and whether that work is matmul. HBM bandwidth says whether decode is memory-bound. Clock, power and temperature catch throttling. XID and ECC counters feed the health agent that cordons nodes.') + `
  <div class="grid"><div class="card c12"><div class="row between"><div class="seg">${live.map((x) => `<button class="${x.id === j.id ? 'on' : ''}" data-gpujob="${x.id}">${h(x.name)}</button>`).join('')}</div><button class="btn" data-act="profile" ${can('platform', 'sre', 'researcher', 'ml_engineer') ? '' : 'disabled'}>Capture profile (20 steps)</button></div></div>
    <div class="card c3 kpi"><b>${Math.round(METRICS.sm[2](j, 0, Date.now()))}%</b><span>SM active, job mean</span><small>${fmt(E.jobGpus(j))} GPUs</small></div>
    <div class="card c3 kpi"><b>${Math.round(METRICS.tensor[2](j, 0, Date.now()))}%</b><span>Tensor core active</span><small>share of cycles in matmul units</small></div>
    <div class="card c3 kpi"><b>${Math.round(METRICS.hbm[2](j, 0, Date.now()))}%</b><span>HBM bandwidth</span><small>of ${(E.HW[j.cfg.hw].bw / 1e12).toFixed(2)} TB/s</small></div>
    <div class="card c3 kpi ${bad ? 'bad' : 'good'}"><b>${bad ? 1 : 0}</b><span>GPUs throttling</span><small>${bad ? 'node 55, GPU 5: thermal' : 'none in this job'}</small></div>
    <div class="card c12"><h3>SM active by node <span class="right">${nodes} nodes · select one</span></h3><div class="heat">${heat}</div></div>
    <div class="card c12"><div class="row between"><h3>Node ${node}, 8 GPUs, last hour</h3><div class="seg">${Object.entries(METRICS).map(([k, [n]]) => `<button class="${k === S.gpu.metric ? 'on' : ''}" data-gpumetric="${k}">${n}</button>`).join('')}</div></div>${tsChart(series, { range: '1h', w: 1120, height: 200, fmt: (v) => Math.round(v) + (M[1] === '%' ? '%' : '') })}</div>
    ${S.gpu.profiled === j.id ? `<div class="card c7"><h3>Profile: top kernels by GPU time <span class="right">Nsight Systems, rank 0, 20 steps</span></h3>${kernels.map(([k, v]) => `<div class="bar-row"><span class="mono">${h(k)}</span><div class="track"><div class="fill" style="width:${v * 2}%"></div></div><span class="v">${v}%</span></div>`).join('')}</div>
    <div class="card c5"><h3>Reading the profile</h3><ul class="why">${j.kind === 'rl' ? '<li>Decode attention dominates: rollout is memory-bound, so larger batches or FP8 KV help more than faster GEMMs.</li><li>Weight broadcast is 6%; bucketed and overlapped with the next rollout start.</li>' : '<li>GEMMs at 46% with FP8: the matmul path is healthy.</li><li>15% idle is the pipeline bubble plus waits on the slow rank.</li><li>TP all-reduce at 9% is mostly exposed; async TP would hide about half.</li>'}</ul><a class="btn" href="#" data-go="runs">Open the run</a></div>` : ''}
    <div class="card c12"><h3>Alert rules</h3><table class="table"><thead><tr><th>Rule</th><th>Condition</th><th>Action</th><th>Last fired</th></tr></thead><tbody>${[['GPU fell off the bus', 'XID 79 or 48', 'Cordon node, page SRE, swap hot spare', '26 min ago'], ['Thermal throttle', 'SM clock < 85% of peers for 5 min', 'Flag straggler on the job', '2 h ago'], ['ECC rows near limit', 'Remapped rows > 6', 'Drain at next checkpoint', '3 d ago'], ['NCCL hang', 'No collective progress for 300 s', 'Dump flight recorder on every rank, restart', '9 d ago'], ['IB link flapping', '> 5 link-downs per hour', 'Drain node, open hardware ticket', '1 d ago'], ['Serving SLO burn', '2% of 30-day error budget in 1 h', 'Page owning team', '3 h ago']].map((r) => `<tr>${r.map((x) => `<td>${h(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  </div>`;
};
CLICKS.push(['gpujob', (id) => { S.gpu.job = id; S.gpu.node = 0; }]);
CLICKS.push(['gpunode', (n) => { S.gpu.node = +n; }]);
CLICKS.push(['gpumetric', (k) => { S.gpu.metric = k; }]);
ACTIONS.profile = () => { S.gpu.profiled = S.gpu.job; toast('Profile captured on rank 0 for 20 steps'); };

/* ───────────────────────── demand forecast ───────────────────────── */

S.fc = S.fc || { dep: 'all', applied: false, lend: true };
/* Demand model: daily and weekly seasonality, trend and a known launch event.
   Forecast is the same model forward with a widening interval. */
function demand(d, hrs) {
  const t = Date.now() + hrs * 36e5, dt = new Date(t);
  const hr = dt.getUTCHours() + dt.getUTCMinutes() / 60, dow = dt.getUTCDay();
  const day = 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(((hr - 13) / 24) * 2 * Math.PI));
  const week = dow === 0 || dow === 6 ? 0.82 : 1;
  const trend = 1 + hrs / (24 * 90);
  const launch = d.id === 'assistant-8b' && hrs > 30 && hrs < 40 ? 1.35 : 1;
  return d.peak * day * week * trend * launch;
}
VIEWS.forecast = () => {
  const F = ctx.F, deps = S.fc.dep === 'all' ? F.deps.filter((d) => d.id !== 'edge-3b-eval') : [F.dep(S.fc.dep)];
  const H0 = -72, H1 = 48;
  const perRep = Object.fromEntries(deps.map((d) => { const c = E.serveCurve(E.ARCH[d.arch], d.issue ? { ...d.cfg, prompt: 5800 } : d.cfg, d.slo, 14); return [d.id, { gp: c.goodput * 0.7, gpus: d.cfg.tp + (d.cfg.disagg || 0) }]; }));
  const gpusFor = (hrs, q = 1) => deps.reduce((a, d) => a + Math.max(d.min, Math.min(d.max, Math.ceil(demand(d, hrs) * q / perRep[d.id].gp))) * perRep[d.id].gpus, 0);
  const pts = (fn, from, to, step = 1) => { const o = []; for (let x = from; x <= to; x += step) o.push([x - H0, fn(x)]); return o; };
  const req = (hrs) => deps.reduce((a, d) => a + demand(d, hrs), 0);
  const actual = pts((x) => req(x) * (1 + 0.04 * (rnd(x, 2) - 0.5)), H0, 0);
  const band = (x) => 0.04 + 0.0025 * x;
  const fc = pts(req, 0, H1), hi = pts((x) => req(x) * (1 + band(x) * 1.6), 0, H1), lo = pts((x) => req(x) * (1 - band(x) * 1.6), 0, H1);
  const planned = pts((x) => gpusFor(x + 0.25, x > 0 ? 1 + band(x) * 1.6 : 1), H0, H1);
  const reactive = pts((x) => gpusFor(x - 0.1) * 1.0, H0, H1);
  const flat = deps.reduce((a, d) => a + d.max * perRep[d.id].gpus, 0);
  const peakPlan = Math.max(...planned.map((p) => p[1])), next24 = planned.filter((p) => p[0] >= -H0 && p[0] <= -H0 + 24);
  const freeHours = next24.reduce((a, p) => a + (peakPlan - p[1]), 0);
  const cost = deps.length ? E.HW[deps[0].cfg.hw].cost : 3;
  const fx = (v) => { const hrs = v + H0; return hrs === 0 ? 'now' : (hrs > 0 ? '+' : '') + Math.round(hrs / 24) + 'd'; };
  const sched = [];
  for (let x = 1; x <= 24; x += 1) { const a = gpusFor(x - 1, 1 + band(x) * 1.6), b = gpusFor(x, 1 + band(x) * 1.6); if (Math.abs(b - a) >= Math.max(16, peakPlan * 0.03)) sched.push([x, b > a ? 'Scale up' : 'Scale down', b - a, b]); }
  return head('Demand forecast', 'Forecast request traffic per deployment, provision GPUs for the forecast before it arrives, and lend the troughs to training as preemptible capacity.', 'Each deployment\'s requests per second are modeled with daily and weekly seasonality, a trend and known events (launches, campaigns), fitted on 8 weeks of history and re-fitted hourly. GPUs needed at time t = ceil(p90 forecast / per-replica goodput at 70%) × GPUs per replica, bounded by min and max replicas. Replicas start 15 minutes before the forecast needs them, because a cold start takes about a minute and the autoscaler alone would react after latency has already risen. GPUs freed in troughs go to the batch and training queue at P2 and are reclaimed by preemption with a checkpoint.') + `
  <div class="grid"><div class="card c12"><div class="row between"><div class="seg"><button class="${S.fc.dep === 'all' ? 'on' : ''}" data-fcdep="all">All interactive</button>${F.deps.filter((d) => d.id !== 'edge-3b-eval').map((d) => `<button class="${d.id === S.fc.dep ? 'on' : ''}" data-fcdep="${d.id}">${h(d.name)}</button>`).join('')}</div><span class="note">Model: seasonal + trend + events · fitted ${ago(Date.now() - 22 * 6e4)} · MAPE 4.8% (7 days)</span></div></div>
    <div class="card c3 kpi"><b>${si(req(0))}</b><span>Requests/s now</span><small>peak next 24 h ${si(Math.max(...fc.slice(0, 25).map((p) => p[1])))}</small></div>
    <div class="card c3 kpi"><b>${fmt(gpusFor(0))}</b><span>GPUs needed now</span><small>peak next 24 h ${fmt(Math.max(...next24.map((p) => p[1])))}</small></div>
    <div class="card c3 kpi good"><b>${fmt(Math.round(freeHours))}</b><span>GPU-hours to lend, next 24 h</span><small>${usd(freeHours * cost)} of capacity to training</small></div>
    <div class="card c3 kpi good"><b>${((1 - next24.reduce((a, p) => a + p[1], 0) / (24 * flat)) * 100).toFixed(0)}%</b><span>Fewer GPU-hours than static</span><small>vs provisioning every deployment at max</small></div>
    <div class="card c12"><h3>Requests per second: 3 days of history, 2 days of forecast with p10 to p90</h3>${xyChart([{ name: 'Actual', color: C.blue, pts: actual }, { name: 'Forecast', color: C.purple, pts: fc }, { name: 'p90', color: C.purple, dash: true, pts: hi }, { name: 'p10', color: C.gray, dash: true, pts: lo }], { fx, fy: (v) => si(v), hgt: 260, w: 1120, marks: deps.some((d) => d.id === 'assistant-8b') ? [{ x: 34 - H0, y: req(34), color: C.amber, label: 'Launch: +35% expected' }] : [] })}</div>
    <div class="card c8"><h3>GPUs: forecast-driven plan vs reactive autoscaling</h3>${xyChart([{ name: 'Forecast plan (p90, 15 min ahead)', color: C.blue, pts: planned }, { name: 'Reactive autoscaler', color: C.gray, dash: true, pts: reactive }, { name: 'Static at max replicas', color: C.red, dash: true, pts: pts(() => flat, H0, H1, 6) }], { fx, fy: (v) => si(v), hgt: 220, w: 760 })}<p class="note">The reactive line trails demand: it scales after latency rises. The plan leads it by 15 minutes and holds p90 headroom, which is why it sits slightly above.</p></div>
    <div class="card c4"><h3>Next 24 hours</h3>${sched.length ? `<ul class="feed">${sched.slice(0, 8).map(([x, k, dlt, tot]) => `<li><span class="when">+${x} h</span><span>${pill(dlt > 0 ? 'blue' : 'ok', k)} ${dlt > 0 ? '+' : ''}${fmt(dlt)} GPUs → ${fmt(tot)}${dlt < 0 && S.fc.lend ? ', lent to training' : ''}</span></li>`).join('')}</ul>` : '<p class="note">Flat: no scheduled changes.</p>'}
      <label class="row"><span class="switch"><input type="checkbox" data-bind="fc.lend" ${S.fc.lend ? 'checked' : ''}><span></span></span><span>Lend troughs to training (P2, preemptible)</span></label>
      <div class="row">${S.fc.applied ? pill('ok', 'Schedule active') : `<button class="btn primary" data-act="fc-apply" ${can('sre', 'platform', 'manager') ? '' : 'disabled title="SRE, platform engineer or manager"'}>Apply schedule</button>`}</div></div>
    <div class="card c12"><h3>Per deployment</h3><table class="table"><thead><tr><th>Deployment</th><th class="num">Now req/s</th><th class="num">Peak 24 h</th><th class="num">Per replica at 70%</th><th class="num">Replicas now → peak</th><th class="num">GPUs now → peak</th><th>Model fit</th></tr></thead><tbody>${deps.map((d) => { const pr = perRep[d.id], now = Math.ceil(demand(d, 0) / pr.gp), pk = Math.ceil(Math.max(...Array.from({ length: 25 }, (_, x) => demand(d, x))) / pr.gp); const cl = (n) => Math.max(d.min, Math.min(d.max, n)); return `<tr class="click" data-fcdep="${d.id}"><td><b>${h(d.name)}</b></td><td class="num">${si(demand(d, 0))}</td><td class="num">${si(Math.max(...Array.from({ length: 25 }, (_, x) => demand(d, x))))}</td><td class="num">${pr.gp.toFixed(1)}</td><td class="num">${cl(now)} → ${cl(pk)}${pk > d.max ? ' ' + pill('warn', 'over max') : ''}</td><td class="num">${fmt(cl(now) * pr.gpus)} → ${fmt(cl(pk) * pr.gpus)}</td><td>${pill('ok', `MAPE ${(3.6 + rnd(d.id.length, 4) * 3).toFixed(1)}%`)}</td></tr>`; }).join('')}</tbody></table></div>
  </div>`;
};
CLICKS.push(['fcdep', (id) => { S.fc.dep = id; }]);
ACTIONS['fc-apply'] = () => { S.fc.applied = true; ctx.F.event(Date.now(), 'serving-fleet', 'scaled', `Forecast schedule applied by ${me().name}: replicas lead demand by 15 min; troughs ${S.fc.lend ? 'lent to training at P2' : 'held idle'}.`); toast('Forecast schedule active. Next change in under an hour.'); };
