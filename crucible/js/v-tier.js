/* Weight tiering: keep hot experts in GPU memory, park cold ones in CPU memory or on NVMe,
   and promote them back on demand. */
import { h, fmt, S, VIEWS, ACTIONS, CLICKS, EXPORTS, head, pill, seg, C, toast } from './core.js?v=20261102-3';

/* mb: one expert in one layer. kv: KV bytes per token. gpus × 80 GB H100. rate: tokens/s per replica. */
const MODELS = [
  { id: 'qwen3-235b', name: 'Qwen3 235B A22B', experts: 128, topk: 8, layers: 94, mb: 18.9, base: 8.2, kv: 96256, gpus: 4, rate: 6200, quant: 'FP8' },
  { id: 'gpt-oss-120b', name: 'gpt-oss 120B', experts: 128, topk: 4, layers: 36, mb: 13.2, base: 4.1, kv: 36864, gpus: 1, rate: 11800, quant: 'MXFP4' },
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B (dense)', dense: true, layers: 80, gb: 70.6, kv: 163840, gpus: 2, rate: 5400, quant: 'FP8' },
];
const TIERS = {
  hbm: ['GPU memory', 'HBM3, 3.35 TB/s', 3350, C.blue],
  dram: ['CPU memory', 'PCIe Gen5, about 25 GB/s', 25, C.teal],
  nvme: ['Local NVMe', 'Gen4 to Gen5, 7 to 14 GB/s', 7, C.amber],
};
const OFF = [[0, 'Never'], [60, '1 min'], [600, '10 min'], [3600, '1 h']];
const SSD = [[86400, '1 day'], [604800, '7 days'], [2592000, '30 days'], [7776000, '90 days']];
const CTX = 8192, REQ = 1500;

S.wt = S.wt || { model: 'qwen3-235b', off: 600, ssd: 2592000, hot: {}, log: [] };

/* Seconds since each expert was last routed a token, from last quarter's router logs. */
function idles(m) {
  let x = 0; for (const ch of m.id) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
  const span = (a, b) => a * Math.pow(b / a, rnd());
  return Array.from({ length: m.experts }, (_, i) => {
    const u = rnd();
    const s = u < 0.66 ? span(0.05, 20) : u < 0.82 ? span(60, 21600) : u < 0.92 ? span(21600, 604800) : span(604800, 1.1e7);
    return S.wt.hot[m.id + i] ? 1 : s;
  });
}
const tier = (s, P) => !P.off || s < P.off ? 'hbm' : s < P.ssd ? 'dram' : 'nvme';
const ago = (s) => s < 60 ? `${Math.max(1, Math.round(s))} s` : s < 3600 ? `${Math.round(s / 60)} min` : s < 86400 ? `${Math.round(s / 3600)} h` : `${Math.round(s / 86400)} days`;
const gbs = (g) => g >= 100 ? `${fmt(Math.round(g))} GB` : `${g.toFixed(1)} GB`;
const msf = (v) => v >= 100 ? `${fmt(Math.round(v))} ms` : `${v.toFixed(1)} ms`;
const odds = (p) => p <= 0 ? 'none' : p >= 0.01 ? `${(p * 100).toFixed(1)}%` : 1 / p >= 1e6 ? `1 in ${(1 / p / 1e6).toFixed(0)} million` : `1 in ${fmt(Math.round(1 / p))}`;

function plan(m, P) {
  const cap = m.gpus * 80 * 0.92;
  if (m.dense) {
    const seqs = Math.floor((cap - m.gb) * 1e9 / (m.kv * CTX));
    return { cap, weights: m.gb, freed: 0, seqs, more: 0, cnt: { hbm: m.layers, dram: 0, nvme: 0 } };
  }
  const id = idles(m), t = id.map((s) => tier(s, P)), all = m.experts * m.layers * m.mb / 1000;
  const cnt = { hbm: 0, dram: 0, nvme: 0 }; t.forEach((k) => cnt[k]++);
  const freed = (cnt.dram + cnt.nvme) / m.experts * all, weights = m.base + all;
  const per = m.kv * CTX / 1e9, seqs = Math.floor((cap - weights) / per), more = Math.floor(freed / per);
  /* A request of REQ tokens reaches expert j with probability 1 - exp(-REQ / (idle_j × rate)). */
  const hit = (k) => 1 - id.reduce((a, s, i) => a * (t[i] === k ? Math.exp(-REQ / (s * m.rate)) : 1), 1);
  const one = { dram: m.mb / TIERS.dram[2], nvme: m.mb / TIERS.nvme[2] + m.mb / TIERS.dram[2] };
  return { cap, weights, freed, seqs, more, cnt, id, t, pd: hit('dram'), pn: hit('nvme'), one };
}

VIEWS.tiering = () => {
  const P = S.wt, m = MODELS.find((x) => x.id === P.model) || MODELS[0], R = plan(m, P);
  const cell = (k, i) => `<i style="background:${TIERS[k][3]}" title="Expert ${i} · last used ${ago(R.id[i])} ago · ${TIERS[k][0]}"></i>`;
  const tiers = Object.entries(TIERS).map(([k, [name, bw, rate, col]]) => {
    const n = R.cnt[k], sz = m.dense ? (k === 'hbm' ? m.gb : 0) : n / m.experts * m.experts * m.layers * m.mb / 1000 + (k === 'hbm' ? m.base : 0);
    const move = m.dense || k === 'hbm' ? '' : `${msf(m.mb / rate)} to move one expert`;
    return `<div class="card c4 wt-tier"><span><i class="wt-dot" style="background:${col}"></i>${name}</span><b>${gbs(sz)}</b><p>${m.dense ? (k === 'hbm' ? `All ${m.layers} layers` : 'Nothing parked') : `${n} of ${m.experts} experts`}</p><small>${bw}${move ? ' · ' + move : ''}</small></div>`;
  }).join('');
  const kpi = (t, v, n) => `<div class="card c3 lever"><span>${t}</span><b>${v}</b><p>${n}</p></div>`;
  const coldest = m.dense ? [] : R.id.map((s, i) => [i, s]).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const body = m.dense
    ? `<div class="card c12"><h3>Nothing to park</h3><p class="note">${h(m.name.replace(' (dense)', ''))} is dense: every weight takes part in every token, so no block ever goes idle. Tiering pays off on mixture-of-experts models, where the router leaves some experts untouched for days. To free memory here, quantize the weights or move the KV cache instead.</p></div>`
    : `${kpi('GPU memory freed', gbs(R.freed), `${Math.round(R.freed / (m.gpus * 80) * 100)}% of ${m.gpus} × H100, returned to the KV cache`)}
      ${kpi('More requests at once', `+${fmt(R.more)}`, `${fmt(R.seqs)} → ${fmt(R.seqs + R.more)} sequences of ${fmt(CTX)} tokens`)}
      ${kpi('Requests that wait on a cold expert', odds(R.pd + R.pn), `CPU memory ${odds(R.pd)}, NVMe ${odds(R.pn)}`)}
      ${kpi('Pause when they do', `${msf(R.one.nvme)}`, `Per expert from NVMe, ${msf(R.one.dram)} from CPU memory. A request that misses in every layer waits ${msf(R.one.nvme * m.layers)}.`)}
      <div class="card c8"><h3>Where each expert lives <span class="right">Layer ${Math.round(m.layers / 2)}, ${m.experts} experts, top ${m.topk} routing</span></h3>
        <div class="wt-grid">${R.t.map(cell).join('')}</div>
        <div class="wt-key">${Object.entries(TIERS).map(([k, [n, , , c]]) => `<span><i style="background:${c}"></i>${n} ${R.cnt[k]}</span>`).join('')}</div>
        <p class="note">Each square is one expert. The policy runs per layer every few seconds; usage over months only decides what to park first. Other layers follow a similar pattern.</p></div>
      <div class="card c4"><h3>Coldest experts</h3><table class="table"><thead><tr><th>Expert</th><th class="num">Last used</th><th>Tier</th></tr></thead><tbody>${coldest.map(([i, s]) => `<tr><td>${i}</td><td class="num">${ago(s)} ago</td><td>${pill(tier(s, P) === 'nvme' ? 'amber' : tier(s, P) === 'dram' ? 'teal' : 'blue', TIERS[tier(s, P)][0])}</td></tr>`).join('')}</tbody></table>
        <button class="btn" data-act="wt-rare" style="margin-top:12px">Send a rare request</button></div>
      ${P.log.length ? `<div class="card c12"><h3>Promotions</h3><table class="table"><thead><tr><th>Request</th><th>Expert</th><th>Path</th><th class="num">Waited</th></tr></thead><tbody>${P.log.slice(0, 5).map((r) => `<tr><td>${h(r.req)}</td><td>${r.e}</td><td>${r.path}</td><td class="num">${msf(r.ms)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
  return head('Weight tiering', 'Keep hot experts in GPU memory, park the ones nobody uses in CPU memory or on NVMe, and bring them back the moment a request needs them.',
    'The router logs which experts each token visits. Experts idle past the first threshold leave GPU memory for CPU memory; idle past the second, they go to local NVMe. When a request routes to a parked expert, it is read back up the chain while that layer waits. The freed GPU memory holds more KV cache, so more requests run at once.') + `<div class="grid">
    <div class="card c12 wt-bar"><label class="field inline">Model <select data-bind="wt.model" data-num="no">${MODELS.map((x) => `<option value="${x.id}"${x.id === m.id ? ' selected' : ''}>${h(x.name)}</option>`).join('')}</select></label>
      <span class="wt-ctl">Leave GPU after idle ${seg('wtoff', P.off, OFF)}</span><span class="wt-ctl">Move to NVMe after idle ${seg('wtssd', P.ssd, SSD)}</span></div>
    ${tiers}${body}</div>`;
};

CLICKS.push(['wtoff', (v) => { S.wt.off = +v; }], ['wtssd', (v) => { S.wt.ssd = +v; }]);
ACTIONS['wt-rare'] = () => {
  const P = S.wt, m = MODELS.find((x) => x.id === P.model);
  if (!m || m.dense) return;
  const R = plan(m, P), i = R.id.reduce((b, s, j) => (s > R.id[b] ? j : b), 0), k = R.t[i];
  const wait = k === 'hbm' ? 0 : R.one[k];
  P.hot[m.id + i] = true;
  P.log.unshift({ req: `req-${(Date.now() % 1e6).toString(36)}`, e: i, path: k === 'nvme' ? 'NVMe → CPU memory → GPU' : k === 'dram' ? 'CPU memory → GPU' : 'Already in GPU', ms: wait });
  toast(k === 'hbm' ? `Expert ${i} was already in GPU memory` : `Expert ${i} promoted to GPU memory in ${msf(wait)}`);
};
EXPORTS.tiering = () => {
  const m = MODELS.find((x) => x.id === S.wt.model);
  if (!m || m.dense) return [['Model', 'Note'], [m ? m.name : '', 'Dense model, nothing to tier']];
  const R = plan(m, S.wt);
  return [['Expert', 'Last used (s)', 'Tier'], ...R.id.map((s, i) => [i, Math.round(s), TIERS[R.t[i]][0]])];
};
