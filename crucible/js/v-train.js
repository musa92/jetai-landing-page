/* Training views: runs (pretraining, post-training, RL, eval) with detail
   tabs, the parallelism planner and training datasets. */
import { E, $, h, fmt, si, gb, ms, dur, ago, usd, ctx, S, VIEWS, ACTIONS, CLICKS, DRAWERS, EV, EXPORTS, head, pill, glist, stack, seg, C, xyChart, can, roleNote, me, toast, ui, sleep, icon, match, F_ } from './core.js?v=20261031-4';
import { tsChart } from './charts.js?v=20261031-4';

const KIND = { pretrain: ['blue', 'Pretraining'], post: ['', 'Post-training'], rl: ['purple', 'RL'], eval: ['', 'Evaluation'] };
const STATE = { running: 'live', queued: 'pending', succeeded: 'ok', failed: 'deny', stopped: '' };
const FILTERS = { all: ['All', () => true], pretrain: ['Pretraining', (j) => j.kind === 'pretrain'], post: ['Post-training', (j) => j.kind === 'post'], rl: ['RL', (j) => j.kind === 'rl'], eval: ['Eval', (j) => j.kind === 'eval'] };
const layout = (c) => [`TP ${c.tp}`, c.pp > 1 ? `PP ${c.pp}${c.vpp > 1 ? `×${c.vpp}` : ''}` : '', (c.cp || 1) > 1 ? `CP ${c.cp}` : '', `${c.zero >= 3 ? 'FSDP' : 'DP'} ${c.dp}`].filter(Boolean).join(' · ');
const slowF = (j) => (j.straggler ? 1 + j.straggler.slow / 100 : 1);
const progress = (F, j) => (j.kind === 'pretrain' ? F.tokensAt(j) / j.targetTokens : j.step / j.steps);


/* ───────────────────────── runs list + detail ───────────────────────── */

function runsView(preset) {
  const F = ctx.F;
  const filter = preset === 'rl' ? 'rl' : S.runFilter;
  const rows = F.jobs.filter(FILTERS[filter][1]).filter((j) => match('runs', j.name, j.id, j.method, j.owner, E.TEAMS[j.team].name, E.ARCH[j.arch].name, j.state));
  if (!rows.some((j) => j.id === S.run)) S.run = rows[0]?.id;
  const j = F.job(S.run);
  const title = preset === 'rl' ? head('RL runs', 'Reinforcement learning on Ray: rollouts on an inference engine, rewards from verifiers, training on FSDP, weights synced every step.') : head('Runs', 'Every training job on the fleet: pretraining, post-training, RL and evaluation. Select a run to see its loss, throughput, layout and checkpoints.');
  const list = rows.map((x) => {
    const p = progress(F, x);
    const badge = x.state === 'failed' ? '<span class="badge deny">Failed</span>' : x.state === 'queued' ? '<span class="badge">Queued</span>' : x.straggler ? '<span class="badge warn">Straggler</span>' : x.state === 'succeeded' ? '<span class="badge ok">Done</span>' : `<em>${(p * 100).toFixed(0)}%</em>`;
    return `<button class="lcm-row nodot${x.id === S.run ? ' on' : ''}" data-openrun="${x.id}"><span><b>${h(x.name)}</b><small>${KIND[x.kind][1]}${x.method ? ' · ' + x.method : ''} · ${fmt(E.jobGpus(x))} GPUs</small></span>${badge}</button>`;
  }).join('');
  return title + `<div class="grid"><div class="card c12 lcm"><div class="lcm-list"><label class="search lsearch">${icon('search')}<input data-filter="runs" value="${h(F_['runs'] || '')}" placeholder="Search runs, owners, models"></label>${preset === 'rl' ? '' : seg('runfilter', filter, Object.entries(FILTERS).map(([k, [t]]) => [k, t]))}<div class="lcm-rows">${list || '<p class="note">No runs match.</p>'}</div></div><div class="lcm-detail">${j ? runDetail(j) : ''}</div></div></div>`;
}
VIEWS.runs = () => runsView('all');
VIEWS.rl = () => runsView('rl');
CLICKS.push(['openrun', (id) => { S.run = id; const j = ctx.F.job(id); if (S.view !== 'runs' && S.view !== 'rl') ui.go(j.kind === 'rl' ? 'rl' : 'runs'); }]);
CLICKS.push(['runfilter', (k) => { S.runFilter = k; }]);
CLICKS.push(['runtab', (k) => { S.runTab = k; }]);

function runDetail(j) {
  const F = ctx.F, a = E.ARCH[j.arch], hw = E.HW[j.cfg.hw];
  const tabs = j.kind === 'eval' ? [['overview', 'Overview'], ['events', 'Events'], ['config', 'Config']] : [['overview', 'Overview'], ['performance', 'Performance'], ['parallelism', 'Parallelism'], ['checkpoints', 'Checkpoints'], ['events', 'Events'], ['config', 'Config']];
  if (!tabs.some(([k]) => k === S.runTab)) S.runTab = 'overview';
  const p = F.perf(j), seqs = j.cfg.micro * j.cfg.accum * j.cfg.dp;
  const actions = [];
  if (j.state === 'running' && j.kind !== 'eval') actions.push(`<button class="btn" data-act="ckpt-now">Checkpoint now</button>`);
  if (j.state === 'running' && j.kind === 'pretrain') actions.push(`<button class="btn" data-act="inject-failure" ${can('sre', 'platform') ? '' : 'disabled title="SRE or platform engineer"'}>Simulate node failure</button>`);
  if (j.state === 'failed') actions.push(`<button class="btn primary" data-act="clone-fix">Clone with fix</button>`);
  if (j.state === 'succeeded') actions.push(`<button class="btn primary" data-go="registry">Open in registry</button>`);
  if (j.state === 'queued') actions.push(`<button class="btn" data-go="queue">Why queued</button>`);
  return `<div class="lcm-head"><div><h2>${h(j.name)} <span>${pill(STATE[j.state], j.state)}</span></h2><p>${h(j.owner)} · ${h(E.TEAMS[j.team].name)} · ${h(j.cluster)} · <span class="mono">${h(j.id)}</span></p></div><div class="row">${actions.join('')}</div></div>
    <div class="lcm-facts"><span><small>Model</small>${h(a.name)}</span><span><small>GPUs</small>${fmt(E.jobGpus(j))} × ${h(hw.name)}</span><span><small>Layout</small>${j.kind === 'rl' ? `Rollout ${j.rl.rolloutGpus} · Train ${j.rl.trainGpus}` : layout(j.cfg)}</span><span><small>Precision</small>${j.cfg.fp8 ? 'FP8 matmuls, BF16 master' : 'BF16'}</span><span><small>Sequence</small>${fmt(j.cfg.seq)}</span><span><small>Global batch</small>${j.kind === 'rl' ? fmt(j.rl.promptsPerStep * j.rl.group) + ' samples' : si(seqs * j.cfg.seq) + ' tokens'}</span></div>
    ${recoveryBanner(j)}
    ${seg('runtab', S.runTab, tabs)}
    ${({ overview: runOverview, performance: runPerf, parallelism: runPar, checkpoints: runCkpts, events: runEvents, config: runConfig })[S.runTab](j, p)}`;
}

/* ── overview, by kind ── */
function runOverview(j, p) {
  const F = ctx.F, a = E.ARCH[j.arch];
  if (j.kind === 'rl') return rlOverview(j);
  if (j.kind === 'eval') return evalOverview(j);
  if (j.state === 'queued') return `<div class="lcm-banner warn"><b>Waiting for capacity.</b> Needs ${fmt(E.jobGpus(j))} GPUs gang-scheduled in one rail group on ${h(j.cluster)}. Team quota is fully used by running jobs; it can borrow idle capacity from Research when that frees up.<div class="row"><button class="btn" data-go="queue">Open queue</button></div></div>`;
  const sf = slowF(j), tps = p.tps / sf * (j.goodput || 1);
  if (j.kind === 'pretrain') {
    const done = F.tokensAt(j), left = (j.targetTokens - done) / tps;
    const span = Date.now() - j.started, pts = [];
    for (let i = 0; i <= 90; i++) {
      const t = j.started + (span * i) / 90;
      const tok = t <= F.t0 ? j.doneTokens * ((t - j.started) / (F.t0 - j.started)) : F.tokensAt(j, t);
      pts.push([t, E.lossAt(a, tok) + 0.012 * Math.sin(i * 1.7) * Math.exp(-i / 60)]);
    }
    const lossPts = Array.from({ length: 80 }, (_, i) => { const tok = done * Math.pow((i + 1) / 80, 1.6); return [tok, E.lossAt(a, tok) + 0.006 * Math.sin(i * 1.9)]; });
    const thr = [];
    for (let i = 0; i <= 96; i++) { const t = Date.now() - 864e5 + i * 9e5, ago_ = Date.now() - t; const dip = ago_ > 22 * 6e4 && ago_ < 30 * 6e4 ? 0 : 1; thr.push([t, (p.tps / sf) * dip * (1 + 0.012 * Math.sin(i))]); }
    const cost = (Date.now() - j.started) / 36e5 * E.jobGpus(j) * E.HW[j.cfg.hw].cost;
    return `<div class="lcm-tiles">
      <div class="lcm-tile"><span>Tokens</span><b>${si(done, 2)}</b><small>of ${si(j.targetTokens)} (${(done / j.targetTokens * 100).toFixed(1)}%)</small></div>
      <div class="lcm-tile"><span>Throughput</span><b>${si(p.tps / sf, 2)}/s</b><small>${fmt(p.tps / sf / E.jobGpus(j))} per GPU</small></div>
      <div class="lcm-tile ${j.straggler ? 'warn' : ''}"><span>MFU</span><b>${(p.mfu / sf * 100).toFixed(1)}%</b><small>${j.straggler ? `${j.straggler.slow}% lost to a straggler` : 'BF16 peak basis'}</small></div>
      <div class="lcm-tile"><span>Goodput</span><b>${(j.goodput * 100).toFixed(1)}%</b><small>after restarts and saves</small></div>
      <div class="lcm-tile"><span>Loss</span><b>${pts.at(-1)[1].toFixed(3)}</b><small>step ${fmt(Math.round(F.stepAt(j)))}</small></div>
      <div class="lcm-tile"><span>ETA</span><b>${dur(left)}</b><small>${usd(cost / 1e6)}M spent so far</small></div></div>
      <div class="card-sub"><h4>Training loss by tokens seen</h4>${xyChart([{ name: 'Loss', color: C.blue, pts: lossPts }], { w: 820, hgt: 190, ymin: 1.8, ymax: 2.6, xl: 'tokens', fy: (v) => v.toFixed(2), marks: [{ x: done, y: E.lossAt(a, done), color: C.blue, label: 'now' }] })}<p class="note">Fit: L = 1.69 + A/N^0.34 + B/D^0.28 (Chinchilla). The run tracks its forecast within 0.4%, so the target loss at ${si(j.targetTokens)} tokens is ${E.lossAt(a, j.targetTokens).toFixed(3)}.</p></div>
      <div class="card-sub"><h4>Tokens per second, last 24 hours</h4><p class="note">The gap is the node failure 26 minutes ago: detection, a hot spare and a restore from peer memory took 94 s, plus warmup.</p>${tsChart([{ name: 'Tokens/s', color: C.teal, points: thr }], { range: '24h', w: 820, height: 140, area: true })}</div>`;
  }
  // SFT, DPO, LoRA: loss or preference accuracy by step
  const n = Math.max(2, j.step), pts = [], acc = [];
  for (let i = 1; i <= 60; i++) { const s = (n * i) / 60; pts.push([s, 1.12 + 0.75 * Math.exp(-s / (j.steps * 0.18)) + 0.015 * Math.sin(i * 2.1)]); acc.push([s, 0.5 + 0.22 * (1 - Math.exp(-s / (j.steps * 0.3))) + 0.006 * Math.sin(i * 1.3)]); }
  const dpo = j.method === 'DPO';
  return `<div class="lcm-tiles">
    <div class="lcm-tile"><span>Step</span><b>${fmt(j.step)}</b><small>of ${fmt(j.steps)}</small></div>
    <div class="lcm-tile"><span>Throughput</span><b>${si(p.tps)}/s</b><small>tokens, packed</small></div>
    <div class="lcm-tile"><span>MFU</span><b>${(p.mfu * 100).toFixed(1)}%</b><small>${j.cfg.zero >= 3 ? 'FSDP2' : 'DDP'}</small></div>
    <div class="lcm-tile"><span>${dpo ? 'Preference accuracy' : 'Loss'}</span><b>${(dpo ? acc : pts).at(-1)[1].toFixed(3)}</b><small>${dpo ? 'chosen beats rejected' : 'response tokens only'}</small></div>
    <div class="lcm-tile"><span>${j.state === 'running' ? 'ETA' : 'Took'}</span><b>${j.state === 'running' ? dur((j.steps - j.step) * p.step) : dur(((j.ended || Date.now()) - j.started) / 1000)}</b><small>${h(j.dataset)}</small></div></div>
    <div class="card-sub"><h4>${dpo ? 'Preference accuracy and loss by step' : 'Loss by step'}</h4>${xyChart(dpo ? [{ name: 'Preference accuracy', color: C.purple, pts: acc }, { name: 'DPO loss', color: C.blue, pts: pts.map(([s, v]) => [s, v * 0.55]) }] : [{ name: 'Loss', color: C.blue, pts }], { xl: 'step', fy: (v) => v.toFixed(2), hgt: 200, w: 820 })}</div>
    ${dpo ? `<p class="note">β = 0.1. Reference log-probs were precomputed once from ${h(j.base)} and stored with the dataset, so the reference model never loads on the training GPUs.</p>` : `<p class="note">Loss is masked to response tokens. Examples are packed to ${fmt(j.cfg.seq)} tokens with document masking, so no compute goes to padding.</p>`}`;
}

/* ── RL ── */
function rlOverview(j) {
  const F = ctx.F, b = F.rlBreakdown(j), m = E.rlMetrics(j.step, j.state === 'failed');
  const series = (k) => Array.from({ length: 60 }, (_, i) => { const s = Math.max(1, (j.step * (i + 1)) / 60); return [s, E.rlMetrics(s, j.state === 'failed')[k]]; });
  const fail = j.state === 'failed' ? `<div class="lcm-banner deny"><b>Failed at step ${j.step}.</b> ${h(j.failure)}<div class="glist">${[['Root cause', 'Sandbox timeouts were scored as reward 0, so whole groups scored the same and GRPO advantages were zero.'], ['Signal', '61% of groups had zero reward variance by step 233 (normal is under 15%).'], ['Fix', 'Timeouts return an error and are dropped; DAPO dynamic sampling skips zero-variance groups; verifier pool raised to 1,024 sandboxes.']].map(([k, v]) => `<div class="grow tall"><span>${k}</span><span>${v}</span></div>`).join('')}</div><div class="row"><button class="btn primary" data-act="clone-fix">Clone with fix</button><button class="btn" data-act="ack-fail">Acknowledge</button></div></div>` : '';
  const parts = [['Rollout (generation)', b.rollout, C.blue], ['Rewards (verifiers)', b.reward, C.amber], ['Reference log-probs', b.ref, C.gray], ['Policy update', b.train, C.purple], ['Weight sync', b.sync, C.teal]];
  const gain = j.rl.partial ? '' : (() => { const k = { ...j, rl: { ...j.rl, partial: true } }; const nb = F.rlBreakdown(k); return `<div class="lcm-banner warn"><b>The long tail sets the pace.</b> Mean response is ${fmt(b.meanOut)} tokens but the slowest group runs to ${fmt(b.tail)}, so rollout GPUs idle at ${fmt(Math.round(100 - (b.meanOut / b.tail) * 100))}% of the batch for the last stretch. Partial rollouts carry unfinished sequences into the next step: iteration ${b.total.toFixed(0)} s → ${nb.total.toFixed(0)} s.<div class="row"><button class="btn primary" data-act="partial" ${can('researcher', 'ml_engineer') ? '' : 'disabled'}>Enable partial rollouts</button><span class="note">Adds at most one step of staleness, corrected with importance weights.</span></div></div>`; })();
  return `${fail}<div class="lcm-tiles">
    <div class="lcm-tile"><span>Step</span><b>${fmt(j.step)}</b><small>of ${fmt(j.steps)} · ${h(j.method)}</small></div>
    <div class="lcm-tile ${j.state === 'failed' ? 'fail' : ''}"><span>Mean reward</span><b>${m.reward.toFixed(3)}</b><small>verifiable, 0 to 1</small></div>
    <div class="lcm-tile"><span>Response length</span><b>${fmt(m.len)}</b><small>tokens, mean</small></div>
    <div class="lcm-tile"><span>KL to reference</span><b>${m.kl.toFixed(4)}</b><small>β = 0.001</small></div>
    <div class="lcm-tile ${j.state === 'failed' ? 'fail' : ''}"><span>Zero-advantage groups</span><b>${(m.zeroAdv * 100).toFixed(0)}%</b><small>all samples scored the same</small></div>
    <div class="lcm-tile"><span>Iteration</span><b>${b.total.toFixed(0)} s</b><small>${fmt(b.seqs)} samples</small></div></div>
    ${j.state === 'running' ? gain : ''}
    <div class="card-sub"><h4>One iteration, ${j.rl.async ? 'one-step async: generation overlaps training' : 'synchronous'}</h4>${stack(parts, (v) => v.toFixed(0) + ' s')}<p class="note">${j.rl.async ? `Rollout for step n+1 runs while step n trains, hiding ${b.overlap.toFixed(0)} s. ` : ''}Rollout engine: ${h(j.rl.engine)} on ${j.rl.rolloutGpus} GPUs (TP 4, batch ${b.B}). Weight sync: ${h(j.rl.sync)}.</p></div>
    <div class="card-sub"><h4>The loop on Ray</h4><div class="flow">${[['Driver', 'single controller'], ['Prompts', `${j.rl.promptsPerStep} × ${j.rl.group} samples`], ['Rollout pool', `${j.rl.engine}, ${j.rl.rolloutGpus} GPUs`], ['Verifiers', `${fmt(j.rl.verifiers)} sandboxes`], ['Trainer', `FSDP2, ${j.rl.trainGpus} GPUs`], ['Weight sync', j.rl.sync.split(',')[0]]].map(([k, v]) => `<div class="hop lit"><b>${k}</b><span>${h(v)}</span></div>`).join('')}</div></div>
    <div class="grid2"><div class="card-sub"><h4>Mean reward</h4>${xyChart([{ name: 'Reward', color: j.state === 'failed' ? C.red : C.green, pts: series('reward') }], { xl: 'step', fy: (v) => v.toFixed(2), hgt: 170, w: 410 })}</div>
    <div class="card-sub"><h4>${j.state === 'failed' ? 'Zero-advantage groups' : 'Response length'}</h4>${xyChart([{ name: 'v', color: j.state === 'failed' ? C.amber : C.blue, pts: series(j.state === 'failed' ? 'zeroAdv' : 'len') }], { xl: 'step', fy: j.state === 'failed' ? (v) => (v * 100).toFixed(0) + '%' : (v) => si(v), hgt: 170, w: 410 })}</div></div>`;
}

function evalOverview(j) {
  const suites = EVAL_SUITES;
  const done = Math.min(suites.length, j.step);
  return `<div class="lcm-tiles"><div class="lcm-tile"><span>Suites</span><b>${done} of ${suites.length}</b><small>sharded over 8 vLLM replicas</small></div><div class="lcm-tile"><span>Model</span><b>${h(j.base)}</b><small>vs core-70b-sft-v3.1</small></div></div>
  <table class="table"><thead><tr><th>Suite</th><th>Kind</th><th>Status</th></tr></thead><tbody>${suites.map((s, i) => `<tr><td>${h(s[0])}</td><td>${h(s[1])}</td><td>${i < done ? pill('ok', 'Done') : i === done ? pill('live', 'Running') : pill('', 'Queued')}</td></tr>`).join('')}</tbody></table>`;
}
export const EVAL_SUITES = [['MMLU-Pro', 'Knowledge'], ['GPQA Diamond', 'Reasoning'], ['MATH-500', 'Math'], ['AIME 2025', 'Math'], ['HumanEval+', 'Code'], ['LiveCodeBench', 'Code'], ['IFEval', 'Instruction following'], ['MT-Bench', 'Chat, judged'], ['Arena-Hard', 'Chat, judged'], ['RULER 128K', 'Long context'], ['BFCL v3', 'Tool use'], ['Multilingual MGSM', 'Multilingual'], ['Safety refusals', 'Safety'], ['Over-refusal (XSTest)', 'Safety'], ['Jailbreak suite', 'Safety'], ['PII extraction', 'Privacy'], ['Memorization canaries', 'Privacy'], ['Latency at SLO', 'Serving']];

/* ── performance ── */
function runPerf(j, p) {
  const sf = slowF(j), parts = p.parts;
  const step = p.step * sf;
  const rows = [['Compute', parts.compute, C.blue], ['Pipeline bubble', parts.bubble, C.gray], ['Tensor parallel comm', parts.tpComm, C.purple], ['Data parallel comm, exposed', parts.dpComm, C.teal], ['Pipeline and context comm', parts.cpComm, C.indigo], ['Optimizer step', parts.optimizer, C.pink], ['Waiting on straggler', step - p.step, C.red]];
  const rec = [];
  const pct = (v) => (v / step * 100);
  if (j.straggler) rec.push(['Replace the slow GPU', `${j.straggler.node} GPU ${j.straggler.gpu}: ${j.straggler.why}`, 'cordon', `Cordon and replace`]);
  if (pct(parts.bubble) > 4) rec.push(['Shrink the pipeline bubble', `${pct(parts.bubble).toFixed(1)}% of each step. More microbatches per step, or more interleaved stages, cut it at the cost of more point-to-point traffic.`]);
  if (pct(parts.tpComm) > 5) rec.push(['Overlap tensor parallel communication', `${pct(parts.tpComm).toFixed(1)}% exposed. Async TP (overlapping the all-gather with the matmul) or a lower TP degree would recover most of it.`]);
  if (pct(parts.cpComm) > 5) rec.push(['Pipeline sends are on the critical path', `${pct(parts.cpComm).toFixed(1)}%. Interleaving multiplies them; check that sends overlap compute.`]);
  const plan = E.plan(E.ARCH[j.arch], { hw: j.cfg.hw, gpus: E.jobGpus(j), seq: j.cfg.seq, batchTokens: j.cfg.micro * j.cfg.accum * j.cfg.dp * j.cfg.seq, fp8: j.cfg.fp8, maxResults: 1 }).best[0];
  if (plan && plan.perf.tps > p.tps * 1.03) rec.push(['A faster layout exists', `The planner finds ${layout(plan.c)} at ${(plan.perf.mfu * 100).toFixed(1)}% MFU vs ${(p.mfu * 100).toFixed(1)}% now (+${((plan.perf.tps / p.tps - 1) * 100).toFixed(0)}% throughput). Apply at the next restart: the checkpoint is reshardable.`, 'planner', 'Open in planner']);
  return `<div class="card-sub"><h4>Where a ${ms(step)} step goes</h4>${stack(rows, ms)}</div>
    <div class="card-sub"><h4>Recommendations</h4>${rec.length ? `<div class="recs">${rec.map(([t, d, act, label]) => `<div class="rec"><div><b>${t}</b><p>${h(d)}</p></div>${act ? `<button class="btn" data-act="${act === 'cordon' ? 'cordon-straggler' : 'to-planner'}" ${act === 'cordon' && !can('sre', 'platform') ? 'disabled title="SRE or platform engineer"' : ''}>${label}</button>` : ''}</div>`).join('')}</div>` : '<p class="note">Nothing material to fix. Compute is the dominant cost.</p>'}</div>
    ${j.kind !== 'rl' ? rankGrid(j) : ''}`;
}

/* Per-rank step time: one cell per GPU, grouped by node. */
function rankGrid(j) {
  const n = E.jobGpus(j), nodes = n / 8, show = Math.min(nodes, 256);
  const bad = j.straggler ? 311 % show : -1;
  let cells = '';
  for (let k = 0; k < show; k++) {
    let g = '';
    for (let q = 0; q < 8; q++) {
      const x = Math.sin(k * 12.9898 + q * 78.233) * 43758.5453, r = x - Math.floor(x);
      const slow = k === bad && q === j.straggler.gpu ? 3 : r > 0.985 ? 1 : 0;
      g += `<i class="s${slow}"></i>`;
    }
    cells += `<span class="nd" data-drawer="node:${j.cluster}|${k}" title="node ${k}">${g}</span>`;
  }
  return `<div class="card-sub"><h4>Step time by rank, last 50 steps <span class="right">${fmt(n)} ranks · ${fmt(nodes)} nodes</span></h4><div class="rankgrid">${cells}</div><div class="lin-foot"><span class="lg"><i style="background:var(--fill-2)"></i>within 1%</span><span class="lg"><i style="background:#ffd60a"></i>1 to 3% slow</span><span class="lg"><i style="background:#ff3b30"></i>over 5% slow</span><span class="spacer"></span><span>Collected from NCCL flight recorder and per-rank step timers</span></div></div>`;
}

/* ── parallelism ── */
function runPar(j) {
  const a = E.ARCH[j.arch], c = j.kind === 'rl' ? { ...j.cfg } : j.cfg, m = E.trainMemory(a, c), cap = E.HW[c.hw].mem * 1e9;
  const stages = [];
  const per = a.layers / c.pp;
  for (let s = 0; s < c.pp; s++) stages.push(`<div class="pp-stage"><small>Stage ${s + 1} · layers ${s * per}–${(s + 1) * per - 1}${s === 0 ? ' + embeddings' : ''}${s === c.pp - 1 ? ' + LM head' : ''}</small><div class="tp-row">${Array.from({ length: c.tp }, (_, g) => `<i title="TP rank ${g}">${g}</i>`).join('')}</div></div>`);
  const coll = [
    ['Tensor parallel', `${c.tp} GPUs`, c.tp > 1 ? 'All-reduce or reduce-scatter + all-gather, 4 per layer per microbatch' : 'None', c.tp <= 8 ? 'NVLink' : 'InfiniBand'],
    ['Pipeline parallel', `${c.pp} stages`, c.pp > 1 ? `Point-to-point activations, ${c.accum} microbatches${c.vpp > 1 ? `, ${c.vpp} virtual stages` : ''}` : 'None', 'InfiniBand'],
    ['Data parallel', `${c.dp} replicas`, c.zero >= 3 ? 'FSDP: all-gather params, reduce-scatter grads' : `ZeRO-1: reduce-scatter grads, all-gather params after the step`, 'InfiniBand, rail-aligned'],
  ];
  return `<div class="card-sub"><h4>One model replica: ${c.pp} pipeline stage${c.pp > 1 ? 's' : ''} × ${c.tp} tensor-parallel GPUs, repeated ${c.dp} times</h4><div class="pp">${stages.join('<span class="pp-arrow">→</span>')}</div>${c.zero >= 3 ? `<div class="row"><button class="btn" data-go="fsdp">FSDP configuration ›</button></div>` : ''}<p class="note">Tensor parallel stays inside a node on NVLink. Pipeline stages and data-parallel replicas cross nodes on InfiniBand, placed so each rail carries one rank's traffic.</p></div>
    <div class="card-sub"><h4>Memory per GPU: ${gb(m.total)} of ${E.HW[c.hw].mem} GB</h4>${stack([['Weights', m.weights, C.blue], ['Gradients', m.grads, C.teal], ['Optimizer state', m.optim, C.purple], ['Activations', m.acts, C.amber], ['Gathered params', m.gathered, C.indigo], ['Logits', m.logits, C.pink], ['Runtime and fragmentation', m.other, C.gray], ['Free', Math.max(0, cap - m.total), 'var(--fill-2)']], gb)}<p class="note">${c.recompute === 'full' ? 'Full activation recompute' : c.recompute === 'selective' ? 'Selective recompute of attention and activations' : 'No recompute'}${c.zero >= 1 ? `, optimizer state sharded over ${c.dp} ranks` : ''}${c.chunkedLoss ? ', chunked cross-entropy (no full logits)' : ''}.</p></div>
    <div class="card-sub"><h4>Collectives</h4><table class="table"><thead><tr><th>Dimension</th><th>Group</th><th>Traffic</th><th>Link</th></tr></thead><tbody>${coll.map((r) => `<tr>${r.map((x) => `<td>${h(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/* ── checkpoints ── */
function runCkpts(j) {
  const F = ctx.F, list = F.ckpts[j.id] || [];
  const nodes = E.jobGpus(j) / 8, mtbf = 1500 * 3600 / nodes;
  const save = list[0] ? list[0].blocking : 3, opt = E.ckptInterval(save, mtbf);
  return `<div class="lcm-banner ${j.ckptEvery > opt * 1.5 ? 'warn' : 'ok'}"><b>Checkpoint every ${dur(j.ckptEvery || 1800)}.</b> With ${fmt(nodes)} nodes at a 1,500 h node MTBF, the job sees a failure every ${dur(mtbf)}. A save blocks training for ${save.toFixed(1)} s (async: copy to host memory, upload in the background), so the Young/Daly optimum is every ${dur(opt)}.${j.ckptEvery > opt * 1.5 ? `<div class="row"><button class="btn primary" data-act="ckpt-interval">Use ${dur(opt)}</button><span class="note">Expected lost work per failure drops from ${dur((j.ckptEvery || 1800) / 2)} to ${dur(opt / 2)}.</span></div>` : ''}</div>
    <table class="table"><thead><tr><th>Step</th><th>Saved</th><th>Tier</th><th class="num">Size</th><th class="num">Blocking</th><th>Status</th><th></th></tr></thead><tbody>${list.map((k, i) => `<tr class="click" data-drawer="ckpt:${j.id}|${i}"><td class="mono">${fmt(k.step)}</td><td>${ago(k.t)}</td><td>${h(k.tier)}</td><td class="num">${k.size.toFixed(2)} TB</td><td class="num">${k.blocking.toFixed(1)} s</td><td>${pill('ok', k.status)}</td><td>${i === 0 ? '<span class="note">latest</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="note">No checkpoints yet.</td></tr>'}</tbody></table>
    <p class="note">Sharded with torch.distributed.checkpoint: each rank writes its own shards plus global metadata, so a restart can load into a different TP, PP or DP layout. Optimizer state, RNG, LR schedule and data loader position are included.</p>`;
}
DRAWERS.ckpt = (id) => {
  const [jid, i] = id.split('|'), j = ctx.F.job(jid), k = ctx.F.ckpts[jid][+i];
  return { title: `Checkpoint step ${fmt(k.step)}`, sub: `s3://acme-ckpt/${jid}/step_${k.step}/`, glyph: 'training', body: glist([['Saved', new Date(k.t).toLocaleString('en-GB')], ['Size', k.size.toFixed(2) + ' TB, sharded'], ['Shards', fmt(E.jobGpus(j)) + ' files + metadata'], ['Tier', k.tier], ['Training blocked', k.blocking.toFixed(1) + ' s'], ['Upload', dur(k.upload) + ' in background'], ['Checksum', 'Verified, SHA-256 per shard'], ['Contains', 'Model, optimizer, RNG, LR schedule, loader state']]) + `<div class="row"><button class="btn" data-act="resume-from" ${can('researcher', 'platform', 'sre') ? '' : 'disabled'}>Resume from here</button><button class="btn" data-go="registry">Register as version</button></div>` };
};

function runEvents(j) {
  const ev = ctx.F.events.filter((e) => e.subject === j.id);
  const base = [[j.started, 'admitted', `Admitted on ${j.cluster}: ${fmt(E.jobGpus(j))} GPUs in one rail group.`]];
  const all = [...ev.map((e) => [e.t, e.kind, e.text]), ...(j.started ? base : [])].sort((a, b) => b[0] - a[0]);
  return `<ul class="feed">${all.map(([t, k, x]) => `<li><span class="when">${ago(t)}</span><span>${pill(EV[k] || '', k)} ${h(x)}</span></li>`).join('') || '<li><span></span><span class="note">No events yet.</span></li>'}</ul>`;
}

function runConfig(j) {
  const cfg = { name: j.id, model: j.base || j.arch, team: j.team, cluster: j.cluster, priority: j.priority, parallel: { tp: j.cfg.tp, pp: j.cfg.pp, vpp: j.cfg.vpp, cp: j.cfg.cp, dp: j.cfg.dp, fsdp: j.cfg.zero >= 3 }, batch: { micro: j.cfg.micro, grad_accum: j.cfg.accum, seq_len: j.cfg.seq, packing: true }, precision: j.cfg.fp8 ? 'fp8-hybrid' : 'bf16', recompute: j.cfg.recompute, data: j.dataset || j.mix, checkpoint: { every_s: j.ckptEvery || 1800, async: true, format: 'torch-dcp' }, ...(j.rl ? { rl: j.rl } : {}) };
  const sdk = j.kind === 'rl' ? `from crucible import rl

job = rl.GRPO(
    policy="${j.base}",
    prompts="${j.dataset}",
    reward=rl.verifiers.math_and_code(timeout_s=20, on_timeout="drop"),
    group_size=${j.rl.group}, prompts_per_step=${j.rl.promptsPerStep},
    rollout=rl.Rollout(engine="${j.rl.engine.split(' ')[0].toLowerCase()}", gpus=${j.rl.rolloutGpus}, tp=4, max_tokens=${j.rl.maxLen}),
    trainer=rl.FSDP(gpus=${j.rl.trainGpus}, recompute="full"),
    async_steps=${j.rl.async}, kl_coef=0.001,
)
job.submit(team="${j.team}", priority="${j.priority}")` : `from crucible import train

job = train.${j.kind === 'pretrain' ? 'Pretrain' : j.method === 'DPO' ? 'DPO' : 'SFT'}(
    model="${j.base || j.arch}",
    data="${j.dataset || j.mix}",
    layout=train.Layout(tp=${j.cfg.tp}, pp=${j.cfg.pp}, dp=${j.cfg.dp}${j.cfg.vpp > 1 ? `, vpp=${j.cfg.vpp}` : ''}),  # or layout="auto"
    seq_len=${j.cfg.seq}, micro_batch=${j.cfg.micro}, grad_accum=${j.cfg.accum},
    precision="${j.cfg.fp8 ? 'fp8' : 'bf16'}", recompute="${j.cfg.recompute}",
    checkpoint=train.Checkpoint(every="${Math.round((j.ckptEvery || 1800) / 60)}m", async_save=True),
)
job.submit(team="${j.team}", priority="${j.priority}")`;
  return `<pre class="code">${h(sdk)}</pre><pre class="code insp-code">${h(JSON.stringify(cfg, null, 2))}</pre>`;
}

/* ── recovery: node failure or straggler swap, step by step ── */
function recoveryBanner(j) {
  const r = j.recovery; if (!r) return '';
  return `<div class="lcm-banner ${r.done ? 'ok' : 'warn'}"><b>${r.done ? 'Recovered.' : 'Recovering from a node failure.'}</b><ol class="steps">${r.steps.map((s, i) => `<li class="${i < r.at ? 'done' : i === r.at && !r.done ? 'running' : ''}"><span class="dot">${i < r.at ? '✓' : ''}</span><div><b>${h(s[0])}</b><p>${h(s[1])}</p></div><span class="id">${i < r.at ? s[2] : ''}</span></li>`).join('')}</ol>${r.done ? `<div class="row"><button class="btn" data-act="dismiss-recovery">Dismiss</button></div>` : ''}</div>`;
}
async function recover(j, cause) {
  const F = ctx.F, step = Math.round(F.stepAt(j));
  const node = cause === 'straggler' ? j.straggler.node : 'usw2-a-n0167';
  const save = Math.round(step - (cause === 'straggler' ? 0 : 41));
  j.recovery = { at: 0, done: false, steps: cause === 'straggler' ? [
    ['Cordon', `${node} marked unschedulable after the next checkpoint at step ${fmt(step)}.`, '0 s'],
    ['Replace', 'Hot spare usw2-a-n0377 passed burn-in and NCCL tests; joined the job.', '18 s'],
    ['Rebuild communicators', `${fmt(E.jobGpus(j))} ranks re-rendezvous; same layout.`, '21 s'],
    ['Restore', 'Loaded the step from peer memory, not object storage.', '24 s'],
    ['Resume', 'Step time back to the cluster median.', '0 s'],
  ] : [
    ['Detect', `NCCL watchdog: all-reduce timed out on ranks 1336–1343 (${node}). GPU XID 79, fell off the bus.`, '30 s'],
    ['Cordon', `${node} drained and sent to repair with the diagnostic bundle.`, '2 s'],
    ['Replace', 'Hot spare usw2-a-n0377 passed burn-in and NCCL tests; joined the job.', '18 s'],
    ['Rebuild communicators', `${fmt(E.jobGpus(j))} ranks re-rendezvous; same layout.`, '21 s'],
    ['Restore', `Step ${fmt(save)} from peer memory (in-memory copy on the neighbour node) in 23 s instead of ${dur(E.ARCH[j.arch].params * 16 / 120e9)} from object storage.`, '23 s'],
    ['Resume', `${fmt(step - save)} steps of work redone. Goodput for the run ${(j.goodput * 100).toFixed(1)}% → ${((j.goodput - 0.0008) * 100).toFixed(1)}%.`, '0 s'],
  ] };
  F.event(Date.now(), j.id, cause === 'straggler' ? 'cordoned' : 'detected', j.recovery.steps[0][1]);
  for (let i = 1; i <= j.recovery.steps.length; i++) {
    await sleep(1400); j.recovery.at = i; ui.render();
  }
  j.recovery.done = true;
  if (cause === 'straggler') j.straggler = null; else j.goodput -= 0.0008;
  F.event(Date.now(), j.id, 'recovered', cause === 'straggler' ? `Replaced ${node}; step time back to median.` : `Recovered from ${node} failure in 94 s; ${fmt(step - save)} steps redone.`);
  toast(cause === 'straggler' ? 'Straggler replaced. Step time back to median.' : 'Recovered. Training resumed.');
  ui.render(); ui.renderChrome();
}

Object.assign(ACTIONS, {
  'inject-failure': () => { const j = ctx.F.job(S.run); if (j.recovery && !j.recovery.done) return; S.runTab = 'overview'; recover(j, 'failure'); },
  'cordon-straggler': () => { const j = ctx.F.jobs.find((x) => x.straggler); if (!j || (j.recovery && !j.recovery.done)) return; S.run = j.id; S.runTab = 'overview'; ui.closeDrawer(); if (S.view !== 'runs') ui.go('runs'); recover(j, 'straggler'); },
  'dismiss-recovery': () => { ctx.F.job(S.run).recovery = null; },
  'to-planner': () => { const j = ctx.F.job(S.run); Object.assign(S.planner, { arch: j.arch, hw: j.cfg.hw, gpus: E.jobGpus(j), seq: j.cfg.seq, batch: j.cfg.micro * j.cfg.accum * j.cfg.dp * j.cfg.seq, fp8: j.cfg.fp8, pick: 0 }); ui.go('planner'); },
  'ckpt-now': () => { const F = ctx.F, j = F.job(S.run); const k = { t: Date.now(), step: Math.round(F.stepAt(j)), tier: 'Peer memory + object store', size: E.ARCH[j.arch].params * 16 / 1e12, blocking: 3.0, upload: 60, status: 'Verified' }; (F.ckpts[j.id] ||= []).unshift(k); F.event(Date.now(), j.id, 'checkpoint', `Manual checkpoint at step ${fmt(k.step)} by ${me().name}.`); toast(`Checkpoint saved at step ${fmt(k.step)}; uploading in the background`); },
  'ckpt-interval': () => { const j = ctx.F.job(S.run); const nodes = E.jobGpus(j) / 8; j.ckptEvery = Math.round(E.ckptInterval(3.1, 1500 * 3600 / nodes)); ctx.F.event(Date.now(), j.id, 'checkpoint', `Interval set to ${dur(j.ckptEvery)} by ${me().name}.`); toast(`Checkpoint interval set to ${dur(j.ckptEvery)}`); },
  'resume-from': () => { toast('Restart scheduled from this checkpoint after the current step'); ui.closeDrawer(); },
  partial: () => { const j = ctx.F.job(S.run); j.rl.partial = true; ctx.F.event(Date.now(), j.id, 'submitted', `Partial rollouts enabled by ${me().name}; takes effect next step.`); toast('Partial rollouts on from the next step'); },
  'ack-fail': () => { ctx.F.job(S.run).ack = true; toast('Acknowledged'); },
  'clone-fix': () => { const j = ctx.F.job(S.run); j.ack = true; ui.openForm('rl', { name: j.name.replace('(GRPO)', '(DAPO, fixed)'), algo: 'DAPO', base: j.base, dataset: 'math-code-verifiable-v4', group: j.rl.group, engine: j.rl.engine, placement: 'split', hw: j.cfg.hw, gpus: j.rl.trainGpus, steps: j.steps }); },
});

/* ───────────────────────── parallelism planner ───────────────────────── */

const PL_ARCH = ['edge-3b', 'core-8b', 'coder-34b', 'core-70b'];
VIEWS.planner = () => {
  const P = S.planner, a = E.ARCH[P.arch];
  const res = E.plan(a, { hw: P.hw, gpus: +P.gpus, seq: +P.seq, batchTokens: +P.batch, fp8: !!P.fp8 });
  const pick = res.best[Math.min(P.pick, res.best.length - 1)];
  const target = P.arch === 'core-70b' ? 9e12 : P.arch === 'coder-34b' ? 5e12 : 2e12;
  const sel = (k, opts) => `<select data-bind="planner.${k}">${opts.map(([v, t]) => `<option value="${v}"${String(v) === String(P[k]) ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
  const row = (r, i) => `<tr class="click${i === P.pick ? ' sel' : ''}" data-plpick="${i}"><td class="mono">${r.c.tp}</td><td class="mono">${r.c.pp}${r.c.vpp > 1 ? '×' + r.c.vpp : ''}</td><td class="mono">${r.c.cp}</td><td class="mono">${r.c.dp}</td><td class="mono">${r.c.micro} × ${r.c.accum}</td><td>${r.c.zero >= 3 ? 'FSDP' : 'ZeRO-1'}</td><td>${r.c.recompute}</td><td><div class="membar"><i style="width:${(r.mem.total / (E.HW[P.hw].mem * 1e9) * 100).toFixed(0)}%"></i></div><span class="id">${gb(r.mem.total)}</span></td><td class="num"><b>${(r.perf.mfu * 100).toFixed(1)}%</b></td><td class="num">${si(r.perf.tps)}/s</td><td class="num">${dur(target / r.perf.tps)}</td></tr>`;
  const cost = pick ? (target / pick.perf.tps) / 3600 * (+P.gpus) * E.HW[P.hw].cost : 0;
  return head('Parallelism planner', 'Pick a model and a GPU budget. The planner searches tensor, pipeline, context and data parallel layouts, recompute and sharding, drops the ones that run out of memory, and ranks the rest by modeled throughput.', 'Memory follows the standard accounting: 16 bytes per parameter for mixed-precision Adam, sharded by ZeRO stage, plus activations of 34·s·b·h bytes per layer without recompute (Korthikanti et al.), divided by TP. Step time adds compute at a size-dependent matmul efficiency, the pipeline bubble (p−1)/(v·m+p−1), exposed TP all-reduces on NVLink and the part of DP traffic that compute cannot hide. The same model drives the Performance tab of every run.') + `
  <div class="grid">
    <div class="card c12"><div class="fields">
      <label class="field">Model${sel('arch', PL_ARCH.map((k) => [k, E.ARCH[k].name]))}</label>
      <label class="field">Hardware${sel('hw', Object.entries(E.HW).map(([k, x]) => [k, `${x.name} ${x.mem} GB`]))}</label>
      <label class="field">GPUs${sel('gpus', [64, 128, 256, 512, 1024, 2048, 4096].map((n) => [n, fmt(n)]))}</label>
      <label class="field">Sequence length${sel('seq', [4096, 8192, 16384, 32768, 131072].map((n) => [n, fmt(n)]))}</label>
      <label class="field">Global batch${sel('batch', [[1048576, '1M tokens'], [2097152, '2M tokens'], [4194304, '4M tokens'], [8388608, '8M tokens'], [16777216, '16M tokens']])}</label>
      <label class="field">Matmul precision${sel('fp8', [['', 'BF16'], ['1', 'FP8 (Transformer Engine)']])}</label>
    </div></div>
    <div class="card c12"><h3>${res.best.length ? `${res.feasible} of ${res.considered} layouts fit in memory. Fastest ${res.best.length}:` : 'No layout fits'} <span class="right">${si(target)} tokens target</span></h3>
      ${res.best.length ? `<div class="scroll-x"><table class="table"><thead><tr><th>TP</th><th>PP</th><th>CP</th><th>DP</th><th>Micro × accum</th><th>Sharding</th><th>Recompute</th><th>Memory / GPU</th><th class="num">MFU</th><th class="num">Tokens</th><th class="num">Time to target</th></tr></thead><tbody>${res.best.map(row).join('')}</tbody></table></div>` : `<p class="note">The smallest layout needs ${res.nearestOom ? gb(res.nearestOom.mem.total) : 'more than'} per GPU. Add GPUs, use a larger GPU, or shorten the sequence.</p>`}</div>
    ${pick ? `<div class="card c6"><h3>Memory per GPU, selected layout</h3>${stack([['Weights', pick.mem.weights, C.blue], ['Gradients', pick.mem.grads, C.teal], ['Optimizer', pick.mem.optim, C.purple], ['Activations', pick.mem.acts, C.amber], ['Gathered params', pick.mem.gathered, C.indigo], ['Runtime', pick.mem.other, C.gray], ['Free', Math.max(0, E.HW[P.hw].mem * 1e9 - pick.mem.total), 'var(--fill-2)']], gb)}
      <h3 class="sub-h">Step time, ${ms(pick.perf.step)}</h3>${stack([['Compute', pick.perf.parts.compute, C.blue], ['Bubble', pick.perf.parts.bubble, C.gray], ['TP comm', pick.perf.parts.tpComm, C.purple], ['DP comm', pick.perf.parts.dpComm, C.teal], ['PP/CP comm', pick.perf.parts.cpComm, C.indigo], ['Optimizer', pick.perf.parts.optimizer, C.pink]], ms)}</div>
    <div class="card c6"><h3>Why this layout</h3><ul class="why">${why(a, pick, res).map((x) => `<li>${x}</li>`).join('')}</ul>
      <h3 class="sub-h">Cost to train ${si(target)} tokens</h3><p class="big">${usd(cost / 1e6)}M <span class="note">${fmt(+P.gpus)} × ${E.HW[P.hw].name} for ${dur(target / pick.perf.tps)} at list price, before goodput loss</span></p>
      <pre class="code insp-code">${h(`train.Layout(tp=${pick.c.tp}, pp=${pick.c.pp}${pick.c.vpp > 1 ? `, vpp=${pick.c.vpp}` : ''}, cp=${pick.c.cp}, dp=${pick.c.dp},\n             fsdp=${pick.c.zero >= 3 ? 'True' : 'False'}, recompute="${pick.c.recompute}",\n             micro_batch=${pick.c.micro}, grad_accum=${pick.c.accum})`)}</pre></div>` : ''}
  </div>`;
};
function why(a, r, res) {
  const c = r.c, out = [];
  out.push(c.tp === 1 ? 'No tensor parallel: the model fits per GPU with sharding, so no per-layer all-reduces.' : `TP ${c.tp} keeps the per-layer all-reduces on NVLink inside one node${c.tp > 4 ? ', and splits the large hidden size' : ''}.`);
  if (c.pp > 1) out.push(`PP ${c.pp} with ${c.vpp > 1 ? `${c.vpp} interleaved chunks per GPU` : 'plain 1F1B'} and ${c.accum} microbatches: bubble ${(r.perf.bubbleFrac * 100).toFixed(1)}%.`);
  else out.push('No pipeline parallel, so no bubble.');
  out.push(c.zero >= 3 ? `FSDP shards weights, gradients and optimizer over ${c.dp} ranks; the all-gathers overlap with compute at this size.` : `ZeRO-1 shards only optimizer state (12 of 16 bytes per parameter); weights stay resident, avoiding per-microbatch all-gathers.`);
  out.push(c.recompute === 'none' ? 'No recompute: memory allows keeping activations, saving a third of backward compute.' : c.recompute === 'selective' ? 'Selective recompute: cheap attention and activation ops are recomputed, matmul outputs kept.' : 'Full recompute: needed to fit activations; costs about 33% more compute.');
  if (res.nearestOom) out.push(`Smallest rejected layout (TP ${res.nearestOom.c.tp}, PP ${res.nearestOom.c.pp}, ${res.nearestOom.c.recompute} recompute) needs ${gb(res.nearestOom.mem.total)}.`);
  return out;
}
CLICKS.push(['plpick', (i) => { S.planner.pick = +i; }]);

/* ───────────────────────── datasets ───────────────────────── */

VIEWS.data = () => {
  const F = ctx.F;
  const used = (id) => F.jobs.filter((j) => j.dataset === id || j.mix === id).map((j) => j.name);
  EXPORTS.datasets = () => [['id', 'kind', 'tokens', 'shards', 'format', 'snapshot', 'governance'], ...E.DATASETS.map((d) => [d.id, d.kind, d.tokens, d.shards, d.format, d.snapshot, d.governance])];
  return head('Datasets', 'Training data as versioned, sharded snapshots. Every run pins a snapshot so it can be reproduced, and the governance platform approves a dataset before any job can read it.') + `<div class="grid"><div class="card c12"><div class="tools"><span class="note">${E.DATASETS.length} datasets</span><span class="spacer"></span><button class="btn" data-act="export" data-key="datasets">Export CSV</button></div><div class="scroll-x"><table class="table"><thead><tr><th>Dataset</th><th>Kind</th><th class="num">Tokens</th><th class="num">Shards</th><th>Format</th><th>Snapshot</th><th>Governance</th><th>Used by</th></tr></thead><tbody>${E.DATASETS.map((d) => `<tr class="click" data-drawer="dataset:${d.id}"><td><b>${h(d.id)}</b></td><td>${h(d.kind)}</td><td class="num">${si(d.tokens)}</td><td class="num">${fmt(d.shards)}</td><td>${h(d.format)}</td><td class="mono">${d.snapshot}</td><td>${pill(d.governance === 'Approved' ? 'ok' : 'warn', d.governance)}</td><td class="small">${h(used(d.id).join(', ') || 'none')}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="card c12"><h3>Streaming loader for the 70B run</h3>${loaderMath(F)}</div></div>`;
};
function loaderMath(F) {
  const j = F.job('pt-core-70b-v3'), p = F.perf(j), ranks = j.cfg.dp;
  const need = p.tps, perRank = need / ranks, bytes = need * 2.1;
  return glist([['Needed', `${si(need)} tokens/s for ${fmt(E.jobGpus(j))} GPUs; only the ${ranks} data-parallel ranks read data (TP and PP peers receive it by broadcast)`], ['Per reader', `${si(perRank)} tokens/s, about ${gb(bytes / ranks)}/s of compressed shards`], ['Aggregate read', `${gb(bytes)}/s from object storage, under 2% of the bucket's limit`], ['Shuffle', 'Shard order permuted per epoch with a seeded Feistel permutation; 16K-sample buffer per reader'], ['Resume', 'Loader position (epoch, shard, offset, RNG) is saved in every checkpoint, so a restart replays no data'], ['Headroom', 'Readers deliver 3.4× the needed rate; prefetch 4 shards ahead to local NVMe']]);
}
DRAWERS.dataset = (id) => {
  const d = E.DATASETS.find((x) => x.id === id);
  return { title: d.id, sub: d.kind, glyph: 'training', body: glist([['Tokens', si(d.tokens)], ['Shards', fmt(d.shards)], ['Format', d.format], ['Snapshot', `#${d.snapshot}, immutable`], ['Governance', pill(d.governance === 'Approved' ? 'ok' : 'warn', d.governance)], ['Location', `s3://acme-train/${d.id}/snap-${d.snapshot}/`]]) + `<h4 class="insp-h">Mixture</h4>${d.sources.map(([k, w]) => `<div class="bar-row"><span>${h(k)}</span><div class="track"><div class="fill" style="width:${w * 100}%"></div></div><span class="v">${(w * 100).toFixed(0)}%</span></div>`).join('')}<p class="insp-p">Mixture weights are applied by the loader per step with a deterministic seed, so the exact mixture is reproducible at any step.</p>` };
};

DRAWERS.node = (id) => {
  const [cl, k] = id.split('|'), c = E.CLUSTERS.find((x) => x.id === cl), name = `${cl.slice(0, 6)}-n${String(k).padStart(4, '0')}`;
  const j = ctx.F.job('pt-core-70b-v3');
  const bad = j.straggler && +k === 311 % Math.min(256, E.jobGpus(j) / 8) && cl === j.cluster;
  return { title: name, sub: `${c.id} · 8 × ${E.HW[c.hw].name}`, glyph: 'compute', body: glist([['State', bad ? pill('warn', 'Straggler') : pill('ok', 'Healthy')], ['GPUs', `8 × ${E.HW[c.hw].name}, ${E.HW[c.hw].mem} GB`], ['SM clock', bad ? '1.59 GHz on GPU 5 (peers 1.98)' : '1.98 GHz'], ['GPU temperature', bad ? '87 °C on GPU 5' : '61 to 66 °C'], ['ECC errors (24 h)', '0'], ['NVLink', '18 links up'], ['InfiniBand', '8 × 400G, no flaps'], ['Last burn-in', '9 days ago, passed']]) + (bad ? `<div class="row"><button class="btn primary" data-act="cordon-straggler" ${can('sre', 'platform') ? '' : 'disabled'}>Cordon and replace</button></div>` : '') };
};
