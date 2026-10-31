/* FSDP: the sharding configuration of each FSDP job, its measured cost per
   wrapped unit, peak memory over a step, the generated FSDP2 code, and
   config changes applied at the next checkpoint restart. */
import { E, h, fmt, si, gb, ms, ctx, S, VIEWS, ACTIONS, CLICKS, head, pill, stack, C, xyChart, can, me, toast } from './core.js?v=20261031-3';

S.fsdp = { job: null, draft: null };
const STRATS = { full: 'FULL_SHARD', grad: 'SHARD_GRAD_OP', hybrid: 'HYBRID_SHARD (HSDP)' };
const fsdpJobs = () => ctx.F.jobs.filter((j) => j.cfg && j.cfg.zero >= 3 && j.kind !== 'eval');
const defaults = (j) => j.fsdp || { strat: 'full', prefetch: 1, reduce: 'fp32', offload: 'false', wrap: 1 };
const on = (v) => v === true || v === 'true';

/* Per wrapped unit and per step, for one job and one FSDP config. Seconds and bytes, per GPU. */
export function fsdpModel(j, f) {
  const a = E.ARCH[j.arch], c = j.cfg, hw = E.HW[c.hw];
  const ranks = c.dp, tp = c.tp, wrap = +f.wrap, prefetch = +f.prefetch;
  const shardGroup = f.strat === 'hybrid' ? Math.max(1, Math.min(ranks, hw.perNode / tp)) : ranks;
  const embed = a.vocab * a.hidden * 2;
  const unitParams = (a.params - embed) / a.layers * wrap / tp;
  const units = a.layers / wrap;
  const intra = tp * shardGroup <= hw.perNode;
  const bw = intra ? hw.nvlink * 0.7 : hw.net * 0.85;
  const ring = (shardGroup - 1) / shardGroup;
  const ag = 2 * unitParams * ring / bw + 25e-6;                                    // BF16 params
  const rs = (f.reduce === 'fp32' ? 4 : 2) * unitParams * ring / bw + 25e-6;      // gradients
  const tokens = c.micro * c.seq;
  const peak = (c.fp8 ? hw.fp8 * 0.55 : hw.flops) * 0.5;
  let fwd = (2 * tokens * unitParams + 2 * wrap * tokens * c.seq * a.hidden / tp) / peak;
  let bwd = 2 * fwd * (c.recompute === 'full' ? 1.5 : 1);
  // Calibrate to the same compute model the Runs page uses, so both pages agree.
  const k = E.trainStep(a, c).parts.compute / (units * (fwd + bwd) * c.accum);
  fwd *= k; bwd *= k;
  // With prefetch depth p, a unit's all-gather can hide behind p units of compute.
  const hideF = Math.min(1, (fwd * prefetch) / ag), hideB = Math.min(1, (bwd * prefetch) / (ag + rs));
  const regather = f.strat === 'grad' ? 0 : 1;
  const exposedF = units * ag * (1 - hideF) + ag, exposedB = units * (ag * regather + rs) * (1 - hideB);
  // HSDP adds a cross-node all-reduce of gradient shards between replicas once per step.
  const replicas = ranks / shardGroup;
  const hsdpAR = f.strat === 'hybrid' && replicas > 1 ? 2 * (4 * unitParams * units / shardGroup) * (replicas - 1) / replicas / (hw.net * 0.85) * 0.35 : 0;
  const offload = on(f.offload) ? 16 * a.params / tp / shardGroup / 25e9 : 0;     // PCIe Gen5, ~25 GB/s effective
  const compute = units * (fwd + bwd) * c.accum;
  const exposed = (exposedF + exposedB) * c.accum + hsdpAR;
  const step = compute + exposed + offload;
  const state = (on(f.offload) ? 2 : 16) * a.params / tp / shardGroup + (f.strat === 'grad' ? 2 * a.params / tp * (1 - 1 / shardGroup) : 0);
  const gathered = 2 * unitParams * (1 + prefetch);
  const actPerUnit = 18 * tokens * a.hidden * wrap / tp;
  const peakMem = state + gathered + actPerUnit * units + 2.5e9;
  const comm = units * (ag * (1 + regather) + rs) * c.accum;
  return { units, unitParams, shardGroup, intra, ag, rs, fwd, bwd, hideF, hideB, exposed, compute, step, state, gathered, actPerUnit, peakMem, comm, offload, tokensPerStep: c.micro * c.accum * c.dp * c.seq, ranks };
}

/* Memory on one GPU through a microbatch: shards resident, units gathered and freed, activations built in forward and released in backward. */
function memTrace(m) {
  const pts = [[0, (m.state + 2.5e9) / 1e9]], base = m.state + 2.5e9;
  let t = 0;
  for (let u = 0; u < m.units; u++) { t += m.fwd; pts.push([t * 1000, (base + m.gathered + m.actPerUnit * (u + 1)) / 1e9]); }
  for (let u = m.units - 1; u >= 0; u--) { t += m.bwd; pts.push([t * 1000, (base + m.gathered + m.actPerUnit * u) / 1e9]); }
  pts.push([t * 1000 + 1, base / 1e9]);
  return pts;
}

function code(j, f, m) {
  const mesh = f.strat === 'hybrid' ? `init_device_mesh("cuda", (${m.ranks / m.shardGroup}, ${m.shardGroup}), mesh_dim_names=("replicate", "shard"))` : `init_device_mesh("cuda", (${m.ranks},), mesh_dim_names=("shard",))`;
  return `# crucible.backends.torch.fsdp, generated for ${j.id}
from torch.distributed.fsdp import fully_shard, MixedPrecisionPolicy${on(f.offload) ? ', CPUOffloadPolicy' : ''}
from torch.distributed.device_mesh import init_device_mesh

mesh = ${mesh}
mp = MixedPrecisionPolicy(param_dtype=torch.bfloat16, reduce_dtype=torch.${f.reduce === 'fp32' ? 'float32' : 'bfloat16'})
kw = dict(mesh=mesh, mp_policy=mp${on(f.offload) ? ', offload_policy=CPUOffloadPolicy()' : ''})

units = []
for i in range(0, len(model.layers), ${f.wrap}):              # ${m.units} FSDP units of ${f.wrap} block${+f.wrap > 1 ? 's' : ''}
    unit = ${+f.wrap > 1 ? `torch.nn.ModuleList(model.layers[i:i + ${f.wrap}])` : 'model.layers[i]'}
    fully_shard(unit, reshard_after_forward=${f.strat === 'grad' ? 'False' : 'True'}, **kw)
    units.append(unit)
fully_shard(model, **kw)                             # embeddings, final norm, LM head

# explicit prefetch: gather the next ${f.prefetch} unit${+f.prefetch > 1 ? 's' : ''} while the current one computes
for k, u in enumerate(units[:-1]):
    u.set_modules_to_forward_prefetch(units[k + 1:k + 1 + ${f.prefetch}])
for k, u in enumerate(units[1:], start=1):
    u.set_modules_to_backward_prefetch(units[max(0, k - ${f.prefetch}):k][::-1])`;
}

VIEWS.fsdp = () => {
  const jobs = fsdpJobs();
  if (!jobs.some((j) => j.id === S.fsdp.job)) { S.fsdp.job = (jobs.find((j) => j.state === 'running') || jobs[0])?.id; S.fsdp.draft = null; }
  const j = ctx.F.job(S.fsdp.job);
  if (!j) return head('FSDP', 'No FSDP jobs.');
  const cur = defaults(j), d = S.fsdp.draft || (S.fsdp.draft = { ...cur });
  const m0 = fsdpModel(j, cur), m1 = fsdpModel(j, d);
  const cap = E.HW[j.cfg.hw].mem * 1e9, changed = JSON.stringify(cur) !== JSON.stringify(d);
  const sel = (k, opts) => `<select data-bind="fsdp.draft.${k}" data-num="no">${opts.map(([v, t]) => `<option value="${v}"${String(v) === String(d[k]) ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
  const diff = (a, b, fmtv, lowerBetter = true) => { const better = lowerBetter ? b < a * 0.995 : b > a * 1.005, worse = lowerBetter ? b > a * 1.005 : b < a * 0.995; return `<span class="${better ? 'dv-up' : worse ? 'dv-down' : ''}">${fmtv(b)}</span>`; };
  const tput = (m) => m.tokensPerStep / m.step / (m.ranks * j.cfg.tp);
  const n = Math.min(8, m0.units);
  const recs = [];
  const hy = fsdpModel(j, { ...cur, strat: 'hybrid' });
  if (!m0.intra && cur.strat !== 'hybrid' && hy.step < m0.step * 0.98 && hy.peakMem < cap * 0.92) recs.push(['Shard inside the node (HSDP)', `All-gathers cross InfiniBand. HYBRID_SHARD keeps them on NVLink and replicates across nodes: step ${ms(m0.step)} → ${ms(hy.step)}, memory ${gb(m0.peakMem)} → ${gb(hy.peakMem)}.`, { strat: 'hybrid' }]);
  const pf = fsdpModel(j, { ...cur, prefetch: 2 });
  if (+cur.prefetch === 1 && m0.hideF < 0.999) recs.push(['Prefetch two units ahead', `Forward hides ${(m0.hideF * 100).toFixed(0)}% of each all-gather today; with two units ahead ${(pf.hideF * 100).toFixed(0)}%, for ${gb(2 * m0.unitParams)} more memory.`, { prefetch: '2' }]);
  if (cur.reduce === 'fp32' && m0.exposed / m0.step > 0.02) recs.push(['Reduce gradients in BF16', 'Halves reduce-scatter bytes. Keep FP32 if loss spikes appear.', { reduce: 'bf16' }]);
  const g2 = fsdpModel(j, { ...cur, strat: 'grad' });
  if (cur.strat === 'full' && g2.peakMem < cap * 0.9 && g2.step < m0.step * 0.99) recs.push(['Skip the backward re-gather', `SHARD_GRAD_OP keeps parameters gathered from forward to backward and still fits (${gb(g2.peakMem)}).`, { strat: 'grad' }]);
  return head('FSDP', 'Sharding configuration and measured collective cost for every FSDP job. Change the strategy, prefetch or precision, compare against the running configuration, and apply at the next checkpoint restart.') + `
  <div class="grid"><div class="card c12"><div class="row between"><div class="seg">${jobs.map((x) => `<button class="${x.id === j.id ? 'on' : ''}" data-fsdpjob="${x.id}">${h(x.name)}</button>`).join('')}</div><button class="btn" data-openrun="${j.id}">Open run</button></div></div>
    <div class="card c3 kpi"><b>${ms(m0.step)}</b><span>Step time</span><small>${fmt(m0.ranks)} ranks · ${m0.units} units · ${j.cfg.accum} microbatch${j.cfg.accum > 1 ? 'es' : ''}</small></div>
    <div class="card c3 kpi ${m0.exposed / m0.step > 0.08 ? 'bad' : ''}"><b>${(m0.exposed / m0.step * 100).toFixed(1)}%</b><span>Step waiting on FSDP collectives</span><small>${ms(m0.comm)} of collectives, ${Math.max(0, (1 - m0.exposed / m0.comm) * 100).toFixed(0)}% overlapped</small></div>
    <div class="card c3 kpi"><b>${gb(m0.peakMem)}</b><span>Peak memory per GPU</span><small>of ${E.HW[j.cfg.hw].mem} GB · sharded state ${gb(m0.state)}</small></div>
    <div class="card c3 kpi"><b>${fmt(tput(m0))}</b><span>Tokens/s per GPU</span><small>${STRATS[cur.strat]} over ${m0.shardGroup} ranks, ${m0.intra ? 'NVLink' : 'InfiniBand'}</small></div>
    <div class="card c5"><h3>Configuration</h3><div class="ff2">
      <label>Sharding strategy</label>${sel('strat', Object.entries(STRATS))}
      <label>Prefetch depth</label>${sel('prefetch', [['1', '1 unit'], ['2', '2 units']])}
      <label>Gradient reduce dtype</label>${sel('reduce', [['fp32', 'FP32'], ['bf16', 'BF16']])}
      <label>Wrap policy</label>${sel('wrap', [['1', 'Every transformer block'], ['2', 'Every 2 blocks']])}
      <label>CPU offload</label>${sel('offload', [['false', 'Off'], ['true', 'Optimizer state and grads']])}</div>
      <table class="table cmp"><thead><tr><th></th><th class="num">Running</th><th class="num">Projected</th></tr></thead><tbody>
        <tr><td>Step time</td><td class="num">${ms(m0.step)}</td><td class="num">${diff(m0.step, m1.step, ms)}</td></tr>
        <tr><td>Tokens/s per GPU</td><td class="num">${fmt(tput(m0))}</td><td class="num">${diff(tput(m0), tput(m1), (v) => fmt(v), false)}</td></tr>
        <tr><td>Waiting on collectives</td><td class="num">${(m0.exposed / m0.step * 100).toFixed(1)}%</td><td class="num">${diff(m0.exposed / m0.step, m1.exposed / m1.step, (v) => (v * 100).toFixed(1) + '%')}</td></tr>
        <tr><td>Peak memory / GPU</td><td class="num">${gb(m0.peakMem)}</td><td class="num">${diff(m0.peakMem, m1.peakMem, gb)}${m1.peakMem > cap * 0.92 ? ' ' + pill('deny', 'OOM') : ''}</td></tr>
      </tbody></table>
      <div class="row"><button class="btn primary" data-act="fsdp-apply" ${changed && m1.peakMem <= cap * 0.92 && can('researcher', 'ml_engineer', 'platform') ? '' : 'disabled'}>Apply at next checkpoint</button><button class="btn" data-act="fsdp-reset" ${changed ? '' : 'disabled'}>Discard</button></div></div>
    <div class="card c7"><h3>Memory per GPU through one microbatch</h3>${xyChart([{ name: 'Running', color: C.blue, pts: memTrace(m0) }, ...(changed ? [{ name: 'Projected', color: C.purple, dash: true, pts: memTrace(m1) }] : [])], { xl: 'ms', yl: 'GB', fy: (v) => v.toFixed(0), fx: (v) => Math.round(v), ymax: E.HW[j.cfg.hw].mem * 1.08, hline: { v: E.HW[j.cfg.hw].mem, label: `${E.HW[j.cfg.hw].mem} GB` }, w: 760, hgt: 220 })}
      ${stack([['Sharded state', m0.state, C.purple], ['Gathered units', m0.gathered, C.blue], ['Activations at peak', m0.actPerUnit * m0.units, C.amber], ['Runtime', 2.5e9, C.gray], ['Free', Math.max(0, cap - m0.peakMem), 'var(--fill-2)']], gb)}</div>
    <div class="card c12"><h3>Per unit, rank 0 <span class="right">first ${n} of ${m0.units} units · NCCL flight recorder and CUDA events, last 20 steps</span></h3><table class="table"><thead><tr><th>Unit</th><th class="num">Params per rank</th><th class="num">All-gather</th><th class="num">Forward</th><th class="num">Hidden in fwd</th><th class="num">Reduce-scatter</th><th class="num">Backward</th><th class="num">Hidden in bwd</th><th>Link</th></tr></thead><tbody>${Array.from({ length: n }, (_, u) => { const jit = 1 + 0.04 * Math.sin(u * 2.1); return `<tr><td class="mono">layers.${u * cur.wrap}${+cur.wrap > 1 ? '-' + (u * cur.wrap + +cur.wrap - 1) : ''}</td><td class="num">${si(m0.unitParams / m0.shardGroup)}</td><td class="num">${ms(m0.ag * jit)}</td><td class="num">${ms(m0.fwd)}</td><td class="num">${u === 0 ? pill('warn', 'exposed') : (m0.hideF * 100).toFixed(0) + '%'}</td><td class="num">${ms(m0.rs * jit)}</td><td class="num">${ms(m0.bwd)}</td><td class="num">${(m0.hideB * 100).toFixed(0)}%</td><td>${m0.intra ? 'NVLink' : 'InfiniBand'}</td></tr>`; }).join('')}</tbody></table></div>
    <div class="card c5"><h3>Recommendations</h3>${recs.length ? `<div class="recs">${recs.map(([t, x, patch]) => `<div class="rec"><div><b>${t}</b><p>${h(x)}</p></div><button class="btn" data-fsdppatch='${JSON.stringify(patch)}'>Try</button></div>`).join('')}</div>` : '<p class="note">Collectives are hidden behind compute. Nothing to change.</p>'}</div>
    <div class="card c7"><h3>Implementation</h3><pre class="code">${h(code(j, d, m1))}</pre></div>
  </div>`;
};
CLICKS.push(['fsdpjob', (id) => { S.fsdp.job = id; S.fsdp.draft = null; }]);
CLICKS.push(['fsdppatch', (p) => { Object.assign(S.fsdp.draft, JSON.parse(p)); }]);
ACTIONS['fsdp-reset'] = () => { S.fsdp.draft = null; };
ACTIONS['fsdp-apply'] = () => {
  const j = ctx.F.job(S.fsdp.job), d = S.fsdp.draft;
  j.fsdp = { ...d };
  ctx.F.event(Date.now(), j.id, 'checkpoint', `FSDP config changed by ${me().name}: ${STRATS[d.strat]}, prefetch ${d.prefetch}, reduce ${d.reduce.toUpperCase()}${on(d.offload) ? ', CPU offload' : ''}. Applies at the next checkpoint restart.`);
  toast('Saved. The job restarts from its next checkpoint with the new sharding.');
};
