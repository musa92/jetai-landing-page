/* Terminal: the crucible CLI in the browser. `crucible serve <model> --auto`
   runs the whole serving pipeline (mesh, meta, wrap, allocate, optimize,
   serve) against the same cost models the console uses. */
import { E, $, h, fmt, si, gb, ms, ctx, S, VIEWS, AFTER, ui, me, sleep, p90, usd, dur } from './core.js?v=20261030-1';

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
  if (!T.steps) return `<p class="note">Run <code>crucible serve core-8b --auto</code> to watch the six serving steps execute.</p>`;
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

/* ── commands ── */
const HELP = `[b]crucible[/] training and inference CLI

  [acc]serve[/] <model> [--auto] [--engine vllm|sglang|trt] [--replicas N] [--ttft 1.2] [--itl 40]
        runs mesh → meta → wrap → optimize → allocate → serve
  [acc]mesh[/] <model> [--gpu h100|h200|b200|l40s] [--quant fp8|bf16|int4]
  [acc]meta[/] <model>          architecture, KV bytes, shard map
  [acc]optimize[/] <model>      sweep configs against an SLO
  [acc]plan[/] <model> --gpus N  training layouts (TP, PP, DP, recompute)
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
    out(`  [dim]${pad('TP', 4)}${pad('PP', 6)}${pad('DP', 6)}${pad('shard', 8)}${pad('recompute', 11)}${lpad('mem/GPU', 9)}${lpad('MFU', 7)}${lpad('tokens/s', 10)}[/]`);
    for (const x of r.best) out(`  ${pad(x.c.tp, 4)}${pad(x.c.pp + (x.c.vpp > 1 ? '×' + x.c.vpp : ''), 6)}${pad(x.c.dp, 6)}${pad(x.c.zero >= 3 ? 'FSDP' : 'ZeRO-1', 8)}${pad(x.c.recompute, 11)}${lpad(gb(x.mem.total), 9)}${lpad((x.perf.mfu * 100).toFixed(1) + '%', 7)}${lpad(si(x.perf.tps), 10)}`);
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
  const chips = ['crucible serve core-8b --auto --engine sglang', 'crucible serve core-70b --auto --ttft 1.2 --itl 40', 'crucible plan core-70b --gpus 1024', 'crucible status', 'crucible top', 'crucible forecast assistant-8b'];
  return `<div class="view-head"><h1>Terminal</h1><p>Every console action is a CLI command. One line takes a model from the registry to a serving canary: mesh, metadata, engine wrap, allocation, SLO optimization and rollout.</p></div>
  <div class="term-wrap"><div class="term"><div class="term-bar"><i></i><i></i><i></i><span>crucible · ${h(me().name.split(' ')[0].toLowerCase())}@acme</span></div><div class="term-out" id="term-out"></div><label class="term-in"><span class="t-prompt">${h(me().name.split(' ')[0].toLowerCase())}@crucible ~ %</span><input id="term-q" autocomplete="off" spellcheck="false" placeholder="type a command, Tab to complete"></label><div class="term-hint" id="term-hint"></div></div>
    <aside class="term-side"><h3>Pipeline</h3><div id="term-steps"></div><h3 class="sub-h">Try</h3><div class="term-chips">${chips.map((c) => `<button class="btn" data-termrun="${h(c)}">${h(c.replace('crucible ', ''))}</button>`).join('')}</div></aside></div>`;
};
/* ── tab completion: commands, then models, deployments, jobs, flags and flag values ── */
const MODEL_ARGS = ['serve', 'mesh', 'meta', 'wrap', 'optimize', 'allocate', 'plan'];
const FLAGS = {
  serve: ['--auto', '--engine', '--replicas', '--ttft', '--itl', '--gpu', '--quant', '--name'],
  mesh: ['--gpu', '--quant'], wrap: ['--gpu', '--quant'], optimize: ['--gpu', '--quant', '--ttft', '--itl'],
  allocate: ['--gpu', '--quant', '--replicas'], plan: ['--gpus', '--gpu', '--seq'], scale: ['--replicas'],
};
const VALUES = {
  '--engine': ['vllm', 'sglang', 'trt'], '--gpu': Object.keys(E.HW), '--quant': ['fp8', 'bf16', 'int4'],
  '--gpus': ['64', '128', '256', '512', '1024', '2048', '4096'], '--seq': ['4096', '8192', '16384', '32768', '131072'],
  '--replicas': ['2', '4', '8', '16', '32'], '--ttft': ['0.3', '0.6', '1.2', '2.5'], '--itl': ['20', '30', '40', '60'],
};
function candidates(line) {
  const toks = line.replace(/^\s+/, '').split(/\s+/);
  const lead = toks[0] === 'crucible' ? 1 : 0;
  const words = toks.slice(lead), cur = words[words.length - 1] ?? '', i = words.length - 1;
  let opts = [];
  if (i <= 0) opts = [...Object.keys(CMDS), ...(lead ? [] : ['crucible'])];
  else {
    const cmd = words[0], prev = words[i - 1];
    if (VALUES[prev]) opts = VALUES[prev];
    else if (i === 1 && MODEL_ARGS.includes(cmd)) opts = [...Object.keys(E.ARCH).filter((k) => cmd !== 'plan' || !E.ARCH[k].experts), ...VERS().map(([v]) => v)];
    else if (i === 1 && ['forecast', 'kv', 'scale'].includes(cmd)) opts = ctx.F.deps.map((d) => d.id);
    else if (i === 1 && cmd === 'logs') opts = [...ctx.F.jobs.map((j) => j.id), ...ctx.F.deps.map((d) => d.id)];
    else if (i === 1 && cmd === 'open') opts = Object.keys(VIEWS);
    else opts = (FLAGS[cmd] || []).filter((f) => !words.slice(1, -1).includes(f));
  }
  return { head: toks.slice(0, toks.length - 1).join(' '), cur, list: [...new Set(opts)].filter((o) => o.startsWith(cur)) };
}
const common = (a) => !a.length ? '' : a.reduce((p, x) => { let k = 0; while (k < p.length && p[k] === x[k]) k++; return p.slice(0, k); });
function hint(q) {
  const el = $('#term-hint'); if (!el) return;
  const c = T.cyc >= 0 && T.cycList ? { list: T.cycList, cur: '' } : q.value.trim() ? candidates(q.value) : { list: [] };
  const show = c.list.length > 1 || (c.list.length === 1 && c.list[0] !== c.cur) ? c.list.slice(0, 20) : [];
  el.innerHTML = show.length ? show.map((o, k) => `<span class="${k === T.cyc ? 'on' : ''}">${h(o)}</span>`).join('') + (c.list.length > 20 ? `<em>+${c.list.length - 20} more</em>` : '') + `<em>${T.cyc >= 0 ? 'Tab for next' : 'Tab to complete'}</em>` : '';
}
function complete(q) {
  const c = candidates(q.value);
  if (!c.list.length && T.cyc < 0) return;
  const join = (w, done) => (c.head ? c.head + ' ' : '') + w + (done ? ' ' : '');
  if (T.cyc < 0 && c.list.length === 1) { q.value = join(c.list[0], true); T.armed = false; return; }
  const pre = common(c.list);
  if (T.cyc < 0 && pre.length > c.cur.length) { q.value = join(pre); T.armed = true; return; }
  // First Tab lists the matches; further Tabs cycle through them, zsh style.
  if (T.cyc < 0 && !T.armed) { T.armed = true; return; }
  T.cycList = T.cyc >= 0 && T.cycList ? T.cycList : c.list; T.cycHead = T.cyc >= 0 ? T.cycHead : c.head;
  T.cyc = (T.cyc + 1) % T.cycList.length;
  q.value = (T.cycHead ? T.cycHead + ' ' : '') + T.cycList[T.cyc];
}
T.cyc = -1;

AFTER.terminal = () => {
  draw();
  const q = $('#term-q'); if (!q) return;
  q.focus();
  q.addEventListener('input', () => { T.cyc = -1; T.cycList = null; T.armed = false; hint(q); });
  q.addEventListener('keydown', async (e) => {
    if (e.key === 'Tab') { e.preventDefault(); complete(q); hint(q); return; }
    if (e.key !== 'Shift') { T.cyc = -1; T.cycList = null; T.armed = false; }
    if (e.key === 'Enter' && !T.busy) { const v = q.value; q.value = ''; hint(q); await exec(v); }
    if (e.key === 'ArrowUp') { T.hi = Math.max(0, T.hi - 1); q.value = T.hist[T.hi] || ''; e.preventDefault(); hint(q); }
    if (e.key === 'ArrowDown') { T.hi = Math.min(T.hist.length, T.hi + 1); q.value = T.hist[T.hi] || ''; e.preventDefault(); hint(q); }
    if (e.key === 'Escape') { $('#term-hint').innerHTML = ''; }
    if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); CMDS.clear(); }
  });
};
document.addEventListener('click', (e) => { const b = e.target.closest('[data-termrun]'); if (b && !T.busy) { e.stopPropagation(); exec(b.dataset.termrun); } }, true);
