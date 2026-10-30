/* Inference views: deployments (SLOs, tuning, canary rollout, autoscaling,
   engine config), the capacity planner and engine benchmarks. */
import { E, h, fmt, si, gb, ms, dur, ago, usd, ctx, S, VIEWS, ACTIONS, CLICKS, DRAWERS, EV, EXPORTS, head, pill, glist, stack, seg, C, xyChart, can, me, toast, ui, sleep, p90 } from './core.js?v=20261030-1';
import { tsChart } from './charts.js?v=20261030-1';

const DSTATE = { healthy: 'ok', canary: 'blue', degraded: 'warn', 'rolling back': 'warn' };
const effCfg = (d) => (d.issue ? { ...d.cfg, prompt: 5800 } : d.cfg);
const sloOk = (d, s) => { const q = p90(s); return q.ttft <= d.slo.ttft && q.itl <= d.slo.itl; };
const specLabel = (c) => (c.spec ? `${c.spec.kind || 'Draft'}, k=${c.spec.k}` : 'Off');

/* ───────────────────────── deployments ───────────────────────── */

VIEWS.deployments = () => {
  const F = ctx.F;
  if (!F.dep(S.dep)) S.dep = F.deps[0].id;
  const d = F.dep(S.dep);
  const list = F.deps.map((x) => { const s = F.servingNow(x), ok = sloOk(x, s); const badge = !ok || x.state === 'degraded' ? '<span class="badge warn">SLO breach</span>' : x.canary ? `<span class="badge blue">Canary ${x.canary.steps[x.canary.step - 1]}%</span>` : ''; return `<button class="lcm-row nodot${x.id === S.dep ? ' on' : ''}" data-opendep="${x.id}"><span><b>${h(x.name)}</b><small>${h(x.engine)} · ${x.replicas} × TP${x.cfg.tp}${x.cfg.disagg ? ' + prefill' : ''} · ${si(s.total)} req/s</small></span>${badge}</button>`; }).join('');
  return head('Deployments', 'Every model serving traffic: engine, layout, SLOs and cost per token. Tune a deployment, then roll the change out as a canary gated on its SLOs.') + `<div class="grid"><div class="card c12 lcm"><div class="lcm-list"><div class="lcm-rows">${list}</div></div><div class="lcm-detail">${depDetail(d)}</div></div></div>`;
};
CLICKS.push(['opendep', (id) => { S.dep = id; if (S.view !== 'deployments') ui.go('deployments'); }]);
CLICKS.push(['deptab', (k) => { S.depTab = k; }]);

function depDetail(d) {
  const F = ctx.F, s = F.servingNow(d), a = E.ARCH[d.arch], hw = E.HW[d.cfg.hw];
  const tabs = [['overview', 'Overview'], ['tuning', 'Tuning'], ['rollout', 'Rollout'], ['autoscaling', 'Autoscaling'], ['config', 'Engine config']];
  return `<div class="lcm-head"><div><h2>${h(d.name)} <span>${pill(DSTATE[d.state] || '', d.state)}</span></h2><p>${h(d.model)} · ${h(d.engine)} ${h(d.version)} · ${h(d.region)} · ${h(E.TEAMS[d.team].name)}</p></div></div>
    <div class="lcm-facts"><span><small>Model</small>${h(a.name)}</span><span><small>Replicas</small>${d.replicas} (${d.min} to ${d.max})</span><span><small>GPUs</small>${fmt(s.gpus)} × ${h(hw.name)}</span><span><small>Per replica</small>TP ${d.cfg.tp}${d.cfg.ep ? ` · EP ${d.cfg.ep}` : ''}${d.cfg.disagg ? ` · +${d.cfg.disagg} prefill GPUs` : ''}</span><span><small>Weights / KV</small>${d.cfg.quant.toUpperCase()} / ${d.cfg.kvq.toUpperCase()}</span><span><small>Speculative</small>${specLabel(d.cfg)}</span></div>
    ${d.issue ? `<div class="lcm-banner warn"><b>SLO breach.</b> ${h(d.issue)} The autoscaler is pinned at max replicas, so more replicas cannot help. <button class="link" data-deptab="tuning">See the tuning fix ›</button></div>` : ''}
    ${seg('deptab', S.depTab, tabs)}
    ${({ overview: depOverview, tuning: depTuning, rollout: depRollout, autoscaling: depScale, config: depConfig })[S.depTab](d, s)}`;
}

function depOverview(d, s) {
  const F = ctx.F, q = p90(s);
  const hist = (fn) => Array.from({ length: 97 }, (_, i) => { const t = Date.now() - 864e5 + i * 9e5; return [t, fn(t)]; });
  const lat = Array.from({ length: 49 }, (_, i) => { const t = Date.now() - 864e5 + i * 18e5; const x = F.servingNow(d, t); return [t, p90(x)]; });
  return `<div class="lcm-tiles">
      <div class="lcm-tile"><span>Requests/s</span><b>${si(s.total)}</b><small>${s.per.toFixed(1)} per replica</small></div>
      <div class="lcm-tile ${q.ttft > d.slo.ttft ? 'fail' : ''}"><span>TTFT p90</span><b>${ms(q.ttft)}</b><small>SLO ${ms(d.slo.ttft)}</small></div>
      <div class="lcm-tile ${q.itl > d.slo.itl ? 'fail' : ''}"><span>ITL p90</span><b>${ms(q.itl)}</b><small>SLO ${ms(d.slo.itl)}</small></div>
      <div class="lcm-tile"><span>Output tokens/s</span><b>${si(s.tpsAll)}</b><small>${fmt(s.tpsAll / s.gpus)} per GPU</small></div>
      <div class="lcm-tile"><span>Batch per replica</span><b>${Math.round(s.B)}</b><small>max ${fmt(s.cap.maxBatch)} by KV memory</small></div>
      <div class="lcm-tile"><span>Cost per 1M tokens</span><b>${usd(s.cost)}</b><small>output, at list price</small></div></div>
    <div class="grid2"><div class="card-sub"><h4>Requests per second, 24 hours</h4>${tsChart([{ name: 'Requests/s', color: C.blue, points: hist((t) => F.trafficAt(d, t)) }], { range: '24h', w: 400, height: 150, area: true })}</div>
    <div class="card-sub"><h4>Latency p90, 24 hours</h4>${tsChart([{ name: 'TTFT', color: C.purple, points: lat.map(([t, x]) => [t, x.ttft * 1000]) }, { name: 'ITL', color: C.teal, points: lat.map(([t, x]) => [t, x.itl * 1000]) }], { range: '24h', w: 400, height: 150, fmt: (v) => Math.round(v) + ' ms', threshold: { value: d.slo.ttft * 1000, label: 'TTFT SLO' } })}</div></div>
    <div class="card-sub"><h4>KV cache per replica: ${si(s.cap.kvTokens)} tokens in ${gb(s.cap.kvBytes)}</h4>${stack([['Active sequences', s.kvActive, C.blue], ['Cached prefixes', s.kvCached, C.teal], ['Free', Math.max(0, 1 - s.kvActive - s.kvCached), 'var(--fill-2)']], (v) => (v * 100).toFixed(0) + '%')}<p class="note">Prefix hit rate ${((d.cfg.prefixHit || 0) * 100).toFixed(0)}%: shared system prompts and earlier turns skip prefill. The router hashes the prefix to send a conversation back to the replica that holds its cache.</p></div>
    <div class="card-sub"><h4>Features</h4><div class="tags">${d.features.map((f) => pill('blue', f)).join('')}</div></div>`;
}

/* ── tuning: search configurations, pick the cheapest that meets the SLO ── */
function candidates(d) {
  const a = E.ARCH[d.arch], base = effCfg(d), out = [];
  const quants = d.arch === 'moe-235b' ? ['fp8'] : ['bf16', 'fp8', 'int4'];
  for (const tp of [1, 2, 4, 8]) for (const quant of quants) for (const disagg of [0, tp]) for (const spec of [base.spec, null]) {
    const c = { ...base, tp, quant, kvq: quant === 'bf16' ? 'bf16' : 'fp8', disagg: disagg || 0, spec };
    if (!E.serveCapacity(a, c).fits) continue;
    if (spec === null && !base.spec && out.some((x) => x.c.tp === tp && x.c.quant === quant && x.c.disagg === c.disagg)) continue;
    const cur = E.serveCurve(a, c, d.slo, 14);
    if (!cur.goodput) continue;
    out.push({ c, cur });
  }
  out.sort((x, y) => x.cur.cost - y.cur.cost);
  return out;
}
function depTuning(d, s) {
  const F = ctx.F, a = E.ARCH[d.arch];
  const now = E.serveCurve(a, effCfg(d), d.slo, 14);
  const list = candidates(d).slice(0, 6);
  const total = F.trafficAt(d);
  const gpusFor = (r) => Math.ceil(total / (r.cur.goodput * 0.7)) * r.cur.gpus;
  const label = (c) => `TP ${c.tp} · ${c.quant.toUpperCase()}${c.disagg ? ` · ${c.disagg} prefill GPUs` : ''} · spec ${c.spec ? 'on' : 'off'}`;
  const best = list[0];
  const T = S.tune[d.id] || (S.tune[d.id] = 0);
  const pick = list[T] || best;
  const rows = list.map((r, i) => `<tr class="click${i === T ? ' sel' : ''}" data-tunepick="${i}"><td>${h(label(r.c))}${i === 0 ? ' ' + pill('ok', 'Cheapest') : ''}</td><td class="num">${r.cur.goodput.toFixed(1)}</td><td class="num">${fmt(r.cur.tpsAtGoodput / r.cur.gpus)}</td><td class="num">${usd(r.cur.cost)}</td><td class="num">${fmt(gpusFor(r))}</td></tr>`).join('');
  return `<p class="note">Each row is a full sweep of request rate against the cost model for this model, hardware and today's traffic shape (${fmt(effCfg(d).prompt)} prompt tokens, ${fmt(effCfg(d).out)} output, ${((d.cfg.prefixHit || 0) * 100).toFixed(0)}% prefix hits). Goodput is the highest rate per replica that meets both SLOs.</p>
    <table class="table"><thead><tr><th>Configuration</th><th class="num">Goodput req/s/replica</th><th class="num">Tokens/s/GPU</th><th class="num">$ / 1M tokens</th><th class="num">GPUs for current load</th></tr></thead><tbody>
    <tr class="cur"><td>Current: ${h(label(effCfg(d)))}</td><td class="num">${now.goodput.toFixed(1)}</td><td class="num">${now.goodput ? fmt(now.tpsAtGoodput / now.gpus) : '0'}</td><td class="num">${now.cost ? usd(now.cost) : 'misses SLO'}</td><td class="num">${now.goodput ? fmt(Math.ceil(total / (now.goodput * 0.7)) * now.gpus) : 'any'}</td></tr>${rows}</tbody></table>
    ${pick ? `<div class="card-sub"><h4>Latency against throughput per GPU</h4>${xyChart([{ name: 'Current', color: C.gray, dash: true, pts: now.rows.filter((r) => Number.isFinite(r.itl)).map((r) => [r.tps / now.gpus, p90(r).itl * 1000]) }, { name: label(pick.c), color: C.blue, pts: pick.cur.rows.filter((r) => Number.isFinite(r.itl)).map((r) => [r.tps / pick.cur.gpus, p90(r).itl * 1000]) }], { xl: 'output tokens/s per GPU', yl: 'ITL p90, ms', fy: (v) => Math.round(v), hline: { v: d.slo.itl * 1000, label: 'ITL SLO' }, hgt: 230, w: 820 })}</div>
    <div class="row"><button class="btn primary" data-act="tune-canary" ${can('ml_engineer', 'platform', 'sre') ? '' : 'disabled title="ML engineer, platform engineer or SRE"'}>Roll out ${h(label(pick.c))} as canary</button><span class="note">Starts at 5% of traffic; advances only while TTFT, ITL and error rate stay inside SLO.</span></div>` : '<p class="note">No configuration meets the SLO on this hardware.</p>'}`;
}
CLICKS.push(['tunepick', (i) => { S.tune[S.dep] = +i; }]);

/* ── rollout ── */
function depRollout(d) {
  const c = d.canary;
  if (!c) return `<div class="empty"><b>No rollout in progress.</b>${h(d.model)} serves 100% of traffic. Changes from the Tuning tab, or a new model version, start here as a 5% canary.</div>`;
  const pct = c.steps[c.step - 1];
  const gates = [['TTFT p90', 'within SLO and within 10% of baseline', true], ['ITL p90', 'within SLO', true], ['Error rate', '0.02% vs 0.03% baseline', true], ['Shadow eval win rate', c.to.includes('grpo') ? '54% vs current (n = 2,400)' : 'no regression', true], ['KV cache evictions', 'under 1% of requests', true]];
  return `<div class="canary">${c.steps.map((p, i) => `<div class="cstep ${i < c.step - 1 ? 'done' : i === c.step - 1 ? 'on' : ''}"><b>${p}%</b><span>${i < c.step - 1 ? 'passed' : i === c.step - 1 ? 'current' : 'next'}</span></div>`).join('<i></i>')}</div>
    <p class="note">${h(c.from === 'none' ? 'New deployment' : `${c.from} → ${c.to}`)}${c.change ? `: ${h(c.change)}` : ''}. ${pct}% of traffic on the canary for ${dur((Date.now() - (c.since || Date.now() - 50 * 6e4)) / 1000)}.</p>
    <table class="table"><thead><tr><th>Gate</th><th>Canary</th><th>Status</th></tr></thead><tbody>${gates.map(([k, v, ok]) => `<tr><td>${k}</td><td>${h(v)}</td><td>${pill(ok ? 'ok' : 'deny', ok ? 'Pass' : 'Fail')}</td></tr>`).join('')}</tbody></table>
    <div class="row"><button class="btn primary" data-act="canary-advance" ${can('ml_engineer', 'platform', 'researcher', 'sre') ? '' : 'disabled'}>${c.step < c.steps.length ? `Advance to ${c.steps[c.step]}%` : 'Complete rollout'}</button><button class="btn danger" data-act="canary-rollback">Roll back</button></div>`;
}
ACTIONS['canary-advance'] = () => {
  const F = ctx.F, d = F.dep(S.dep), c = d.canary; if (!c) return;
  if (c.step < c.steps.length) { c.step++; c.since = Date.now(); F.event(Date.now(), d.id, 'deploy', `Canary advanced to ${c.steps[c.step - 1]}% by ${me().name}.`); toast(`Canary at ${c.steps[c.step - 1]}%`); }
  if (c.step === c.steps.length && c.steps[c.step - 1] === 100) {
    if (c.cfg) { d.cfg = c.cfg; d.issue = null; }
    d.model = c.to; d.canary = null; d.state = 'healthy'; d.replicas = F.desiredReplicas(d);
    F.event(Date.now(), d.id, 'promoted', `Rollout complete: ${d.model} on 100% of traffic.`);
    toast(`${d.name} rollout complete`);
  }
};
ACTIONS['canary-rollback'] = () => { const F = ctx.F, d = F.dep(S.dep); if (!d.canary) return; F.event(Date.now(), d.id, 'rollback', `Rolled back by ${me().name}; ${d.canary.from === 'none' ? 'deployment removed from the router' : d.canary.from + ' serves 100%'}.`); d.canary = null; d.state = d.issue ? 'degraded' : 'healthy'; toast('Rolled back'); };
ACTIONS['tune-canary'] = () => {
  const d = ctx.F.dep(S.dep), list = candidates(d), pick = list[S.tune[d.id] || 0];
  if (!pick) return;
  const c = { ...pick.c, prompt: d.cfg.prompt };
  d.canary = { from: d.model, to: d.model, step: 1, steps: [5, 25, 50, 100], cfg: c, since: Date.now(), change: `TP ${c.tp}, ${c.quant.toUpperCase()}${c.disagg ? `, ${c.disagg} prefill GPUs per replica` : ''}, speculative ${c.spec ? 'on' : 'off'}` };
  d.state = 'canary';
  ctx.F.event(Date.now(), d.id, 'deploy', `Config canary started by ${me().name}: ${d.canary.change}.`);
  S.depTab = 'rollout'; toast('Canary started at 5%');
};

/* ── autoscaling ── */
function depScale(d) {
  const F = ctx.F, a = E.ARCH[d.arch];
  const per = E.serveCurve(a, effCfg(d), d.slo, 14).goodput;
  const pts = Array.from({ length: 49 }, (_, i) => { const t = Date.now() - 864e5 + i * 18e5; return [t, d.issue ? d.max : F.desiredReplicas(d, t)]; });
  const load = (a.params * E.WBYTES_(d.cfg.quant) / 1e9);
  return `<div class="lcm-tiles"><div class="lcm-tile"><span>Target per replica</span><b>${(per * 0.7).toFixed(1)} req/s</b><small>70% of goodput ${per.toFixed(1)}</small></div><div class="lcm-tile"><span>Now</span><b>${d.replicas}</b><small>replicas, bounds ${d.min} to ${d.max}</small></div><div class="lcm-tile"><span>Cold start</span><b>${Math.round(load / 3.2 + 14 + 9)} s</b><small>to first token</small></div></div>
    <div class="card-sub"><h4>Replicas, 24 hours</h4>${tsChart([{ name: 'Replicas', color: C.blue, points: pts }], { range: '24h', w: 820, height: 140, fmt: (v) => Math.round(v) })}</div>
    ${glist([['Signal', 'Requests per replica against goodput, plus queue depth. Not GPU utilization: a decoding GPU always looks busy.'], ['Scale up', 'Within 60 s when the 2-minute average passes target'], ['Scale down', 'After 10 minutes below 50% of target, draining in-flight requests'], ['Cold start', `Weights (${load.toFixed(0)} GB) stream from node-local NVMe at 3.2 GB/s, CUDA graphs captured in 14 s, warmup 9 s`], ['Warm pool', `${Math.max(1, Math.round(d.replicas * 0.05))} replicas preloaded on idle capacity`], ['Priority', d.id === 'moe-235b' ? 'Batch: preemptible, fills idle capacity' : 'Interactive: never preempted']])}
    <div class="row"><label class="field inline">Min <input type="number" data-bind="depmin" value="${d.min}" min="1"></label><label class="field inline">Max <input type="number" data-bind="depmax" value="${d.max}" min="1"></label><button class="btn" data-act="save-scale" ${can('sre', 'platform', 'ml_engineer') ? '' : 'disabled'}>Save bounds</button></div>`;
}
ACTIONS['save-scale'] = () => { const d = ctx.F.dep(S.dep); const mn = +S.depmin || d.min, mx = +S.depmax || d.max; if (mn > mx) return toast('Min must not exceed max'); d.min = mn; d.max = mx; d.replicas = Math.max(mn, Math.min(mx, d.replicas)); ctx.F.event(Date.now(), d.id, 'scaled', `Bounds set to ${mn} to ${mx} by ${me().name}.`); toast('Autoscaling bounds saved'); };

function depConfig(d) {
  const c = d.cfg, a = E.ARCH[d.arch];
  const vllm = `vllm serve acme/${d.model} \\
  --tensor-parallel-size ${c.tp} \\
  --quantization ${c.quant === 'int4' ? 'awq' : c.quant === 'fp8' ? 'fp8' : 'none'} --kv-cache-dtype ${c.kvq === 'fp8' ? 'fp8_e4m3' : 'auto'} \\
  --enable-prefix-caching --enable-chunked-prefill --max-num-batched-tokens 8192 \\
  --gpu-memory-utilization 0.90 --max-model-len ${c.prompt > 4000 ? 32768 : 16384}${c.spec ? ` \\
  --speculative-config '{"method": "${c.spec.kind && c.spec.kind.startsWith('EAGLE') ? 'eagle3' : c.spec.kind && c.spec.kind.startsWith('MTP') ? 'mtp' : 'ngram'}", "num_speculative_tokens": ${c.spec.k}}'` : ''}${c.disagg ? ` \\
  --kv-transfer-config '{"kv_connector": "NixlConnector", "kv_role": "kv_both"}'` : ''}`;
  const sgl = `python -m sglang.launch_server --model-path acme/${d.model} \\
  --tp ${c.tp}${c.ep ? ` --ep-size ${c.ep} --enable-ep-moe` : ''} --quantization ${c.quant === 'int4' ? 'awq' : c.quant} --kv-cache-dtype ${c.kvq === 'fp8' ? 'fp8_e4m3' : 'auto'} \\
  --mem-fraction-static 0.88 --chunked-prefill-size 8192 --schedule-policy lpm${d.features.some((f) => f.includes('LoRA')) ? ` \\
  --lora-paths @registry/assistant-adapters --max-loras-per-batch 16` : ''}`;
  const trt = `trtllm-serve acme/${d.model} --backend pytorch \\
  --tp_size ${c.tp} --max_batch_size 256 --max_num_tokens 8192 \\
  --kv_cache_free_gpu_memory_fraction 0.9 --extra_llm_api_options spec.yaml  # ngram lookup, k=${c.spec ? c.spec.k : 0}`;
  const k8s = `apiVersion: serving.acme.dev/v1
kind: ModelDeployment
metadata: { name: ${d.id}, team: ${d.team} }
spec:
  model: registry://${d.model}
  engine: { name: ${d.engine.toLowerCase()}, version: "${d.version}" }
  resources: { gpu: ${E.HW[c.hw].name.replace(/ /g, '-')}, perReplica: ${c.tp + (c.disagg || 0)} }
  replicas: { min: ${d.min}, max: ${d.max}, target: goodput-70 }
  slo: { ttftP90: ${d.slo.ttft}s, itlP90: ${Math.round(d.slo.itl * 1000)}ms }
  router: { affinity: prefix-hash, fallback: least-loaded }
  regions: [${d.region}]`;
  return `<pre class="code">${h(d.engine === 'vLLM' ? vllm : d.engine === 'SGLang' ? sgl : trt)}</pre><pre class="code">${h(k8s)}</pre><p class="note">${h(a.name)}: ${gb(E.serveCapacity(a, c).weights)} of weights per replica, ${si(E.kvPerToken(a, c.kvq))}B of KV cache per token.</p>`;
}

/* ───────────────────────── capacity planner ───────────────────────── */

VIEWS.capacity = () => {
  const P = S.cap, a = E.ARCH[P.arch];
  const cfg = { hw: P.hw, tp: +P.tp, quant: P.quant, kvq: P.kvq, prompt: +P.prompt, out: +P.out, prefixHit: +P.prefixHit, spec: P.spec === 'eagle' ? { k: 3, alpha: 0.72, kind: 'EAGLE-3' } : P.spec === 'ngram' ? { k: 5, alpha: 0.55, kind: 'N-gram' } : null, disagg: +P.disagg, cudaGraphs: true };
  const slo = { ttft: +P.ttft, itl: +P.itl };
  const cap = E.serveCapacity(a, cfg);
  const sel = (k, opts) => `<select data-bind="cap.${k}">${opts.map(([v, t]) => `<option value="${v}"${String(v) === String(P[k]) ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
  const controls = `<div class="fields">
    <label class="field">Model${sel('arch', Object.entries(E.ARCH).map(([k, x]) => [k, x.name]))}</label>
    <label class="field">GPU${sel('hw', Object.entries(E.HW).map(([k, x]) => [k, `${x.name} ${x.mem} GB`]))}</label>
    <label class="field">Tensor parallel${sel('tp', [1, 2, 4, 8].map((n) => [n, n]))}</label>
    <label class="field">Weights${sel('quant', [['bf16', 'BF16'], ['fp8', 'FP8'], ['int4', 'INT4 AWQ']])}</label>
    <label class="field">KV cache${sel('kvq', [['bf16', 'BF16'], ['fp8', 'FP8']])}</label>
    <label class="field">Speculative decoding${sel('spec', [['none', 'Off'], ['eagle', 'EAGLE-3, k=3, α 0.72'], ['ngram', 'N-gram, k=5, α 0.55']])}</label>
    <label class="field">Prefill${sel('disagg', [[0, 'Colocated, chunked'], [2, '+2 prefill GPUs'], [4, '+4 prefill GPUs'], [8, '+8 prefill GPUs']])}</label>
    <label class="field">Prompt tokens${sel('prompt', [300, 900, 1800, 4000, 12000, 32000].map((n) => [n, fmt(n)]))}</label>
    <label class="field">Output tokens${sel('out', [60, 200, 350, 1000, 3200].map((n) => [n, fmt(n)]))}</label>
    <label class="field">Prefix hit rate${sel('prefixHit', [0, 0.3, 0.6, 0.8].map((n) => [n, n * 100 + '%']))}</label>
    <label class="field">TTFT SLO${sel('ttft', [[0.3, '300 ms'], [0.6, '600 ms'], [1.2, '1.2 s'], [2.5, '2.5 s'], [10, '10 s']])}</label>
    <label class="field">ITL SLO${sel('itl', [[0.02, '20 ms'], [0.03, '30 ms'], [0.04, '40 ms'], [0.06, '60 ms'], [0.1, '100 ms']])}</label></div>`;
  if (!cap.fits) return head('Capacity planner', 'What one replica of a model can serve on a given GPU, and what each token costs.') + `<div class="grid"><div class="card c12">${controls}</div><div class="card c12"><div class="lcm-banner deny"><b>Does not fit.</b> ${h(a.name)} in ${P.quant.toUpperCase()} needs ${gb(cap.weights)} for weights; ${P.tp} × ${E.HW[P.hw].mem} GB leaves no room for the KV cache. Raise tensor parallel or quantize.</div></div></div>`;
  const cur = E.serveCurve(a, cfg, slo, 26);
  const noSpec = cfg.spec ? E.serveCurve(a, { ...cfg, spec: null }, slo, 26) : null;
  const bf = P.quant !== 'bf16' && E.serveCapacity(a, { ...cfg, quant: 'bf16', kvq: 'bf16' }).fits ? E.serveCurve(a, { ...cfg, quant: 'bf16', kvq: 'bf16' }, slo, 26) : null;
  const ser = (c, name, color, dash) => ({ name, color, dash, pts: c.rows.filter((r) => Number.isFinite(r.itl) && !r.saturated).map((r) => [r.tps / c.gpus, p90(r).itl * 1000]) });
  const lowB = E.decodeStep(a, cfg, 1, cfg.prompt + cfg.out / 2);
  return head('Capacity planner', 'What one replica of a model can serve on a given GPU, and what each token costs. The same cost model sizes every deployment and the autoscaler.', 'Decode is memory-bound: each step reads every weight once plus the KV cache of every sequence in the batch, so step time ≈ (weights/TP + B·ctx·KV-per-token/TP) / HBM bandwidth, plus TP all-reduces. Batching amortizes the weight read, so throughput rises with batch until compute or KV memory runs out. Prefill is compute-bound (2·params·tokens FLOPs) and, colocated, steals time from decode. Speculative decoding verifies k drafts in one pass: (1−α^(k+1))/(1−α) tokens per step, which wins at low batch and loses once compute binds. Concurrency follows Little\'s law at each request rate.') + `
  <div class="grid"><div class="card c12">${controls}</div>
    <div class="card c3 kpi"><b>${gb(cap.weights)}</b><span>Weights per replica</span><small>${gb(cap.weights / cfg.tp)} per GPU</small></div>
    <div class="card c3 kpi"><b>${si(cap.kvTokens)}</b><span>KV cache tokens</span><small>${fmt(E.kvPerToken(a, cfg.kvq) / 1024)} KB per token · ${fmt(cap.maxBatch)} sequences at full length</small></div>
    <div class="card c3 kpi ${cur.goodput ? 'good' : 'bad'}"><b>${cur.goodput ? cur.goodput.toFixed(1) : '0'}</b><span>Goodput, requests/s per replica</span><small>${cur.goodput ? `${fmt(cur.tpsAtGoodput / cur.gpus)} output tokens/s per GPU` : 'Misses the SLO at any load'}</small></div>
    <div class="card c3 kpi"><b>${cur.cost ? usd(cur.cost) : 'n/a'}</b><span>Cost per 1M output tokens</span><small>${cur.gpus} GPUs × $${E.HW[P.hw].cost}/h at goodput</small></div>
    <div class="card c8"><h3>ITL p90 against throughput per GPU</h3>${xyChart([ser(cur, 'This configuration', C.blue), ...(noSpec ? [ser(noSpec, 'Without speculative decoding', C.purple, true)] : []), ...(bf ? [ser(bf, 'BF16 weights and KV', C.gray, true)] : [])], { xl: 'output tokens/s per GPU', yl: 'ms', fy: (v) => Math.round(v), hline: { v: slo.itl * 1000, label: 'ITL SLO' }, hgt: 260, w: 760 })}</div>
    <div class="card c4"><h3>Reading it</h3><ul class="why">
      <li>One sequence alone decodes at ${ms(lowB)} per token: the floor set by reading ${gb(cap.weights / cfg.tp)} per GPU from HBM.</li>
      <li>Throughput keeps rising with batch until ${cur.goodput ? 'the ITL or TTFT SLO binds' : 'memory runs out'}; goodput is the last point inside both SLOs.</li>
      ${noSpec ? `<li>Speculative decoding: goodput ${cur.goodput.toFixed(1)} vs ${noSpec.goodput.toFixed(1)} req/s without it. ${cur.goodput > noSpec.goodput ? 'It pays off here because decode is memory-bound at this load.' : 'At this load the batch is large enough that verification compute costs more than the drafts save.'}</li>` : ''}
      ${bf ? `<li>FP8 halves weight and KV bytes: goodput ${cur.goodput.toFixed(1)} vs ${bf.goodput.toFixed(1)} req/s in BF16.</li>` : ''}
      ${cfg.disagg ? `<li>Disaggregated prefill on ${cfg.disagg} extra GPUs keeps long prompts from stalling decode; KV moves over RDMA at ${gb(E.kvPerToken(a, cfg.kvq) * cfg.prompt)} per request.</li>` : `<li>Prefill takes ${ms(E.prefillTime(a, cfg, cfg.prompt * (1 - cfg.prefixHit)))} per request after prefix hits; colocated, it steals decode time as load grows.</li>`}
    </ul></div>
  </div>`;
};

/* ───────────────────────── benchmarks ───────────────────────── */

const ENGINE = { vLLM: 1.0, SGLang: 1.04, 'TensorRT-LLM': 1.07 };
const WORK = { chat: { prompt: 1800, out: 350, prefixHit: 0.6, slo: { ttft: 1.2, itl: 0.04 }, label: 'Chat' }, rag: { prompt: 12000, out: 400, prefixHit: 0.3, slo: { ttft: 2.5, itl: 0.05 }, label: 'Long context RAG' }, code: { prompt: 3000, out: 60, prefixHit: 0.55, slo: { ttft: 0.4, itl: 0.02 }, label: 'Code completion' }, reason: { prompt: 900, out: 3200, prefixHit: 0.2, slo: { ttft: 2.5, itl: 0.03 }, label: 'Reasoning' } };
function benchRow(v, state = 'Done', t = Date.now()) {
  const a = E.ARCH[v.model], w = WORK[v.workload], f = ENGINE[v.engine];
  const cfg = { hw: v.hw, tp: +v.tp, quant: v.quant, kvq: v.quant === 'bf16' ? 'bf16' : 'fp8', prompt: w.prompt, out: w.out, prefixHit: w.prefixHit * (v.engine === 'SGLang' ? 1.08 : 1), spec: null, cudaGraphs: true };
  if (!E.serveCapacity(a, cfg).fits) return { ...v, state: 'Does not fit', t, cfg };
  const c = E.serveCurve(a, cfg, w.slo, 18), g = c.rows.filter((r) => r.ok).at(-1);
  return { ...v, state, t, cfg, curve: c, f, gp: c.goodput * f, tpg: c.tpsAtGoodput * f / c.gpus, ttft: g ? p90(g).ttft / f : null, itl: g ? p90(g).itl / f : null, cost: c.cost ? c.cost / f : null };
}
function seedBench() {
  if (S.bench.length) return;
  const base = { model: 'core-70b', hw: 'h100', tp: 4, quant: 'fp8', workload: 'chat' };
  S.bench = [['vLLM'], ['SGLang'], ['TensorRT-LLM']].map(([e], i) => benchRow({ ...base, engine: e, id: 'B-' + (311 + i) }, 'Done', Date.now() - (5 - i) * 36e5));
  S.bench.push(benchRow({ ...base, engine: 'vLLM', hw: 'h200', id: 'B-314' }, 'Done', Date.now() - 2 * 36e5));
  S.bench.push(benchRow({ ...base, engine: 'SGLang', workload: 'reason', hw: 'h200', id: 'B-315' }, 'Done', Date.now() - 36e5));
  S.benchSel = 'B-312';
}
VIEWS.benchmarks = () => {
  seedBench();
  const sel = S.bench.find((b) => b.id === S.benchSel) || S.bench[0];
  const peers = S.bench.filter((b) => b.curve && b.workload === sel.workload && b.model === sel.model);
  const colors = [C.blue, C.purple, C.teal, C.amber, C.pink];
  EXPORTS.bench = () => [['id', 'model', 'engine', 'hw', 'tp', 'quant', 'workload', 'goodput_rps', 'tokens_s_gpu', 'ttft_p90_s', 'itl_p90_s', 'usd_per_1m'], ...S.bench.map((b) => [b.id, b.model, b.engine, b.hw, b.tp, b.quant, b.workload, b.gp?.toFixed(2), b.tpg?.toFixed(0), b.ttft?.toFixed(3), b.itl?.toFixed(4), b.cost?.toFixed(3)])];
  return head('Benchmarks', 'Engines and configurations on the same workloads, swept across request rates. Results feed the capacity planner and the defaults the platform picks for new deployments.', 'Each run sweeps request rate on a fixed workload until latency leaves the SLO and reports goodput, tokens per GPU, p90 latencies and cost per million tokens. Engine factors come from the last measured fleet sweep; rerunning a benchmark refreshes them. Same model, precision, hardware and parallelism in every comparison.') + `
  <div class="grid"><div class="card c12"><div class="tools"><span class="note">${S.bench.length} runs</span><span class="spacer"></span><button class="btn" data-act="export" data-key="bench">Export CSV</button><button class="btn primary" data-act="new" data-form="bench">New benchmark</button></div>
    <div class="scroll-x"><table class="table"><thead><tr><th>Run</th><th>Model</th><th>Engine</th><th>Hardware</th><th>Workload</th><th class="num">Goodput req/s</th><th class="num">Tokens/s/GPU</th><th class="num">TTFT p90</th><th class="num">ITL p90</th><th class="num">$ / 1M</th><th>Status</th></tr></thead><tbody>${S.bench.map((b) => `<tr class="click${b.id === sel.id ? ' sel' : ''}" data-benchsel="${b.id}"><td class="mono">${b.id}</td><td>${h(E.ARCH[b.model].name)}</td><td>${h(b.engine)}</td><td>${b.tp} × ${h(E.HW[b.hw].name)} · ${b.quant.toUpperCase()}</td><td>${WORK[b.workload].label}</td><td class="num">${b.gp ? b.gp.toFixed(1) : ''}</td><td class="num">${b.tpg ? fmt(b.tpg) : ''}</td><td class="num">${b.ttft ? ms(b.ttft) : ''}</td><td class="num">${b.itl ? ms(b.itl) : ''}</td><td class="num">${b.cost ? usd(b.cost) : ''}</td><td>${pill(b.state === 'Done' ? 'ok' : b.state === 'Running' ? 'live' : 'deny', b.state)}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card c12"><h3>${h(E.ARCH[sel.model].name)}, ${WORK[sel.workload].label}: ITL p90 against throughput per GPU</h3>${peers.length ? xyChart(peers.map((b, i) => ({ name: `${b.engine} · ${b.tp}×${E.HW[b.hw].name}`, color: colors[i % colors.length], pts: b.curve.rows.filter((r) => Number.isFinite(r.itl) && !r.saturated).map((r) => [r.tps * b.f / b.curve.gpus, p90(r).itl / b.f * 1000]) })), { xl: 'output tokens/s per GPU', yl: 'ms', fy: (v) => Math.round(v), hline: { v: WORK[sel.workload].slo.itl * 1000, label: 'ITL SLO' }, hgt: 280, w: 1120 }) : '<p class="note">Still running.</p>'}
    <p class="note">Same hardware and precision across engines. The gap at low load is kernel and scheduler overhead; at high load it is batching and KV cache management. Reruns on every engine upgrade catch regressions before they reach a deployment.</p></div></div>`;
};
CLICKS.push(['benchsel', (id) => { S.benchSel = id; }]);
window.__runBench = (v) => {
  seedBench();
  const id = 'B-' + (311 + S.bench.length);
  const row = { ...v, id, state: 'Running', t: Date.now() };
  S.bench.unshift(row); S.benchSel = id;
  setTimeout(() => { const i = S.bench.findIndex((b) => b.id === id); S.bench[i] = benchRow({ ...v, id }); ctx.F.event(Date.now(), id, 'benchmark', `${v.engine} on ${E.ARCH[v.model].name}, ${WORK[v.workload].label}: ${S.bench[i].gp ? S.bench[i].gp.toFixed(1) + ' req/s goodput per replica' : 'does not fit'}.`); toast(`${id} finished`); if (S.view === 'benchmarks') ui.render(); }, 4000);
  return { ok: `${id} started: sweeping request rate`, go: 'benchmarks' };
};
