/* Shared console state and helpers. Every view module imports this one file
   (same URL, so one instance) and registers into VIEWS, ACTIONS and CLICKS. */
import * as E from './sim.js?v=20261030-8';
export { E };

export const $ = (s, r = document) => r.querySelector(s);
export const h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const time = (t) => new Date(t).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });
export const date = (t) => new Date(t).toISOString().slice(0, 10);
export const initials = (n) => n.split(' ').map((x) => x[0]).join('');
export const si = (n, d = 1) => { const a = Math.abs(n); return a >= 1e12 ? (n / 1e12).toFixed(d) + 'T' : a >= 1e9 ? (n / 1e9).toFixed(d) + 'B' : a >= 1e6 ? (n / 1e6).toFixed(d) + 'M' : a >= 1e3 ? (n / 1e3).toFixed(d) + 'K' : fmt(n, a < 10 && n % 1 ? 1 : 0); };
export const gb = (b) => (b / 1e9).toFixed(b >= 1e11 ? 0 : 1) + ' GB';
export const ms = (s) => (s === Infinity ? 'saturated' : s >= 1 ? s.toFixed(2) + ' s' : (s * 1000).toFixed(s < 0.01 ? 1 : 0) + ' ms');
export const dur = (sec) => sec >= 86400 ? `${Math.floor(sec / 86400)}d ${Math.round((sec % 86400) / 3600)}h` : sec >= 3600 ? `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m` : sec >= 60 ? `${Math.round(sec / 60)} min` : `${Math.max(1, Math.round(sec))} s`;
export const ago = (t) => { const s = (Date.now() - t) / 1000; return s < 60 ? 'just now' : s < 5400 ? Math.round(s / 60) + ' min ago' : s < 129600 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' d ago'; };
/* Latency percentiles from the mean-value model: TTFT has a heavier tail (queueing behind prefills) than ITL. */
export const p90 = (x) => ({ ttft: x.ttft * E.P90.ttft, itl: x.itl * E.P90.itl });
export const usd = (v) => '$' + (v >= 1000 ? fmt(v) : v >= 10 ? v.toFixed(0) : v.toFixed(2));
export const store = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
  del: (k) => { try { sessionStorage.removeItem(k); } catch { /* private mode */ } },
};

export const ctx = { F: null };
export const S = {
  view: 'overview', role: null, open: new Set(['home']), inspector: true, drawer: null, range: '24h',
  run: 'pt-core-70b-v3', runTab: 'overview', runFilter: 'all',
  dep: 'assistant-70b', depTab: 'overview', tune: {},
  cluster: 'usw2-h100-a', ray: 'rl-core-70b-reason', model: 'core-70b', bench: [],
  planner: { arch: 'core-70b', hw: 'h100', gpus: 1024, seq: 8192, batch: 4194304, fp8: false, pick: 0 },
  cap: { arch: 'core-70b', hw: 'h100', tp: 4, quant: 'fp8', kvq: 'fp8', prompt: 1800, out: 350, prefixHit: 0.6, spec: 'eagle', disagg: 0, ttft: 1.2, itl: 0.04 },
};

export const VIEWS = {};
export const AFTER = {};
export const ACTIONS = {};
export const CLICKS = [];   // [attr, handler(el, e)] pairs for data-* clicks
export const EXPORTS = {};
export const DRAWERS = {};  // kind -> (id) => { title, sub, glyph, body }
export const EV = { recovered: 'ok', failed: 'deny', alert: 'warn', deploy: 'blue', admitted: 'ok', submitted: '', promoted: 'ok', rollback: 'warn', scaled: '', checkpoint: '', benchmark: 'blue', cordoned: 'warn', resumed: 'ok', detected: 'deny' };

export const ICON = {
  home: '<path d="M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1h-3.5v-5h-5v5H4a1 1 0 0 1-1-1z"/>',
  training: '<path d="M3 16.5 7.5 11l3 3L17 6.5"/><path d="M13 6.5h4v4"/>',
  post: '<path d="M10 3v4m0 6v4M3 10h4m6 0h4"/><circle cx="10" cy="10" r="3"/>',
  inference: '<path d="M11.5 2.5 5 11h5l-1.5 6.5L15 9h-5z"/>',
  compute: '<rect x="3" y="4" width="14" height="5" rx="1.5"/><rect x="3" y="11" width="14" height="5" rx="1.5"/><path d="M6 6.5h.1M6 13.5h.1"/>',
  models: '<path d="M10 2.5 17 6.5v7L10 17.5 3 13.5v-7z"/><path d="M3 6.5 10 10.5l7-4M10 10.5v7"/>',
  dev: '<path d="m7 6-4 4 4 4m6-8 4 4-4 4M11.5 4l-3 12"/>',
  settings: '<circle cx="10" cy="10" r="2.5"/><path d="M10 2.5v2m0 11v2m7.5-7.5h-2m-11 0h-2m12.8-5.3-1.4 1.4m-7.8 7.8-1.4 1.4m10.6 0-1.4-1.4M6.1 6.1 4.7 4.7"/>',
  search: '<circle cx="9" cy="9" r="5.5"/><path d="m13 13 4 4"/>',
  bell: '<path d="M5 8a5 5 0 0 1 10 0c0 4 1.5 5.5 1.5 5.5h-13S5 12 5 8M8 16a2 2 0 0 0 4 0"/>',
  bolt: '<path d="M11.5 2.5 5 11h5l-1.5 6.5L15 9h-5z"/>',
  flask: '<path d="M8 3h4M8.5 3v5L4 16a1 1 0 0 0 .9 1.5h10.2A1 1 0 0 0 16 16l-4.5-8V3"/>',
  gauge: '<path d="M3.5 14a7 7 0 1 1 13 0"/><path d="m10 11 3-4"/>',
  play: '<path d="M6 4.5v11l9-5.5z"/>',
  info: '<circle cx="10" cy="10" r="7.5"/><path d="M10 9v5M10 6.2v.1"/>',
};
export const icon = (k) => `<svg class="ic" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k] || ICON.home}</svg>`;

export const head = (title, sub, how) => `<div class="view-head"><div class="vh-t"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="vh-a">${how ? `<details class="how"><summary>${ICON.info ? icon('info') : ''}How it works</summary><p>${how}</p></details>` : ''}${EXPORTS[S.view] ? `<button class="btn" data-act="export" data-key="${S.view}">Export</button>` : ''}<button class="btn" data-act="share">Share</button></div></div>`;
/* KPI tile with change vs previous period and a sparkline. invert: lower is better. */
export function kpi2(label, value, sub, delta, seed, level, invert = false) {
  const n = 24, pts = [];
  let x = 0; for (const ch of seed) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  for (let i = 0; i < n; i++) { const r = Math.sin(x + i * 1.7) * 0.5 + Math.sin(x * 0.3 + i * 0.4) * 0.5; pts.push(level * (1 - delta / 100 * (1 - i / (n - 1))) * (1 + r * 0.025)); }
  const mx = Math.max(...pts), mn = Math.min(...pts), d = pts.map((v, i) => `${i ? 'L' : 'M'}${(i / (n - 1) * 100).toFixed(1)},${(26 - (v - mn) / (mx - mn || 1) * 22).toFixed(1)}`).join('');
  const good = invert ? delta < 0 : delta > 0;
  return `<div class="card c3 kpi2"><div class="k2-h"><span>${label}</span><em class="${good ? 'up' : 'down'}">${delta > 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}%</em></div><b>${value}</b><svg viewBox="0 0 100 28" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="${good ? '#34c759' : '#ff9f0a'}" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg><small>${sub} · vs previous ${S.range}</small></div>`;
}
export const kpi = (v, label, sub, cls = '', span = 'c3') => `<div class="card ${span} kpi ${cls}"><b>${v}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
export const pill = (cls, text) => `<span class="pill ${h(cls)}">${h(text ?? cls)}</span>`;
export const glist = (rows) => `<div class="glist">${rows.filter(Boolean).map(([k, v]) => `<div class="grow"><span>${k}</span><span>${v}</span></div>`).join('')}</div>`;
export const bars = (rows, cls = '') => {
  const max = Math.max(1e-9, ...rows.map((r) => r[1]));
  return `<div class="bars">${rows.map(([k, v, label]) => `<div class="bar-row"><span title="${h(k)}">${h(k)}</span><div class="track"><div class="fill ${cls}" style="width:${(100 * v / max).toFixed(1)}%"></div></div><span class="v">${label ?? fmt(v)}</span></div>`).join('')}</div>`;
};
/** Horizontal stacked bar with legend: parts = [[label, value, color]]. */
export const stack = (parts, fmtv = (v) => v.toFixed(2)) => {
  const tot = parts.reduce((a, p) => a + p[1], 0) || 1;
  return `<div class="stack">${parts.filter((p) => p[1] > 0).map(([k, v, c]) => `<i style="width:${(100 * v / tot).toFixed(2)}%;background:${c}" title="${h(k)}: ${fmtv(v)}"></i>`).join('')}</div><div class="stack-lg">${parts.filter((p) => p[1] > 0).map(([k, v, c]) => `<span><i style="background:${c}"></i>${h(k)} <b>${fmtv(v)}</b>${String(fmtv(v)).endsWith('%') ? '' : ` <em>${(100 * v / tot).toFixed(0)}%</em>`}</span>`).join('')}</div>`;
};
export const seg = (attr, cur, opts) => `<div class="seg">${opts.map(([k, t]) => `<button class="${String(k) === String(cur) ? 'on' : ''}" data-${attr}="${h(k)}">${t}</button>`).join('')}</div>`;
export const F_ = {};
export const match = (key, ...fields) => { const q = (F_[key] || '').trim().toLowerCase(); return !q || fields.some((x) => String(x ?? '').toLowerCase().includes(q)); };
export const csv = (rows) => rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

export const can = (...roles) => roles.includes(S.role);
export const roleNote = (...roles) => can(...roles) ? '' : `<p class="note">Only ${roles.map((r) => E.ROLES[r].title.toLowerCase() + 's').join(' or ')} can do this. You are signed in as ${E.ROLES[S.role].title.toLowerCase()}.</p>`;
export const me = () => E.ROLES[S.role];

/* Palette: one meaning per color across charts and stacks. */
export const C = { blue: '#0a84ff', teal: '#30b0c7', green: '#34c759', amber: '#ff9f0a', red: '#ff3b30', purple: '#8e6cf0', gray: '#8e8e93', pink: '#ff6482', indigo: '#5e5ce6' };

export function toast(text) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = text;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3800);
}

/* Render hooks the shell fills in, so view modules can request a redraw. */
export const ui = { render: () => {}, renderChrome: () => {}, go: () => {}, openDrawer: () => {}, closeDrawer: () => {}, openForm: () => {} };

/** Scatter/line chart with numeric axes: series = [{ name, color, pts: [[x, y]], dash }]. */
export function xyChart(series, { w = 1000, hgt = 220, xl = '', yl = '', fx = (v) => si(v), fy = (v) => si(v), ymax, ymin = 0, xmax, hline, marks = [] } = {}) {
  const L = 48, R = 12, T = 12, B = 30;
  const xs = series.flatMap((s) => s.pts.map((p) => p[0])), ys = series.flatMap((s) => s.pts.map((p) => p[1])).filter(Number.isFinite);
  const X = xmax || Math.max(...xs, 1) * 1.04, Y = ymax || Math.max(...ys, hline || 0, 1e-9) * 1.1;
  const x = (v) => L + (v / X) * (w - L - R), y = (v) => T + (1 - (Math.max(ymin, Math.min(v, Y)) - ymin) / (Y - ymin)) * (hgt - T - B);
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = ymin + ((Y - ymin) / 4) * i; g += `<line x1="${L}" x2="${w - R}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${L - 6}" y="${y(v) + 3}" class="yl">${fy(v)}</text>`; }
  for (let i = 0; i <= 4; i++) { const v = (X / 4) * i; g += `<text x="${x(v)}" y="${hgt - 12}" class="xl" text-anchor="${i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}">${fx(v)}</text>`; }
  g += `<text x="${w - R}" y="${hgt - 1}" class="xl" text-anchor="end">${h(xl)}</text><text x="${L}" y="${T - 2}" class="xl">${h(yl)}</text>`;
  if (hline) g += `<line x1="${L}" x2="${w - R}" y1="${y(hline.v)}" y2="${y(hline.v)}" class="th"/><text x="${w - R}" y="${y(hline.v) - 4}" class="thl" text-anchor="end">${h(hline.label)}</text>`;
  for (const s of series) {
    const pts = s.pts.filter((p) => Number.isFinite(p[1]));
    if (!pts.length) continue;
    g += `<path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('')}" fill="none" stroke="${s.color}" stroke-width="1.8" ${s.dash ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round"/>`;
    if (s.dots) g += pts.map((p) => `<circle cx="${x(p[0]).toFixed(1)}" cy="${y(p[1]).toFixed(1)}" r="2.4" fill="${s.color}"/>`).join('');
  }
  for (const m of marks) g += `<circle cx="${x(m.x)}" cy="${y(m.y)}" r="4.5" fill="${m.color}" stroke="var(--surface)" stroke-width="2"/><text x="${x(m.x) + (x(m.x) > w * 0.7 ? -8 : 8)}" y="${y(m.y) - 7}" class="mk" text-anchor="${x(m.x) > w * 0.7 ? 'end' : 'start'}">${h(m.label)}</text>`;
  const legend = series.length > 1 ? `<div class="ts-legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${h(s.name)}</span>`).join('')}</div>` : '';
  return `<div class="ts"><svg class="ts-svg xy" viewBox="0 0 ${w} ${hgt}">${g}</svg></div>${legend}`;
}
