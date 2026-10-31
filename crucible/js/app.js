/* Crucible console shell: sign-in, sidebar, toolbar, Inspector, palette,
   notifications, create workflows and the live tick. Views live in v-*.js. */
import { E, $, h, fmt, time, initials, si, usd, store, ctx, S, VIEWS, AFTER, ACTIONS, CLICKS, EXPORTS, DRAWERS, EV, icon, pill, toast, ui, F_, csv, me, date, ago, gb, ms, p90, head, kpi2 } from './core.js?v=20261030-9';
import { initChartHover } from './charts.js?v=20261030-9';
import './v-train.js?v=20261030-9';
import './v-infer.js?v=20261030-9';
import './v-compute.js?v=20261030-9';
import './v-more.js?v=20261030-9';
import './v-ops.js?v=20261030-9';
import './v-term.js?v=20261030-9';
import './v-fsdp.js?v=20261030-9';
import './v-backends.js?v=20261030-9';
import './v-lib.js?v=20261030-9';
import './v-perf.js?v=20261030-9';

/* ───────────────────────── sign-in ───────────────────────── */

function showSignin() {
  $('#signin').hidden = false; $('#app').hidden = true;
  $('#who').innerHTML = Object.entries(E.ROLES).map(([k, r]) => `<button data-signin="${k}"><span class="av">${initials(r.name)}</span><span><b>${h(r.name)}</b><span>${h(r.title)} · ${h(E.TEAMS[r.team].name)}</span></span><i>›</i></button>`).join('');
}
$('#who').addEventListener('click', (e) => { const b = e.target.closest('[data-signin]'); if (b) signIn(b.dataset.signin); });

function signIn(role, quiet) {
  S.role = role; store.set('crucible.role', role);
  S.session = Date.now() + 8 * 36e5;
  if (!ctx.F) ctx.F = new E.Fleet();
  if (!quiet) toast(`Signed in as ${E.ROLES[role].name}, ${E.ROLES[role].title}`);
  $('#signin').hidden = true; $('#app').hidden = false;
  renderChrome(); render(); layoutInspector(); drawDrawer();
}

/* ───────────────────────── chrome ───────────────────────── */

export const SECTIONS = [
  ['home', 'Home', [['overview', 'Overview']]],
  ['training', 'Training', [['runs', 'Runs'], ['planner', 'Parallelism planner'], ['fsdp', 'FSDP'], ['data', 'Datasets']]],
  ['post', 'Post-training', [['pipelines', 'Pipelines'], ['rl', 'RL runs'], ['evals', 'Evaluations']]],
  ['inference', 'Inference', [['deployments', 'Deployments'], ['tenant', 'Tenant optimizer'], ['forecast', 'Demand forecast'], ['kv', 'KV cache'], ['moe', 'Mixture of experts'], ['capacity', 'Capacity planner'], ['benchmarks', 'Benchmarks']]],
  ['compute', 'Compute', [['fleet', 'Fleet'], ['gpu', 'GPU telemetry'], ['kernels', 'Kernels and memory'], ['tenants', 'Tenants and cost'], ['queue', 'Queue and quotas'], ['ray', 'Ray clusters'], ['backends', 'Execution backends']]],
  ['models', 'Models', [['registry', 'Registry']]],
  ['dev', 'Developers', [['library', 'Crucible library'], ['terminal', 'Terminal'], ['review', 'Design review'], ['sdk', 'SDK and API']]],
  ['settings', 'Settings', [['org', 'Organization'], ['integrations', 'Integrations']]],
];
const SECTION_OF = Object.fromEntries(SECTIONS.flatMap(([k, , tabs]) => tabs.map(([v]) => [v, k])));
const TITLES = Object.fromEntries(SECTIONS.flatMap(([, , tabs]) => tabs));

/* What needs the signed-in person, derived from live fleet state. */
export function attention() {
  const F = ctx.F, r = S.role, out = [];
  const coder = F.dep('coder-34b');
  if (coder.issue && ['sre', 'platform', 'ml_engineer'].includes(r)) out.push({ t: 'Coder 34B is breaching its TTFT SLO', m: 'At max replicas. Prompts grew to 5,800 tokens; see the tuning suggestion.', go: 'deployments', set: () => { S.dep = 'coder-34b'; S.depTab = 'tuning'; } });
  const canary = F.deps.find((d) => d.canary && d.state === 'canary');
  if (canary && ['ml_engineer', 'platform', 'researcher'].includes(r)) out.push({ t: `Canary ${canary.name} at ${canary.canary.steps[canary.canary.step - 1]}%`, m: 'Gates are green. Advance or roll back.', go: 'deployments', set: () => { S.dep = canary.id; S.depTab = 'rollout'; } });
  const failed = F.jobs.find((j) => j.state === 'failed' && !j.ack);
  if (failed && ['ml_engineer', 'researcher', 'platform'].includes(r)) out.push({ t: `${failed.name} failed`, m: 'Reward collapse. Root cause and a fixed config are ready.', go: 'rl', set: () => { S.run = failed.id; S.runTab = 'overview'; } });
  const q = F.jobs.filter((j) => j.state === 'queued');
  if (q.length && ['manager', 'platform'].includes(r)) out.push({ t: `${q.length} job${q.length > 1 ? 's' : ''} waiting for capacity`, m: q.map((j) => j.name).join(', '), go: 'queue' });
  const bad = F.jobs.find((j) => j.straggler && j.state === 'running');
  if (bad && ['sre', 'platform', 'researcher'].includes(r)) out.push({ t: `Straggler in ${bad.name}`, m: `${bad.straggler.node} GPU ${bad.straggler.gpu} is ${bad.straggler.slow}% slow and holds back every step.`, go: 'runs', set: () => { S.run = bad.id; S.runTab = 'performance'; } });
  const evalv = ['researcher', 'manager'].includes(r) && !F.promoted32;
  if (evalv) out.push({ t: 'Core 70B SFT v3.2 is ready for review', m: '17 of 18 suites pass; one regression to accept or block.', go: 'evals' });
  return out;
}

function counts() {
  const F = ctx.F;
  return {
    home: attention().length || '',
    training: F.jobs.filter((j) => j.state === 'running' && j.kind !== 'rl').length || '',
    post: F.jobs.filter((j) => j.kind === 'rl' && j.state === 'running').length || '',
    inference: F.deps.some((d) => d.state === 'degraded') ? '!' : '',
    compute: F.jobs.filter((j) => j.state === 'queued').length || '',
  };
}

function renderChrome() {
  if (!ctx.F) return;
  const c = counts(), cur = SECTION_OF[S.view];
  S.open.add(cur);
  const item = ([k, t, tabs]) => {
    if (tabs.length === 1) return `<button class="nav-item${cur === k ? ' on' : ''}" data-go="${tabs[0][0]}">${icon(k)}${t}<span class="count${c[k] === '!' ? ' alert' : ''}">${c[k] ?? ''}</span></button>`;
    return `<div class="nav-sec"><h6>${t}<span class="count${c[k] === '!' ? ' alert' : ''}">${c[k] ?? ''}</span></h6>${tabs.map(([v, tt]) => `<button class="nav-link${S.view === v ? ' on' : ''}" data-go="${v}">${tt}</button>`).join('')}</div>`;
  };
  $('#nav').innerHTML = SECTIONS.filter(([k]) => k !== 'settings').map(item).join('');
  $('#nav-bottom').innerHTML = item(SECTIONS.find(([k]) => k === 'settings'));
  $('#bar-ctx').innerHTML = `<button class="ctx-btn" data-act="env"><span class="dot-ok"></span>Production<i>▾</i></button><div class="seg range">${['1h', '24h', '7d', '30d'].map((r) => `<button class="${S.range === r ? 'on' : ''}" data-range="${r}">${r}</button>`).join('')}</div><span class="live"><span class="live-dot"></span>Live</span>`;
  const n = notifications().length;
  $('#btn-bell').innerHTML = icon('bell') + (n ? `<span class="badge">${n}</span>` : '');
  const r = me();
  $('#btn-role').innerHTML = `<span class="av">${initials(r.name)}</span>${h(r.name.split(' ')[0])} <small>${h(r.title)}</small>`;
  const sec = SECTIONS.find(([k]) => k === cur);
  $('#bar-title').innerHTML = sec[2].length > 1 ? `<span class="crumb">${sec[1]}</span><span class="crumb-sep">›</span><span>${TITLES[S.view]}</span>` : `<span>${sec[1]}</span>`;
  const F = ctx.F, total = E.CLUSTERS.reduce((a, cl) => a + cl.nodes * 8, 0);
  const used = F.jobs.filter((j) => j.state === 'running').reduce((a, j) => a + E.jobGpus(j), 0) + F.deps.reduce((a, d) => a + d.replicas * (d.cfg.tp + (d.cfg.disagg || 0)), 0);
  const degraded = F.deps.some((d) => d.state === 'degraded');
  $('#side-foot').innerHTML = `${fmt(used)} of ${fmt(total)} GPUs in use<br>Session until ${time(S.session)}`;
  const crit = F.deps.filter((d) => d.state === 'degraded').length, fails = F.jobs.filter((j) => j.state === 'failed' && !j.ack).length;
  $('#statusbar').innerHTML = `<span class="sb-h ${crit ? 'warn' : ''}"><i></i>${crit ? `${crit} deployment degraded` : 'All systems operational'}</span><span>${fmt(used)} / ${fmt(total)} GPUs</span><span>${F.jobs.filter((j) => j.state === 'running').length} jobs running${fails ? ` · ${fails} failed` : ''}</span><span>${F.deps.length} deployments</span><span class="sb-sp"></span><span>us-west 9 ms · us-east 61 ms · eu-west 142 ms</span><span>Control plane 3.4.0</span><span>Synced ${new Date().toLocaleTimeString('en-GB', { hour12: false })}</span>`;
}

function go(view) {
  if (SECTION_OF[view] !== SECTION_OF[S.view]) { S.open = new Set([SECTION_OF[view]]); if (S.drawer) { S.drawer = null; drawDrawer(); } }
  S.view = view; $('#side').classList.remove('open'); renderChrome(); render(); $('#view').scrollTop = 0;
}

/* ───────────────────────── rendering ───────────────────────── */

let queued = false;
export function scheduleRender() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; render(); }); }
function render() {
  if (!ctx.F) return;
  const v = $('#view'), st = v.scrollTop;
  const a = document.activeElement, keep = a && a.dataset && a.dataset.filter, caret = keep ? a.selectionStart : 0;
  v.innerHTML = (VIEWS[S.view] || VIEWS.overview)();
  v.scrollTop = st;
  if (keep) { const el = v.querySelector(`[data-filter="${keep}"]`); if (el) { el.focus(); el.setSelectionRange(caret, caret); } }
  applySorts();
  AFTER[S.view] && AFTER[S.view]();
  layoutInspector();
}

/* Click any column header to sort that table; the choice survives live refreshes. */
const SORTS = {};
const cellVal = (td) => {
  const t = (td?.innerText || '').trim().replace(/,/g, '');
  const m = t.match(/^[$▲▼]?\s*(-?\d+(?:\.\d+)?)\s*(T|B|M|K|GB|TB|ms|s|%|×)?/);
  if (!m) return t.toLowerCase();
  const mult = { T: 1e12, B: 1e9, M: 1e6, K: 1e3, GB: 1e9, TB: 1e12, ms: 1e-3, s: 1 }[m[2]] || 1;
  return parseFloat(m[1]) * mult;
};
function applySorts() {
  document.querySelectorAll('#view table.table').forEach((tb, i) => {
    const key = S.view + ':' + i, st = SORTS[key], ths = tb.querySelectorAll('thead th');
    ths.forEach((th, c) => { th.dataset.sortcol = key + '|' + c; th.classList.toggle('sorted', !!st && st.c === c); th.classList.toggle('desc', !!st && st.c === c && st.d < 0); });
    if (!st || !tb.tBodies[0]) return;
    const rows = [...tb.tBodies[0].rows];
    rows.sort((x, y) => { const a = cellVal(x.cells[st.c]), b = cellVal(y.cells[st.c]); return (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))) * st.d; });
    rows.forEach((r) => tb.tBodies[0].appendChild(r));
  });
}
document.addEventListener('click', (e) => {
  const th = e.target.closest('#view th[data-sortcol]'); if (!th) return;
  const [key, c] = th.dataset.sortcol.split('|'), cur = SORTS[key];
  SORTS[key] = { c: +c, d: cur && cur.c === +c ? -cur.d : -1 };
  applySorts();
});
const LIVE = new Set(['overview', 'runs', 'rl', 'deployments', 'fleet', 'ray', 'gpu']);
setInterval(() => {
  if (!ctx.F || $('#app').hidden) return;
  const a = document.activeElement;
  if (a && $('#view').contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
  if ($('#modal') || document.querySelector('.ts:hover, .nodegrid:hover, .rankgrid:hover')) return;
  if (LIVE.has(S.view)) render();
  renderChrome();
}, 2000);

Object.assign(ui, { render, renderChrome, go, openDrawer, closeDrawer, openForm: (k, v) => openForm(k, v), attention: () => attention() });

/* ───────────────────────── Inspector ───────────────────────── */

function openDrawer(kind, id) { S.drawer = { kind, id }; S.inspector = true; layoutInspector(); drawDrawer(); }
function closeDrawer() { S.drawer = null; drawDrawer(); layoutInspector(); }
function layoutInspector() { $('#app').classList.toggle('no-insp', !S.inspector || !S.drawer); $('#btn-insp').classList.toggle('on', S.inspector); }
export function drawDrawer() {
  const el = $('#inspector');
  if (!S.drawer || !DRAWERS[S.drawer.kind]) { el.innerHTML = `<div class="insp-empty"><b>No Selection</b><span>Select a node, checkpoint, dataset or event to inspect it here.</span></div>`; return; }
  const d = DRAWERS[S.drawer.kind](S.drawer.id);
  el.innerHTML = `<div class="insp-head"><span class="insp-glyph">${icon(d.glyph || 'compute')}</span><div><h3>${h(d.title)}</h3>${d.sub ? `<span class="id">${h(d.sub)}</span>` : ''}</div><button class="icon-btn" data-closedrawer aria-label="Close">✕</button></div><div class="insp-body">${d.body}</div>`;
}

/* ───────────────────────── notifications, palette ───────────────────────── */

function notifications() {
  const F = ctx.F, out = attention().map((x) => ({ ...x, kind: 'task' }));
  for (const d of F.deps.filter((x) => x.state === 'degraded')) if (!out.some((o) => o.t.startsWith(d.name))) out.unshift({ t: `${d.name} degraded`, m: 'SLO breach', go: 'deployments', kind: 'alert', set: () => { S.dep = d.id; } });
  return out;
}
let popSet = [];
function openBell(e) {
  e.stopPropagation(); closePop();
  const r = $('#btn-bell').getBoundingClientRect(), list = notifications();
  popSet = list;
  const pop = document.createElement('div');
  pop.className = 'popover wide'; pop.id = 'pop';
  pop.style.top = r.bottom + 6 + 'px'; pop.style.right = Math.max(8, innerWidth - r.right) + 'px';
  pop.innerHTML = `<p class="pop-h">Notifications</p>` + (list.length ? list.map((x, i) => `<button data-att="${i}"><span class="dotk ${x.kind}"></span><span>${h(x.t)}<small>${h(x.m)}</small></span></button>`).join('') : '<p class="pop-empty">You are all caught up.</p>');
  document.body.appendChild(pop);
}

let palIndex = 0;
function paletteItems(q) {
  q = q.trim().toLowerCase();
  const F = ctx.F, items = [];
  for (const [, t, tabs] of SECTIONS) for (const [v, tt] of tabs) items.push({ t: tabs.length > 1 ? `${t} › ${tt}` : t, kind: 'Page', go: v });
  for (const j of F.jobs) items.push({ t: j.name, sub: j.id, kind: 'Run', go: j.kind === 'rl' ? 'rl' : 'runs', set: () => { S.run = j.id; } });
  for (const d of F.deps) items.push({ t: d.name, sub: `${d.engine} · ${d.model}`, kind: 'Deployment', go: 'deployments', set: () => { S.dep = d.id; } });
  for (const m of E.MODELS) items.push({ t: m.name, sub: m.versions.length + ' versions', kind: 'Model', go: 'registry', set: () => { S.model = m.id; } });
  for (const cl of E.CLUSTERS) items.push({ t: cl.id, sub: `${cl.nodes * 8} × ${E.HW[cl.hw].name}`, kind: 'Cluster', go: 'fleet', set: () => { S.cluster = cl.id; } });
  for (const [k, t] of NEW_MENU) items.push({ t: `New ${t.toLowerCase()}`, kind: 'Create', act: () => openForm(k) });
  items.push({ t: 'Switch account', kind: 'Action', act: () => $('#btn-role').click() });
  return items.filter((x) => !q || (x.t + ' ' + (x.sub || '') + ' ' + x.kind).toLowerCase().includes(q)).slice(0, 9);
}
function openPalette() {
  if ($('#pal')) return;
  const back = document.createElement('div'); back.className = 'pal-back'; back.id = 'pal';
  back.innerHTML = `<div class="pal"><label class="pal-in">${icon('search')}<input id="pal-q" placeholder="Search runs, deployments, models, clusters" autocomplete="off"><kbd>esc</kbd></label><div id="pal-list"></div></div>`;
  document.body.appendChild(back);
  const q = $('#pal-q'); palIndex = 0;
  const draw = () => { const items = paletteItems(q.value); palIndex = Math.min(palIndex, Math.max(items.length - 1, 0)); $('#pal-list').innerHTML = items.map((x, i) => `<button class="pal-item${i === palIndex ? ' on' : ''}" data-i="${i}"><span>${h(x.t)}${x.sub ? `<small>${h(x.sub)}</small>` : ''}</span><em>${x.kind}</em></button>`).join('') || '<p class="pop-empty">No results</p>'; return items; };
  let items = draw();
  const pick = (x) => { closePalette(); if (!x) return; if (x.set) x.set(); if (x.go) go(x.go); if (x.act) x.act(); };
  q.addEventListener('input', () => { palIndex = 0; items = draw(); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { palIndex = Math.min(palIndex + 1, items.length - 1); draw(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { palIndex = Math.max(palIndex - 1, 0); draw(); e.preventDefault(); }
    if (e.key === 'Enter') pick(items[palIndex]);
    if (e.key === 'Escape') closePalette();
  });
  back.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) return pick(items[+b.dataset.i]); if (e.target === back) closePalette(); });
  q.focus();
}
function closePalette() { const p = $('#pal'); if (p) p.remove(); }
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!$('#app').hidden) openPalette(); }
  if (e.key === 'Escape' && $('#modal')) closeForm();
});

/* ───────────────────────── create workflows ───────────────────────── */

const versions = () => E.MODELS.flatMap((m) => m.versions.map((v) => [v[0], `${v[0]} (${v[3].toLowerCase()})`]));
const dsOpts = (kinds) => E.DATASETS.filter((d) => !kinds || kinds.includes(d.kind)).map((d) => [d.id, `${d.id} · ${d.kind}`]);
const archOf = (version) => E.MODELS.find((m) => m.versions.some((v) => v[0] === version)).id;
const gpuOpts = [8, 16, 32, 64, 128, 256].map((n) => [n, `${n} GPUs`]);
const hwOpts = Object.entries(E.HW).map(([k, x]) => [k, `${x.name} ${x.mem} GB`]);

/* A queued job admits after a short wait, as Kueue would once quota frees. */
function admitLater(j, secs) {
  setTimeout(() => {
    if (j.state !== 'queued') return;
    j.state = 'running'; j.started = Date.now(); j.wait = 0;
    ctx.F.event(Date.now(), j.id, 'admitted', `Admitted by the scheduler on ${j.cluster}: ${E.jobGpus(j)} GPUs gang-scheduled in one rail group.`);
    toast(`${j.name} is running`); renderChrome(); render();
  }, secs * 1000);
}
function postJob(v, method, extra = {}) {
  const arch = archOf(v.base), a = E.ARCH[arch], gpus = +v.gpus;
  const tp = a.params > 30e9 ? Math.min(4, gpus) : 1;
  const cfg = { hw: v.hw, tp, pp: 1, cp: 1, dp: gpus / tp, micro: 1, accum: 4, zero: 3, recompute: a.params > 30e9 ? 'full' : 'selective', vpp: 1, seq: +v.seq || 8192, fp8: false, chunkedLoss: true };
  const mem = E.trainMemory(a, cfg);
  if (mem.total > E.HW[v.hw].mem * 1e9 * 0.92) return { error: { gpus: `Needs ${gb(mem.total)} per GPU on ${E.HW[v.hw].name}. Add GPUs or pick a larger GPU.` } };
  const j = { id: `${method.toLowerCase().replace(/[^a-z]/g, '')}-${arch}-${Math.random().toString(36).slice(2, 6)}`, name: v.name, kind: extra.rl ? 'rl' : 'post', method, arch, team: me().team, owner: me().name, cluster: E.CLUSTERS.find((c) => c.hw === v.hw).id, state: 'queued', priority: v.priority || 'P2', cfg, steps: +v.steps || 1000, started: null, step: 0, base: v.base, dataset: v.dataset, wait: 20, ...extra };
  ctx.F.jobs.unshift(j);
  ctx.F.event(Date.now(), j.id, 'submitted', `${me().name} submitted ${method} on ${v.base}: ${gpus} GPUs, ${gb(mem.total)} per GPU planned.`);
  admitLater(j, 6);
  S.run = j.id; S.runTab = 'overview';
  return { ok: `${j.name} queued. Admission in a few seconds.`, go: extra.rl ? 'rl' : 'runs' };
}

export const FORMS = {
  finetune: {
    title: 'New fine-tuning job', icon: 'training', sub: 'SFT, DPO or LoRA on a registered model. The planner sizes memory before anything is queued.', cta: 'Queue job', roles: ['researcher', 'ml_engineer', 'platform'],
    fields: () => [
      { k: 'name', label: 'Name', type: 'text', req: true, def: 'Core 8B support assistant SFT', minLen: 6 },
      { k: 'method', label: 'Method', type: 'select', options: [['SFT', 'Supervised fine-tuning'], ['LoRA SFT', 'LoRA, rank 16'], ['DPO', 'Direct preference optimization'], ['KTO', 'KTO, unpaired feedback']], def: 'SFT' },
      { k: 'base', label: 'Base model', type: 'select', options: versions(), def: 'core-8b-sft-v5' },
      { k: 'dataset', label: 'Dataset', type: 'select', options: dsOpts(['SFT', 'Preference pairs']), def: 'assistant-sft-v9', hint: 'Datasets must be approved by the governance platform before a job can read them.' },
      { k: 'hw', label: 'Hardware', type: 'select', options: hwOpts, def: 'h100' },
      { k: 'gpus', label: 'GPUs', type: 'select', options: gpuOpts, def: 32 },
      { k: 'seq', label: 'Sequence length', type: 'select', options: [[4096, '4,096'], [8192, '8,192'], [16384, '16,384'], [32768, '32,768']], def: 8192, hint: 'Examples are packed to this length with document masking.' },
      { k: 'steps', label: 'Max steps', type: 'number', def: 1500, min: 10 },
      { k: 'evals', label: 'Evaluate after', type: 'checks', options: [['core', 'Core capability suites'], ['safety', 'Safety and refusal'], ['regress', 'Regression vs base']], def: ['core', 'safety', 'regress'], req: true },
    ],
    submit: (v) => { const ds = E.DATASETS.find((d) => d.id === v.dataset); if (ds.governance !== 'Approved') return { error: { dataset: `${ds.id} is ${ds.governance.toLowerCase()} by governance. Pick an approved dataset.` } }; return postJob(v, v.method); },
  },
  rl: {
    title: 'New RL job', icon: 'post', sub: 'GRPO or PPO with verifiable rewards on Ray. Rollouts run on a vLLM or SGLang pool, training on FSDP.', cta: 'Queue RL job', roles: ['researcher', 'ml_engineer'],
    fields: () => [
      { k: 'name', label: 'Name', type: 'text', req: true, def: 'Core 8B math RL (GRPO)', minLen: 6 },
      { k: 'algo', label: 'Algorithm', type: 'select', options: [['GRPO', 'GRPO, group-relative advantages'], ['DAPO', 'DAPO, dynamic sampling + clip-higher'], ['PPO', 'PPO with a critic']], def: 'DAPO' },
      { k: 'base', label: 'Policy', type: 'select', options: versions(), def: 'core-8b-sft-v5' },
      { k: 'dataset', label: 'Prompts and verifiers', type: 'select', options: dsOpts(['RL prompts with verifiers']), def: 'math-code-verifiable-v4' },
      { k: 'group', label: 'Samples per prompt', type: 'select', options: [[8, '8'], [16, '16'], [32, '32']], def: 16 },
      { k: 'engine', label: 'Rollout engine', type: 'select', options: [['vLLM 0.11', 'vLLM'], ['SGLang 0.5', 'SGLang']], def: 'vLLM 0.11' },
      { k: 'placement', label: 'Placement', type: 'select', options: [['colocated', 'Colocated: trainer and engine share GPUs'], ['split', 'Disaggregated: separate pools, one-step async']], def: 'split' },
      { k: 'hw', label: 'Hardware', type: 'select', options: hwOpts, def: 'h100' },
      { k: 'gpus', label: 'Trainer GPUs', type: 'select', options: gpuOpts, def: 32 },
      { k: 'steps', label: 'Steps', type: 'number', def: 600, min: 10 },
    ],
    submit: (v) => postJob(v, v.algo, { rl: { rolloutGpus: v.placement === 'split' ? +v.gpus : 0, trainGpus: +v.gpus, rmGpus: 0, verifiers: 512, group: +v.group, promptsPerStep: 256, maxLen: 8192, async: v.placement === 'split' ? 1 : 0, engine: v.engine, sync: v.placement === 'split' ? 'NCCL broadcast, bucketed' : 'CUDA IPC, colocated' } }),
  },
  deploy: {
    title: 'New deployment', icon: 'inference', sub: 'Serve a registered model behind the router. New deployments start as a 5% canary.', cta: 'Deploy as canary', roles: ['ml_engineer', 'platform'],
    fields: () => [
      { k: 'name', label: 'Name', type: 'text', req: true, def: 'Assistant 8B EU', minLen: 4 },
      { k: 'model', label: 'Model version', type: 'select', options: versions(), def: 'core-8b-dpo-v5.3' },
      { k: 'engine', label: 'Engine', type: 'select', options: [['vLLM', 'vLLM 0.11.1'], ['SGLang', 'SGLang 0.5.2'], ['TensorRT-LLM', 'TensorRT-LLM 1.1']], def: 'SGLang' },
      { k: 'hw', label: 'Hardware', type: 'select', options: hwOpts, def: 'h100' },
      { k: 'tp', label: 'Tensor parallel', type: 'select', options: [[1, '1'], [2, '2'], [4, '4'], [8, '8']], def: 1 },
      { k: 'quant', label: 'Weights', type: 'select', options: [['bf16', 'BF16'], ['fp8', 'FP8, per-channel'], ['int4', 'INT4 AWQ']], def: 'fp8' },
      { k: 'region', label: 'Region', type: 'select', options: [['eu-west', 'eu-west'], ['us-west', 'us-west'], ['us-east', 'us-east']], def: 'eu-west', hint: 'EU traffic stays on EU capacity.' },
      { k: 'ttft', label: 'TTFT SLO, seconds', type: 'number', def: 0.8, min: 0.05 },
      { k: 'itl', label: 'ITL SLO, ms', type: 'number', def: 30, min: 5 },
    ],
    submit: (v) => {
      const arch = archOf(v.model), a = E.ARCH[arch];
      const cfg = { hw: v.hw, tp: +v.tp, quant: v.quant, kvq: v.quant === 'fp8' ? 'fp8' : 'bf16', prompt: 1400, out: 250, prefixHit: 0.5, spec: null, cudaGraphs: true };
      const cap = E.serveCapacity(a, cfg);
      if (!cap.fits) return { error: { tp: `${a.name} in ${v.quant.toUpperCase()} needs ${gb(cap.weights)} for weights alone. Raise tensor parallel or quantize.` } };
      const id = v.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (ctx.F.dep(id)) return { error: { name: 'A deployment with this name exists.' } };
      const d = { id, name: v.name, model: v.model, arch, team: me().team, engine: v.engine, version: v.engine === 'vLLM' ? '0.11.1' : v.engine === 'SGLang' ? '0.5.2' : '1.1', region: v.region, state: 'canary', cfg, replicas: 2, min: 2, max: 24, slo: { ttft: +v.ttft, itl: +v.itl / 1000 }, peak: 40, features: ['Created from the console'], canary: { from: 'none', to: v.model, step: 1, steps: [5, 25, 50, 100] } };
      ctx.F.deps.push(d);
      ctx.F.event(Date.now(), id, 'deploy', `${me().name} deployed ${v.model} on ${v.engine}, TP ${v.tp}, ${v.quant.toUpperCase()}. Canary at 5%.`);
      S.dep = id; S.depTab = 'overview';
      return { ok: `${v.name} is live as a 5% canary`, go: 'deployments' };
    },
  },
  bench: {
    title: 'New benchmark', icon: 'gauge', sub: 'Sweep request rate for one configuration on a fixed workload. Results land in Benchmarks.', cta: 'Run benchmark', roles: null,
    fields: () => [
      { k: 'model', label: 'Model', type: 'select', options: Object.entries(E.ARCH).map(([k, a]) => [k, a.name]), def: 'core-70b' },
      { k: 'engine', label: 'Engine', type: 'select', options: [['vLLM', 'vLLM'], ['SGLang', 'SGLang'], ['TensorRT-LLM', 'TensorRT-LLM']], def: 'SGLang' },
      { k: 'hw', label: 'Hardware', type: 'select', options: hwOpts, def: 'h200' },
      { k: 'tp', label: 'Tensor parallel', type: 'select', options: [[1, '1'], [2, '2'], [4, '4'], [8, '8']], def: 4 },
      { k: 'quant', label: 'Weights', type: 'select', options: [['bf16', 'BF16'], ['fp8', 'FP8'], ['int4', 'INT4 AWQ']], def: 'fp8' },
      { k: 'workload', label: 'Workload', type: 'select', options: [['chat', 'Chat: 1.8K in, 350 out'], ['rag', 'Long context RAG: 12K in, 400 out'], ['code', 'Code completion: 3K in, 60 out'], ['reason', 'Reasoning: 900 in, 3.2K out']], def: 'chat' },
    ],
    submit: (v) => { const r = window.__runBench && window.__runBench(v); return r || { ok: 'Benchmark started', go: 'benchmarks' }; },
  },
};
const NEW_MENU = [['finetune', 'Fine-tuning job'], ['rl', 'RL job'], ['deploy', 'Deployment'], ['bench', 'Benchmark']];

function openNewMenu(e) {
  e.stopPropagation(); closePop();
  const r = $('#btn-new').getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'popover'; pop.id = 'pop';
  pop.style.top = r.bottom + 6 + 'px'; pop.style.left = Math.max(8, r.left) + 'px';
  pop.innerHTML = `<p class="pop-h">Create</p>` + NEW_MENU.map(([k, t]) => { const f = FORMS[k], ok = !f.roles || f.roles.includes(S.role); return `<button data-newform="${k}" ${ok ? '' : 'class="dis"'}><span class="pop-ic">${icon(f.icon)}</span><span>${t}${ok ? '' : `<small>${f.roles.map((x) => E.ROLES[x].title).join(', ')}</small>`}</span></button>`; }).join('');
  pop.addEventListener('click', (ev) => { const b = ev.target.closest('[data-newform]'); if (b) { closePop(); openForm(b.dataset.newform); } });
  document.body.appendChild(pop);
}
function fieldHtml(f, v, err) {
  const id = 'f-' + f.k, val = v ?? f.def ?? '';
  let input = '';
  if (f.type === 'select') input = `<select id="${id}" name="${f.k}">${f.options.map(([k, t]) => `<option value="${h(k)}"${String(k) === String(val) ? ' selected' : ''}>${h(t)}</option>`).join('')}</select>`;
  else if (f.type === 'checks') input = `<div class="checks">${f.options.map(([k, t]) => `<label><input type="checkbox" name="${f.k}" value="${h(k)}"${(Array.isArray(val) ? val : []).includes(k) ? ' checked' : ''}><span>${h(t)}</span></label>`).join('')}</div>`;
  else input = `<input id="${id}" name="${f.k}" type="${f.type}" value="${h(val)}"${f.min !== undefined ? ` min="${f.min}" step="any"` : ''} autocomplete="off">`;
  return `<div class="ff${err ? ' bad' : ''}"><label for="${id}">${h(f.label)}</label>${input}${err ? `<span class="ff-err">${h(err)}</span>` : f.hint ? `<span class="ff-hint">${h(f.hint)}</span>` : ''}</div>`;
}
function openForm(key, values = {}, errors = {}) {
  const f = FORMS[key], allowed = !f.roles || f.roles.includes(S.role);
  closeForm();
  const wrap = document.createElement('div');
  wrap.className = 'modal-back'; wrap.id = 'modal';
  wrap.innerHTML = `<form class="modal" novalidate><div class="modal-head"><span class="insp-glyph">${icon(f.icon)}</span><div><h3>${h(f.title)}</h3><p>${h(f.sub)}</p></div></div>
    <div class="modal-body">${f.fields().map((x) => fieldHtml(x, values[x.k], errors[x.k])).join('')}</div>
    <div class="modal-foot">${allowed ? `<span class="note">Submitted as ${h(me().name)}, ${h(E.TEAMS[me().team].name)} quota.</span>` : `<span class="note warn">${h(me().title)}s cannot do this. Needs ${h(f.roles.map((x) => E.ROLES[x].title).join(' or '))}.</span>`}<span class="spacer"></span><button type="button" class="btn" data-modal-cancel>Cancel</button><button type="submit" class="btn primary" ${allowed ? '' : 'disabled'}>${h(f.cta)}</button></div></form>`;
  document.body.appendChild(wrap);
  const form = wrap.querySelector('form');
  (form.querySelector('.ff.bad input, .ff.bad select') || form.querySelector('input:not([type=checkbox]), select'))?.focus();
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) closeForm(); });
  wrap.querySelector('[data-modal-cancel]').addEventListener('click', closeForm);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = {}, err = {};
    for (const x of f.fields()) {
      if (x.type === 'checks') v[x.k] = [...form.querySelectorAll(`input[name="${x.k}"]:checked`)].map((c) => c.value);
      else v[x.k] = (form.elements[x.k].value || '').trim();
      const empty = Array.isArray(v[x.k]) ? !v[x.k].length : v[x.k] === '';
      if ((x.req || x.type === 'number') && empty) err[x.k] = x.type === 'checks' ? 'Choose at least one.' : 'Required.';
      else if (x.minLen && v[x.k].length < x.minLen) err[x.k] = `At least ${x.minLen} characters.`;
      else if (x.type === 'number' && (!Number.isFinite(+v[x.k]) || +v[x.k] < (x.min ?? -Infinity))) err[x.k] = `Must be at least ${x.min}.`;
    }
    if (Object.keys(err).length) return openForm(key, v, err);
    const res = f.submit(v);
    if (res.error) return openForm(key, v, res.error);
    closeForm(); toast(res.ok);
    if (res.go) go(res.go); else render();
    renderChrome();
  });
}
function closeForm() { const m = $('#modal'); if (m) m.remove(); }

function openHelp(e) {
  e.stopPropagation(); closePop();
  const r = $('#btn-help').getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'popover'; pop.id = 'pop';
  pop.style.top = r.bottom + 6 + 'px'; pop.style.right = Math.max(8, innerWidth - r.right) + 'px';
  pop.innerHTML = `<button data-help="review"><span>Design review<small>What the platform owns and why it is built this way</small></span></button><button data-help="sdk"><span>SDK and API<small>Python SDK, REST and CLI</small></span></button><button data-help="capacity"><span>Capacity planner<small>Cost per token for any model and GPU</small></span></button><hr><button data-help="reset"><span>Reset workspace<small>Restore the sample fleet</small></span></button>`;
  pop.addEventListener('click', (ev) => { const b = ev.target.closest('[data-help]'); if (!b) return; closePop(); if (b.dataset.help === 'reset') { location.reload(); return; } go(b.dataset.help); });
  document.body.appendChild(pop);
}

/* ───────────────────────── events ───────────────────────── */

document.addEventListener('click', async (e) => {
  if ($('#app').hidden) return;
  const att = e.target.closest('[data-att]');
  if (att) { closePop(); const x = popSet[+att.dataset.att]; if (x) { x.set && x.set(); go(x.go); } return; }
  const inbox = e.target.closest('[data-inbox]');
  if (inbox) { const x = attention()[+inbox.dataset.inbox]; if (x) { x.set && x.set(); go(x.go); } return; }
  const t = e.target.closest('[data-toggle],[data-go],[data-act],[data-closedrawer],[data-drawer],[data-range]' + CLICKS.map(([a]) => `,[data-${a}]`).join(''));
  if (!t) return;
  if (t.dataset.toggle) { e.stopPropagation(); S.open.has(t.dataset.toggle) ? S.open.delete(t.dataset.toggle) : S.open.add(t.dataset.toggle); return renderChrome(); }
  if (t.dataset.closedrawer !== undefined) return closeDrawer();
  if (t.dataset.drawer) { const [k, v] = t.dataset.drawer.split(/:(.*)/s); openDrawer(k, v); return render(); }
  if (t.dataset.range) { S.range = t.dataset.range; return render(); }
  for (const [a, fn] of CLICKS) {
    const key = a.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (t.dataset[key] !== undefined) { const r = await fn(t.dataset[key], t, e); if (r !== false) render(); return; }
  }
  if (t.dataset.go) { e.preventDefault(); return go(t.dataset.go); }
  const act = ACTIONS[t.dataset.act];
  if (act) { await act(t); render(); renderChrome(); }
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.filter) { F_[t.dataset.filter] = t.value; render(); }
  if (t.dataset.bindLive) { bind(t); if (AFTER.live) AFTER.live(t); }
});
document.addEventListener('change', (e) => { const t = e.target; if (t.dataset.bind) { bind(t); render(); } });
function bind(t) {
  const path = (t.dataset.bind || t.dataset.bindLive).split('.');
  let o = S; for (const k of path.slice(0, -1)) o = o[k];
  const raw = t.type === 'checkbox' ? t.checked : t.value;
  o[path.at(-1)] = typeof raw === 'string' && raw !== '' && !isNaN(+raw) && t.dataset.num !== 'no' ? +raw : raw;
}

ACTIONS.export = (t) => {
  const k = t.dataset.key, rows = EXPORTS[k] ? EXPORTS[k]() : [];
  const url = URL.createObjectURL(new Blob([csv(rows)], { type: 'text/csv' }));
  const a = document.createElement('a'); a.href = url; a.download = `crucible-${k}-${date(Date.now())}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Exported ${fmt(Math.max(rows.length - 1, 0))} rows`);
};
ACTIONS.env = () => toast('Production is the only environment you can access. Staging requires the platform-admin group.');
ACTIONS.share = () => { try { navigator.clipboard.writeText(location.origin + location.pathname + '#' + S.view); } catch { /* clipboard blocked */ } toast('Link to this view copied'); };
ACTIONS.new = (t) => openForm(t.dataset.form, t.dataset.values ? JSON.parse(t.dataset.values) : {});

$('#btn-role').addEventListener('click', (e) => {
  e.stopPropagation(); closePop();
  const r = $('#btn-role').getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'popover'; pop.id = 'pop';
  pop.style.top = r.bottom + 6 + 'px'; pop.style.right = Math.max(8, innerWidth - r.right) + 'px';
  pop.innerHTML = Object.entries(E.ROLES).map(([k, x]) => `<button class="${k === S.role ? 'on' : ''}" data-role="${k}"><span class="av">${initials(x.name)}</span><span>${h(x.name)}<small>${h(x.title)}</small></span></button>`).join('') + `<hr><button data-role="__theme">${document.documentElement.dataset.theme === 'dark' ? 'Light appearance' : 'Dark appearance'}</button><button data-role="__out">Sign out</button><button data-role="__lock">Lock</button>`;
  pop.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-role]'); if (!b) return;
    closePop();
    if (b.dataset.role === '__theme') { const dk = document.documentElement.dataset.theme !== 'dark'; document.documentElement.dataset.theme = dk ? 'dark' : 'light'; try { localStorage.setItem('crucible.theme', dk ? 'dark' : 'light'); } catch { /* storage blocked */ } return render(); }
    if (b.dataset.role === '__out') { store.del('crucible.role'); return showSignin(); }
    if (b.dataset.role === '__lock') { store.del('crucible.role'); location.href = '/crucible/__logout'; return; }
    signIn(b.dataset.role);
  });
  document.body.appendChild(pop);
});
function closePop() { const p = $('#pop'); if (p) p.remove(); }
document.addEventListener('click', (e) => { if (!e.target.closest('#pop')) closePop(); });
$('#menu-btn').addEventListener('click', () => $('#side').classList.toggle('open'));
$('#btn-new').addEventListener('click', openNewMenu);
$('#btn-help').addEventListener('click', openHelp);
$('#btn-search').addEventListener('click', openPalette);
$('#btn-bell').addEventListener('click', openBell);
$('#btn-term').addEventListener('click', () => go('terminal'));
$('#btn-insp').addEventListener('click', () => { S.inspector = !S.inspector; layoutInspector(); });

/* ───────────────────────── home ───────────────────────── */

VIEWS.overview = () => {
  const F = ctx.F, r = me(), hr = new Date().getHours();
  const items = attention();
  const running = F.jobs.filter((j) => j.state === 'running' && j.kind !== 'eval');
  const total = E.CLUSTERS.reduce((a, cl) => a + cl.nodes * 8, 0);
  const trainGpus = running.reduce((a, j) => a + E.jobGpus(j), 0);
  const serveGpus = F.deps.reduce((a, d) => a + d.replicas * (d.cfg.tp + (d.cfg.disagg || 0)), 0);
  const now = F.deps.map((d) => [d, F.servingNow(d)]);
  const tokS = now.reduce((a, [, s]) => a + s.tpsAll, 0);
  const cost = now.reduce((a, [, s]) => a + s.cost * s.tpsAll, 0) / Math.max(tokS, 1);
  const gp = running.filter((j) => j.goodput).reduce((a, j) => a + j.goodput * E.jobGpus(j), 0) / Math.max(1, running.filter((j) => j.goodput).reduce((a, j) => a + E.jobGpus(j), 0));
  const runRow = (j) => {
    const p = F.perf(j), prog = j.kind === 'pretrain' ? F.tokensAt(j) / j.targetTokens : j.step / j.steps;
    return `<tr class="click" data-openrun="${j.id}"><td><b>${h(j.name)}</b><span class="id">${h(E.TEAMS[j.team].name)} · ${h(j.owner)}</span></td><td>${pill(j.kind === 'pretrain' ? 'blue' : j.kind === 'rl' ? 'purple' : '', j.kind === 'pretrain' ? 'Pretraining' : j.method || j.kind)}</td><td class="num">${fmt(E.jobGpus(j))}</td><td><div class="prog"><div style="width:${(prog * 100).toFixed(1)}%"></div></div><span class="id">${(prog * 100).toFixed(1)}%</span></td><td class="num">${j.kind === 'eval' ? 'n/a' : (p.mfu * 100).toFixed(1) + '%'}</td><td class="num">${si(p.tps)}/s</td></tr>`;
  };
  const reqs = now.reduce((a, [, s]) => a + s.total, 0);
  return head('Overview', `Acme Corp production · ${E.CLUSTERS.length} clusters · ${fmt(total)} GPUs · ${items.length ? `${items.length} item${items.length > 1 ? 's' : ''} need you` : 'nothing needs you'}`) + `
  <div class="grid">
    ${kpi2('Fleet allocated', fmt((trainGpus + serveGpus) / total * 100, 1) + '%', `${fmt(trainGpus)} training · ${fmt(serveGpus)} serving`, 2.4, 'alloc', (trainGpus + serveGpus) / total * 100)}
    ${kpi2('Training goodput', (gp * 100).toFixed(1) + '%', 'productive time / wall time', -0.3, 'goodput', gp * 100)}
    ${kpi2('Output tokens/s', si(tokS), `${si(reqs)} req/s · ${F.deps.length} deployments`, 6.8, 'tok', tokS)}
    ${kpi2('$ per 1M output tokens', usd(cost), 'blended, list GPU prices', -4.1, 'cost', cost, true)}
    <div class="card c12"><h3>Runtime efficiency <span class="right"><a href="#" data-go="kernels">Kernels and memory ›</a></span></h3><div class="rt-tiles">${[
      ['SM busy, training', '84%', 'gpu', 'bubbles and waits are the rest'],
      ['Tensor-core use, training', '41%', 'kernels', 'of FP8 peak, FA3 + FP8 GEMMs'],
      ['HBM bandwidth, decode', '79%', 'kernels', 'decode is memory-bound'],
      ['L2 hit, GEMMs', '78%', 'kernels', 'tile swizzling on'],
      ['KV cache in use', Math.round(now.reduce((a, [, x]) => a + x.kvActive + x.kvCached, 0) / now.length * 100) + '%', 'kv', 'active + cached prefixes'],
      ['FlashAttention-3', '100%', 'kernels', 'of attention kernels, all fleets'],
    ].map(([k, v, go, sub]) => `<button class="rt" data-go="${go}"><b>${v}</b><span>${k}</span><small>${sub}</small></button>`).join('')}</div></div>
    <div class="card c8"><h3>Needs your attention</h3>${items.length ? `<div class="inbox">${items.map((x, i) => `<button class="inbox-item" data-inbox="${i}"><span><b>${h(x.t)}</b><span>${h(x.m)}</span></span><i>›</i></button>`).join('')}</div>` : `<div class="empty"><b>You're all caught up.</b>Failures, SLO breaches and reviews for your role appear here.</div>`}</div>
    <div class="card c4"><h3>Serving SLOs <span class="right"><a href="#" data-go="deployments">All ›</a></span></h3><ul class="checks">${now.map(([d, s]) => { const q = p90(s), ok = q.ttft <= d.slo.ttft && q.itl <= d.slo.itl; return `<li data-opendep="${d.id}"><span class="tick ${ok ? 'ok' : 'no'}">${ok ? '✓' : '!'}</span><span class="grow1">${h(d.name)}</span><span class="id">${ms(q.ttft)} · ${ms(q.itl)}</span></li>`; }).join('')}</ul></div>
    <div class="card c12"><h3>Training now <span class="right"><a href="#" data-go="runs">All runs ›</a></span></h3><div class="scroll-x"><table class="table"><thead><tr><th>Run</th><th>Kind</th><th class="num">GPUs</th><th>Progress</th><th class="num">MFU</th><th class="num">Tokens</th></tr></thead><tbody>${running.map(runRow).join('')}</tbody></table></div></div>
    <div class="card c12"><h3>Recent events</h3><ul class="feed">${F.events.slice(0, 7).map((e) => `<li><span class="when">${ago(e.t)}</span><span>${pill(EV[e.kind] || '', e.kind)} <b>${h(e.subject)}</b> ${h(e.text)}</span></li>`).join('')}</ul></div>
  </div>`;
};

/* ───────────────────────── start ───────────────────────── */

try { const th = localStorage.getItem('crucible.theme'); if (th) document.documentElement.dataset.theme = th; } catch { /* storage blocked */ }
initChartHover();
const role = store.get('crucible.role');
if (role && E.ROLES[role]) signIn(role, true); else showSignin();
