/* Compute views: fleet (clusters, node health), queue and quotas, Ray clusters. */
import { E, h, fmt, si, gb, dur, ago, ctx, S, VIEWS, ACTIONS, CLICKS, DRAWERS, head, pill, glist, stack, seg, C, can, me, toast, ui } from './core.js?v=20261031-3';

const XID = [['XID 79', 'GPU fell off the bus'], ['XID 48', 'Double-bit ECC error'], ['XID 94', 'Contained ECC error, row remap pending'], ['NVLink', 'Link 7 down, CRC errors'], ['IB', 'Port flapping, 14 link-downs in 1 h'], ['Thermal', 'GPU 5 throttling at 87 °C']];

/* ───────────────────────── fleet ───────────────────────── */

VIEWS.fleet = () => {
  const F = ctx.F, cl = E.CLUSTERS.find((c) => c.id === S.cluster) || E.CLUSTERS[0];
  const nodes = E.clusterNodes(cl, F.jobs);
  const tally = (c) => { const n = E.clusterNodes(c, F.jobs); return { busy: n.filter((x) => x.job).length, failed: n.filter((x) => x.state === 'failed').length, drain: n.filter((x) => x.state === 'draining').length, spare: n.filter((x) => x.state === 'spare').length, idle: n.filter((x) => x.state === 'idle').length }; };
  const jobs = [...new Set(nodes.filter((x) => x.job).map((x) => x.job))];
  const jc = [C.blue, C.purple, C.teal, C.indigo, C.pink];
  const color = (x) => (x.job ? jc[jobs.indexOf(x.job) % jc.length] : x.state === 'failed' ? C.red : x.state === 'draining' ? C.amber : x.state === 'spare' ? C.green : 'var(--fill-2)');
  const bad = nodes.filter((x) => x.state === 'failed' || x.state === 'draining');
  const t = tally(cl);
  return head('Fleet', 'Every GPU node across clusters: what runs where, what is broken and what is held as a spare.', 'Nodes pass burn-in (GPU stress, NCCL all-reduce tests, IB link checks) before they join. Health agents watch XID errors, ECC, NVLink and InfiniBand counters; a failing node is cordoned, drained and sent to repair with a diagnostic bundle, and a hot spare replaces it in running jobs. About 2% of each cluster is held as spares.') + `
  <div class="grid">${E.CLUSTERS.map((c) => { const x = tally(c); return `<button class="card c3 cl-card${c.id === cl.id ? ' on' : ''}" data-cluster="${c.id}"><b>${h(c.id)}</b><span>${fmt(c.nodes * 8)} × ${h(E.HW[c.hw].name)} · ${h(c.region)}</span><div class="prog"><div style="width:${(x.busy / c.nodes * 100).toFixed(0)}%"></div></div><small>${(x.busy / c.nodes * 100).toFixed(0)}% allocated · ${x.failed + x.drain} unhealthy · ${x.spare} spares</small></button>`; }).join('')}
    <div class="card c12"><h3>${h(cl.id)} <span class="right">${fmt(cl.nodes)} nodes · ${h(cl.fabric)}</span></h3>
      <div class="nodegrid">${nodes.map((x) => `<i style="background:${color(x)}" data-drawer="fnode:${cl.id}|${x.i}" title="n${String(x.i).padStart(4, '0')} ${x.job || x.state}"></i>`).join('')}</div>
      <div class="lin-foot">${jobs.map((j, i) => `<span class="lg"><i style="background:${jc[i % jc.length]}"></i>${h(F.job(j).name)}</span>`).join('')}<span class="lg"><i style="background:${C.green}"></i>Hot spare</span><span class="lg"><i style="background:var(--fill-2)"></i>Idle</span><span class="lg"><i style="background:${C.amber}"></i>Draining</span><span class="lg"><i style="background:${C.red}"></i>Failed</span></div></div>
    <div class="card c7"><h3>Unhealthy nodes</h3>${bad.length ? `<table class="table"><thead><tr><th>Node</th><th>Signal</th><th>State</th><th></th></tr></thead><tbody>${bad.map((x, i) => { const [k, v] = XID[i % XID.length], fixed = (F.repaired || new Set()).has(cl.id + x.i); return `<tr><td class="mono">${cl.id.slice(0, 6)}-n${String(x.i).padStart(4, '0')}</td><td><b>${k}</b> <span class="note">${h(v)}</span></td><td>${fixed ? pill('ok', 'Returned to pool') : pill(x.state === 'failed' ? 'deny' : 'warn', x.state === 'failed' ? 'In repair' : 'Draining')}</td><td>${fixed ? '' : `<button class="btn" data-repair="${cl.id}|${x.i}" ${can('sre', 'platform') ? '' : 'disabled'}>${x.state === 'failed' ? 'Mark repaired' : 'Finish drain'}</button>`}</td></tr>`; }).join('')}</tbody></table>` : '<p class="note">All nodes healthy.</p>'}</div>
    <div class="card c5"><h3>Capacity</h3>${stack([['Running jobs', t.busy, C.blue], ['Hot spares', t.spare, C.green], ['Idle', t.idle, C.gray], ['Unhealthy', t.failed + t.drain, C.red]], (v) => fmt(v) + ' nodes')}
      ${glist([['Node MTBF', '1,500 h (trailing 90 days)'], ['Mean time to replace', '94 s with a hot spare'], ['Repair turnaround', '2.1 days'], ['Burn-in before join', 'GPU stress, NCCL tests, IB checks']])}</div>
  </div>`;
};
CLICKS.push(['cluster', (id) => { S.cluster = id; }]);
CLICKS.push(['repair', (id) => { (ctx.F.repaired ||= new Set()).add(id.replace('|', '')); ctx.F.event(Date.now(), id.split('|')[0], 'recovered', `Node n${id.split('|')[1].padStart(4, '0')} passed burn-in and returned to the pool (${me().name}).`); toast('Node passed burn-in and returned to the pool'); }]);
DRAWERS.fnode = (id) => {
  const [cid, i] = id.split('|'), cl = E.CLUSTERS.find((c) => c.id === cid), x = E.clusterNodes(cl, ctx.F.jobs)[+i];
  const j = x.job && ctx.F.job(x.job);
  return { title: `${cid.slice(0, 6)}-n${String(i).padStart(4, '0')}`, sub: `${cid} · rack ${Math.floor(i / 16) + 1}, rail group ${Math.floor(i / 32) + 1}`, glyph: 'compute', body: glist([['State', j ? pill('live', 'Running') : pill(x.state === 'failed' ? 'deny' : x.state === 'spare' ? 'ok' : '', x.state)], ['Job', j ? h(j.name) : 'none'], ['GPUs', `8 × ${E.HW[cl.hw].name}, ${E.HW[cl.hw].mem} GB`], ['Interconnect', `NVLink within node · ${h(cl.fabric)}`], ['Driver', 'R570, CUDA 12.8, NCCL 2.26'], ['Last burn-in', `${3 + (i % 20)} days ago`]]) + (j ? `<div class="row"><button class="btn" data-openrun="${j.id}">Open ${h(j.name)}</button></div>` : '') };
};

/* ───────────────────────── queue and quotas ───────────────────────── */

VIEWS.queue = () => {
  const F = ctx.F;
  const usage = Object.fromEntries(Object.keys(E.TEAMS).map((k) => [k, 0]));
  for (const j of F.jobs.filter((x) => x.state === 'running')) usage[j.team] += E.jobGpus(j);
  for (const d of F.deps) usage[d.team] += d.replicas * (d.cfg.tp + (d.cfg.disagg || 0));
  const queued = F.jobs.filter((j) => j.state === 'queued');
  return head('Queue and quotas', 'Each team has a guaranteed GPU quota. Idle quota can be borrowed and is reclaimed by preemption, with a checkpoint first, when the owner needs it back.', 'Admission is gang-scheduled: a job starts only when every GPU it needs is free in one topology domain, so a 256-GPU job never runs on 255. Priority classes: P0 (never preempted), P1, P2 (preemptible), Batch (fills idle capacity). Preemption sends SIGTERM, the job saves an async checkpoint within 60 s, then the pods are evicted.') + `
  <div class="grid"><div class="card c12"><h3>Pending</h3>${queued.length ? `<table class="table"><thead><tr><th>Job</th><th>Team</th><th>Priority</th><th class="num">GPUs</th><th>Waiting</th><th>Reason</th><th></th></tr></thead><tbody>${queued.map((j) => `<tr><td><b>${h(j.name)}</b><span class="id">${h(j.id)}</span></td><td>${h(E.TEAMS[j.team].name)}</td><td>${pill(j.priority === 'P0' ? 'deny' : j.priority === 'P1' ? 'warn' : '', j.priority)}</td><td class="num">${fmt(E.jobGpus(j))}</td><td>${dur(j.wait || 60)}</td><td class="small">${E.jobGpus(j) >= 32 ? 'Team quota in use; waiting to borrow 32 GPUs in one rail group from Research' : 'Waiting for nodes in one rail group'}</td><td><button class="btn" data-admit="${j.id}" ${can('manager', 'platform') ? '' : 'disabled title="Engineering manager or platform engineer"'}>Raise to P1 and borrow</button></td></tr>`).join('')}</tbody></table>` : '<p class="note">Nothing waiting. New jobs admit immediately while quota is free.</p>'}</div>
    <div class="card c12"><h3>Team quotas</h3><table class="table"><thead><tr><th>Team</th><th>Lead</th><th class="num">Guaranteed</th><th class="num">In use</th><th>Usage</th><th>Borrowing</th></tr></thead><tbody>${Object.entries(E.TEAMS).map(([k, t]) => { const u = usage[k], over = u > t.quota; return `<tr><td><b>${h(t.name)}</b></td><td>${h(t.lead)}</td><td class="num">${fmt(t.quota)}</td><td class="num">${fmt(u)}</td><td><div class="quota"><i style="width:${Math.min(100, u / t.quota * 100).toFixed(0)}%" class="${over ? 'over' : ''}"></i></div></td><td>${over ? pill('warn', `Borrowing ${fmt(u - t.quota)}`) : u < t.quota * 0.6 ? pill('ok', `Lending ${fmt(t.quota - u)}`) : pill('', 'Within quota')}</td></tr>`; }).join('')}</tbody></table>
      <p class="note">Serving replicas count against the owning team's quota. Borrowed GPUs run at P2 and are the first preempted when a lender needs capacity back.</p></div></div>`;
};
CLICKS.push(['admit', (id) => { const j = ctx.F.job(id); if (!j || j.state !== 'queued') return; j.priority = 'P1'; j.state = 'running'; j.started = Date.now(); ctx.F.event(Date.now(), id, 'admitted', `Raised to P1 by ${me().name}; borrowed ${E.jobGpus(j)} GPUs from Research quota and admitted.`); toast(`${j.name} admitted`); ui.renderChrome(); }]);

/* ───────────────────────── Ray clusters ───────────────────────── */

function actorGroups(j) {
  const a = E.ARCH[j.arch];
  if (j.rl) return [
    ['Driver', 'RLController', 1, '4 CPU', 'Head node', 'Single controller: schedules steps, gathers metrics'],
    ['Rollout', `${j.rl.engine.split(' ')[0]}Engine`, j.rl.rolloutGpus / 4, '4 GPU each', 'STRICT_PACK per engine', 'Generates samples; receives weights each step'],
    ['Trainer', 'FSDPWorker', j.rl.trainGpus, '1 GPU each', 'PACK across nodes', 'Policy update; reference model colocated, offloaded between phases'],
    ['Verifier', 'SandboxPool', j.rl.verifiers, '1 CPU each', 'SPREAD on CPU nodes', 'Runs model code and checks answers with a 20 s timeout'],
    ['Data', 'PromptLoader', 8, '2 CPU each', 'SPREAD', 'Ray Data streaming prompts with backpressure'],
  ];
  return [
    ['Driver', 'TrainController', 1, '4 CPU', 'Head node', 'Ray Train controller: worker group, restarts, checkpoints'],
    ['Trainer', 'TorchWorker', E.jobGpus(j), '1 GPU each', j.cfg.tp > 1 ? 'STRICT_PACK per TP group' : 'PACK', `torch.distributed ranks; ${a.name}`],
    ['Data', 'DataShard', j.cfg.dp, '4 CPU each', 'SPREAD', 'Ray Data shards feeding each data-parallel rank'],
  ];
}
VIEWS.ray = () => {
  const F = ctx.F, live = F.jobs.filter((j) => j.state === 'running' && j.kind !== 'eval');
  if (!live.some((j) => j.id === S.ray)) S.ray = live[0]?.id;
  const j = F.job(S.ray), groups = actorGroups(j);
  const actors = groups.reduce((a, g) => a + g[2], 0);
  return head('Ray clusters', 'Each job runs on its own Ray cluster on Kubernetes (KubeRay). Actors map to the job\'s roles; placement groups reserve GPUs atomically so a gang starts together.', 'The head runs the GCS with fault tolerance backed by an external Redis, so a head restart does not kill workers. Large tensors move between actors over NCCL rather than the object store; the object store carries control data, prompts and metrics. Worker failures restart the actor and the job resumes from its last checkpoint.') + `
  <div class="grid"><div class="card c12"><table class="table"><thead><tr><th>Ray cluster</th><th>Job</th><th>Ray</th><th class="num">Actors</th><th class="num">GPUs</th><th>Object store</th><th>GCS</th></tr></thead><tbody>${live.map((x) => `<tr class="click${x.id === S.ray ? ' sel' : ''}" data-raysel="${x.id}"><td class="mono">ray-${h(x.id)}</td><td>${h(x.name)}</td><td>2.49</td><td class="num">${fmt(actorGroups(x).reduce((a, g) => a + g[2], 0))}</td><td class="num">${fmt(E.jobGpus(x))}</td><td>${(18 + (x.id.length % 7) * 4)}% of ${x.rl ? '1.2 TB' : '640 GB'}</td><td>${pill('ok', 'FT on, Redis')}</td></tr>`).join('')}</tbody></table></div>
    <div class="card c12"><h3>${h(j.name)} <span class="right">${fmt(actors)} actors</span></h3><table class="table"><thead><tr><th>Role</th><th>Actor class</th><th class="num">Count</th><th>Resources</th><th>Placement</th><th>Does</th><th>Health</th></tr></thead><tbody>${groups.map((g) => `<tr><td><b>${g[0]}</b></td><td class="mono">${g[1]}</td><td class="num">${fmt(g[2])}</td><td>${g[3]}</td><td>${g[4]}</td><td class="small">${h(g[5])}</td><td>${pill('ok', `${fmt(g[2])} alive`)}</td></tr>`).join('')}</tbody></table>
    ${j.rl ? `<p class="note">Weight sync runs over NCCL between trainer and rollout actors (${h(j.rl.sync)}), outside the object store: ${gb(E.ARCH[j.arch].params * 2)} per step in ${F.rlBreakdown(j).sync.toFixed(1)} s.</p>` : ''}</div></div>`;
};
CLICKS.push(['raysel', (id) => { S.ray = id; }]);
