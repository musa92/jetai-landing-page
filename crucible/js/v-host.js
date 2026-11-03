/* Open-weights model hosting: catalog and approval, lifecycle and tiering,
   tenancy, gateway, observability, cold start and scale to zero. */
import { E, h, fmt, si, usd, ctx, S, VIEWS, ACTIONS, CLICKS, EXPORTS, head, pill, glist, seg, stack, kpi2, xyChart, C, can, me, toast, icon, match, F_, ui } from './core.js?v=20261102-3';

const D = 864e5;
const BYTES = { bf16: 2, fp8: 1.02, mxfp4: 0.55 };
const STEPS = ['Request', 'License review', 'Security scan', 'Risk review', 'Ingest', 'Available'];

/* trend: tokens per day (millions), one value per week, oldest first. */
export const OSS = [
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B Instruct', pub: 'Meta', repo: 'meta-llama/Llama-3.3-70B-Instruct', params: 70.6e9, ctx: 131072, license: 'Llama 3.3 Community License', status: 'approved', step: 6, tier: 0, tenants: ['assistant', 'search'], quant: 'fp8', hw: 'h100', tp: 4, replicas: 6, min: 4, max: 16, tps: 2400, use: 'Chat, tool use, RAG', trend: [2400, 2550, 2700, 2800, 2850, 2900, 2950, 2900, 3000, 3050, 3020, 3100], bench: { ttft: 0.41, itl: 0.021 } },
  { id: 'qwen3-30b-a3b', name: 'Qwen3 30B-A3B', pub: 'Qwen', repo: 'Qwen/Qwen3-30B-A3B', params: 30.5e9, active: 3.3e9, ctx: 32768, license: 'Apache 2.0', status: 'approved', step: 6, tier: 0, tenants: ['devtools'], quant: 'fp8', hw: 'h100', tp: 1, replicas: 8, min: 4, max: 20, tps: 3800, use: 'Code review, summarization', trend: [880, 910, 940, 990, 1010, 1040, 1060, 1090, 1100, 1120, 1140, 1150], bench: { ttft: 0.18, itl: 0.012 },
    upgrade: { name: 'Qwen3 30B-A3B Instruct 2507', repo: 'Qwen/Qwen3-30B-A3B-Instruct-2507', ctx: 262144, note: 'New weights from the publisher: 256K context, better instruction following. Ingested and evaluated; same architecture, so replicas swap in place behind the same endpoint.' } },
  { id: 'gemma-3-27b', name: 'Gemma 3 27B IT', pub: 'Google', repo: 'google/gemma-3-27b-it', params: 27.4e9, ctx: 131072, license: 'Gemma Terms of Use', status: 'approved', step: 6, tier: 0, tenants: ['assistant'], quant: 'bf16', hw: 'h100', tp: 2, replicas: 4, min: 4, max: 8, tps: 1900, use: 'Multimodal captioning', trend: [820, 780, 700, 560, 430, 320, 240, 180, 130, 90, 70, 55], bench: { ttft: 0.33, itl: 0.019 } },
  { id: 'qwen3-235b', name: 'Qwen3 235B-A22B Instruct 2507', pub: 'Qwen', repo: 'Qwen/Qwen3-235B-A22B-Instruct-2507', params: 235e9, active: 22e9, ctx: 262144, license: 'Apache 2.0', status: 'approved', step: 6, tier: 1, tenants: ['search', 'research'], quant: 'fp8', hw: 'h200', tp: 4, replicas: 3, min: 0, max: 6, use: 'Search answer synthesis', trend: [0, 20, 60, 140, 260, 420, 610, 820, 1050, 1300, 1580, 1900], ask: 'Search asked for a 1.5 s TTFT SLA for answer synthesis.' },
  { id: 'gpt-oss-120b', name: 'gpt-oss-120b', pub: 'OpenAI', repo: 'openai/gpt-oss-120b', params: 117e9, active: 5.1e9, ctx: 131072, license: 'Apache 2.0', status: 'approved', step: 6, tier: 1, tenants: ['research', 'devtools'], quant: 'mxfp4', hw: 'h100', tp: 1, replicas: 2, min: 0, max: 8, use: 'Agent research, reasoning', trend: [0, 0, 0, 0, 30, 90, 180, 260, 330, 390, 430, 470] },
  { id: 'llama-3.1-8b', name: 'Llama 3.1 8B Instruct', pub: 'Meta', repo: 'meta-llama/Llama-3.1-8B-Instruct', params: 8.03e9, ctx: 131072, license: 'Llama 3.1 Community License', status: 'approved', step: 6, tier: 1, tenants: ['research', 'foundation'], quant: 'bf16', hw: 'h100', tp: 1, replicas: 0, min: 0, max: 32, use: 'Batch inference, synthetic data', trend: [300, 280, 450, 20, 600, 520, 30, 700, 640, 10, 800, 760] },
  { id: 'mistral-small-3.2', name: 'Mistral Small 3.2 24B Instruct', pub: 'Mistral AI', repo: 'mistralai/Mistral-Small-3.2-24B-Instruct-2506', params: 24e9, ctx: 131072, license: 'Apache 2.0', status: 'approved', step: 6, tier: 1, tenants: ['research'], quant: 'bf16', hw: 'h100', tp: 1, replicas: 0, min: 0, max: 4, use: 'Function calling experiments', trend: [60, 85, 90, 70, 40, 22, 10, 4, 1, 0, 0, 0] },
  { id: 'deepseek-v3.1', name: 'DeepSeek V3.1', pub: 'DeepSeek', repo: 'deepseek-ai/DeepSeek-V3.1', params: 671e9, active: 37e9, ctx: 131072, license: 'MIT', status: 'pending', step: 2, requester: 'Hiro Tanaka', team: 'research', use: 'Reasoning research baseline', why: 'Security scan running: 163 safetensors shards, custom modeling code in the repo is reviewed before it can load.' },
  { id: 'llama-4-scout', name: 'Llama 4 Scout 17B-16E Instruct', pub: 'Meta', repo: 'meta-llama/Llama-4-Scout-17B-16E-Instruct', params: 109e9, active: 17e9, ctx: 10485760, license: 'Llama 4 Community License', status: 'restricted', step: 6, use: 'Long-context research', why: 'Approved for internal research only. Use in shipped features needs a separate legal review.' },
  { id: 'phi-4', name: 'Phi-4', pub: 'Microsoft', repo: 'microsoft/phi-4', params: 14.7e9, ctx: 16384, license: 'MIT', status: 'available', step: 0, use: 'Small reasoning model' },
  { id: 'olmo-2-32b', name: 'OLMo 2 32B Instruct', pub: 'Ai2', repo: 'allenai/OLMo-2-0325-32B-Instruct', params: 32.2e9, ctx: 4096, license: 'Apache 2.0', status: 'available', step: 0, use: 'Fully open data, research' },
];
const oss = (id) => OSS.find((m) => m.id === id);
export const sizeB = (m) => m.params * BYTES[m.quant || 'bf16'];
const gbs = (b) => (b / 1e9).toFixed(b >= 1e11 ? 0 : 1) + ' GB';
const team = (k) => E.TEAMS[k]?.name || k;
const last = (m) => m.trend ? m.trend.at(-1) : 0;
const STATUS = { approved: ['ok', 'Approved'], pending: ['warn', 'In review'], restricted: ['purple', 'Approved with conditions'], available: ['', 'Not requested'], retired: ['', 'Retired'] };
const tierPill = (m) => m.status === 'retired' ? pill('', 'Retired') : m.tier === 0 ? pill('blue', 'Tier 0') : m.tier === 1 ? pill('', 'Tier 1') : '';

function spark(vals, w = 120, hgt = 26, color = C.blue) {
  const mx = Math.max(...vals, 1), n = vals.length;
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${(i / (n - 1) * w).toFixed(1)},${(hgt - 2 - v / mx * (hgt - 4)).toFixed(1)}`).join('');
  return `<svg class="hspark" viewBox="0 0 ${w} ${hgt}" width="${w}" height="${hgt}"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`;
}

/* What the platform recommends for a hosted model, from its usage curve. */
function advice(m) {
  if (m.status !== 'approved') return null;
  const t = m.trend, now = t.at(-1), prev = t.at(-5);
  if (t.slice(-3).every((v) => v === 0)) return { k: 'retire', t: 'Retire', why: `No traffic for 3 weeks (peak ${fmt(Math.max(...t))}M tokens a day). Weights stay in governed storage.` };
  if (m.upgrade) return { k: 'upgrade', t: 'Upgrade in place', why: `${m.upgrade.name} is ingested and passed evals.` };
  if (m.tier === 1 && now >= 1000 && now > prev * 1.3) return { k: 'promote', t: 'Promote to Tier 0', why: `${fmt(now)}M tokens a day, up ${Math.round((now / prev - 1) * 100)}% in 4 weeks. ${m.ask || ''}` };
  if (m.tier === 0 && now < 100 && now < prev * 0.6) return { k: 'demote', t: 'Demote to Tier 1', why: `Down to ${fmt(now)}M tokens a day from ${fmt(Math.max(...t))}M. Holding ${m.min} replicas reserved costs ${usd(m.min * m.tp * E.HW[m.hw].cost * 24 * 30)} a month.` };
  return null;
}

/* ───────────────────────── catalog ───────────────────────── */

S.oss = S.oss || 'llama-3.3-70b';
S.ossFilter = S.ossFilter || 'all';
VIEWS.catalog = () => {
  const m = oss(S.oss), f = S.ossFilter;
  const rows = OSS.filter((x) => (f === 'all' || x.status === f || (f === 'approved' && x.status === 'restricted')) && match('oss', x.name, x.pub, x.repo, x.license, x.use));
  const cnt = (k) => OSS.filter((x) => k === 'all' || x.status === k || (k === 'approved' && x.status === 'restricted')).length;
  return head('Catalog', 'Every open-weights model the company can use, in one place: what it is, whether it is approved for your use case, and the endpoint to call.') + `<div class="grid">
    <div class="card c12 lcm"><div class="lcm-list"><label class="search lsearch">${icon('search')}<input data-filter="oss" value="${h(F_.oss || '')}" placeholder="Search models, publishers, licenses"></label>
      ${seg('ossf', f, [['all', `All<span class="cnt">${cnt('all')}</span>`], ['approved', `Approved<span class="cnt">${cnt('approved')}</span>`], ['pending', `In review<span class="cnt">${cnt('pending')}</span>`], ['available', `New<span class="cnt">${cnt('available')}</span>`]])}
      <div class="lcm-rows">${rows.map((x) => `<button class="lcm-row nodot${x.id === m.id ? ' on' : ''}" data-osssel="${x.id}"><span><b>${h(x.name)}</b><small>${h(x.pub)} · ${si(x.params, 0)}${x.active ? ` (${si(x.active)} active)` : ''} · ${h(x.license)}</small></span><em>${x.tier === 0 && x.status === 'approved' ? 'T0' : x.tier === 1 && x.status === 'approved' ? 'T1' : ''}</em></button>`).join('') || '<p class="note">No models match.</p>'}</div></div>
    <div class="lcm-detail">${detail(m)}</div></div></div>`;
};
function detail(m) {
  const [sc, st] = STATUS[m.status];
  const flow = `<div class="pipe">${STEPS.map((s, i) => { const state = i < m.step ? 'done' : i === m.step && m.status === 'pending' ? 'running' : 'waiting'; return `<div class="pstage ${state}"><span class="pdot ${state === 'done' ? 'done' : state === 'running' ? 'running' : ''}"></span><b>${s}</b><small>${['Use case and tenant', 'Terms of use, Legal', 'Safetensors only, ModelScan, hashes', 'Safety and bias evals', 'Ray job to governed storage', 'Endpoint in catalog'][i]}</small></div>`; }).join('<span class="parrow">›</span>')}</div>`;
  const live = m.status === 'approved' || m.status === 'restricted';
  const action = m.status === 'available' ? `<button class="btn primary" data-act="oss-request" data-id="${m.id}">Request access</button>` : m.status === 'approved' && m.tier !== undefined ? `<button class="btn" data-go="lifecycle">View lifecycle</button>` : '';
  return `<div class="lcm-head"><div><h2>${h(m.name)} ${pill(sc, st)} ${m.status === 'approved' ? tierPill(m) : ''}</h2><p class="mono">${h(m.repo)}</p></div><div class="row">${action}</div></div>
    ${m.why ? `<div class="lcm-banner ${m.status === 'pending' ? 'warn' : ''}"><b>${m.status === 'pending' ? `Requested by ${h(m.requester)}, ${team(m.team)}` : 'Condition'}</b><span>${h(m.why)}</span></div>` : ''}
    ${flow}
    <div class="grid2">${glist([['Publisher', h(m.pub)], ['Parameters', `${si(m.params)}${m.active ? `, ${si(m.active)} active per token (MoE)` : ''}`], ['Context', si(m.ctx, 0) + ' tokens'], ['License', h(m.license)], ['Good for', h(m.use)]])}
    ${glist(live && m.tier !== undefined ? [['Endpoint', `<span class="mono">https://llm.acme.internal/v1</span>`], ['Model name', `<span class="mono">${m.id}</span>`], ['Serving', `vLLM 0.11.1 on Ray Serve, ${m.quant.toUpperCase()}, TP ${m.tp} on ${E.HW[m.hw].name}`], ['Tenants', (m.tenants || []).map(team).join(', ')], ['Weights', `<span class="mono">s3://acme-models-governed/oss/${m.repo}</span>`]] : [['Endpoint', m.status === 'restricted' ? 'Research cluster only' : 'After approval'], ['Weights', m.status === 'available' ? 'Not ingested' : 'Quarantine bucket until approved'], ['Est. size', gbs(m.params * 2) + ' in BF16']])}</div>
    ${live && m.tier !== undefined ? `<pre class="code">curl https://llm.acme.internal/v1/chat/completions \\
  -H "Authorization: Bearer $ACME_TOKEN" \\
  -d '{"model": "${m.id}", "messages": [{"role": "user", "content": "Hello"}]}'</pre><p class="note">OpenAI-compatible. Your token carries your team and use case; the gateway checks both against this model's approval before the request reaches a GPU.</p>` : ''}`;
}
CLICKS.push(['osssel', (id) => { S.oss = id; }], ['ossf', (v) => { S.ossFilter = v; }]);
ACTIONS['oss-request'] = (t) => {
  const m = oss(t.dataset.id); m.status = 'pending'; m.step = 1; m.requester = me().name; m.team = E.ROLES[S.role].team;
  m.why = 'License review assigned to Legal. Typical turnaround is 2 business days; you will be notified at each step.';
  ctx.F.event(Date.now(), m.name, 'submitted', `Access requested by ${me().name} for ${team(m.team)}.`);
  toast('Request submitted to Legal');
};

/* ───────────────────────── lifecycle ───────────────────────── */

const INGESTS = [
  ['ingest-qwen3-30b-2507', 'Qwen/Qwen3-30B-A3B-Instruct-2507', 61.1e9, 16, 64, 6.4, 3.1, 'FP8 dynamic, 6 min on 1 × H100', 'done', 2],
  ['ingest-qwen3-235b-2507', 'Qwen/Qwen3-235B-A22B-Instruct-2507', 470e9, 118, 64, 48.0, 21.8, 'FP8 dynamic, 14 min on 8 × H200', 'done', 41],
  ['ingest-gpt-oss-120b', 'openai/gpt-oss-120b', 65.3e9, 15, 64, 6.9, 3.4, 'None, MXFP4 as published', 'done', 66],
  ['ingest-deepseek-v3.1', 'deepseek-ai/DeepSeek-V3.1', 688e9, 163, 64, 70.2, 0, 'Waiting for security scan', 'quarantine', 0.1],
];
VIEWS.lifecycle = () => {
  const hosted = OSS.filter((m) => m.tier !== undefined);
  const recs = hosted.map((m) => [m, advice(m)]).filter(([, a]) => a);
  const stage = (k) => OSS.filter(k).length;
  return head('Lifecycle', 'Models come in through one governed path, earn their tier from usage, upgrade in place when the publisher ships new weights, and retire when nobody calls them.', 'A Ray job pulls weights with parallel ranged reads, verifies every shard hash, optionally quantizes, scans and writes to governed storage with object lock. Deployment is a short spec over vLLM and Ray Serve. Usage drives the tier: Tier 1 is shared and scales to zero; Tier 0 is single-tenant with reserved replicas and published benchmarks.') + `<div class="grid">
    <div class="card c12"><div class="pipe">${[['Requested', stage((m) => m.status === 'pending')], ['Approved', stage((m) => ['approved', 'restricted'].includes(m.status))], ['Tier 1: shared', stage((m) => m.status === 'approved' && m.tier === 1)], ['Tier 0: dedicated', stage((m) => m.status === 'approved' && m.tier === 0)], ['Retired', stage((m) => m.status === 'retired')]].map(([n, c]) => `<div class="pstage"><b>${n}</b><span class="big">${c}</span></div>`).join('<span class="parrow">›</span>')}</div></div>
    ${recs.length ? `<div class="card c12"><h3>Recommended changes <span class="right">From 12 weeks of token usage</span></h3><div class="recs">${recs.map(([m, a]) => `<div class="rec"><div><b>${a.t}: ${h(m.name)}</b><p>${h(a.why)}</p></div><button class="btn${a.k === 'retire' ? '' : ' primary'}" data-act="oss-${a.k}" data-id="${m.id}" ${can('platform', 'sre', 'manager') ? '' : 'disabled'}>${a.t}</button></div>`).join('')}</div>${can('platform', 'sre', 'manager') ? '' : '<p class="note">Platform engineers, SREs and managers apply tier changes.</p>'}</div>` : ''}
    <div class="card c12"><h3>Hosted models</h3><table class="table"><thead><tr><th>Model</th><th>Tier</th><th>Tenants</th><th class="num">Tokens a day</th><th>12 weeks</th><th class="num">Replicas</th><th>Next step</th></tr></thead><tbody>${hosted.map((m) => { const a = advice(m); return `<tr class="click" data-osssel-go="${m.id}"><td><b>${h(m.name)}</b><br><small class="mono">${h(m.repo)}</small></td><td>${tierPill(m)}</td><td>${(m.tenants || []).map(team).join(', ')}</td><td class="num">${m.status === 'retired' ? 'Retired' : fmt(last(m)) + 'M'}</td><td>${spark(m.trend, 120, 26, m.tier === 0 ? C.blue : C.gray)}</td><td class="num">${m.status === 'retired' ? '0' : `${m.replicas} <small>(${m.min} to ${m.max})</small>`}</td><td>${a ? pill(a.k === 'retire' || a.k === 'demote' ? 'warn' : 'blue', a.t) : '<span class="note">Steady</span>'}</td></tr>`; }).join('')}</tbody></table></div>
    <div class="card c12"><h3>Ingestion <span class="right">Ray jobs into s3://acme-models-governed</span></h3><table class="table"><thead><tr><th>Ray job</th><th>Source</th><th class="num">Size</th><th class="num">Shards</th><th class="num">Streams</th><th class="num">Download</th><th class="num">Verify</th><th>Transform</th><th>State</th></tr></thead><tbody>${INGESTS.map(([id, src, b, sh, str, dl, vf, tr, s, days]) => `<tr><td class="mono">${id}</td><td class="mono">${h(src)}</td><td class="num">${gbs(b)}</td><td class="num">${sh}</td><td class="num">${str}</td><td class="num">${dl.toFixed(1)} s</td><td class="num">${vf ? vf.toFixed(1) + ' s' : '-'}</td><td>${h(tr)}</td><td>${s === 'done' ? pill('ok', days < 7 ? `Done ${days} d ago` : 'Done') : pill('warn', 'Quarantined')}</td></tr>`).join('')}</tbody></table>
    <p class="note">Each job: 64 parallel ranged GETs per node (about 9.8 GB/s, NIC bound), SHA-256 per shard against the publisher manifest, pickle files rejected, then write-once to governed storage. Every later read is logged with the reader's identity.</p></div></div>`;
};
CLICKS.push(['osssel-go', (id) => { S.oss = id; ui.go('catalog'); return false; }]);
const tierEvent = (m, kind, text) => { ctx.F.event(Date.now(), m.name, kind, `${text} by ${me().name}.`); };
ACTIONS['oss-promote'] = (t) => { const m = oss(t.dataset.id); m.tier = 0; m.min = 2; m.replicas = Math.max(m.replicas, 2); m.tps = 1600; m.bench = { ttft: 0.62, itl: 0.026 }; m.ask = ''; tierEvent(m, 'promoted', 'Promoted to Tier 0: single-tenant, 2 reserved replicas, benchmark scheduled'); toast(`${m.name} is Tier 0`); };
ACTIONS['oss-demote'] = (t) => { const m = oss(t.dataset.id); m.tier = 1; m.min = 0; m.replicas = 1; tierEvent(m, 'scaled', 'Demoted to Tier 1: shared pool, scales to zero'); toast(`${m.name} moved to the shared pool`); };
ACTIONS['oss-retire'] = (t) => { const m = oss(t.dataset.id); m.status = 'retired'; m.replicas = 0; m.min = 0; tierEvent(m, 'scaled', 'Retired: endpoint removed, weights kept'); toast(`${m.name} retired. Callers get a 410 with the suggested replacement.`); };
ACTIONS['oss-upgrade'] = (t) => { const m = oss(t.dataset.id), u = m.upgrade; m.name = u.name; m.repo = u.repo; m.ctx = u.ctx; delete m.upgrade; tierEvent(m, 'deploy', 'Upgraded in place: rolling replica swap, same endpoint and model name'); toast('Rolling upgrade started: one replica at a time'); };

/* ───────────────────────── tiers and tenancy ───────────────────────── */

VIEWS.hosting = () => {
  const live = OSS.filter((m) => m.status === 'approved' && m.tier !== undefined);
  const t0 = live.filter((m) => m.tier === 0), t1 = live.filter((m) => m.tier === 1);
  const gpus = (ms) => ms.reduce((a, m) => a + m.replicas * m.tp, 0);
  const pool = 48, warm = gpus(t1);
  return head('Tiers and tenancy', 'Two ways to host a model. Tier 1 shares a GPU pool and scales to zero, trading a cold start for cost. Tier 0 gets its own replicas, provisioned throughput and published benchmarks.') + `<div class="grid">
    <div class="card c6 tierc"><h3>${pill('blue', 'Tier 0')} Single-tenant, provisioned</h3>${glist([['For', 'Large or high, sustained usage; latency SLAs'], ['Replicas', 'Reserved minimum of 2 or more, scale out on load'], ['Guarantee', 'Provisioned tokens per second per tenant'], ['Benchmarks', 'Published TTFT, ITL and throughput per release'], ['Cold start', 'Never on the request path']])}<p class="note">${t0.length} models on ${fmt(gpus(t0))} GPUs</p></div>
    <div class="card c6 tierc"><h3>${pill('', 'Tier 1')} Multi-tenant, scale to zero</h3>${glist([['For', 'Research, batch inference, data generation, new models'], ['Replicas', '0 when idle, scale up on first request'], ['Guarantee', 'Best effort with fair-share quotas'], ['Benchmarks', 'None published'], ['Cold start', 'About 1 to 2 min for a warm node, queued at the gateway']])}<p class="note">${t1.length} models sharing a ${pool}-GPU pool, ${warm} warm now</p></div>
    <div class="card c12"><h3>Tier 0 endpoints</h3><table class="table"><thead><tr><th>Model</th><th>Tenants</th><th class="num">Replicas</th><th class="num">GPUs</th><th class="num">Provisioned</th><th class="num">TTFT p90</th><th class="num">ITL p50</th><th class="num">Monthly</th></tr></thead><tbody>${t0.map((m) => `<tr><td><b>${h(m.name)}</b><br><small>${m.quant.toUpperCase()}, TP ${m.tp}, ${E.HW[m.hw].name}</small></td><td>${m.tenants.map(team).join(', ')}</td><td class="num">${m.replicas} <small>(min ${m.min})</small></td><td class="num">${m.replicas * m.tp}</td><td class="num">${fmt(m.tps * m.min)} tok/s</td><td class="num">${(m.bench.ttft * 1000).toFixed(0)} ms</td><td class="num">${(m.bench.itl * 1000).toFixed(0)} ms</td><td class="num">${usd(m.replicas * m.tp * E.HW[m.hw].cost * 730)}</td></tr>`).join('')}</tbody></table><p class="note">Provisioned = reserved replicas × benchmarked output tokens per second at the SLA (input 1,800, output 350 tokens). Extra replicas above the minimum are elastic and not guaranteed.</p></div>
    <div class="card c12"><h3>Shared Tier 1 pool <span class="right">${warm} of ${pool} H100 and H200 GPUs warm</span></h3><div class="poolmap">${Array.from({ length: pool }, (_, i) => { let k = 0, owner = null; for (const m of t1) { k += m.replicas * m.tp; if (i < k) { owner = m; break; } } return `<i ${owner ? `style="background:${[C.purple, C.teal, C.amber, C.pink][t1.indexOf(owner) % 4]}" title="${h(owner.name)}"` : 'title="Idle, scaled to zero"'}></i>`; }).join('')}</div>
      <div class="stack-lg">${t1.map((m, i) => `<span><i style="background:${[C.purple, C.teal, C.amber, C.pink][i % 4]}"></i>${h(m.name)} <b>${m.replicas ? `${m.replicas} × TP ${m.tp}` : 'scaled to zero'}</b></span>`).join('')}</div>
      <p class="note">Replicas are Ray Serve deployments with min_replicas 0. Idle GPUs go back to the pool after the downscale delay and are lent to preemptible batch jobs until a request needs them.</p></div></div>`;
};

/* ───────────────────────── gateway ───────────────────────── */

S.gwCache = S.gwCache ?? 'on';
const GW = [
  ['TLS and request parse', 0.4, 0.4],
  ['Authenticate', 18.2, 0.3, 'OIDC token introspection vs local JWT check with cached JWKS'],
  ['Authorize', 9.1, 0.2, 'Tenant × model × use-case policy, cached 5 min'],
  ['Rate limit', 2.1, 0.4, 'Token bucket: local counters, synced to Redis every 100 ms'],
  ['Route to Ray Serve', 0.6, 0.6, 'Prefix-aware: same conversation goes to the same replica'],
];
const LIMITS = [
  ['assistant', 'llama-3.3-70b', 2.0e6, 4.0e6, 0.71, 0],
  ['search', 'llama-3.3-70b', 1.2e6, 2.0e6, 0.64, 0],
  ['search', 'qwen3-235b', 1.0e6, 1.5e6, 0.97, 1840],
  ['devtools', 'qwen3-30b-a3b', 1.5e6, 3.0e6, 0.58, 0],
  ['research', 'gpt-oss-120b', 0.4e6, 0.8e6, 0.83, 212],
  ['research', 'llama-3.1-8b', 3.0e6, 3.0e6, 0.99, 15620],
  ['foundation', 'llama-3.1-8b', 1.0e6, 1.0e6, 0.22, 0],
];
VIEWS.gateway = () => {
  const on = S.gwCache === 'on', parts = GW.map(([k, a, b], i) => [k, on ? b : a, [C.gray, C.blue, C.purple, C.teal, C.amber][i]]);
  const tot = parts.reduce((a, p) => a + p[1], 0);
  return head('Gateway', 'One front door for every model: who you are, whether your use case may call this model, and how much you may send, checked before a GPU sees the request.') + `<div class="grid">
    <div class="card c12"><h3>Overhead added per request <span class="right">${seg('gwc', S.gwCache, [['on', 'With caching'], ['off', 'Without caching']])}</span></h3>${stack(parts, (v) => v.toFixed(1) + ' ms')}
      <div class="row between"><p class="note">${on ? `${tot.toFixed(1)} ms p50, under 1% of a 70B time to first token.` : `${tot.toFixed(1)} ms p50 and a hard dependency on the identity provider and policy store for every call.`}</p><b>${tot.toFixed(1)} ms</b></div>
      <table class="table"><thead><tr><th>Step</th><th class="num">Uncached</th><th class="num">Cached</th><th>How</th></tr></thead><tbody>${GW.map(([k, a, b, how]) => `<tr><td>${k}</td><td class="num">${a.toFixed(1)} ms</td><td class="num">${b.toFixed(1)} ms</td><td>${how || ''}</td></tr>`).join('')}</tbody></table>
      <p class="note">If the policy store is unreachable, cached decisions keep serving for up to 5 minutes (fail static), then new tenants fail closed. Revocations push an invalidation, so a removed grant stops within seconds.</p></div>
    <div class="card c12"><h3>Rate limits by tenant <span class="right">Tokens per minute, input + output</span></h3><table class="table"><thead><tr><th>Tenant</th><th>Model</th><th class="num">Limit</th><th class="num">Burst</th><th class="num">Peak use</th><th class="num">429s, 24 h</th><th></th></tr></thead><tbody>${LIMITS.map(([t, mid, lim, burst, u, r]) => `<tr${u > 0.95 ? ' class="warnrow"' : ''}><td>${team(t)}</td><td>${h(oss(mid).name)}</td><td class="num">${si(lim)}</td><td class="num">${si(burst)}</td><td class="num"><div class="mini"><i style="width:${u * 100}%;background:${u > 0.95 ? C.amber : C.blue}"></i></div>${Math.round(u * 100)}%</td><td class="num">${fmt(r)}</td><td>${u > 0.95 ? pill('warn', r > 10000 ? 'Batch job hitting limit' : 'Raise or promote') : ''}</td></tr>`).join('')}</tbody></table>
      <p class="note">Limits are per tenant and model, so a burst from one team queues or gets a 429 with Retry-After instead of slowing everyone sharing the replica. Research's batch job should move to the offline batch API, which runs at a lower priority without a per-minute cap.</p></div></div>`;
};
CLICKS.push(['gwc', (v) => { S.gwCache = v; }]);

/* ───────────────────────── observability ───────────────────────── */

S.mobs = S.mobs || 'tokens';
const hourly = (m, f = 1) => Array.from({ length: 25 }, (_, i) => [i, last(m) / 24 * f * (0.62 + 0.38 * Math.sin((i - 9) / 24 * 2 * Math.PI)) * (1 + 0.05 * Math.sin(i * 2.3 + m.params / 1e9))]);
VIEWS.mobs = () => {
  const live = OSS.filter((m) => m.status === 'approved' && m.tier !== undefined && last(m) > 0);
  const cols = [C.blue, C.teal, C.purple, C.amber, C.pink, C.indigo, C.green];
  const tokDay = live.reduce((a, m) => a + last(m), 0) * 1e6;
  const tab = S.mobs;
  const series = (fn) => live.map((m, i) => ({ name: m.name, color: cols[i % cols.length], pts: fn(m) }));
  const body = {
    tokens: () => `<div class="card c12"><h3>Tokens per hour by model, last 24 h</h3>${xyChart(series((m) => hourly(m).map(([x, y]) => [x, y * 1e6])), { w: 1120, hgt: 240, fx: (v) => `${Math.round(v)}:00`, fy: (v) => si(v) })}</div>
      <div class="card c12"><h3>Usage and cost by tenant</h3><table class="table"><thead><tr><th>Tenant</th><th class="num">Tokens, 24 h</th><th class="num">Input share</th><th class="num">Cost, 24 h</th><th class="num">Per 1M tokens</th></tr></thead><tbody>${Object.keys(E.TEAMS).map((t) => { const ms = live.filter((m) => m.tenants.includes(t)); const tok = ms.reduce((a, m) => a + last(m) * 1e6 / m.tenants.length, 0); const cost = ms.reduce((a, m) => a + m.replicas * m.tp * E.HW[m.hw].cost * 24 / m.tenants.length, 0); return tok ? `<tr><td>${team(t)}</td><td class="num">${si(tok)}</td><td class="num">${t === 'search' ? 81 : t === 'research' ? 64 : 72}%</td><td class="num">${usd(cost)}</td><td class="num">$${(cost / tok * 1e6).toFixed(3)}</td></tr>` : ''; }).join('')}</tbody></table><p class="note">GPU-hours are split by each tenant's token share on shared replicas. Prompt and completion tokens come from <span class="mono">vllm:prompt_tokens_total</span> and <span class="mono">vllm:generation_tokens_total</span>, labeled by tenant at the gateway.</p></div>`,
    api: () => `<div class="card c12"><h3>Time to first token, p90 by model</h3>${xyChart(series((m) => hourly(m, 1).map(([x, y]) => [x, (m.bench?.ttft || 0.9) * (0.8 + 0.4 * y / (last(m) / 24 || 1))])), { w: 1120, hgt: 220, fx: (v) => `${Math.round(v)}:00`, fy: (v) => (v * 1000).toFixed(0) + ' ms' })}</div>
      <div class="card c12"><h3>Latency and throughput now</h3><table class="table"><thead><tr><th>Model</th><th class="num">TTFT p50</th><th class="num">TTFT p90</th><th class="num">ITL p50</th><th class="num">E2E p90</th><th class="num">Output tok/s</th><th class="num">Queue</th></tr></thead><tbody>${live.map((m) => { const t = m.bench?.ttft || 0.9, i = m.bench?.itl || 0.028; return `<tr><td>${h(m.name)}</td><td class="num">${Math.round(t * 520)} ms</td><td class="num">${Math.round(t * 1000)} ms</td><td class="num">${Math.round(i * 1000)} ms</td><td class="num">${(t + 350 * i * 1.3).toFixed(1)} s</td><td class="num">${fmt(last(m) * 1e6 / 86400 * 0.18)}</td><td class="num">${m.tier === 1 ? Math.round(last(m) / 400) : 0}</td></tr>`; }).join('')}</tbody></table><p class="note">From <span class="mono">vllm:time_to_first_token_seconds</span>, <span class="mono">vllm:inter_token_latency_seconds</span> and <span class="mono">vllm:e2e_request_latency_seconds</span> histograms; queue is <span class="mono">vllm:num_requests_waiting</span>.</p></div>`,
    limits: () => `<div class="card c12"><h3>Quota use by tenant and model</h3><table class="table"><thead><tr><th>Tenant</th><th>Model</th><th class="num">Peak use</th><th class="num">429s, 24 h</th><th class="num">Share of requests</th></tr></thead><tbody>${LIMITS.map(([t, mid, , , u, r]) => `<tr><td>${team(t)}</td><td>${h(oss(mid).name)}</td><td class="num">${Math.round(u * 100)}%</td><td class="num">${fmt(r)}</td><td class="num">${r ? (r / (last(oss(mid)) * 1e6 / 1200) * 100).toFixed(2) + '%' : '0%'}</td></tr>`).join('')}</tbody></table><p class="note">A breach is a 429 with Retry-After, counted per tenant. Sustained breaches open a ticket to raise the quota, move to batch, or promote the model.</p></div>`,
    errors: () => `<div class="card c12"><h3>Errors by layer, last 24 h</h3><table class="table"><thead><tr><th>Layer</th><th>Error</th><th class="num">Count</th><th class="num">Rate</th><th>Usual cause</th></tr></thead><tbody>${[['Gateway', '401 / 403', 1204, 'Expired token, model not approved for the use case'], ['Gateway', '429', 17672, 'Quota breach, mostly one batch job'], ['Ray Serve', '503 replica unavailable', 38, 'Cold start beyond the 120 s queue timeout'], ['vLLM', '400 context length', 412, 'Prompt plus max_tokens over the model context'], ['vLLM', '500 engine error', 3, 'CUDA OOM on a 128K prompt, replica restarted'], ['Kubernetes', 'Pod evicted', 2, 'Node drained for a driver upgrade']].map(([l, e, n, w]) => `<tr><td>${l}</td><td class="mono">${e}</td><td class="num">${fmt(n)}</td><td class="num">${(n / (tokDay / 1100) * 100).toFixed(3)}%</td><td>${w}</td></tr>`).join('')}</tbody></table><p class="note">Server-side errors (5xx) are 0.0012% of requests, inside the 0.1% monthly error budget for Tier 0.</p></div>`,
  };
  return head('Observability', 'Logs, traces and metrics from every layer, Kubernetes, Ray, vLLM and the gateway, joined by request and tenant.') + `<div class="grid">
    ${kpi2('Tokens, 24 h', si(tokDay), `${live.length} models`, 8.4, 'mobs-tok', tokDay)}
    ${kpi2('TTFT p90, Tier 0', '412 ms', 'Llama 3.3 70B', -3.1, 'mobs-ttft', 412, true)}
    ${kpi2('Rate-limited', '0.41%', '17.7K requests', 22.0, 'mobs-429', 0.41, true)}
    ${kpi2('Server errors', '0.0012%', '41 requests', -12.5, 'mobs-err', 41, true)}
    <div class="c12">${seg('mobs', tab, [['tokens', 'Tokens'], ['api', 'API latency'], ['limits', 'Rate limits'], ['errors', 'Errors']])}</div>
    ${body[tab]()}
    <div class="card c12"><h3>Sources</h3><div class="srcs">${[['Gateway', 'Tenant, use case, auth result, quota, 429s'], ['Ray Serve', 'Replicas, queue length, autoscaling decisions'], ['vLLM', 'TTFT, ITL, tokens, KV cache use, preemptions'], ['Kubernetes', 'Pods, nodes, DCGM GPU metrics, events']].map(([k, v]) => `<div><b>${k}</b><span>${v}</span></div>`).join('')}</div><p class="note">Every layer tags the same request ID, so one trace goes from the gateway through the Serve router to the vLLM engine step that produced the first token.</p></div></div>`;
};
CLICKS.push(['mobs', (v) => { S.mobs = v; }]);

/* ───────────────────────── cold start and scale to zero ───────────────────────── */

S.cs = S.cs || { model: 'llama-3.3-70b', src: 'lustre', node: 'warm', image: 'cached', compile: 'cached', idle: 'qwen3-235b' };
export const SRC = {
  serial: ['Object storage, 1 stream', (b) => [['Download weights', b / 0.35e9], ['Load to GPU from disk', b / 6.5e9]]],
  parallel: ['Object storage, 64 parallel reads', (b) => [['Download weights', b / 9.8e9], ['Load to GPU from disk', b / 6.5e9]]],
  lustre: ['Shared cache in the cluster (Lustre)', (b) => [['Read weights to GPU', b / 8.4e9]]],
  nvme: ['Local NVMe cache on the node', (b) => [['Read weights to GPU', b / 12e9]]],
  stream: ['Model streamer to GPU', (b) => [['Stream weights to GPU', b / 9.2e9]]],
};
export function coldStart(m, P) {
  const b = sizeB(m), moe = !!m.active;
  return [
    ['GPU node provisioning', P.node === 'cold' ? 270 : 0, C.gray],
    ['Image pull, 14.2 GB', P.image === 'cold' || P.node === 'cold' ? 52 : 0, C.indigo],
    ['Ray actor and engine start', 9, C.teal],
    ...SRC[P.src][1](b).map(([k, v], i) => [k, v, i ? C.blue : C.purple]),
    ['torch.compile and CUDA graphs', P.compile === 'cached' ? (moe ? 21 : 16) : (moe ? 96 : 74), C.amber],
    ['Warmup and readiness', 4, C.green],
  ];
}
/* A week of traffic for a Tier 1 model: busy sessions with idle gaps between them. */
function gaps(m) {
  let x = 0; for (const ch of m.id) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out = [], perDay = Math.max(3, Math.round(4 + last(m) / 120));
  for (let i = 0; i < perDay * 7; i++) out.push(-Math.log(1 - rnd()) * (1440 / perDay) * 0.55);
  return out; // minutes
}
VIEWS.coldstart = () => {
  const P = S.cs, m = oss(P.model) || OSS[0], parts = coldStart(m, P), tot = parts.reduce((a, p) => a + p[1], 0);
  const base = coldStart(m, { ...P, src: 'serial', node: 'cold', image: 'cold', compile: 'none' }).reduce((a, p) => a + p[1], 0);
  const par = SRC.parallel[1](sizeB(m)).reduce((a, p) => a + p[1], 0), ser = SRC.serial[1](sizeB(m))[0][1], parDl = SRC.parallel[1](sizeB(m))[0][1], lus = SRC.lustre[1](sizeB(m))[0][1];
  const sel = (k, opts) => `<select data-bind="cs.${k}" data-num="no">${opts.map(([v, t]) => `<option value="${v}"${v === P[k] ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
  const hosted = OSS.filter((x) => x.tier !== undefined && x.status !== 'pending');
  const im = oss(P.idle) || OSS[3], g = gaps(im), gpu = im.tp * Math.max(1, im.replicas), rate = E.HW[im.hw].cost;
  const row = (delay, label) => { const idle = g.reduce((a, x) => a + Math.min(x, delay), 0) / 60 * gpu, colds = g.filter((x) => x > delay).length; return [label || (delay >= 60 ? `${delay / 60} h` : `${delay} min`), idle, colds, delay]; };
  const delays = [row(5), row(10), row(15), row(30), row(60), row(240, '4 h (before)'), row(1e9, 'Never (min 1 replica)')];
  const cur = 15;
  return head('Cold start and scaling', 'How long a scaled-to-zero model takes to serve its first token again, where that time goes, and what scaling to zero saves in idle GPU-hours.') + `<div class="grid">
    <div class="card c12"><div class="fields"><label class="field">Model ${sel('model', hosted.map((x) => [x.id, `${x.name} (${gbs(sizeB(x))})`]))}</label><label class="field">Weights from ${sel('src', Object.entries(SRC).map(([k, [t]]) => [k, t]))}</label><label class="field">GPU node ${sel('node', [['warm', 'Warm pool node'], ['cold', 'New node']])}</label><label class="field">Container image ${sel('image', [['cached', 'Cached on node'], ['cold', 'Pull']])}</label><label class="field">Compile cache ${sel('compile', [['cached', 'Shared cache hit'], ['none', 'Compile from scratch']])}</label></div></div>
    <div class="card c12"><h3>Time to first token from zero replicas <span class="right"><b class="big">${tot >= 120 ? (tot / 60).toFixed(1) + ' min' : tot.toFixed(0) + ' s'}</b></span></h3>${stack(parts, (v) => v >= 100 ? (v / 60).toFixed(1) + ' min' : v.toFixed(1) + ' s')}
      <p class="note">${gbs(sizeB(m))} of ${m.quant.toUpperCase()} weights onto ${m.tp} × ${E.HW[m.hw].name}. Everything cold with one download stream takes ${(base / 60).toFixed(1)} min; this setup is ${(base / tot).toFixed(1)}× faster.</p></div>
    ${[['Parallel download', `${Math.round(ser)} s → ${parDl.toFixed(1)} s`, `${fmt(Math.round((ser / parDl - 1) * 100))}% faster: 64 ranged reads per node fill the 100 Gb/s NIC instead of one TCP stream.`],
      ['Cache near the GPU', `${par.toFixed(0)} s → ${lus.toFixed(0)} s`, `${Math.round((1 - lus / par) * 100)}% less transfer: reading from the in-cluster file system skips the object storage round trip and the second copy through local disk.`],
      ['Compile cache', `${m.active ? 96 : 74} s → ${m.active ? 21 : 16} s`, 'torch.compile artifacts and CUDA graph shapes stored per model, engine version and GPU type.'],
      ['Warm pool', '4.5 min → 0', 'Two idle GPU nodes kept per region with the image preloaded, so scale-up rarely waits for hardware.']].map(([t, v, n]) => `<div class="card c3 lever"><span>${t}</span><b>${v}</b><p>${n}</p></div>`).join('')}
    <div class="card c12"><h3>Scale to zero: idle GPU-hours vs cold starts <span class="right"><select data-bind="cs.idle" data-num="no">${OSS.filter((x) => x.tier === 1 && x.status === 'approved').map((x) => `<option value="${x.id}"${x.id === im.id ? ' selected' : ''}>${h(x.name)}</option>`).join('')}</select></span></h3>
      <table class="table"><thead><tr><th>Downscale after idle for</th><th class="num">Idle GPU-hours a week</th><th class="num">Idle cost a week</th><th class="num">Cold starts a week</th><th class="num">Requests that wait</th></tr></thead><tbody>${delays.map(([l, idle, cs, d]) => `<tr${d === cur ? ' class="sel"' : ''}><td>${l}${d === cur ? ' ' + pill('blue', 'Current') : ''}</td><td class="num">${fmt(idle)}</td><td class="num">${usd(idle * rate)}</td><td class="num">${fmt(cs)}</td><td class="num">${(cs / (last(im) * 7 / 1.2) * 100).toFixed(3)}%</td></tr>`).join('')}</tbody></table>
      <p class="note">From this model's real gaps between bursts last week, on ${gpu} GPUs per replica set. Moving the delay from 4 hours to ${cur} minutes saves ${fmt(delays[5][1] - delays[2][1])} GPU-hours (${usd((delays[5][1] - delays[2][1]) * rate)}) a week for ${delays[2][2] - delays[5][2]} more cold starts, each about ${Math.round(coldStart(im, { ...P, node: 'warm', image: 'cached' }).reduce((a, p) => a + p[1], 0))} s with the current cache setup.</p></div></div>`;
};
EXPORTS.lifecycle = () => [['Model', 'Repo', 'Tier', 'Tokens per day (M)', 'Replicas', 'Next step'], ...OSS.filter((m) => m.tier !== undefined).map((m) => [m.name, m.repo, m.status === 'retired' ? 'Retired' : 'Tier ' + m.tier, last(m), m.replicas, advice(m)?.t || 'Steady'])];
