/* Terminal: the crucible CLI in the browser. `crucible serve <model> --auto`
   runs the whole serving pipeline (mesh, meta, wrap, allocate, optimize,
   serve) against the same cost models the console uses. */
import { E, $, h, fmt, si, gb, ms, ctx, S, VIEWS, AFTER, ui, me, sleep, p90, usd, dur } from './core.js?v=20261102-2';
import { BACKENDS, genTrain, genRL, genServe } from './v-backends.js?v=20261102-2';
import { lower, RULES } from './v-lib.js?v=20261102-2';
import { jobCommands, fileNames, FS } from './v-jobs.js?v=20261102-2';

const T = S.term = S.term || { lines: [], hist: [], hi: 0, busy: false, steps: null, model: null };
const STEPS = [['mesh', 'Build device mesh'], ['meta', 'Read model metadata'], ['wrap', 'Wrap in engine'], ['optimize', 'Optimize for SLO'], ['allocate', 'Allocate GPUs'], ['serve', 'Serve as canary']];
const VERS = () => E.MODELS.flatMap((m) => m.versions.map((v) => [v[0], m.id]));
const archOf = (name) => (E.ARCH[name] ? name : (VERS().find(([v]) => v === name) || [])[1]);
const versionOf = (arch) => (E.MODELS.find((m) => m.id === arch).versions.find((v) => v[3] === 'Production') || E.MODELS.find((m) => m.id === arch).versions[0])[0];

const esc = (s) => h(s).replace(/\[(ok|warn|err|dim|b|acc)\](.*?)\[\/\]/g, '<span class="t-$1">$2</span>');
function out(s = '') { for (const l of String(s).split('\n')) T.lines.push(l); if (T.lines.length > 600) T.lines.splice(0, T.lines.length - 600); draw(); }
function draw() { const el = $('#term-out'); if (!el) return; el.innerHTML = T.lines.map((l) => `<div>${l.startsWith('\u0001') ? `<span class="t-prompt">${h(me().name.split(' ')[0].toLowerCase())}@crucible ~ %</span> ${h(l.slice(1))}` : esc(l) || '&nbsp;'}</div>`).join(''); el.scrollTop = el.scrollHeight; const side = $('#term-steps'); if (side) side.innerHTML = stepsHtml(); }
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
const flag = (args, k, d) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const has = (args, k) => args.includes('--' + k);

function stepsHtml() {
  const mine = (S.submitted || []).map((id) => ctx.F.job(id)).filter(Boolean);
  const jobs = mine.length ? `<b class="t-model">Submitted from this terminal</b><ul class="tjobs">${mine.slice(0, 6).map((j) => `<li><span class="mono">${h(j.id)}</span><em>${j.state} · ${E.jobGpus(j)} GPUs</em></li>`).join('')}</ul>` : '';
  if (!T.steps) return jobs + `<p class="note">Submit a spec with <code>crucible job submit jobs/sft-8b.yaml</code>, or run <code>crucible serve core-8b --auto</code> to watch the serving steps.</p>`;
  return `<b class="t-model">${h(T.model)}</b><ol class="steps">${STEPS.map(([k, n], i) => { const st = T.steps[k]; return `<li class="${st === 'done' ? 'done' : st === 'run' ? 'running' : ''}"><span class="dot">${st === 'done' ? '✓' : ''}</span><div><b>${n}</b><p class="mono">crucible ${k}</p></div><span class="id">${T.stepTime && T.stepTime[k] ? T.stepTime[k] : ''}</span></li>`; }).join('')}</ol>`;
}

/* ── individual steps; each returns what the next one needs ── */
function stepMesh(arch, args) {
  const a = E.ARCH[arch], hw = flag(args, 'gpu', a.params > 100e9 ? 'b200' : 'h100'), q = flag(args, 'quant', 'fp8');
  let tp = 1;
  while (tp < 8 && !E.serveCapacity(a, { hw, tp, quant: q, kvq: 'fp8', prompt: 2000, out: 400 }).fits) tp *= 2;
  if (E.serveCapacity(a, { hw, tp, quant: q, kvq: 'fp8', prompt: 2000, out: 400 }).kvTokens < 200000 && tp < 8) tp *= 2;
  const ep = a.experts ? Math.min(8, tp) : 0;
  out(`[b]mesh[/] ${a.name} on ${E.HW[hw].name}`);
  out(`  weights ${q.toUpperCase()}: ${gb(a.params * E.WBYTES_(q))}  →  smallest TP that leaves room for KV cache: [acc]TP ${tp}[/]${ep ? `, EP ${ep}` : ''}`);
  out(`  mesh shape (replica): [${tp}] over NVLink${ep ? `, experts sharded ${a.experts / ep} per GPU` : ''}`);
  out(`  ┌${'───────┬'.repeat(tp - 1)}───────┐\n  │${Array.from({ length: tp }, (_, i) => ` GPU ${i} `).join('│')}│\n  └${'───────┴'.repeat(tp - 1)}───────┘`);
  return { hw, tp, quant: q, ep };
}
function stepMeta(arch, m) {
  const a = E.ARCH[arch], kv = E.kvPerToken(a, 'fp8');
  out(`[b]meta[/] ${a.name}`);
  out(`  params ${si(a.params)}${a.active ? ` (${si(a.active)} active)` : ''} · layers ${a.layers} · hidden ${fmt(a.hidden)} · heads ${a.heads}/${a.kv} KV · vocab ${fmt(a.vocab)}`);
  out(`  KV per token ${fmt(kv / 1024)} KB (FP8) · weights per GPU ${gb(a.params * E.WBYTES_(m.quant) / m.tp)}`);
  out(`  shard map: qkv_proj, gate_up_proj → column-parallel · o_proj, down_proj → row-parallel · embed, lm_head → vocab-parallel`);
  return m;
}
function stepWrap(arch, m, engine) {
  const a = E.ARCH[arch];
  out(`[b]wrap[/] ${engine} · TP ${m.tp} · ${m.quant.toUpperCase()} weights · FP8 KV`);
  out(`  [dim]load[/] safetensors from node NVMe cache at 3.2 GB/s → ${(a.params * E.WBYTES_(m.quant) / 3.2e9 / m.tp).toFixed(1)} s per GPU`);
  out(`  [dim]quantize[/] ${m.quant === 'fp8' ? 'per-channel FP8 scales from calibration set (512 samples)' : m.quant === 'int4' ? 'AWQ int4, group size 128' : 'none'}`);
  out(`  [dim]kernels[/] FlashAttention 3, paged KV (16-token blocks), fused RMSNorm + RoPE${a.experts ? ', grouped GEMM for experts, DeepEP all-to-all' : ''}`);
  out(`  [dim]graphs[/] CUDA graphs captured for batch sizes 1, 2, 4 … 256 in 14 s`);
  return m;
}
function stepAlloc(arch, m, replicas) {
  const cl = E.CLUSTERS.find((c) => c.hw === m.hw) || E.CLUSTERS[0], per = m.tp;
  out(`[b]allocate[/] ${replicas} replicas × ${per} GPUs = ${replicas * per} GPUs on ${cl.id}`);
  out(`  gang placement: each replica's ${per} GPUs on one node (NVLink); replicas spread across 3 racks for failure isolation`);
  out(`  quota: ${E.TEAMS[me().team].name}, priority interactive (not preemptible) · [ok]admitted[/]`);
  return { ...m, cluster: cl.id };
}
function stepOptimize(arch, m, slo) {
  const a = E.ARCH[arch], base = { hw: m.hw, tp: m.tp, quant: m.quant, kvq: 'fp8', prompt: 1500, out: 300, prefixHit: 0.5, cudaGraphs: true };
  const cands = [['baseline', { ...base, spec: null }], ['+ EAGLE-3 drafts k=3', { ...base, spec: { k: 3, alpha: 0.72, kind: 'EAGLE-3' } }], [`TP ${m.tp * 2}`, { ...base, tp: Math.min(8, m.tp * 2), spec: null }], [`+ ${m.tp} prefill GPUs`, { ...base, disagg: m.tp, spec: null }]];
  out(`[b]optimize[/] sweep request rate per config · SLO TTFT p90 ≤ ${ms(slo.ttft)}, ITL p90 ≤ ${ms(slo.itl)}`);
  out(`  [dim]${pad('config', 24)}${lpad('goodput', 10)}${lpad('tok/s/GPU', 11)}${lpad('$/1M', 8)}[/]`);
  let best = null;
  for (const [name, c] of cands) {
    if (!E.serveCapacity(a, c).fits) continue;
    const r = E.serveCurve(a, c, slo, 14);
    out(`  ${pad(name, 24)}${lpad(r.goodput.toFixed(1), 10)}${lpad(r.goodput ? fmt(r.tpsAtGoodput / r.gpus) : '0', 11)}${lpad(r.cost ? usd(r.cost) : 'miss', 8)}`);
    if (r.cost && (!best || r.cost < best.r.cost)) best = { name, c, r };
  }
  if (!best) { out('  [err]no configuration meets the SLO; relax it or use a larger GPU[/]'); return null; }
  out(`  → [ok]${best.name}[/]: ${best.r.goodput.toFixed(1)} req/s per replica at ${usd(best.r.cost)} per 1M tokens`);
  return { ...m, cfg: best.c, curve: best.r };
}
function stepServe(arch, m, name, slo) {
  const F = ctx.F, id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const version = versionOf(arch);
  if (!F.dep(id)) {
    F.deps.push({ id, name, model: version, arch, team: me().team, engine: m.engine, version: m.engine === 'vLLM' ? '0.11.1' : m.engine === 'SGLang' ? '0.5.2' : '1.1', region: 'us-west', state: 'canary', cfg: { ...m.cfg, prompt: 1500, out: 300, prefixHit: 0.5 }, replicas: m.replicas, min: Math.max(1, Math.floor(m.replicas / 2)), max: m.replicas * 4, slo, peak: m.curve.goodput * 0.6 * m.replicas, features: ['Deployed from the CLI', m.cfg.spec ? 'EAGLE-3 drafts' : 'Continuous batching', 'Prefix caching'], canary: { from: 'none', to: version, step: 1, steps: [5, 25, 50, 100], since: Date.now() } });
    F.event(Date.now(), id, 'deploy', `${me().name} deployed ${version} from the CLI: TP ${m.cfg.tp}, ${m.cfg.quant.toUpperCase()}, ${m.replicas} replicas. Canary at 5%.`);
  }
  out(`[b]serve[/] ${name} · router: prefix-hash affinity · health: /v1/health on every replica`);
  out(`  warmup 64 requests · p90 TTFT ${ms(p90(E.servePoint(E.ARCH[arch], m.cfg, 1)).ttft)} · [ok]healthy[/]`);
  out(`  canary 5% → 25% → 50% → 100%, gated on TTFT, ITL, errors and shadow evals`);
  out(`  [acc]https://inference.acme.internal/v1/models/${id}[/]`);
  return id;
}

function serveStatus() {
  out(`[dim]Ray Serve applications[/]`);
  for (const d of ctx.F.deps) { const s = ctx.F.servingNow(d); out(`${d.id}:\n  status: ${d.state === 'degraded' ? '[warn]DEPLOY_FAILED_SLO[/]' : 'RUNNING'}\n  deployments:\n    LLMServer:${d.engine.replace(/[^A-Za-z]/g, '')}:\n      status: ${d.state === 'degraded' ? '[warn]UNHEALTHY[/]' : 'HEALTHY'}\n      replica_states: { RUNNING: ${d.replicas} }\n      ongoing_requests_per_replica: ${Math.round(s.B)}`); }
}

/* Concepts, one screen each. [name, text, console page]. */
const EXPLAIN = {
  fsdp: ['FSDP', `[b]FSDP step on N GPUs[/] (each owns 1/N of every layer)
  forward   for each layer:  [acc]all-gather[/] params → compute → [dim]free (reshard)[/]   next layer prefetched on the NCCL stream
  backward  for each layer:  [acc]all-gather[/] params → compute grads → [acc]reduce-scatter[/] → keep 1/N of grads
  optimizer Adam on the local shard only, no communication
  memory    16·P/N bytes of state per GPU + ~2 gathered layers + activations
  traffic   ~3·(N−1)/N·2P bytes per GPU per step (1.5× DDP)`, 'fsdp'],
  zero: ['ZeRO stages', `[b]ZeRO[/] shards the 16 bytes/param of mixed-precision Adam (2 weights, 2 grads, 12 optimizer)
  ZeRO-1  shard optimizer state     → 4 + 12/N bytes/param
  ZeRO-2  + shard gradients         → 2 + 14/N
  ZeRO-3  + shard parameters (FSDP) → 16/N, params all-gathered per layer
  70B on 64 GPUs: DDP 1.1 TB/GPU (impossible) · ZeRO-1 297 GB · ZeRO-2 156 GB · ZeRO-3 17.5 GB`, 'fsdp'],
  kv: ['KV cache', `[b]KV cache[/]: keys and values of every past token, kept so decode never recomputes them
  bytes/token = 2 (K,V) × layers × kv_heads × head_dim × bytes
  Core 70B: 2 × 80 × 8 × 128 × 2 B = [acc]320 KB/token[/] in BF16, 160 KB in FP8
  4K-token request ≈ 1.3 GB · it, not compute, caps the batch size
  GQA (8 KV heads for 64 query heads) is why it is 8× smaller than full attention`, 'kv'],
  paged: ['PagedAttention', `[b]PagedAttention[/] (vLLM): KV memory in fixed 16-token blocks, like OS pages
  sequence → block table: [0→14750] [1→59681] [2→45513] …   no contiguous allocation, ~no fragmentation
  shared prefixes: same physical blocks, refcount > 1, copy-on-write on divergence
  freed blocks keep their prefix until LRU evicts them → automatic prefix caching
  memory pressure: preempt newest sequence, swap blocks to host or recompute later`, 'kv'],
  batching: ['Continuous batching', `[b]Continuous batching[/]: scheduling per decode step, not per request
  static:      [AAAA____][BB______] wait for the longest   → idle slots
  continuous:  finished sequences leave, queued ones join every step → GPU stays full
  chunked prefill: long prompts split into chunks mixed with decode tokens, so ITL stays flat`, 'capacity'],
  spec: ['Speculative decoding', `[b]Speculative decoding[/]: a cheap draft proposes k tokens, the model verifies all k in one pass
  expected tokens/step = (1 − α^(k+1)) / (1 − α)      α=0.72, k=3 → 2.6 tokens per pass
  wins when decode is memory-bound (small batch); loses when compute-bound (large batch)
  drafts: small model · n-gram/prompt lookup · Medusa/EAGLE heads · MTP heads`, 'capacity'],
  disagg: ['Disaggregated prefill/decode', `[b]Disaggregated serving[/]
  prefill = compute-bound (2·P·prompt FLOPs)  ·  decode = memory-bound (read weights + KV per token)
  colocated: a 12K-token prefill stalls every decode in the batch → ITL spikes
  split: prefill pool → KV over RDMA (NIXL) → decode pool; size and parallelize each pool separately
  cost: KV transfer, e.g. 70B × 8K tokens ≈ 1.3 GB in FP8 per request`, 'capacity'],
  moe: ['Mixture of experts', `[b]MoE[/]: router picks top-k of E experts per token; only k experts compute
  235B total, 22B active: memory of 235B, FLOPs of 22B
  expert parallel: experts on different GPUs, tokens move by [acc]all-to-all[/] (dispatch + combine) per layer
  hot experts make one GPU the straggler for every layer → bias balancing, capacity factor, replicate hot experts (EPLB)`, 'moe'],
  tp: ['Tensor parallel', `[b]Tensor parallel[/] (Megatron): split each weight matrix across GPUs
  MLP: W1 column-parallel (no comm) → W2 row-parallel → [acc]all-reduce[/]
  attention: heads split across GPUs → out-proj row-parallel → [acc]all-reduce[/]
  2 all-reduces per layer forward, 2 backward → keep TP inside NVLink (≤ 8 GPUs)`, 'planner'],
  pp: ['Pipeline parallel', `[b]Pipeline parallel[/]: layers split into stages, microbatches flow through
  bubble = (p − 1) / (v·m + p − 1)     p stages, m microbatches, v interleaved chunks
  1F1B: same bubble as GPipe, activations for only p microbatches in flight
  interleaved: v chunks per GPU shrink the bubble by v, more point-to-point traffic`, 'planner'],
  ring: ['Ring all-reduce', `[b]Ring all-reduce[/] over N GPUs: reduce-scatter (N−1 steps) then all-gather (N−1 steps)
  each GPU sends 2(N−1)/N × message size: bandwidth-optimal, latency grows with N
  NCCL picks ring or tree by size; hierarchical: NVLink inside the node, InfiniBand across`, 'fsdp'],
  grpo: ['GRPO', `[b]GRPO[/]: sample G responses per prompt, score them, advantage = (r − mean) / std within the group
  no critic model · verifiable rewards (math answers, unit tests)
  generation is most of the wall time; zero-variance groups give no signal (DAPO drops them)`, 'rl'],
  dpo: ['DPO', `[b]DPO[/]: preference pairs, no reward model, no sampling
  loss = −log σ(β[(log π(y_w) − log π_ref(y_w)) − (log π(y_l) − log π_ref(y_l))])
  reference log-probs can be precomputed once, so only the policy is on GPU`, 'pipelines'],
  ray: ['Ray', `[b]Ray[/]: tasks (stateless functions) and actors (stateful workers), scheduled across a cluster
  object store per node (shared memory), ownership-based metadata, GCS for cluster state
  placement groups reserve GPU bundles atomically (STRICT_PACK keeps a replica on one node)
  Ray Train = worker groups over torch.distributed · Ray Serve = autoscaled deployments · Ray Data = streaming`, 'backends'],
};

/* ── commands ── */
const HELP = `[b]crucible[/] training and inference CLI

  [acc]serve[/] <model> [--auto] [--engine vllm|sglang|trt] [--replicas N] [--ttft 1.2] [--itl 40]
        runs mesh → meta → wrap → optimize → allocate → serve
  [acc]mesh[/] <model> [--gpu h100|h200|b200|l40s] [--quant fp8|bf16|int4]
  [acc]meta[/] <model>          architecture, KV bytes, shard map
  [acc]optimize[/] <model>      sweep configs against an SLO
  [acc]plan[/] <model> --gpus N  training layouts (TP, PP, DP, recompute)
  [acc]explain[/] <topic>         fsdp, zero, kv, paged, batching, spec, disagg, moe, tp, pp, ring, grpo, dpo, ray
  [acc]export[/] <job|dep> --backend ray|k8s|slurm|skypilot|kserve|dynamo|llmd|triton
  [acc]backends[/]              Ray and its alternatives
  [acc]build[/] <model> --framework jax|torch --mesh 8x32x8   lower a job through the Crucible library
  [acc]ray[/] status | list actors | list placement-groups | job list | job submit
  [acc]serve status[/]          Ray Serve application status
  [b]jobs[/]
  [acc]ls[/] · [acc]tree[/] · [acc]cat[/] <file> · [acc]edit[/] <file>      workspace: jobs/*.yaml, src/*.py, configs/
  [acc]job validate[/] <file.yaml>   schema, registry, governance and quota checks with line numbers
  [acc]job submit[/] <file.yaml> [--dry-run]   package code, shard data, place on GPUs/CPUs, launch on Ray
  [acc]run[/] <src/file.py> --gpus 64 --cpus 256   generate a job spec from flags and submit it
  [acc]job list[/] · [acc]job status[/] · [acc]job logs[/] · [acc]job describe[/] · [acc]job cancel[/] <id>
  [acc]data shard[/] <dataset> --ranks N   shard-to-rank assignment
  [b]fleet[/]
  [acc]status[/]                fleet, jobs and deployments
  [acc]models[/]                registry
  [acc]top[/]                   GPU telemetry snapshot
  [acc]forecast[/] <deployment> next 24 h of demand and replicas
  [acc]kv[/] <deployment>       KV cache capacity and hit rate
  [acc]scale[/] <deployment> --replicas N
  [acc]logs[/] <job>            recent events for a job
  clear · history · open <page>

  models: ${Object.keys(E.ARCH).join(', ')}`;

async function serve(args) {
  if (args[0] === 'status') return serveStatus();
  const arch = archOf(args[0]);
  if (!arch) return out(`[err]unknown model ${args[0] || ''}[/]. Try: ${Object.keys(E.ARCH).join(', ')}`);
  const engine = { vllm: 'vLLM', sglang: 'SGLang', trt: 'TensorRT-LLM' }[flag(args, 'engine', 'vllm')] || 'vLLM';
  const slo = { ttft: +flag(args, 'ttft', 1.2), itl: +flag(args, 'itl', 40) / 1000 };
  const name = flag(args, 'name', `${E.ARCH[arch].name.replace('Acme ', '')} CLI`);
  T.model = `${E.ARCH[arch].name} → ${name}`;
  T.steps = Object.fromEntries(STEPS.map(([k]) => [k, 'wait'])); T.stepTime = {};
  const auto = has(args, 'auto');
  const run = async (k, fn) => { T.steps[k] = 'run'; draw(); const t0 = performance.now(); await sleep(auto ? 650 : 250); const r = fn(); T.steps[k] = r === null ? 'wait' : 'done'; T.stepTime[k] = ((performance.now() - t0) / 1000 + [0.4, 0.1, 21, 9, 3, 6][STEPS.findIndex((s) => s[0] === k)]).toFixed(1) + ' s'; out(''); draw(); return r; };
  out(`[dim]plan: mesh → meta → wrap → optimize → allocate → serve${auto ? ' (auto)' : ''}[/]\n`);
  let m = await run('mesh', () => stepMesh(arch, args));
  m = await run('meta', () => stepMeta(arch, m));
  m = await run('wrap', () => stepWrap(arch, m, engine));
  const opt = await run('optimize', () => stepOptimize(arch, m, slo));
  if (!opt) return;
  const replicas = +flag(args, 'replicas', 4);
  const alloc = await run('allocate', () => stepAlloc(arch, { ...m, tp: opt.cfg.tp + (opt.cfg.disagg || 0) }, replicas));
  await run('serve', () => stepServe(arch, { ...opt, engine, replicas, cluster: alloc.cluster }, name, slo));
  out(`[ok]✓ ${name} is serving as a 5% canary.[/] Open it: [acc]open deployments[/]`);
  ui.renderChrome();
}

const CMDS = {
  help: () => out(HELP),
  clear: () => { T.lines = []; draw(); },
  explain: (a) => {
    const k = EXPLAIN[a[0]];
    if (!k) return out(`[err]usage: crucible explain <topic>[/]  topics: ${Object.keys(EXPLAIN).join(', ')}`);
    out(k[1]);
    if (k[2]) out(`  [dim]open ${k[2]} to see it in the console[/]`);
  },
  export: (a) => {
    const F = ctx.F, id = a[0], b = flag(a, 'backend', 'ray');
    const j = F.job(id), d = F.dep(id);
    if (!j && !d) return out(`[err]usage: crucible export <job|deployment> --backend <name>[/]`);
    const code = d ? genServe(b, d) : j.kind === 'rl' ? genRL(b, j) : genTrain(b, j);
    const opts = BACKENDS[d ? 'serve' : j.kind === 'rl' ? 'rl' : 'train'].map(([k]) => k);
    if (!code) return out(`[err]backend '${b}' does not apply here[/]. Choose: ${opts.join(', ')}`);
    out(`[dim]# ${id} rendered for ${b} · other backends: ${opts.filter((x) => x !== b).join(', ')}[/]`);
    out(code);
  },
  build: async (a) => {
    const arch = archOf(a[0]); if (!arch || E.ARCH[arch].experts) return out('[err]usage: crucible build <dense model> --framework jax|torch --mesh DATAxFSDPxTENSOR[/]');
    const fw = flag(a, 'framework', 'jax'), [d, f, t] = flag(a, 'mesh', '8x32x8').split('x').map(Number);
    if (![d, f, t].every((x) => x > 0)) return out('[err]--mesh must look like 8x32x8[/]');
    const X = lower({ arch, fw, data: d, fsdp: f, tensor: t });
    out(`[b]build[/] ${X.a.name} · ${fw === 'jax' ? 'JAX' : 'PyTorch'} backend · mesh data ${d} × fsdp ${f} × tensor ${t} = ${fmt(X.n)} devices`);
    const step = async (name, text, ok = true) => { await sleep(260); out(`  ${ok ? '[ok]✓[/]' : '[err]✗[/]'} ${pad(name, 18)}${text}`); };
    await step('spec', 'JobSpec parsed, model is framework-neutral (cx.Module)');
    for (const [c, txt] of X.checks) if (!c) { await step('validate', txt, false); return out('[err]build failed[/]'); }
    await step('validate', `${X.checks.length} shape checks pass`);
    const fits = X.mem.total <= 80e9 * 0.92;
    await step('memory', `${gb(X.mem.total)} per device of 80 GB`, fits);
    if (!fits) return out('[err]build failed: raise fsdp or tensor[/]');
    await step('sharding', RULES.filter((r) => r[1].length).map(([k, m]) => `${k}→${m.join('×')}`).join('  '));
    await step('lower', fw === 'jax' ? 'jit + NamedSharding; XLA SPMD inserted 4 all-gathers, 3 reduce-scatters per layer; compiled 41 s (cached)' : 'DTensor ColwiseParallel/RowwiseParallel + fully_shard per block; torch.compile per block');
    await step('ray', `placement group ${X.n / 8} × {GPU: 8} STRICT_SPREAD ready; ${fw === 'jax' ? 'jax.distributed.initialize on each host' : 'init_process_group(nccl) on each GPU'}`);
    await step('checkpoint', fw === 'jax' ? 'Orbax async, cx.ckpt layout' : 'torch DCP async, cx.ckpt layout');
    out(`[ok]✓ ready[/] modeled MFU ${(X.perf.mfu * 100).toFixed(1)}% · ${si(X.perf.tps)} tokens/s · [acc]open library[/] for generated code`);
  },
  backends: () => {
    out(`[b]training[/]  ray (default) · k8s: Kubeflow PyTorchJob + Kueue · slurm · skypilot · torchrun
[b]rl[/]        ray (default: actors per role) · k8s: JobSet per role · monolith: one colocated SPMD job
[b]serving[/]   ray: Ray Serve LLM (default) · kserve: KServe + vLLM · dynamo: NVIDIA Dynamo, disaggregated
            llmd: llm-d, Kubernetes-native vLLM · triton: Triton + TensorRT-LLM
  [dim]crucible export <job|deployment> --backend <name> · open backends[/]`);
  },
  ray: (a) => {
    const F = ctx.F, sub = a[0];
    const live = F.jobs.filter((x) => x.state === 'running' && x.kind !== 'eval');
    const j = F.job((flag(a, 'address', '') || '').replace(/^ray-/, '')) || F.job('rl-core-70b-reason');
    if (sub === 'status') {
      const gpus = E.jobGpus(j), nodes = Math.ceil(gpus / 8), cpu = j.rl ? j.rl.verifiers + 512 : nodes * 96;
      return out(`[dim]cluster ray-${j.id} (KubeRay, Ray 2.49)[/]
======== Autoscaler status: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} ========
Node status
---------------------------------------------------------------
Active:
 1 head
 ${nodes} worker-${j.cfg.hw}-8gpu${j.rl ? `
 ${Math.ceil(j.rl.verifiers / 64)} worker-cpu-64` : ''}
Pending:
 (no pending nodes)
Recent failures:
 (no failures)

Resources
---------------------------------------------------------------
Usage:
 ${gpus.toFixed(1)}/${gpus.toFixed(1)} GPU
 ${(cpu * 0.82).toFixed(1)}/${cpu.toFixed(1)} CPU
 ${(gpus * 0.42).toFixed(1)}GiB/${(gpus * 1.6).toFixed(1)}GiB object_store_memory

Demands:
 (no resource demands)`);
    }
    if (sub === 'list' && (a[1] || 'actors') === 'actors') {
      const groups = j.rl ? [['RLController', 1], [`${j.rl.engine.split(' ')[0]}Engine`, j.rl.rolloutGpus / 4], ['FSDPWorker', j.rl.trainGpus], ['SandboxPool', j.rl.verifiers]] : [['TrainController', 1], ['RayTrainWorker', E.jobGpus(j)]];
      out(`[dim]${pad('ACTOR_ID', 34)}${pad('CLASS_NAME', 16)}${pad('STATE', 8)}${pad('NODE', 18)}PID[/]`);
      let n = 0;
      for (const [c, cnt] of groups) for (let i = 0; i < Math.min(cnt, 3); i++) out(`${pad((0xa1b2c3 + n * 7919).toString(16).padEnd(32, '0'), 34)}${pad(c, 16)}${pad('ALIVE', 8)}${pad(`10.42.${(n * 3) % 250}.${(n * 17) % 250}`, 18)}${41200 + n++ * 13}`);
      return out(`[dim]… ${groups.reduce((s, g) => s + g[1], 0)} actors: ${groups.map(([c, k]) => `${k} ${c}`).join(', ')}[/]`);
    }
    if (sub === 'list' && a[1] === 'placement-groups') {
      if (!j.rl) return out(`  ${pad('pg-train', 14)}CREATED  PACK          ${E.jobGpus(j)} × {GPU: 1}`);
      return out(`  ${pad('pg-rollout', 14)}CREATED  STRICT_PACK   ${j.rl.rolloutGpus / 4} × {GPU: 4}   one engine per node slice
  ${pad('pg-trainer', 14)}CREATED  PACK          ${j.rl.trainGpus} × {GPU: 1}
  ${pad('pg-verify', 14)}CREATED  SPREAD        ${j.rl.verifiers} × {CPU: 1}`);
    }
    if (sub === 'job' && a[1] === 'list') { for (const x of live) out(`  raysubmit_${x.id.slice(0, 10).replace(/-/g, '')}  ${pad('RUNNING', 9)}${x.name}`); return; }
    if (sub === 'job' && a[1] === 'submit') {
      const id = 'raysubmit_' + Math.random().toString(36).slice(2, 12);
      return out(`Job '${id}' submitted successfully
[dim]Next steps
  Query the logs of the job:   ray job logs ${id}
  Query the status of the job: ray job status ${id}[/]
Tailing logs until the job exits (disable with --no-wait):
INFO worker.py: Connecting to existing Ray cluster at address: ray-head:6379
INFO trainer.py: Started distributed worker processes: 8 workers on 1 node
INFO trainer.py: torch.distributed initialized, backend=nccl, world_size=8
[ok]step 10 loss 1.912 tokens/s 61.3K[/]`);
    }
    out('[err]usage: ray status | ray list actors | ray list placement-groups | ray job list | ray job submit -- python train.py[/]');
  },
  history: () => out(T.hist.map((c, i) => `${lpad(i + 1, 4)}  ${c}`).join('\n')),
  open: (a) => { const v = a[0]; if (VIEWS[v]) { ui.go(v); } else out(`[err]no page ${v}[/]`); },
  serve,
  mesh: (a) => { const arch = archOf(a[0]); if (!arch) return out('[err]usage: crucible mesh <model>[/]'); stepMesh(arch, a); },
  meta: (a) => { const arch = archOf(a[0]); if (!arch) return out('[err]usage: crucible meta <model>[/]'); stepMeta(arch, { tp: 4, quant: 'fp8' }); },
  wrap: (a) => { const arch = archOf(a[0]); if (!arch) return out('[err]usage: crucible wrap <model>[/]'); stepWrap(arch, stepMesh(arch, a), 'vLLM'); },
  optimize: (a) => { const arch = archOf(a[0]); if (!arch) return out('[err]usage: crucible optimize <model>[/]'); const m = stepMesh(arch, a); stepOptimize(arch, m, { ttft: +flag(a, 'ttft', 1.2), itl: +flag(a, 'itl', 40) / 1000 }); },
  allocate: (a) => { const arch = archOf(a[0]); if (!arch) return out('[err]usage: crucible allocate <model> --replicas N[/]'); stepAlloc(arch, stepMesh(arch, a), +flag(a, 'replicas', 4)); },
  plan: (a) => {
    const arch = archOf(a[0]); if (!arch || E.ARCH[arch].experts) return out('[err]usage: crucible plan <dense model> --gpus N[/]');
    const gpus = +flag(a, 'gpus', 256), hw = flag(a, 'gpu', 'h100'), seq = +flag(a, 'seq', 8192);
    const r = E.plan(E.ARCH[arch], { hw, gpus, seq, maxResults: 5 });
    out(`[b]plan[/] ${E.ARCH[arch].name} · ${gpus} × ${E.HW[hw].name} · seq ${fmt(seq)} · ${r.feasible} of ${r.considered} layouts fit`);
    out(`  [dim]${pad('TP', 4)}${pad('PP', 6)}${pad('DP', 6)}${pad('micro×acc', 11)}${pad('shard', 8)}${pad('recompute', 11)}${lpad('mem/GPU', 9)}${lpad('MFU', 7)}${lpad('tokens/s', 10)}${lpad('/GPU', 8)}[/]`);
    for (const x of r.best) out(`  ${pad(x.c.tp, 4)}${pad(x.c.pp + (x.c.vpp > 1 ? '×' + x.c.vpp : ''), 6)}${pad(x.c.dp, 6)}${pad(x.c.micro + '×' + x.c.accum, 11)}${pad(x.c.zero >= 3 ? 'FSDP' : 'ZeRO-1', 8)}${pad(x.c.recompute, 11)}${lpad(gb(x.mem.total), 9)}${lpad((x.perf.mfu * 100).toFixed(1) + '%', 7)}${lpad(si(x.perf.tps), 10)}${lpad(si(x.perf.tps / gpus), 8)}`);
    out('  [dim]MFU counts 6·params FLOPs per token (attention FLOPs excluded), against BF16 peak. Excludes data loading, checkpoints and restarts.[/]');
  },
  status: () => {
    const F = ctx.F;
    out('[b]jobs[/]');
    for (const j of F.jobs) out(`  ${pad(j.id, 26)}${pad(j.state, 11)}${lpad(fmt(E.jobGpus(j)), 6)} GPUs  ${j.state === 'running' && j.kind !== 'eval' ? 'MFU ' + (F.perf(j).mfu * 100).toFixed(1) + '%' : ''}`);
    out('[b]deployments[/]');
    for (const d of F.deps) { const s = F.servingNow(d), q = p90(s); out(`  ${pad(d.id, 26)}${pad(d.state, 11)}${lpad(d.replicas, 4)} × TP${d.cfg.tp}  ${lpad(si(s.total), 6)} req/s  TTFT ${ms(q.ttft)}  ITL ${ms(q.itl)}`); }
  },
  models: () => { for (const m of E.MODELS) for (const v of m.versions) out(`  ${pad(v[0], 26)}${pad(v[1], 14)}${v[3]}`); },
  top: () => {
    out(`[dim]${pad('node', 16)}${pad('job', 24)}${lpad('SM%', 5)}${lpad('TC%', 5)}${lpad('HBM%', 6)}${lpad('W', 6)}${lpad('°C', 5)}${lpad('MHz', 6)}[/]`);
    const j = ctx.F.job('pt-core-70b-v3');
    for (let i = 0; i < 8; i++) { const slow = j.straggler && i === 5; out(`${slow ? '[warn]' : ''}  ${pad('usw2-a-n03' + (11 - (i === 5 ? 0 : i + 1)), 16)}${pad(j.id, 24)}${lpad(slow ? 74 : 88 + i % 3, 5)}${lpad(slow ? 41 : 52 + i % 4, 5)}${lpad(44 + i, 6)}${lpad(slow ? 610 : 655 + i * 3, 6)}${lpad(slow ? 87 : 63 + i % 3, 5)}${lpad(slow ? 1590 : 1980, 6)}${slow ? '  ← throttling[/]' : ''}`); }
  },
  forecast: (a) => {
    const d = ctx.F.dep(a[0]); if (!d) return out(`[err]usage: crucible forecast <deployment>[/]  (${ctx.F.deps.map((x) => x.id).join(', ')})`);
    const per = E.serveCurve(E.ARCH[d.arch], d.cfg, d.slo, 14).goodput * 0.7;
    out(`[b]forecast[/] ${d.name} · per replica ${per.toFixed(1)} req/s at 70% of goodput`);
    for (let x = 0; x <= 24; x += 3) { const r = ctx.F.trafficAt(d, Date.now() + x * 36e5); const n = Math.max(d.min, Math.min(d.max, Math.ceil(r / per))); out(`  +${pad(x + 'h', 5)}${lpad(si(r), 7)} req/s  ${lpad(n, 4)} replicas  ${'█'.repeat(Math.round(n / d.max * 30))}`); }
  },
  kv: (a) => { const d = ctx.F.dep(a[0]); if (!d) return out('[err]usage: crucible kv <deployment>[/]'); const s = ctx.F.servingNow(d), ar = E.ARCH[d.arch]; out(`[b]kv[/] ${d.name}: ${fmt(E.kvPerToken(ar, d.cfg.kvq) / 1024)} KB/token · ${si(s.cap.kvTokens)} tokens per replica · ${(s.kvActive * 100).toFixed(0)}% active, ${(s.kvCached * 100).toFixed(0)}% cached · prefix hit ${((d.cfg.prefixHit || 0) * 100).toFixed(0)}%`); },
  scale: (a) => { const d = ctx.F.dep(a[0]), n = +flag(a, 'replicas', 0); if (!d || !n) return out('[err]usage: crucible scale <deployment> --replicas N[/]'); if (n > d.max || n < d.min) return out(`[err]outside bounds ${d.min} to ${d.max}[/]`); d.replicas = n; ctx.F.event(Date.now(), d.id, 'scaled', `Scaled to ${n} replicas from the CLI by ${me().name}.`); out(`[ok]✓ ${d.id} scaled to ${n} replicas[/]`); },
  logs: (a) => { const ev = ctx.F.events.filter((e) => e.subject === a[0]); if (!ev.length) return out(`[dim]no events for ${a[0] || '?'}[/]`); for (const e of ev.slice(0, 12)) out(`  ${new Date(e.t).toISOString().slice(11, 19)}  ${pad(e.kind, 10)} ${e.text}`); },
};

/* Job submission, workspace files and data sharding live in v-jobs.js. */
function setLine(i, text) { if (i >= 0 && i < T.lines.length) { T.lines[i] = text; draw(); } }
function openEditor(file, text) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-back'; wrap.id = 'modal';
  wrap.innerHTML = `<div class="modal ed"><div class="modal-head"><div><h3 class="mono">${h(file)}</h3><p>${FS[file] === undefined ? 'New file.' : 'Edit and save, then run crucible job validate or submit.'}</p></div></div><textarea class="ed-ta" spellcheck="false">${h(text)}</textarea><div class="modal-foot"><span class="note">⌘S to save · Esc to cancel</span><span class="spacer"></span><button class="btn" data-ed-cancel>Cancel</button><button class="btn primary" data-ed-save>Save</button></div></div>`;
  document.body.appendChild(wrap);
  const ta = wrap.querySelector('textarea'); ta.focus();
  const close = () => { wrap.remove(); const q = $('#term-q'); if (q) q.focus(); };
  const save = () => { FS[file] = ta.value.endsWith('\n') ? ta.value : ta.value + '\n'; out(`[ok]✓ saved ${file}[/] (${FS[file].split('\n').length - 1} lines)`); close(); };
  ta.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); } if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); } if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  wrap.querySelector('[data-ed-cancel]').addEventListener('click', close);
  wrap.querySelector('[data-ed-save]').addEventListener('click', save);
}
Object.assign(CMDS, jobCommands({ out, setLine, pad, lpad, flag, has, sleep, openEditor, lineCount: () => T.lines.length }));

async function exec(line) {
  line = line.trim(); if (!line) return;
  T.hist.push(line); T.hi = T.hist.length;
  out('\u0001' + line);
  let parts = line.split(/\s+/);
  if (parts[0] === 'crucible') parts = parts.slice(1);
  const [cmd, ...args] = parts;
  const fn = CMDS[cmd || 'help'];
  if (!fn) return out(`[err]crucible: unknown command '${cmd}'[/]. Type [acc]help[/].`);
  T.busy = true; try { await fn(args); } catch (e) { out(`[err]${e.message}[/]`); } T.busy = false; draw();
}

VIEWS.terminal = () => {
  if (!T.lines.length) out(`Crucible CLI 3.4.0 · signed in as ${me().name} (${me().title}) · type [acc]help[/]\n`);
  const chips = ['ls', 'cat jobs/sft-8b.yaml', 'crucible job submit jobs/sft-8b.yaml', 'crucible job submit jobs/embed-docs.yaml', 'crucible run src/train_sft.py --gpus 32 --cpus 128', 'crucible serve core-8b --auto --engine sglang', 'crucible serve core-70b --auto --ttft 1.2 --itl 40', 'crucible plan core-70b --gpus 1024', 'crucible status', 'crucible top', 'crucible forecast assistant-8b'];
  return `<div class="view-head"><h1>Terminal</h1><p>Every console action is a CLI command. One line takes a model from the registry to a serving canary: mesh, metadata, engine wrap, allocation, SLO optimization and rollout.</p></div>
  <div class="term-wrap"><div class="term"><div class="term-bar"><i></i><i></i><i></i><span>crucible · ${h(me().name.split(' ')[0].toLowerCase())}@acme</span></div><div class="term-out" id="term-out"></div><label class="term-in"><span class="t-prompt">${h(me().name.split(' ')[0].toLowerCase())}@crucible ~ %</span><input id="term-q" autocomplete="off" spellcheck="false" placeholder="type a command, Tab for suggestions"></label><div class="term-menu" id="term-menu" hidden></div></div>
    <aside class="term-side"><h3>Pipeline</h3><div id="term-steps"></div><h3 class="sub-h">Try</h3><div class="term-chips">${chips.map((c) => `<button class="btn" data-termrun="${h(c)}">${h(c.replace('crucible ', ''))}</button>`).join('')}</div></aside></div>`;
};
/* ── tab completion: commands, then models, deployments, jobs, flags and flag values ── */
const MODEL_ARGS = ['serve', 'mesh', 'meta', 'wrap', 'optimize', 'allocate', 'plan', 'build'];
const FLAGS = {
  serve: ['--auto', '--engine', '--replicas', '--ttft', '--itl', '--gpu', '--quant', '--name'],
  mesh: ['--gpu', '--quant'], wrap: ['--gpu', '--quant'], optimize: ['--gpu', '--quant', '--ttft', '--itl'],
  allocate: ['--gpu', '--quant', '--replicas'], plan: ['--gpus', '--gpu', '--seq'], scale: ['--replicas'], export: ['--backend'], build: ['--framework', '--mesh'],
};
const VALUES = {
  '--engine': ['vllm', 'sglang', 'trt'], '--gpu': Object.keys(E.HW), '--quant': ['fp8', 'bf16', 'int4'],
  '--cpus': ['64', '128', '256', '512'], '--model': ['core-8b-sft-v5', 'core-8b-base-v5', 'coder-34b-v2'], '--data': ['assistant-sft-v9', 'ide-completions-v3'],
  '--gpus': ['8', '16', '32', '64', '128', '256', '512', '1024', '2048', '4096'], '--seq': ['4096', '8192', '16384', '32768', '131072'],
  '--framework': ['jax', 'torch'], '--mesh': ['8x32x8', '4x64x8', '1x64x1', '2x16x4', '8x16x8'],
  '--backend': ['ray', 'k8s', 'slurm', 'skypilot', 'torchrun', 'monolith', 'kserve', 'dynamo', 'llmd', 'triton'],
  '--replicas': ['2', '4', '8', '16', '32'], '--ttft': ['0.3', '0.6', '1.2', '2.5'], '--itl': ['20', '30', '40', '60'],
};
function candidates(line) {
  const toks = line.replace(/^\s+/, '').split(/\s+/);
  const lead = toks[0] === 'crucible' ? 1 : 0;
  const words = toks.slice(lead), cur = words[words.length - 1] ?? '', i = words.length - 1;
  let opts = [];
  if (i <= 0) opts = [...Object.keys(CMDS), ...(lead ? [] : ['crucible'])];
  else if (words[0] === 'job') opts = i === 1 ? ['submit', 'validate', 'list', 'status', 'logs', 'describe', 'cancel'] : i === 2 && ['submit', 'validate'].includes(words[1]) ? fileNames().filter((f) => f.endsWith('.yaml') && f.startsWith('jobs/')) : i === 2 && ['status', 'logs', 'describe', 'cancel'].includes(words[1]) ? ctx.F.jobs.map((j) => j.id) : i >= 3 && words[1] === 'submit' ? ['--dry-run'] : i >= 3 && words[1] === 'logs' ? ['--follow'] : [];
  else if (['cat', 'edit'].includes(words[0])) opts = i === 1 ? fileNames() : [];
  else if (words[0] === 'ls') opts = i === 1 ? ['jobs/', 'src/', 'configs/'] : [];
  else if (words[0] === 'run') opts = i === 1 ? fileNames().filter((f) => f.endsWith('.py')) : (VALUES[words[i - 1]] || ['--gpus', '--cpus', '--model', '--data', '--gpu', '--dry-run'].filter((f) => !words.includes(f)));
  else if (words[0] === 'data') opts = i === 1 ? ['shard'] : i === 2 ? E.DATASETS.map((d) => d.id) : words[i - 1] === '--ranks' ? ['8', '64', '256', '1024'] : ['--ranks'];
  else if (words[0] === 'ray') opts = i === 1 ? ['status', 'list', 'job'] : i === 2 && words[1] === 'list' ? ['actors', 'placement-groups'] : i === 2 && words[1] === 'job' ? ['list', 'submit'] : words[1] === 'status' ? (words[i - 1] === '--address' ? ctx.F.jobs.filter((j) => j.state === 'running').map((j) => 'ray-' + j.id) : ['--address']) : [];
  else {
    const cmd = words[0], prev = words[i - 1];
    if (VALUES[prev]) opts = VALUES[prev];
    else if (i === 1 && MODEL_ARGS.includes(cmd)) opts = [...Object.keys(E.ARCH).filter((k) => !['plan', 'build'].includes(cmd) || !E.ARCH[k].experts), ...VERS().map(([v]) => v)];
    else if (i === 1 && ['forecast', 'kv', 'scale'].includes(cmd)) opts = ctx.F.deps.map((d) => d.id);
    else if (i === 1 && cmd === 'logs') opts = [...ctx.F.jobs.map((j) => j.id), ...ctx.F.deps.map((d) => d.id)];
    else if (i === 1 && cmd === 'open') opts = Object.keys(VIEWS);
    else if (i === 1 && cmd === 'explain') opts = Object.keys(EXPLAIN);
    else if (i === 1 && cmd === 'export') opts = [...ctx.F.jobs.map((j) => j.id), ...ctx.F.deps.map((d) => d.id)];
    else if (i === 1 && cmd === 'serve' && 'status'.startsWith(cur)) opts = ['status', ...Object.keys(E.ARCH), ...VERS().map(([v]) => v)];
    else opts = (FLAGS[cmd] || []).filter((f) => !words.slice(1, -1).includes(f));
  }
  return { head: toks.slice(0, toks.length - 1).join(' '), cur, list: [...new Set(opts)].filter((o) => o.startsWith(cur)) };
}
/* What each suggestion is, shown on the right of the dropdown. */
const CMD_DESC = { serve: 'Registry to serving canary, all six steps', mesh: 'Device mesh and tensor parallel size', meta: 'Architecture, KV bytes, shard map', wrap: 'Load, quantize, kernels, CUDA graphs', optimize: 'Sweep configs against an SLO', allocate: 'Gang-schedule GPUs for replicas', plan: 'Training layouts: TP, PP, DP, recompute', status: 'Jobs and deployments', models: 'Registry versions', top: 'GPU telemetry snapshot', forecast: 'Next 24 h of demand and replicas', kv: 'KV cache capacity and hit rate', scale: 'Set replicas for a deployment', logs: 'Recent events for a job', explain: 'FSDP, KV cache, MoE, TP, PP and more', export: 'Render a job for Ray, Kubernetes, Slurm…', backends: 'Ray and its alternatives', ray: 'Ray cluster: status, actors, jobs', build: 'Lower a job to JAX or PyTorch on Ray', job: 'Submit, validate, list, describe, cancel jobs', run: 'Run a script across GPUs and CPUs', ls: 'List workspace files', tree: 'Workspace tree', cat: 'Print a file', edit: 'Edit a file', data: 'Shard a dataset across ranks', open: 'Open a console page', help: 'All commands', clear: 'Clear the screen', history: 'Commands you ran', crucible: 'The CLI' };
const FLAG_DESC = { '--auto': 'Run every step without pausing', '--engine': 'vllm, sglang or trt', '--replicas': 'Number of replicas', '--ttft': 'TTFT p90 SLO, seconds', '--itl': 'ITL p90 SLO, ms', '--gpu': 'h100, h200, b200, l40s', '--quant': 'fp8, bf16, int4', '--name': 'Deployment name', '--gpus': 'GPU budget for training', '--seq': 'Sequence length' };
function describe(o) {
  if (CMD_DESC[o]) return CMD_DESC[o];
  if (FLAG_DESC[o]) return FLAG_DESC[o];
  if (E.ARCH[o]) return `${E.ARCH[o].name} · ${si(E.ARCH[o].params)} params`;
  if (E.HW[o]) return `${E.HW[o].name} ${E.HW[o].mem} GB`;
  const v = E.MODELS.flatMap((m) => m.versions).find((x) => x[0] === o); if (v) return `${v[1]} · ${v[3]}`;
  const d = ctx.F.dep(o); if (d) return `${d.name} · ${d.engine}`;
  const j = ctx.F.job(o); if (j) return `${j.name} · ${j.state}`;
  if (VIEWS[o]) return 'Console page';
  if (EXPLAIN[o]) return EXPLAIN[o][0];
  if (FS[o]) return o.endsWith('.yaml') ? (FS[o].match(/kind: (\w+)/) || [])[1] || 'YAML' : o.endsWith('.py') ? 'Python' : 'File';
  const JD = { submit: 'Package, place and launch', validate: 'Check a spec', describe: 'Nodes, ranks, shards', cancel: 'Checkpoint and release GPUs', logs: 'Tail rank 0', '--dry-run': 'Plan without starting', '--follow': 'Keep tailing', shard: 'Assign shards to ranks', '--ranks': 'Data-parallel ranks', '--cpus': 'CPUs for preprocessing' };
  if (JD[o]) return JD[o];
  if (ctx.F.job(o)) return ctx.F.job(o).name + ' · ' + ctx.F.job(o).state;
  const BD = { jax: 'JAX backend: NamedSharding, jit, Orbax', torch: 'PyTorch backend: DTensor, FSDP2, DCP', '8x32x8': '2,048 devices', '4x64x8': '2,048 devices', '1x64x1': '64 devices, FSDP only', '2x16x4': '128 devices', '8x16x8': '1,024 devices', '--framework': 'jax or torch', '--mesh': 'data x fsdp x tensor', k8s: 'Kubeflow PyTorchJob + Kueue', slurm: 'sbatch + srun torchrun', skypilot: 'Any cloud, spot recovery', torchrun: 'Plain PyTorch launcher', monolith: 'One colocated SPMD job', kserve: 'KServe InferenceService', dynamo: 'NVIDIA Dynamo, disaggregated', llmd: 'llm-d on Kubernetes', triton: 'Triton + TensorRT-LLM', actors: 'Live actors', 'placement-groups': 'GPU reservations', submit: 'Submit a script', list: 'List', status: 'Cluster or app status', job: 'Jobs on the cluster' };
  if (BD[o]) return BD[o];
  return { vllm: 'vLLM 0.11', sglang: 'SGLang 0.5', trt: 'TensorRT-LLM 1.1', fp8: '1 byte per weight', bf16: '2 bytes per weight', int4: 'AWQ, ~0.56 bytes per weight' }[o] || '';
}

/* Dropdown above the prompt: arrows move, Tab or Enter picks, Esc closes. */
const M = T.menu = { open: false, list: [], idx: 0, head: '', cur: '', nav: false };
function menuUpdate(q, force) {
  const c = candidates(q.value);
  const exact = c.list.length === 1 && c.list[0] === c.cur;
  M.list = exact ? [] : c.list; M.head = c.head; M.cur = c.cur;
  M.open = M.list.length > 0 && (force || q.value.trim() !== '' || M.open);
  M.idx = Math.min(M.idx, Math.max(0, M.list.length - 1));
  menuDraw();
}
function menuDraw() {
  const el = $('#term-menu'); if (!el) return;
  if (!M.open) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = M.list.map((o, k) => `<button type="button" class="tm-item${k === M.idx ? ' on' : ''}" data-tmi="${k}"><b>${h(M.cur)}<span>${h(o.slice(M.cur.length))}</span></b><em>${h(describe(o))}</em></button>`).join('') + `<div class="tm-foot">↑↓ choose · Tab insert · Enter ${M.nav ? 'insert' : 'run'} · Esc close</div>`;
  const on = el.querySelector('.tm-item.on');
  if (on) { if (on.offsetTop < el.scrollTop) el.scrollTop = on.offsetTop - 4; else if (on.offsetTop + on.offsetHeight > el.scrollTop + el.clientHeight - 30) el.scrollTop = on.offsetTop + on.offsetHeight - el.clientHeight + 34; }
}
function menuPick(q, k = M.idx) {
  const o = M.list[k]; if (o === undefined) return;
  q.value = (M.head ? M.head + ' ' : '') + o + ' ';
  M.idx = 0; M.nav = false; menuUpdate(q, true); q.focus();
}

AFTER.terminal = () => {
  draw();
  const q = $('#term-q'); if (!q) return;
  q.focus();
  M.open = false; M.idx = 0;
  q.addEventListener('input', () => { M.idx = 0; M.nav = false; menuUpdate(q); });
  q.addEventListener('focus', () => menuUpdate(q));
  q.addEventListener('keydown', async (e) => {
    if (M.open && M.list.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); M.idx = M.nav ? (M.idx + 1) % M.list.length : Math.min(1, M.list.length - 1); M.nav = true; return menuDraw(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); M.idx = M.nav ? (M.idx - 1 + M.list.length) % M.list.length : M.list.length - 1; M.nav = true; return menuDraw(); }
      // Tab always inserts; Enter inserts only after choosing with the arrows, otherwise it runs the line.
      if (e.key === 'Tab' || (e.key === 'Enter' && M.nav)) { e.preventDefault(); return menuPick(q); }
      if (e.key === 'Escape') { e.preventDefault(); M.open = false; return menuDraw(); }
    }
    if (e.key === 'Tab') { e.preventDefault(); return menuUpdate(q, true); }
    if (e.key === 'Enter' && !T.busy) { const v = q.value; q.value = ''; M.open = false; menuDraw(); await exec(v); }
    if (e.key === 'ArrowUp') { T.hi = Math.max(0, T.hi - 1); q.value = T.hist[T.hi] || ''; e.preventDefault(); }
    if (e.key === 'ArrowDown') { T.hi = Math.min(T.hist.length, T.hi + 1); q.value = T.hist[T.hi] || ''; e.preventDefault(); }
    if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); CMDS.clear(); }
  });
  $('#term-menu').addEventListener('mousedown', (e) => { const b = e.target.closest('[data-tmi]'); if (b) { e.preventDefault(); menuPick(q, +b.dataset.tmi); } });
  q.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== q) { M.open = false; menuDraw(); } }, 120));
};
document.addEventListener('click', (e) => { const b = e.target.closest('[data-termrun]'); if (b && !T.busy) { e.stopPropagation(); exec(b.dataset.termrun); } }, true);
