/* Time-series charts: axes, gridlines, time labels, hover crosshair with a
   tooltip, lines or stacked areas. Pure SVG strings plus one hover listener. */

export const RANGES = {
  '1h': { ms: 36e5, points: 60, label: 'Last hour' },
  '24h': { ms: 864e5, points: 96, label: 'Last 24 hours' },
  '7d': { ms: 6048e5, points: 84, label: 'Last 7 days' },
  '30d': { ms: 2592e6, points: 90, label: 'Last 30 days' },
};

function hash(str) { let x = 2166136261; for (const c of str) x = Math.imul(x ^ c.charCodeAt(0), 16777619); return x >>> 0; }
function noise(seed, i) { let t = (seed + i * 0x9e3779b9) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }

/** Deterministic history for a metric: base level, daily rhythm, noise, optional incidents. */
export function history(key, range, { base, jitter = 0.08, daily = 0.25, spikes = [], live = null, min = 0 }) {
  const R = RANGES[range], now = Date.now(), step = R.ms / R.points, seed = hash(key + range);
  const pts = [];
  for (let i = 0; i <= R.points; i++) {
    const t = now - R.ms + i * step;
    const hour = new Date(t).getUTCHours() + new Date(t).getUTCMinutes() / 60;
    let v = base * (1 + daily * Math.sin(((hour - 9) / 24) * 2 * Math.PI)) * (1 + (noise(seed, Math.floor(t / step)) - 0.5) * 2 * jitter);
    for (const sp of spikes) if (Math.abs(t - (now - sp.ago)) < step * (sp.width || 1.5)) v *= sp.factor;
    pts.push([t, Math.max(min, v)]);
  }
  if (live !== null && live !== undefined) pts[pts.length - 1] = [now, live];
  return pts;
}

const CHARTS = new Map();
let uid = 0;

function fmtTime(t, range) {
  const d = new Date(t);
  if (range === 'live') return d.toLocaleTimeString('en-US', { minute: '2-digit', second: '2-digit', hour12: false });
  if (range === '1h' || range === '24h') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }

/**
 * series: [{ name, color, points: [[t, v]] }]
 * opts: { range, height, fmt(v), stacked, area, threshold: { value, label } }
 */
export function tsChart(series, opts = {}) {
  const id = 'c' + ++uid, W = opts.w || 820, H = opts.height || 180, L = 44, Rr = 10, T = 10, B = 22;
  const fmt = opts.fmt || ((v) => (v >= 1e6 ? (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'M' : v >= 1000 ? (v / 1000).toFixed(v >= 1e4 ? 0 : 1) + 'k' : v >= 10 ? String(Math.round(v)) : v === 0 ? '0' : v.toFixed(1)));
  const n = series[0].points.length;
  const t0 = series[0].points[0][0], t1 = series[0].points[n - 1][0];
  const stackTop = series[0].points.map((_, i) => series.reduce((a, s) => a + s.points[i][1], 0));
  const peak = opts.stacked ? Math.max(...stackTop) : Math.max(...series.flatMap((s) => s.points.map((p) => p[1])), opts.threshold ? opts.threshold.value : 0);
  const ymax = opts.max || niceMax(peak * 1.1);
  const x = (t) => L + ((t - t0) / (t1 - t0 || 1)) * (W - L - Rr);
  const y = (v) => T + (1 - v / ymax) * (H - T - B);
  let grid = '';
  for (let i = 0; i <= 4; i++) { const v = (ymax / 4) * i, yy = y(v); grid += `<line x1="${L}" x2="${W - Rr}" y1="${yy}" y2="${yy}" class="gl"/><text x="${L - 6}" y="${yy + 3}" class="yl">${fmt(v)}</text>`; }
  for (let i = 0; i <= 4; i++) { const t = t0 + ((t1 - t0) / 4) * i; grid += `<text x="${x(t)}" y="${H - 6}" class="xl" text-anchor="${i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}">${fmtTime(t, opts.range || '24h')}</text>`; }
  let paths = '';
  const base = new Array(n).fill(0);
  for (const s of series) {
    const top = s.points.map((p, i) => (opts.stacked ? base[i] + p[1] : p[1]));
    const line = s.points.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(top[i]).toFixed(1)}`).join('');
    if (opts.stacked || opts.area) {
      const bottom = s.points.map((p, i) => `L${x(p[0]).toFixed(1)},${y(opts.stacked ? base[i] : 0).toFixed(1)}`).reverse().join('');
      paths += `<path d="${line}${bottom}Z" fill="${s.color}" fill-opacity="${opts.stacked ? 0.55 : 0.12}" stroke="none"/>`;
    }
    paths += `<path d="${line}" fill="none" stroke="${s.color}" stroke-width="1.6" stroke-linejoin="round"/>`;
    if (opts.stacked) top.forEach((v, i) => (base[i] = v));
  }
  if (opts.threshold) { const yy = y(opts.threshold.value); paths += `<line x1="${L}" x2="${W - Rr}" y1="${yy}" y2="${yy}" class="th"/><text x="${W - Rr}" y="${yy - 4}" class="thl" text-anchor="end">${opts.threshold.label}</text>`; }
  CHARTS.set(id, { series, x, y, L, W, Rr, fmt, stacked: opts.stacked, range: opts.range || '24h', H, T, B });
  const legend = series.length > 1 ? `<div class="ts-legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('')}</div>` : '';
  return `<div class="ts" data-chart="${id}"><svg class="ts-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}${paths}<line class="xh" x1="0" x2="0" y1="${T}" y2="${H - B}" style="display:none"/></svg><div class="ts-tip" hidden></div></div>${legend}`;
}

export function initChartHover(root = document) {
  root.addEventListener('mousemove', (e) => {
    const box = e.target.closest && e.target.closest('.ts');
    document.querySelectorAll('.ts .xh').forEach((l) => { if (!box || !box.contains(l)) l.style.display = 'none'; });
    document.querySelectorAll('.ts .ts-tip').forEach((tp) => { if (!box || !box.contains(tp)) tp.hidden = true; });
    if (!box) return;
    const c = CHARTS.get(box.dataset.chart);
    if (!c) return;
    const r = box.getBoundingClientRect(), sx = ((e.clientX - r.left) / r.width) * c.W;
    const pts = c.series[0].points;
    let i = 0, best = Infinity;
    pts.forEach((p, k) => { const d = Math.abs(c.x(p[0]) - sx); if (d < best) { best = d; i = k; } });
    const xx = c.x(pts[i][0]);
    const line = box.querySelector('.xh');
    line.setAttribute('x1', xx); line.setAttribute('x2', xx); line.style.display = '';
    const tip = box.querySelector('.ts-tip');
    const when = new Date(pts[i][0]).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    tip.innerHTML = `<b>${when}</b>` + c.series.map((s) => `<span><i style="background:${s.color}"></i>${s.name}<em>${c.fmt(s.points[i][1])}</em></span>`).join('');
    tip.hidden = false;
    const left = (xx / c.W) * r.width;
    tip.style.left = Math.min(Math.max(left + 12, 0), r.width - 180) + 'px';
  });
}

/** Compact sparkline for table cells. */
export function spark(points, color = 'var(--blue)') {
  const W = 80, H = 22, vs = points.map((p) => p[1]), mx = Math.max(...vs), mn = Math.min(...vs);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${((i / (points.length - 1)) * W).toFixed(1)},${(H - 2 - ((p[1] - mn) / (mx - mn || 1)) * (H - 4)).toFixed(1)}`).join('');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.4"/></svg>`;
}
