/* Submissions dashboard: every job submitted from the CLI or this page, with
   its lifecycle, GPU placement (nodes, ranks, tensor-parallel groups), data
   shard distribution, CPU preprocessing, batch pipeline progress, spec and logs. */
import { E, $, h, fmt, si, gb, ms, ago, ctx, S, VIEWS, ACTIONS, CLICKS, head, pill, glist, seg, C, can, me, toast, ui } from './core.js?v=20261031-4';
import { FS, SUBS, jobCommands, parseYaml, validate } from './v-jobs.js?v=20261031-4';

const quiet = (via) => jobCommands({ out: () => {}, setLine: () => {}, pad: (x, n) => String(x).padEnd(n), lpad: (x, n) => String(x).padStart(n), flag: () => undefined, has: () => false, sleep: (t) => new Promise((r) => setTimeout(r, t)), openEditor: () => {}, lineCount: () => 0, via });
S.subsel = S.subsel || null; S.subtab = S.subtab || 'overview';
const LIFE = { TrainingJob: ['package', 'resolve', 'plan', 'data', 'preprocess', 'admission', 'placement', 'ray', 'launch'], RLJob: ['package', 'resolve', 'roles', 'placement', 'weights', 'ray'], BatchJob: ['package', 'input', 'ray'] };
const STATE = { running: 'live', succeeded: 'ok', rejected: 'deny', submitting: 'warn', 'dry run': '', stopped: '', cancelled: '' };
const tpCol = [C.blue, C.purple, C.teal, C.indigo, C.pink, C.amber, C.green, C.gray];

/* Seed: two past submissions so the page opens with history. */
let seeded = false;
async function seed() {
  if (seeded || SUBS.length) { seeded = true; return; }
  seeded = true;
  const q = jobCommands({ out: () => {}, setLine: () => {}, pad: (x, n) => String(x).padEnd(n), lpad: (x, n) => String(x).padStart(n), flag: () => undefined, has: () => false, sleep: () => Promise.resolve(), openEditor: () => {}, lineCount: () => 0, via: 'CLI' });
  await q.submitFile('jobs/embed-docs.yaml', false);
  await q.submitFile('jobs/sft-8b.yaml', false);
  SUBS.forEach((r, i) => { const back = (i + 1) * 47 * 6e4; r.t -= back; r.steps.forEach((st) => (st[2] -= back)); r.user = i ? 'Dev Patel' : 'Luis Ortega'; });
  S.subsel = SUBS[0].id; ui.render();
}

function lifecycle(r) {
  const keys = LIFE[r.kind] || [], done = new Set(r.steps.map((x) => x[0]));
  return `<div class="life">${keys.map((k) => { const st = r.steps.find((x) => x[0] === k); const cls = done.has(k) ? 'done' : r.active === k ? 'on' : r.state === 'rejected' ? 'off' : ''; return `<div class="lstep ${cls}"><i>${done.has(k) ? '✓' : ''}</i><b>${k}</b><small>${st ? new Date(st[2]).toLocaleTimeString('en-GB', { hour12: false }) : r.active === k ? 'running' : ''}</small></div>`; }).join('')}<div class="lstep ${r.state === 'running' || r.state === 'succeeded' ? 'done' : ''}"><i>${r.state === 'running' || r.state === 'succeeded' ? '●' : ''}</i><b>${r.state === 'succeeded' ? 'succeeded' : 'running'}</b><small></small></div></div>`;
}

function placement(t) {
  if (t.kind === 'train') {
    const show = Math.min(t.nodes, 16), g = 8 / t.tp;
    const nodes = t.names.slice(0, show).map((n, i) => {
      const cells = Array.from({ length: 8 }, (_, k) => { const rank = i * 8 + k, grp = Math.floor(k / t.tp); return `<i style="background:${t.tp > 1 ? tpCol[grp % tpCol.length] : C.blue}" title="rank ${rank}${t.tp > 1 ? `, TP group ${i * g + grp}, TP rank ${k % t.tp}` : ''}">${rank}</i>`; }).join('');
      const d0 = Math.floor(i * g * t.per), d1 = Math.floor((i + 1) * g * t.per) - 1;
      return `<div class="pnode"><div class="pn-h"><b class="mono">${h(n)}</b><span>ranks ${i * 8}-${i * 8 + 7}</span></div><div class="pgpus">${cells}</div><div class="pn-f">${t.tp > 1 ? `${g} TP group${g > 1 ? 's' : ''} of ${t.tp} · ` : ''}shards ${d0}-${d1}</div></div>`;
    }).join('');
    const cpu = Math.ceil(t.cpus / 64);
    return `<div class="pgrid">${nodes}</div>${t.nodes > show ? `<p class="note">${t.nodes - show} more nodes follow the same pattern.</p>` : ''}
      <div class="pcpu">${Array.from({ length: cpu }, (_, i) => `<div class="pnode cpu"><div class="pn-h"><b class="mono">${h(t.cluster.slice(0, 6))}-c${String(20 + i).padStart(3, '0')}</b><span>64 CPUs</span></div><div class="pn-f">${Math.round(t.cpus / cpu)} preprocessing tasks</div></div>`).join('')}</div>
      <div class="lin-foot">${t.tp > 1 ? Array.from({ length: g }, (_, k) => `<span class="lg"><i style="background:${tpCol[k]}"></i>TP group ${k} on each node</span>`).join('') : `<span class="lg"><i style="background:${C.blue}"></i>FSDP rank</span>`}<span class="spacer"></span><span>placement group: ${t.nodes} bundles {GPU: 8, CPU: 96}, STRICT_SPREAD</span></div>`;
  }
  if (t.kind === 'rl') {
    const rn = t.rollout / 8, tn = t.trainer / 8, show = (n) => Math.min(n, 8);
    const block = (n, off, label, color, per) => Array.from({ length: show(n) }, (_, i) => `<div class="pnode"><div class="pn-h"><b class="mono">${h(t.names[off + i])}</b><span>${label}</span></div><div class="pgpus">${Array.from({ length: 8 }, (_, k) => `<i style="background:${per ? tpCol[Math.floor(k / per) % 4] : color}">${per ? 'E' + (i * (8 / per) + Math.floor(k / per)) : k}</i>`).join('')}</div></div>`).join('');
    return `<h4 class="insp-h">Rollout pool: ${t.engines} × ${h(t.engine)} engines, TP ${t.tpE}</h4><div class="pgrid">${block(rn, 0, 'rollout', C.blue, t.tpE)}</div>${rn > 8 ? `<p class="note">${rn - 8} more rollout nodes.</p>` : ''}
      <h4 class="insp-h">Trainer: FSDP over ${t.trainer} GPUs, reference model colocated</h4><div class="pgrid">${block(tn, rn, 'trainer', C.purple)}</div>${tn > 8 ? `<p class="note">${tn - 8} more trainer nodes.</p>` : ''}
      <h4 class="insp-h">Verifier sandboxes: ${fmt(t.sandboxes)} CPU actors on ${Math.ceil(t.sandboxes / 64)} nodes</h4><div class="sbx">${Array.from({ length: Math.min(256, t.sandboxes / 4) }, () => '<i></i>').join('')}</div>`;
  }
  return `<div class="bflow">${t.stages.map((st, i) => `<div class="bop"><div class="bop-h"><b>${h(st.stage)}</b><span>${st.gpus ? `${st.gpus} × ${E.HW[st.gpuType || 'l40s'].name} · actors` : `${st.cpus} CPU tasks`}</span></div><div class="prog"><div style="width:${(st.frac * 100).toFixed(0)}%"></div></div><small>${(st.frac * 100).toFixed(0)}% · ${si(t.rows * st.frac)} rows${st.backpressure ? ' · backpressure' : ''}</small></div>${i < t.stages.length - 1 ? '<span class="barrow">→</span>' : ''}`).join('')}</div>
    <p class="note">Streaming execution: every operator runs at once; rows flow through object-store blocks. When the GPU embed stage falls behind, Ray Data slows the readers instead of buffering everything in memory.</p>`;
}

function dataView(t) {
  if (t.kind === 'batch') return glist([['Input', `<span class="mono">${h(t.input)}</span>`], ['Rows', si(t.rows)], ['Output', `<span class="mono">${h(t.output)}</span>`], ['CPUs / GPUs', `${t.cpus} / ${t.gpus}`]]);
  if (t.kind === 'rl') return glist([['Prompts', h(t.dataset)], ['Per step', 'prompts sharded across rollout engines; samples gathered by the driver'], ['Rewards', `${fmt(t.sandboxes)} sandboxes behind a queue`]]);
  const ranks = Math.min(t.dp, 32), shardsShow = Math.min(t.shards, 128);
  const strip = Array.from({ length: shardsShow }, (_, k) => { const r = Math.floor(k / t.per); return `<i style="background:${tpCol[r % tpCol.length]};opacity:${0.45 + 0.55 * ((r % 3) / 2)}" title="shard ${k} → rank ${r}"></i>`; }).join('');
  return `<div class="shardstrip">${strip}</div><p class="note">${fmt(t.shards)} shards of ${h(t.dataset)} over ${t.dp} data-parallel ranks, ${t.per % 1 ? t.per.toFixed(1) : t.per} each. Order is a seeded permutation per epoch; position is saved in every checkpoint.</p>
    <table class="table"><thead><tr><th>DP rank</th><th>GPUs</th><th>Node</th><th>Shards</th><th class="num">Tokens / epoch</th></tr></thead><tbody>${Array.from({ length: Math.min(ranks, 10) }, (_, r) => `<tr><td class="mono">${r}</td><td class="mono">${r * t.tp}${t.tp > 1 ? `-${r * t.tp + t.tp - 1}` : ''}</td><td class="mono">${h(t.names[Math.floor(r * t.tp / 8)])}</td><td class="mono">${Math.floor(r * t.per)}-${Math.floor((r + 1) * t.per) - 1}</td><td class="num">${si((E.DATASETS.find((d) => d.id === t.dataset) || { tokens: 0 }).tokens / t.dp)}</td></tr>`).join('')}</tbody></table>`;
}

VIEWS.jobs = () => {
  seed();
  if (!SUBS.some((r) => r.id === S.subsel)) S.subsel = SUBS[0]?.id;
  const r = SUBS.find((x) => x.id === S.subsel);
  const job = r && r.jobId ? ctx.F.job(r.jobId) : null;
  const state = job && job.state !== 'running' ? job.state : r ? r.state : '';
  const list = SUBS.map((x) => { const j = x.jobId && ctx.F.job(x.jobId), st = j && j.state !== 'running' ? j.state : x.state; return `<button class="lcm-row nodot${x.id === S.subsel ? ' on' : ''}" data-subsel="${x.id}"><span><b>${h(x.name || x.file)}</b><small>${h(x.kind)} · ${x.gpus} GPUs · ${h(x.user)} via ${x.via} · ${ago(x.t)}</small></span><span class="badge ${STATE[st] === 'deny' ? 'deny' : STATE[st] === 'live' ? 'blue' : STATE[st] === 'ok' ? 'ok' : ''}">${st}</span></button>`; }).join('');
  if (!r) return head('Submissions', 'Jobs submitted from the CLI, SDK or this page.') + `<div class="grid"><div class="card c12"><div class="empty"><b>Loading submissions…</b></div></div></div>`;
  const t = r.topo;
  const tabs = [['overview', 'Overview'], ['placement', 'Placement'], ['data', 'Data'], ['spec', 'Spec'], ['logs', 'Logs']];
  let body = '';
  if (S.subtab === 'overview') body = `${lifecycle(r)}${r.issues.length ? `<div class="lcm-banner ${r.state === 'rejected' ? 'deny' : 'warn'}">${r.issues.map(([lvl, msg, ln]) => `<div><b>${lvl === 'error' ? 'Error' : 'Warning'}</b> ${h(r.file)}:${ln} ${h(msg)}</div>`).join('')}</div>` : ''}
    ${t ? `<div class="lcm-tiles">${t.kind === 'train' ? `<div class="lcm-tile"><span>GPUs</span><b>${t.gpus}</b><small>${t.nodes} nodes · ${E.HW[t.hw].name}</small></div><div class="lcm-tile"><span>Layout</span><b>TP ${t.tp} · DP ${t.dp}</b><small>FSDP within DP</small></div><div class="lcm-tile"><span>Memory / GPU</span><b>${gb(t.mem)}</b><small>planned</small></div><div class="lcm-tile"><span>Shards / rank</span><b>${t.per % 1 ? t.per.toFixed(1) : t.per}</b><small>${fmt(t.shards)} total</small></div><div class="lcm-tile"><span>CPU preprocessing</span><b>${t.cpus}</b><small>Ray Data tasks</small></div><div class="lcm-tile"><span>Modeled</span><b>${si(t.tps)}/s</b><small>MFU ${(t.mfu * 100).toFixed(0)}%</small></div>` : t.kind === 'rl' ? `<div class="lcm-tile"><span>GPUs</span><b>${t.gpus}</b><small>${t.rollout} rollout · ${t.trainer} trainer</small></div><div class="lcm-tile"><span>Engines</span><b>${t.engines}</b><small>${h(t.engine)} TP ${t.tpE}</small></div><div class="lcm-tile"><span>Sandboxes</span><b>${fmt(t.sandboxes)}</b><small>CPU actors</small></div>` : `<div class="lcm-tile"><span>Rows</span><b>${si(t.rows)}</b><small>input</small></div><div class="lcm-tile"><span>CPUs</span><b>${t.cpus}</b><small>read, chunk, write</small></div><div class="lcm-tile"><span>GPUs</span><b>${t.gpus}</b><small>embedding actors</small></div><div class="lcm-tile"><span>Progress</span><b>${Math.round(t.stages.at(-1).frac * 100)}%</b><small>written</small></div>`}</div>
    <div class="card-sub"><h4>Placement</h4>${placement(t)}</div>` : ''}`;
  if (S.subtab === 'placement') body = t ? placement(t) : '<p class="note">Not placed.</p>';
  if (S.subtab === 'data') body = t ? dataView(t) : '<p class="note">No data plan.</p>';
  if (S.subtab === 'spec') body = `<pre class="code">${h(r.text)}</pre>`;
  if (S.subtab === 'logs') { const ev = r.jobId ? ctx.F.events.filter((e) => e.subject === r.jobId) : []; body = `<pre class="code">${h([...r.steps.map(([k, x, tt]) => `${new Date(tt).toISOString().slice(11, 19)}  ${k.padEnd(12)} ${x}`), ...ev.reverse().map((e) => `${new Date(e.t).toISOString().slice(11, 19)}  ${e.kind.padEnd(12)} ${e.text}`)].join('\n'))}</pre>`; }
  return head('Submissions', 'Every job submitted from the CLI, the SDK or this page, and exactly how it was placed: nodes, ranks, tensor-parallel groups, data shards and CPU preprocessing.') + `
  <div class="grid"><div class="card c12 lcm"><div class="lcm-list"><button class="btn primary" data-act="sub-new">Submit job</button><div class="lcm-rows">${list}</div></div>
    <div class="lcm-detail"><div class="lcm-head"><div><h2>${h(r.name || r.file)} <span>${pill(STATE[state] || '', state)}</span></h2><p>${h(r.kind)} · <span class="mono">${h(r.file)}</span> · ${h(r.user)} via ${r.via} · ${new Date(r.t).toLocaleString('en-GB', { hour12: false })}${r.team ? ` · ${h(E.TEAMS[r.team] ? E.TEAMS[r.team].name : r.team)}` : ''}</p></div><div class="row">${job ? `<button class="btn" data-openrun="${job.id}">Open run</button>` : ''}${job && job.state === 'running' ? `<button class="btn danger" data-act="sub-cancel">Cancel</button>` : ''}<button class="btn" data-act="sub-resubmit">Edit and resubmit</button></div></div>
    ${seg('subtab', S.subtab, tabs)}${body}</div></div></div>`;
};
CLICKS.push(['subsel', (id) => { S.subsel = id; }]);
CLICKS.push(['subtab', (k) => { S.subtab = k; }]);
ACTIONS['sub-cancel'] = () => { const r = SUBS.find((x) => x.id === S.subsel), j = r && ctx.F.job(r.jobId); if (!j) return; j.state = 'stopped'; ctx.F.event(Date.now(), j.id, 'rollback', `Cancelled by ${me().name} from Submissions; checkpoint saved, ${E.jobGpus(j)} GPUs released.`); toast(`${j.id} cancelled; GPUs released`); ui.renderChrome(); };
ACTIONS['sub-new'] = () => openSubmit('jobs/sft-8b.yaml');
ACTIONS['sub-resubmit'] = () => { const r = SUBS.find((x) => x.id === S.subsel); openSubmit(r ? r.file : 'jobs/sft-8b.yaml'); };

/* Submit from the UI: pick or paste a spec, validate inline, submit through the same pipeline as the CLI. */
function openSubmit(file) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-back'; wrap.id = 'modal';
  const files = Object.keys(FS).filter((f) => f.endsWith('.yaml') && f.startsWith('jobs/'));
  wrap.innerHTML = `<div class="modal ed"><div class="modal-head"><div><h3>Submit job</h3><p>Same spec format and pipeline as <code>crucible job submit</code>. Validation runs as you type.</p></div></div>
    <div class="ed-bar"><select id="sub-file">${files.map((f) => `<option${f === file ? ' selected' : ''}>${h(f)}</option>`).join('')}</select><span id="sub-check" class="note"></span></div>
    <textarea class="ed-ta" id="sub-ta" spellcheck="false">${h(FS[file] || '')}</textarea>
    <div class="modal-foot"><span class="note">Saves to the workspace and submits as ${h(me().name)}.</span><span class="spacer"></span><button class="btn" data-x>Cancel</button><button class="btn" data-dry>Dry run</button><button class="btn primary" data-go-sub>Submit</button></div></div>`;
  document.body.appendChild(wrap);
  const ta = $('#sub-ta'), sel = $('#sub-file'), chk = $('#sub-check');
  const check = () => { try { const { doc, lineOf } = parseYaml(ta.value); const v = validate(doc, lineOf); chk.innerHTML = v.errors ? `<span class="dv-down">✗ ${h(v.issues.filter((x) => x[0] === 'error').map((x) => `line ${x[2]}: ${x[1]}`).join(' · '))}</span>` : `<span class="dv-up">✓ valid ${h(doc.kind)}, ${v.gpus} GPUs</span>${v.issues.length ? ` · ${v.issues.length} warning${v.issues.length > 1 ? 's' : ''}` : ''}`; return !v.errors; } catch (e) { chk.innerHTML = `<span class="dv-down">✗ ${h(e.message)}</span>`; return false; } };
  check();
  ta.addEventListener('input', check);
  ta.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); } });
  sel.addEventListener('change', () => { ta.value = FS[sel.value]; check(); });
  const close = () => wrap.remove();
  wrap.querySelector('[data-x]').addEventListener('click', close);
  const go = async (dry) => {
    if (!check()) return;
    FS[sel.value] = ta.value; close();
    S.subtab = 'overview';
    const p = quiet('UI').submitFile(sel.value, dry);
    await new Promise((res) => setTimeout(res, 30));
    S.subsel = SUBS[0].id; ui.render();
    toast(dry ? 'Dry run planned' : 'Submitted; watch it place on the fleet');
    await p; ui.render(); ui.renderChrome();
  };
  wrap.querySelector('[data-dry]').addEventListener('click', () => go(true));
  wrap.querySelector('[data-go-sub]').addEventListener('click', () => go(false));
}
