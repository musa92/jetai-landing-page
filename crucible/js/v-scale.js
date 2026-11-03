/* Scaling simulator: one model endpoint through a day of traffic. Demand
   forecast, autoscaling policy, replica cold starts with parallel weight
   loading, serving latency and GPU cost, all stepped live. */
import { E, h, fmt, si, usd, S, VIEWS, AFTER, ACTIONS, CLICKS, head, pill, seg, xyChart, C, toast } from './core.js?v=20261102-3';
import { OSS, SRC, sizeB, coldStart } from './v-host.js?v=20261102-3';

const MODELS = {
  'llama-3.3-70b': { cap: 7.2, peak: 64, slo: 1.0, max: 16 },
  'qwen3-235b': { cap: 4.4, peak: 30, slo: 1.5, max: 12 },
  'gpt-oss-120b': { cap: 9.5, peak: 46, slo: 0.8, max: 10 },
};
const POL = { reactive: 'Reactive', predictive: 'Predictive', static: 'Static at max' };
const SPEED = { 5: '20×', 20: '80×', 60: '240×' };
const STEP = 30;            // autoscaler evaluation period, sim seconds
const TARGET = 0.75;        // target utilization per replica
const DRAIN = 30, POOL = 2, REFILL = 300;
const clock = (t) => { const s = ((t % 86400) + 86400) % 86400; return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}`; };

let SIM = null, timer = null;
S.sim = S.sim || { model: 'llama-3.3-70b', pol: 'predictive', src: 'parallel', spd: 20 };

/* Seasonal profile the forecaster has learned from previous days. */
const profile = (t, p) => { const hr = (t / 3600) % 24; return p.peak * (0.22 + 0.78 * Math.exp(-(((hr - 14.5) / 4.6) ** 2)) + 0.1 * Math.exp(-(((hr - 9.5) / 1.4) ** 2))); };
function demand(t) {
  const p = SIM.p; let d = profile(t, p) * (1 + 0.05 * Math.sin(t / 410) + 0.035 * Math.sin(t / 97 + 1.3));
  for (const b of SIM.bursts) if (t > b.t0) { const a = t - b.t0; d *= 1 + (b.mult - 1) * Math.min(1, a / 90) * Math.exp(-a / 1500); }
  return d;
}
const fc = (tt) => profile(tt, SIM.p) * SIM.level;   // point forecast
const fc90 = (tt) => fc(tt) * 1.12;                   // p90

function phases(warm) {
  const m = SIM.m, parts = coldStart(m, { src: S.sim.src, node: warm ? 'warm' : 'cold', image: warm ? 'cached' : 'cold', compile: 'cached' });
  const get = (re) => parts.filter(([k]) => re.test(k)).reduce((a, p) => a + p[1], 0);
  return [['Provisioning node', get(/node/)], ['Pulling image', get(/Image/)], ['Starting engine', get(/Ray actor/)], ['Loading weights', get(/weights/i)], ['Compiling', get(/compile/)], ['Warming up', get(/Warmup/)]].filter(([, v]) => v > 0);
}
const coldEstimate = () => phases(true).reduce((a, p) => a + p[1], 0);

function reset() {
  const m = OSS.find((x) => x.id === S.sim.model), p = MODELS[m.id];
  SIM = { m, p, t: 3.5 * 3600, reps: [], log: [], hist: [], bursts: [], level: 1, queue: 0, cost: 0, gpuSec: 0, idleGpuSec: 0, slo: [0, 0], colds: 0, pool: POOL, refill: [], seq: 1, low: null, err: [], pend: [], running: true, lastEval: 0 };
  const n = Math.max(1, Math.ceil(demand(SIM.t) / (p.cap * TARGET)));
  for (let i = 0; i < n; i++) SIM.reps.push({ id: SIM.seq++, phase: 'Ready', ph: [], start: SIM.t - 9999 });
  while (SIM.t < 8 * 3600) step(20, true);
}

function addReplica(why) {
  const warm = SIM.pool > 0;
  if (warm) { SIM.pool--; SIM.refill.push(SIM.t + REFILL); }
  const ph = phases(warm);
  SIM.reps.push({ id: SIM.seq++, phase: ph[0][0], ph, start: SIM.t, warm });
  SIM.colds++;
  return warm;
}
function log(text, kind = '') { SIM.log.unshift([SIM.t, text, kind]); SIM.log.length = Math.min(SIM.log.length, 40); }

function autoscale() {
  const p = SIM.p, live = SIM.reps.filter((r) => r.phase !== 'Draining'), n = live.length;
  const recent = SIM.hist.slice(-4).map((x) => x[1]), d = recent.reduce((a, v) => a + v, 0) / (recent.length || 1);
  const lead = coldEstimate() + 300;
  let want, why;
  if (S.sim.pol === 'static') { want = p.max; why = 'static'; }
  else if (S.sim.pol === 'reactive') { want = Math.ceil(d / (p.cap * TARGET)); why = `load ${d.toFixed(1)} req/s`; }
  else { const f = Math.max(...[0, 0.25, 0.5, 0.75, 1].map((k) => fc90(SIM.t + lead * k))); want = Math.ceil(Math.max(d, f) / (p.cap * TARGET)); why = `forecast p90 ${f.toFixed(1)} req/s in ${Math.round(lead / 60)} min`; }
  want = Math.max(1, Math.min(p.max, want));
  if (want > n) {
    SIM.low = null;
    let warm = 0; for (let i = n; i < want; i++) warm += addReplica() ? 1 : 0;
    log(`Scale ${n} → ${want}: ${why}. ${warm ? `${warm} from warm pool` : ''}${want - n - warm ? `${warm ? ', ' : ''}${want - n - warm} need a new node` : ''}`, 'up');
  } else if (want < n && live.every((r) => r.phase === 'Ready')) {
    const delay = S.sim.pol === 'predictive' ? 300 : 600;
    if (SIM.low === null) SIM.low = SIM.t;
    if (SIM.t - SIM.low >= delay) {
      const ready = live.filter((r) => r.phase === 'Ready').sort((a, b) => b.start - a.start).slice(0, n - want);
      ready.forEach((r) => { r.phase = 'Draining'; r.drainAt = SIM.t; });
      if (ready.length) log(`Scale ${n} → ${n - ready.length}: ${why}, below target for ${Math.round(delay / 60)} min`, 'down');
      SIM.low = null;
    }
  } else SIM.low = null;
}

function step(dt, quiet) {
  const p = SIM.p, m = SIM.m, rate = E.HW[m.hw].cost / 3600;
  SIM.t += dt;
  SIM.refill = SIM.refill.filter((x) => (x <= SIM.t ? (SIM.pool = Math.min(POOL, SIM.pool + 1), false) : true));
  for (const r of SIM.reps) {
    if (r.phase === 'Ready' || r.phase === 'Draining') continue;
    let el = SIM.t - r.start, done = true;
    for (const [k, v] of r.ph) { if (el < v) { r.phase = k; r.frac = el / v; r.left = v - el; done = false; break; } el -= v; }
    if (done) { r.phase = 'Ready'; if (!quiet) log(`replica-${r.id} ready after ${Math.round(SIM.t - r.start)} s${r.warm ? '' : ', new node'}`, 'ok'); }
  }
  SIM.reps = SIM.reps.filter((r) => !(r.phase === 'Draining' && SIM.t - r.drainAt > DRAIN));
  const d = demand(SIM.t), ready = SIM.reps.filter((r) => r.phase === 'Ready').length, cap = ready * p.cap;
  SIM.queue = Math.max(0, SIM.queue + (d - cap) * dt);
  const util = cap ? Math.min(1, d / cap) : 1;
  const wait = cap ? SIM.queue / cap : 60;
  const ttft = m.bench ? m.bench.ttft : 0.6;
  SIM.ttft = ttft * (1 + 1.8 * util ** 6) + wait;
  SIM.util = util;
  SIM.slo[1] += d * dt; if (SIM.ttft <= p.slo) SIM.slo[0] += d * dt;
  const gpus = SIM.reps.length * m.tp;
  SIM.gpuSec += gpus * dt; SIM.idleGpuSec += (SIM.reps.length - ready * util) * m.tp * dt; SIM.cost += gpus * dt * rate;
  SIM.level += 0.04 * (d / profile(SIM.t, p) - SIM.level) * (dt / 20);
  SIM.pend.push([SIM.t + 900, fc(SIM.t + 900)]);
  while (SIM.pend.length && SIM.pend[0][0] <= SIM.t) { const [, f] = SIM.pend.shift(); SIM.err.push(Math.abs(f - d) / d); if (SIM.err.length > 300) SIM.err.shift(); }
  if (SIM.t - SIM.lastEval >= STEP) { SIM.lastEval = SIM.t; autoscale(); }
  const last = SIM.hist.at(-1);
  if (!last || SIM.t - last[0] >= 60) SIM.hist.push([SIM.t, d, cap, SIM.reps.length, SIM.ttft]);
  if (SIM.hist.length > 400) SIM.hist.shift();
}

/* ───────────────────────── view ───────────────────────── */

VIEWS.simulate = () => {
  if (!SIM || SIM.m.id !== S.sim.model) reset();
  const m = SIM.m, b = sizeB(m), shards = Math.ceil(b / 5e9);
  return head('Scaling simulator', `${h(m.name)} through a working day: the forecaster predicts demand, the autoscaler adds replicas ahead of it, each replica pulls ${(b / 1e9).toFixed(0)} GB of weights in ${shards} shards, and the router serves from the ready ones.`, 'Demand follows the learned daily profile with noise; bursts are unforeseen. The forecaster is the seasonal profile scaled by a level that tracks how today differs from the profile; p90 is 12% above the point forecast. Reactive scales on the last 2 minutes of load. Predictive scales for the p90 forecast one cold start plus 5 minutes ahead. Cold start times come from the Cold start page: warm pool nodes skip provisioning and image pull.') + `<div class="grid">
    <div class="card c12 simbar"><div class="row">
      <label class="field inline">Model <select data-bind="sim.model" data-num="no">${Object.keys(MODELS).map((id) => `<option value="${id}"${id === S.sim.model ? ' selected' : ''}>${h(OSS.find((x) => x.id === id).name)}</option>`).join('')}</select></label>
      ${seg('simpol', S.sim.pol, Object.entries(POL))}
      ${seg('simsrc', S.sim.src, [['serial', '1 stream'], ['parallel', '64 parallel reads'], ['lustre', 'Cluster cache']])}
      ${seg('simspd', S.sim.spd, Object.entries(SPEED))}
      <span class="sp"></span>
      <button class="btn" data-act="sim-burst">Inject 2.5× burst</button>
      <button class="btn" data-act="sim-toggle" id="sim-play">${SIM.running ? 'Pause' : 'Resume'}</button>
      <button class="btn" data-act="sim-reset">Restart day</button></div></div>
    <div class="c12 simkpis" id="sim-kpis"></div>
    <div class="card c8"><h3>Demand, forecast and ready capacity <span class="right" id="sim-clock"></span></h3><div id="sim-chart"></div></div>
    <div class="card c4"><h3>Autoscaler</h3><div id="sim-log" class="simlog"></div></div>
    <div class="card c12"><h3>Replicas <span class="right" id="sim-pool"></span></h3><div id="sim-reps" class="simreps"></div></div>
    <div class="card c12"><h3>Predicted GPUs, next 24 hours <span class="right" id="sim-mape"></span></h3><div id="sim-gpu"></div><p class="note" id="sim-gpunote"></p></div></div>`;
};

function paint() {
  const el = (id) => document.getElementById(id);
  if (!el('sim-kpis') || !SIM) return;
  const p = SIM.p, m = SIM.m, live = SIM.reps.filter((r) => r.phase !== 'Draining');
  const ready = SIM.reps.filter((r) => r.phase === 'Ready').length, starting = live.length - ready;
  const d = demand(SIM.t), slo = SIM.slo[1] ? SIM.slo[0] / SIM.slo[1] : 1;
  const ttftTxt = SIM.ttft > 30 ? 'queued' : SIM.ttft >= 1 ? SIM.ttft.toFixed(2) + ' s' : Math.round(SIM.ttft * 1000) + ' ms';
  const k = (l, v, s, cls = '') => `<div class="simk ${cls}"><span>${l}</span><b>${v}</b><small>${s}</small></div>`;
  el('sim-kpis').innerHTML = [
    k('Demand', `${d.toFixed(1)} req/s`, `forecast ${fc(SIM.t).toFixed(1)}`),
    k('Replicas', `${ready}${starting ? ` <em>+${starting}</em>` : ''}`, starting ? `${starting} starting` : `max ${p.max}`),
    k('GPUs allocated', fmt(SIM.reps.length * m.tp), `${m.tp} × ${E.HW[m.hw].name} each`),
    k('Utilization', Math.round(SIM.util * 100) + '%', `target ${TARGET * 100}%`, SIM.util > 0.92 ? 'warn' : ''),
    k('TTFT p90', ttftTxt, `SLO ${p.slo} s`, SIM.ttft > p.slo ? 'bad' : ''),
    k('Within SLO', (slo * 100).toFixed(2) + '%', 'requests today', slo < 0.99 ? 'warn' : ''),
    k('GPU cost today', usd(SIM.cost), `${fmt(SIM.idleGpuSec / 3600)} idle GPU-h`),
    k('Cold starts', fmt(SIM.colds), `about ${Math.round(coldEstimate())} s each, warm`),
  ].join('');
  el('sim-clock').textContent = `${clock(SIM.t)} · ${POL[S.sim.pol]}${SIM.running ? '' : ' · paused'}`;
  const H = SIM.hist.filter((x) => x[0] >= SIM.t - 4 * 3600), t0 = SIM.t - 4 * 3600;
  const ahead = Array.from({ length: 13 }, (_, i) => SIM.t + i * 150);
  el('sim-chart').innerHTML = xyChart([
    { name: 'Demand', color: C.blue, pts: H.map((x) => [x[0] - t0, x[1]]) },
    { name: 'Ready capacity at target', color: C.green, pts: H.flatMap((x, i) => i ? [[x[0] - t0, H[i - 1][2] * TARGET], [x[0] - t0, x[2] * TARGET]] : [[x[0] - t0, x[2] * TARGET]]) },
    { name: 'Forecast p90, next 30 min', color: C.purple, dash: true, pts: ahead.map((t) => [t - t0, fc90(t)]) },
  ], { w: 760, hgt: 230, xmax: 4.5 * 3600, fx: (v) => clock(t0 + v), fy: (v) => v.toFixed(0), yl: 'req/s', ymax: p.peak * 1.25 * Math.max(1, ...SIM.bursts.filter((b) => SIM.t - b.t0 < 5000).map(() => 2.2)) });
  el('sim-log').innerHTML = SIM.log.slice(0, 14).map(([t, x, kd]) => `<div class="sl ${kd}"><time>${clock(t)}</time><span>${h(x)}</span></div>`).join('') || '<p class="note">Waiting for the first decision.</p>';
  el('sim-pool').textContent = `Warm pool ${SIM.pool} of ${POOL} nodes · weights ${SRC[S.sim.src][0].toLowerCase()}`;
  const b = sizeB(m), nsh = Math.ceil(b / 5e9), conc = S.sim.src === 'serial' ? 1 : Math.min(nsh, 16), waves = Math.ceil(nsh / conc);
  el('sim-reps').innerHTML = SIM.reps.map((r) => {
    const gpus = `<div class="simg">${Array.from({ length: m.tp }, () => `<i class="${r.phase === 'Ready' ? 'on' : r.phase === 'Draining' ? 'dr' : 'ld'}"></i>`).join('')}</div>`;
    let body;
    if (r.phase === 'Ready') body = `<div class="simbarx"><i style="width:${Math.round(SIM.util * 100)}%"></i></div><small>${(Math.min(d, ready * p.cap) / Math.max(1, ready)).toFixed(1)} req/s · KV ${Math.round(40 + SIM.util * 48)}%</small>`;
    else if (r.phase === 'Draining') body = `<small>Finishing in-flight requests, ${Math.max(0, Math.round(DRAIN - (SIM.t - r.drainAt)))} s</small>`;
    else {
      const all = r.ph.reduce((a, x) => a + x[1], 0), el2 = SIM.t - r.start;
      body = `<div class="simbarx ld"><i style="width:${Math.min(100, el2 / all * 100).toFixed(0)}%"></i></div><small>${r.phase} · ${Math.ceil(r.left || 0)} s left of ${Math.round(all)} s</small>`;
      if (r.phase === 'Loading weights') body += `<div class="simsh" style="--n:${Math.min(nsh, 32)}">${Array.from({ length: nsh }, (_, i) => { const f = Math.max(0, Math.min(1, r.frac * waves - Math.floor(i / conc))); return `<i style="--f:${f.toFixed(2)}" class="${f >= 1 ? 'done' : f > 0 ? 'go' : ''}"></i>`; }).join('')}</div><small>${conc} shard${conc > 1 ? 's' : ''} in flight of ${nsh} · ${(b / 1e9 / (r.ph.find((x) => x[0] === 'Loading weights')[1])).toFixed(1)} GB/s</small>`;
    }
    return `<div class="simr ${r.phase === 'Ready' ? 'ready' : r.phase === 'Draining' ? 'drain' : 'start'}"><div class="row between"><b>replica-${r.id}</b>${pill(r.phase === 'Ready' ? 'ok' : r.phase === 'Draining' ? '' : 'blue', r.phase)}</div>${gpus}${body}</div>`;
  }).join('');
  const mape = SIM.err.length ? SIM.err.reduce((a, v) => a + v, 0) / SIM.err.length : 0;
  el('sim-mape').textContent = `15-min forecast error today: ${(mape * 100).toFixed(1)}% MAPE`;
  const hours = Array.from({ length: 25 }, (_, i) => SIM.t + i * 3600);
  const need = (t) => Math.max(1, Math.ceil(fc90(t) / (p.cap * TARGET))) * m.tp;
  const g = hours.map((t, i) => [i, need(t)]), lo = Math.min(...g.map((x) => x[1])), hi = Math.max(...g.map((x) => x[1]));
  el('sim-gpu').innerHTML = xyChart([{ name: 'GPUs needed for p90 demand', color: C.indigo, pts: g.flatMap(([i, v], j) => j ? [[i, g[j - 1][1]], [i, v]] : [[i, v]]) }, { name: 'Reserved baseline', color: C.gray, dash: true, pts: [[0, lo], [24, lo]] }], { w: 1120, hgt: 180, xmax: 24, fx: (v) => clock(SIM.t + v * 3600), fy: (v) => v.toFixed(0) });
  el('sim-gpunote').textContent = `Reserve ${lo} GPUs as the always-on floor; borrow up to ${hi - lo} more from the shared pool between ${clock(SIM.t + g.find((x) => x[1] === hi)[0] * 3600)} and the evening ramp-down. Static sizing at peak would hold ${hi} GPUs all day: ${usd((hi * 24 - g.reduce((a, x) => a + x[1], 0)) * E.HW[m.hw].cost)} a day more.`;
  const pb = document.getElementById('sim-play'); if (pb) pb.textContent = SIM.running ? 'Pause' : 'Resume';
}

AFTER.simulate = () => {
  paint();
  if (timer) return;
  timer = setInterval(() => {
    if (S.view !== 'simulate') { clearInterval(timer); timer = null; return; }
    if (!SIM || !SIM.running) return;
    const n = Math.max(1, S.sim.spd / 5);
    for (let i = 0; i < n; i++) step(5);
    if (SIM.t >= 23.5 * 3600) { SIM.running = false; log('End of day. Restart to replay with another policy.'); }
    paint();
  }, 250);
};

CLICKS.push(['simpol', (v) => { S.sim.pol = v; reset(); toast(`${POL[v]} policy: day restarted`); }],
  ['simsrc', (v) => { S.sim.src = v; }],
  ['simspd', (v) => { S.sim.spd = +v; }]);
ACTIONS['sim-burst'] = () => { SIM.bursts.push({ t0: SIM.t, mult: 2.5 }); log('Burst: traffic 2.5× above forecast', 'warn'); };
ACTIONS['sim-toggle'] = () => { SIM.running = !SIM.running; };
ACTIONS['sim-reset'] = () => { reset(); };
