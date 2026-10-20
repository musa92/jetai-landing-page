/* Live product UI: interactive macOS windows and iPhones, built in HTML.
   Each [data-app] mount holds a static screenshot as the fallback; this file swaps
   in the working app, scales it to fit, and ticks live data while it is on screen.
   Text is set with textContent; innerHTML is only used for the static icon set below. */
(function () {
  'use strict';

  /* ═════════ helpers ═════════ */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.setAttribute('style', v);
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { add(el, k); }); return; }
    el.append(kid instanceof Node ? kid : String(kid));
  }
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* static icon set (trusted strings, 16×16) */
  var I = {
    grid: '<rect x="1" y="1" width="6" height="6" rx="1.6"/><rect x="9" y="1" width="6" height="6" rx="1.6"/><rect x="1" y="9" width="6" height="6" rx="1.6"/><rect x="9" y="9" width="6" height="6" rx="1.6"/>',
    alert: '<path fill-rule="evenodd" d="M8 1.2 15.2 14H.8zM7.2 5.6h1.6v4.6H7.2zm.8 5.4a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8z"/>',
    cal: '<rect x="1.5" y="2.5" width="13" height="12" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M1.5 6.5h13M5 1v3M11 1v3" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    chart: '<path d="M1.5 13.5 5.5 8l3 3 6-8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    list: '<rect x="2.5" y="2.5" width="11" height="11" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    cube: '<path d="M8 1.8 14 5v6l-6 3.2L2 11V5zM2 5l6 3.2L14 5M8 8.2v6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
    deploy: '<path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 13.5h11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    pin: '<path d="M8 1a5 5 0 0 0-5 5c0 3.6 5 9 5 9s5-5.4 5-9a5 5 0 0 0-5-5zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/>',
    factory: '<path d="M1.5 14V7l4 2.5V7l4 2.5V3h5v11z"/>',
    heart: '<path d="M8 14.2 2.3 8.6A3.4 3.4 0 0 1 8 4.2a3.4 3.4 0 0 1 5.7 4.4z"/>',
    leaf: '<path d="M8 14V7.5C8 4.5 10 2.5 14 2.5c0 4-2 6-5 6M8 10C8 7.5 6.5 6 3 6c0 3 1.5 4.5 5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    fan: '<circle cx="8" cy="8" r="2.4"/><path d="M8 1.5c1.6 1.6 1.6 3.6 0 4.6-1.6-1-1.6-3 0-4.6zM14.5 8c-1.6 1.6-3.6 1.6-4.6 0 1-1.6 3-1.6 4.6 0zM8 14.5c-1.6-1.6-1.6-3.6 0-4.6 1.6 1 1.6 3 0 4.6zM1.5 8c1.6-1.6 3.6-1.6 4.6 0-1 1.6-3 1.6-4.6 0z"/>',
    search: '<circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m11 11 3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    bell: '<path d="M8 1.6a4.4 4.4 0 0 0-4.4 4.4v2.9L2.3 11v.9h11.4V11l-1.3-2.1V6A4.4 4.4 0 0 0 8 1.6zM6.2 13a1.8 1.8 0 0 0 3.6 0z"/>',
    person: '<circle cx="8" cy="5.2" r="3"/><path d="M2.4 14c.4-3 2.8-4.8 5.6-4.8s5.2 1.8 5.6 4.8z"/>',
    bed: '<path d="M1.5 6.5h13v7h-1.6V11H3.1v2.5H1.5zm1.6 3h9.8V8H3.1zM3 4.8a1.6 1.6 0 1 1 3.2 0 1.6 1.6 0 0 1-3.2 0z"/>',
    wave: '<path d="M1.5 9h3l1.5-4 2.5 7 2-4.5 1 1.5h3v1.6h-3.9l-.1-.2-2 4.5L6 6.2 5.6 10.6H1.5z"/>',
    map: '<path d="M1.5 3.5 5.5 2l5 1.6 4-1.5v10.4l-4 1.5-5-1.6-4 1.5zM6.3 3.6v8.6l3.4 1.1V4.7z"/>',
    signal: '<circle cx="8" cy="8" r="2.4"/><path d="M3.8 3.8a6 6 0 0 0 0 8.4l1.1-1.1a4.4 4.4 0 0 1 0-6.2zM12.2 3.8l-1.1 1.1a4.4 4.4 0 0 1 0 6.2l1.1 1.1a6 6 0 0 0 0-8.4z"/>',
    drop: '<path d="M8 1.5C6 4.4 3.8 6.6 3.8 9.2a4.2 4.2 0 0 0 8.4 0C12.2 6.6 10 4.4 8 1.5z"/>',
    check: '<path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    wrench: '<path d="M10.8 1.4a3.9 3.9 0 0 0-3.7 5.1L1.6 12a1.4 1.4 0 0 0 2 2l5.5-5.5a3.9 3.9 0 0 0 5.1-3.7l-2.3 2.3-2.1-.5-.5-2.1z"/>',
    lock: '<path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2h.6c.5 0 .9.4.9.9v6.2c0 .5-.4.9-.9.9H3.9a.9.9 0 0 1-.9-.9V7.9c0-.5.4-.9.9-.9zm1.6 0h3.8V5a1.9 1.9 0 0 0-3.8 0z"/>',
    sync: '<path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v2.4h-2.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    share: '<path d="M8 10V1.5M5 4.5 8 1.5l3 3M3.5 7v6.5h9V7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    doc: '<path d="M4 1.5h5.5l3 3v10H4zM9.5 1.5v3h3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
    bolt: '<path d="M9 1 3 9h4l-1 6 6-8H8z"/>',
    moon: '<path d="M10.5 1.8A6.4 6.4 0 1 0 14.2 11 5.4 5.4 0 0 1 10.5 1.8z"/>',
  };
  function ic(name, size, color) {
    var t = document.createElement('template');
    t.innerHTML = '<svg width="' + (size || 15) + '" height="' + (size || 15) + '" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"' + (color ? ' style="color:' + color + '"' : '') + '>' + I[name] + '</svg>';
    return t.content.firstChild;
  }
  function badgeIcon(color, name, size) { return h('span', { class: 'ui-ind', style: 'background:' + color }, ic(name, size || 11, '#fff')); }
  function excl(color, size) {
    var s = size || 14, t = document.createElement('template');
    t.innerHTML = '<svg width="' + s + '" height="' + s + '" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7.6" fill="' + color + '"/><rect x="7.1" y="3.6" width="1.8" height="5.6" rx=".9" fill="#fff"/><circle cx="8" cy="11.7" r="1.05" fill="#fff"/></svg>';
    return t.content.firstChild;
  }

  /* ═════════ time-series data ═════════ */
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function labels(range) {
    var now = new Date(), out = [], i, d;
    if (range === 'Day') {
      for (i = 23; i >= 0; i--) { d = new Date(now - i * 3600e3); var hr = d.getHours(); out.push((hr % 12 || 12) + ' ' + (hr < 12 ? 'AM' : 'PM')); }
    } else if (range === 'Week') {
      for (i = 27; i >= 0; i--) { d = new Date(now - i * 6 * 3600e3); out.push(DAYS[d.getDay()] + ' ' + ((d.getHours() % 12) || 12) + (d.getHours() < 12 ? ' AM' : ' PM')); }
    } else {
      for (i = 29; i >= 0; i--) { d = new Date(now - i * 864e5); out.push(MONTHS[d.getMonth()] + ' ' + d.getDate()); }
    }
    out[out.length - 1] = 'Now';
    return out;
  }
  var POINTS = { Day: 24, Week: 28, Month: 30 };
  function curve(spec, range, seed) {
    var n = POINTS[range], r = rng(seed + range.length * 7919), s = spec[range] || spec.all, out = [];
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      var v = s.from + (s.to - s.from) * Math.pow(t, s.pow || 1) + (r() - 0.5) * 2 * (s.noise || 0);
      out.push(+v.toFixed(2));
    }
    return out;
  }

  /* ═════════ chart: smooth line, area, limit, hover crosshair ═════════ */
  var gid = 0;
  function smooth(p) {
    var d = 'M' + p[0][0].toFixed(1) + ',' + p[0][1].toFixed(1);
    for (var i = 0; i < p.length - 1; i++) {
      var p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ',' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ',' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
    }
    return d;
  }
  function chart(o) {
    var W = o.w || 560, H = o.h || 110, NS = 'http://www.w3.org/2000/svg', id = 'uig' + (++gid);
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('height', H);
    function s(tag, at) { var e = document.createElementNS(NS, tag); Object.keys(at).forEach(function (k) { e.setAttribute(k, at[k]); }); svg.appendChild(e); return e; }
    var defs = document.createElementNS(NS, 'defs'); svg.appendChild(defs);
    var grad = document.createElementNS(NS, 'linearGradient'); grad.id = id; grad.setAttribute('x1', 0); grad.setAttribute('y1', 0); grad.setAttribute('x2', 0); grad.setAttribute('y2', 1);
    [['0', '.24'], ['1', '0']].forEach(function (st) { var e = document.createElementNS(NS, 'stop'); e.setAttribute('offset', st[0]); e.setAttribute('stop-color', o.color); e.setAttribute('stop-opacity', st[1]); grad.appendChild(e); });
    defs.appendChild(grad);
    [0.18, 0.5, 0.82].forEach(function (f) { s('line', { x1: 0, x2: W, y1: H * f, y2: H * f, stroke: '#ececf0', 'stroke-width': 1 }); });
    var limitLine = s('line', { x1: 0, x2: W, stroke: '#ff3b30', 'stroke-width': 1.2, 'stroke-dasharray': '4 4', opacity: 0 });
    var area = s('path', { fill: 'url(#' + id + ')' });
    var line = s('path', { fill: 'none', stroke: o.color, 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    var cross = s('line', { y1: 0, y2: H, stroke: '#c7c7cc', 'stroke-width': 1, opacity: 0 });
    var dot = s('circle', { r: 4.5, fill: '#fff', stroke: o.color, 'stroke-width': 2.2 });
    var tipB = h('b'), tipS = h('span');
    var tip = h('div', { class: 'ui-tip' }, tipB, tipS);
    var axis = h('div', { class: 'ui-axis' });
    var wrap = h('div', { class: 'ui-chart' }, svg, tip);
    var st = { data: [], labels: [], pts: [] };

    function set(data, labs, limit) {
      st.data = data; st.labels = labs;
      var lo = Math.min.apply(null, data), hi = Math.max.apply(null, data);
      if (limit != null) hi = Math.max(hi, limit);
      if (o.minSpan && hi - lo < o.minSpan) { var mid = (hi + lo) / 2; lo = mid - o.minSpan / 2; hi = mid + o.minSpan / 2; }
      var pad = (hi - lo) * 0.18 || 1; lo -= pad; hi += pad;
      var y = function (v) { return 8 + (1 - (v - lo) / (hi - lo)) * (H - 16); };
      st.pts = data.map(function (v, i) { return [i / (data.length - 1) * W, y(v)]; });
      var d = smooth(st.pts);
      line.setAttribute('d', d);
      area.setAttribute('d', d + ' L' + W + ',' + H + ' L0,' + H + ' Z');
      var last = st.pts[st.pts.length - 1];
      dot.setAttribute('cx', last[0]); dot.setAttribute('cy', last[1]);
      if (limit != null) { limitLine.setAttribute('y1', y(limit)); limitLine.setAttribute('y2', y(limit)); limitLine.setAttribute('opacity', 1); }
      else limitLine.setAttribute('opacity', 0);
      axis.textContent = '';
      var n = labs.length;
      [0, Math.round(n * 0.25), Math.round(n * 0.5), Math.round(n * 0.75), n - 1].forEach(function (i) { axis.append(h('span', null, labs[i])); });
    }
    function hover(e) {
      if (!st.data.length) return;
      var r = svg.getBoundingClientRect();
      var i = Math.round(clamp((e.clientX - r.left) / r.width, 0, 1) * (st.data.length - 1));
      var p = st.pts[i];
      cross.setAttribute('x1', p[0]); cross.setAttribute('x2', p[0]); cross.setAttribute('opacity', 1);
      dot.setAttribute('cx', p[0]); dot.setAttribute('cy', p[1]);
      tipB.textContent = o.fmt(st.data[i]); tipS.textContent = st.labels[i];
      tip.style.left = clamp(p[0] / W * wrap.clientWidth, 50, wrap.clientWidth - 50) + 'px';
      tip.style.top = p[1] + 'px'; tip.style.opacity = 1;
    }
    function leave() {
      cross.setAttribute('opacity', 0); tip.style.opacity = 0;
      var last = st.pts[st.pts.length - 1];
      if (last) { dot.setAttribute('cx', last[0]); dot.setAttribute('cy', last[1]); }
    }
    wrap.addEventListener('pointermove', hover);
    wrap.addEventListener('pointerleave', leave);
    return { el: wrap, axis: axis, set: set };
  }

  /* ═════════ shared macOS window ═════════ */
  function mac(o) {
    var side = h('aside', { class: 'ui-side' }, h('div', { class: 'ui-lights' }, h('i'), h('i'), h('i')));
    var items = {}, badges = {};
    o.sections.forEach(function (sec) {
      var box = h('div', null, h('div', { class: 'ui-sec-h' }, sec.h));
      sec.items.forEach(function (it) {
        var right = it.badge != null ? (badges[it.id] = h('span', { class: 'ui-badge' }, it.badge)) : it.count != null ? h('span', { class: 'ui-count' }, it.count) : null;
        var lead = it.ind ? badgeIcon(it.ind, it.icon) : it.dot ? h('span', { class: 'ui-g' }, h('i', { class: 'ui-dot', style: 'background:' + it.dot })) : h('span', { class: 'ui-g', style: it.gray ? 'color:#86868b' : null }, ic(it.icon));
        var b = h('button', { class: 'ui-item', type: 'button', onclick: function () { o.onNav(it.id); } }, lead, it.label, right);
        items[it.id] = b; box.append(b);
      });
      side.append(box);
    });
    var titleB = h('b'), titleS = h('span');
    var seg = null;
    if (o.seg) {
      seg = h('div', { class: 'ui-seg' });
      o.seg.forEach(function (label, i) {
        seg.append(h('button', { type: 'button', class: i === (o.segOn || 0) ? 'on' : null, onclick: function (e) {
          Array.prototype.forEach.call(seg.children, function (c) { c.classList.toggle('on', c === e.currentTarget); });
          o.onSeg(label);
        } }, label));
      });
    }
    var input = h('input', { type: 'search', placeholder: 'Search', 'aria-label': 'Search' });
    if (o.onSearch) input.addEventListener('input', function () { o.onSearch(input.value.trim().toLowerCase()); });
    var toolbar = h('div', { class: 'ui-toolbar' }, h('div', { class: 'ui-title' }, titleB, titleS), seg, h('label', { class: 'ui-search', style: seg ? null : 'margin-left:auto' }, ic('search', 13), input));
    var body = h('div');
    var veil = h('div', { class: 'ui-veil' }), sheet = h('div', { class: 'ui-sheet', role: 'dialog' });
    var notify = h('div', { class: 'ui-notify', role: 'status' });
    var main = h('section', { class: 'ui-main' }, toolbar, body, veil, sheet);
    var root = h('div', { class: 'ui-win' }, side, main, notify);
    var nt;
    var api = {
      root: root, main: main, body: body,
      title: function (a, b) { titleB.textContent = a; titleS.textContent = b; },
      nav: function (id) { Object.keys(items).forEach(function (k) { items[k].classList.toggle('on', k === id); }); },
      badge: function (id, n) { if (badges[id]) { badges[id].textContent = n; badges[id].classList.toggle('ui-hide', !n); } },
      show: function (pane) { body.textContent = ''; body.append(pane); },
      notify: function (color, icon, title, text) {
        notify.textContent = ''; notify.append(badgeIcon(color, icon, 16), h('div', null, h('b', null, title), h('span', null, text)));
        notify.classList.add('open'); clearTimeout(nt); nt = setTimeout(function () { notify.classList.remove('open'); }, 3800);
      },
      sheet: function (content) {
        sheet.textContent = ''; sheet.append(content); sheet.classList.add('open'); veil.classList.add('open');
        var f = sheet.querySelector('input, select, button'); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 300);
      },
      closeSheet: function () { sheet.classList.remove('open'); veil.classList.remove('open'); },
    };
    veil.addEventListener('click', api.closeSheet);
    return api;
  }
  function kpi(l, v, small, sub) {
    var vEl = h('div', { class: 'ui-kpi-v' }, v, small ? h('small', null, small) : null), sEl = h('div', { class: 'ui-kpi-s' }, sub);
    return { el: h('div', { class: 'ui-card' }, h('div', { class: 'ui-kpi-l' }, l), vEl, sEl), v: vEl, s: sEl, set: function (v2, sm) { vEl.textContent = v2; if (sm) vEl.append(h('small', null, sm)); } };
  }
  function pill(text, color) { return h('span', { class: 'ui-pill', style: 'background:' + color + '1f;color:' + color }, text); }

  /* ═════════ macOS asset monitor (Turbofan, Plant & Process) ═════════ */
  function assetMac(cfg) {
    var S = { pane: 'overview', asset: cfg.assets[0].id, range: 'Day', wos: cfg.workOrders.slice(), next: cfg.woStart, query: '' };
    var seeds = {}; cfg.assets.forEach(function (a, i) { seeds[a.id] = 101 + i * 37; });
    var data = {};
    function series(a) { var k = a.id + S.range; if (!data[k]) data[k] = curve(a.spec, S.range, seeds[a.id]); return data[k]; }
    var W = mac({
      sections: [
        { h: cfg.site, items: [
          { id: 'overview', icon: 'grid', label: 'Overview' },
          { id: 'alerts', icon: 'alert', label: 'Alerts', badge: cfg.assets.filter(function (a) { return a.alert; }).length },
          { id: 'maintenance', icon: 'cal', label: 'Maintenance', count: S.wos.filter(function (w) { return w.status !== 'Done'; }).length },
          { id: 'reports', icon: 'chart', label: 'Reports' },
        ] },
        { h: cfg.unitsLabel, items: cfg.assets.map(function (a) { return { id: 'asset:' + a.id, dot: a.color, label: a.id, count: a.kind }; }) },
      ],
      seg: ['Day', 'Week', 'Month'],
      onSeg: function (r) { S.range = r; if (S.pane !== 'overview') go('overview'); else refreshChart(); },
      onSearch: function (q) { S.query = q; if (S.pane === 'overview') renderTable(); },
      onNav: function (id) { if (id.indexOf('asset:') === 0) { S.asset = id.slice(6); go('overview'); } else go(id); },
    });
    var mainCount = W.root.querySelector('.ui-item:nth-of-type(3) .ui-count');
    function current() { return cfg.assets.filter(function (a) { return a.id === S.asset; })[0]; }

    /* overview */
    var kpis, alertBox, chartCard, ch, big, tableCard;
    function go(pane) {
      S.pane = pane;
      W.nav(pane === 'overview' ? 'asset:' + S.asset : pane);
      if (pane === 'overview') overview();
      else if (pane === 'alerts') alerts();
      else if (pane === 'maintenance') maintenance();
      else reports();
    }
    function overview() {
      W.title(cfg.title, cfg.subtitle);
      var p = h('div', { class: 'ui-pane' });
      kpis = cfg.kpis.map(function (k) { return kpi(k[0], k[1], k[2], k[3]); });
      kpis.forEach(function (k) { p.append(k.el); });
      alertBox = h('div', { class: 'ui-card raised ui-alert ui-c2' });
      big = h('div', { class: 'ui-chart-big' });
      ch = chart({ color: '#ff9500', fmt: function (v) { return cfg.metric.fmt(v); } });
      chartCard = h('div', { class: 'ui-card raised ui-c2' }, h('div', { class: 'ui-chart-h' }, h('b', null, cfg.metric.name), h('span', { class: 'ui-chart-sub' })), big, ch.el, ch.axis);
      tableCard = h('div', { class: 'ui-card ui-table ui-c4' });
      p.append(alertBox, chartCard, tableCard);
      W.show(p);
      renderAlert(); refreshChart(); renderTable();
    }
    function renderAlert() {
      var a = current(); alertBox.textContent = '';
      if (!a.alert) {
        alertBox.append(h('div', { class: 'ui-calm' }, h('span', { class: 'ui-ind', style: 'background:#34c759;width:34px;height:34px;border-radius:10px' }, ic('check', 18, '#fff')),
          h('div', null, h('b', null, a.id + ' is healthy'), h('span', null, 'No anomalies. Next service ' + a.next + '.'))));
        return;
      }
      var al = a.alert;
      alertBox.append(
        h('div', { class: 'ui-alert-top' }, excl('#ff9500'), al.eyebrow + ' · ' + a.id, h('time', null, al.time)),
        h('div', { class: 'ui-alert-h' }, al.title),
        h('div', { class: 'ui-alert-p' }, al.body),
        h('div', { class: 'ui-meta' }, al.meta.map(function (m) { return h('div', null, h('b', null, m[0]), h('span', null, m[1])); })),
        h('div', { class: 'ui-btns' },
          h('button', { class: 'ui-btn p', type: 'button', onclick: woSheet }, cfg.primary),
          h('button', { class: 'ui-btn', type: 'button', onclick: procSheet }, 'View Procedure')));
    }
    function refreshChart() {
      var a = current(), d = series(a);
      ch.set(d, labels(S.range), cfg.metric.limit);
      chartCard.querySelector('.ui-chart-sub').textContent = a.id + ' · ' + (S.range === 'Day' ? 'Last 24 hours' : S.range === 'Week' ? 'Last 7 days' : 'Last 30 days');
      big.textContent = cfg.metric.fmt(d[d.length - 1]);
      var trend = d[d.length - 1] - d[0];
      big.append(h('em', { style: 'color:' + (a.alert ? '#ff3b30' : '#34c759') }, a.alert ? 'Above trend' : 'Within normal range'));
      void trend;
    }
    function renderTable() {
      tableCard.textContent = '';
      var cols = cfg.cols;
      tableCard.append(h('div', { class: 'ui-row h', style: 'grid-template-columns:' + cfg.grid }, cols.map(function (c) { return h('span', null, c[0]); })));
      var rows = cfg.assets.filter(function (a) { return !S.query || (a.id + ' ' + a.state + ' ' + a.kind).toLowerCase().indexOf(S.query) >= 0; });
      if (!rows.length) tableCard.append(h('div', { class: 'ui-empty' }, 'No assets match "' + S.query + '"'));
      rows.forEach(function (a) {
        tableCard.append(h('button', { type: 'button', class: 'ui-row' + (a.id === S.asset ? ' on' : ''), style: 'grid-template-columns:' + cfg.grid, onclick: function () { S.asset = a.id; W.nav('asset:' + a.id); renderAlert(); refreshChart(); renderTable(); } },
          cols.map(function (c) { return c[1](a); })));
      });
    }

    /* alerts, maintenance, reports */
    function alerts() {
      W.title('Alerts', cfg.assets.filter(function (a) { return a.alert; }).length + ' active · sorted by severity');
      var card = h('div', { class: 'ui-card ui-table ui-c4' }, h('div', { class: 'ui-row h', style: 'grid-template-columns:1.6fr 1fr 1fr 0.8fr' }, h('span', null, 'Alert'), h('span', null, 'Asset'), h('span', null, 'Raised'), h('span', null, '')));
      cfg.assets.filter(function (a) { return a.alert; }).forEach(function (a) {
        card.append(h('button', { type: 'button', class: 'ui-row', style: 'grid-template-columns:1.6fr 1fr 1fr 0.8fr', onclick: function () { S.asset = a.id; go('overview'); } },
          h('span', { class: 'ui-st' }, excl(a.alert.sev === 'critical' ? '#ff3b30' : '#ff9500'), h('span', { class: 'ui-strong' }, a.alert.title)),
          h('span', null, a.id), h('span', { class: 'ui-sub' }, a.alert.time), h('span', { style: 'color:#007aff;text-align:right' }, 'Open ›')));
      });
      W.show(h('div', { class: 'ui-pane' }, card));
    }
    function maintenance() {
      W.title('Maintenance', S.wos.filter(function (w) { return w.status !== 'Done'; }).length + ' open work orders');
      var colors = { Open: '#007aff', Scheduled: '#ff9500', Done: '#34c759' };
      var g = '0.8fr 0.8fr 1.8fr 0.8fr 0.9fr';
      var card = h('div', { class: 'ui-card ui-table ui-c4' }, h('div', { class: 'ui-row h', style: 'grid-template-columns:' + g }, ['Order', 'Asset', 'Task', 'Due', 'Status'].map(function (x) { return h('span', null, x); })));
      S.wos.forEach(function (w) {
        card.append(h('div', { class: 'ui-row' + (w.fresh ? ' on' : ''), style: 'grid-template-columns:' + g },
          h('span', { class: 'ui-tnum ui-sub' }, w.id), h('span', { class: 'ui-strong' }, w.asset), h('span', null, w.task), h('span', { class: 'ui-tnum' }, w.due), h('span', null, pill(w.status, colors[w.status]))));
      });
      W.show(h('div', { class: 'ui-pane' }, card));
    }
    function reports() {
      W.title('Reports', 'Generated on site · nothing leaves the plant');
      var card = h('div', { class: 'ui-card ui-table ui-c4' });
      cfg.reports.forEach(function (r) {
        card.append(h('div', { class: 'ui-row', style: 'grid-template-columns:auto 1fr auto;gap:12px' },
          h('span', { class: 'ui-ind', style: 'background:#007aff;width:26px;height:26px;border-radius:7px' }, ic('doc', 14, '#fff')),
          h('span', null, h('span', { class: 'ui-strong' }, r[0]), h('span', { class: 'ui-sub' }, '  ·  ' + r[1])),
          h('button', { class: 'ui-btn', type: 'button', onclick: function () { W.notify('#007aff', 'doc', 'Report exported', r[0] + ' saved to Downloads.'); } }, 'Export PDF')));
      });
      W.show(h('div', { class: 'ui-pane' }, card));
    }

    /* sheets */
    function woSheet() {
      var a = current();
      var task = h('input', { value: a.alert ? a.alert.task : 'Inspection' }), who = h('select', null, cfg.crew.map(function (c) { return h('option', null, c); }));
      var due = h('select', null, ['Tomorrow', 'In 3 days', 'Next planned outage'].map(function (c) { return h('option', null, c); }));
      W.sheet(h('div', null,
        h('div', { class: 'ui-sheet-h' }, 'New work order'), h('div', { class: 'ui-sheet-p' }, a.id + ' · created from the ' + a.alert.eyebrow.toLowerCase()),
        h('div', { class: 'ui-form' }, h('label', null, 'Task', task), h('label', null, 'Assign to', who), h('label', null, 'Due', due)),
        h('div', { class: 'ui-btns' }, h('button', { class: 'ui-btn', type: 'button', onclick: W.closeSheet }, 'Cancel'),
          h('button', { class: 'ui-btn p', type: 'button', onclick: function () {
            var id = 'WO-' + (S.next++);
            S.wos.forEach(function (w) { w.fresh = false; });
            S.wos.unshift({ id: id, asset: a.id, task: task.value || 'Inspection', due: due.value === 'Tomorrow' ? 'Tomorrow' : due.value === 'In 3 days' ? 'In 3 days' : 'Outage', status: 'Open', fresh: true });
            if (mainCount) mainCount.textContent = S.wos.filter(function (w) { return w.status !== 'Done'; }).length;
            W.closeSheet();
            W.notify('#34c759', 'wrench', 'Work order ' + id + ' created', task.value + ' · assigned to ' + who.value + '.');
          } }, 'Create'))));
    }
    function procSheet() {
      var a = current(), list = h('div', { style: 'margin-top:10px' });
      cfg.procedure.forEach(function (step) {
        var row = h('div', { class: 'ui-check', role: 'checkbox', 'aria-checked': 'false', tabindex: '0' }, h('i'), h('span', null, step));
        row.addEventListener('click', function () { row.classList.toggle('done'); row.setAttribute('aria-checked', String(row.classList.contains('done'))); });
        list.append(row);
      });
      W.sheet(h('div', null, h('div', { class: 'ui-sheet-h' }, 'Procedure · ' + a.alert.title), h('div', { class: 'ui-sheet-p' }, 'From the maintenance manual, ordered for this fault.'), list,
        h('div', { class: 'ui-btns' }, h('button', { class: 'ui-btn p', type: 'button', onclick: W.closeSheet }, 'Done'))));
    }

    go('overview');
    return {
      el: W.root,
      tick: function () {
        if (S.pane !== 'overview' || S.range !== 'Day') return;
        var a = current(), d = series(a), last = d[d.length - 1];
        d[d.length - 1] = +(last + (Math.random() - 0.5) * a.jitter).toFixed(2);
        refreshChart();
      },
    };
  }

  /* ═════════ Edge Console (Mac) ═════════ */
  function edgeConsole() {
    var DEV = [
      ['edge-gt07', 'Turbofan', 'Plant Alpha', 'Turbofan 4.2', 11, 'Running'], ['edge-gt01', 'Turbofan', 'Plant Alpha', 'Turbofan 4.2', 12, 'Running'],
      ['edge-gt04', 'Turbofan', 'Plant Alpha', 'Turbofan 4.2', 10, 'Running'], ['edge-gt02', 'Turbofan', 'Plant Alpha', 'Turbofan 4.2', 11, 'Running'],
      ['edge-ward4b', 'Hospital', 'Pilot hospital', 'Clinical 0.9', 9, 'Running'], ['edge-ward4c', 'Hospital', 'Pilot hospital', 'Clinical 0.9', 10, 'Running'],
      ['edge-line3', 'Plant & Process', 'Mill North', 'Process 1.1', 14, 'Updating'], ['edge-line4', 'Plant & Process', 'Mill North', 'Process 1.1', 13, 'Running'],
      ['edge-field7', 'Agriculture', 'Field 7', 'Agriculture 0.3', 18, 'Offline'], ['edge-field8', 'Agriculture', 'Field 8', 'Agriculture 0.3', 17, 'Running'],
    ].map(function (r) { return { id: r[0], product: r[1], site: r[2], model: r[3], lat: r[4], status: r[5], npu: 30 + Math.round(Math.random() * 40), mem: 40 + Math.round(Math.random() * 30) }; });
    var STC = { Running: '#34c759', Updating: '#007aff', Offline: '#aeaeb2' };
    var PROD = { Turbofan: ['#ff9500', 'fan', 96], Hospital: ['#ff2d55', 'heart', 12], 'Plant & Process': ['#5856d6', 'factory', 14], Agriculture: ['#34c759', 'leaf', 6] };
    var S = { pane: 'devices', seg: 'All', product: null, query: '', sel: null, rollout: 62 };
    var lat = curve({ all: { from: 12, to: 12, noise: 0.5 } }, 'Day', 7).concat(curve({ all: { from: 12, to: 12, noise: 0.5 } }, 'Day', 9)).slice(0, 48);
    var latLabels = (function () { var l = [], now = Date.now(); for (var i = 47; i >= 0; i--) { var d = new Date(now - i * 30 * 60e3); l.push(((d.getHours() % 12) || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + (d.getHours() < 12 ? ' AM' : ' PM')); } l[47] = 'Now'; return l; })();
    var W = mac({
      sections: [
        { h: 'Edge Console', items: [{ id: 'overview', icon: 'grid', label: 'Overview' }, { id: 'devices', icon: 'list', label: 'Devices', count: 128 }, { id: 'models', icon: 'cube', label: 'Models', count: 4 }, { id: 'deployments', icon: 'deploy', label: 'Deployments' }] },
        { h: 'Products', items: Object.keys(PROD).map(function (p) { return { id: 'p:' + p, ind: PROD[p][0], icon: PROD[p][1], label: p, count: PROD[p][2] }; }) },
      ],
      seg: ['All', 'Online', 'Updating'],
      onSeg: function (s) { S.seg = s; go('devices'); },
      onSearch: function (q) { S.query = q; if (S.pane !== 'devices') go('devices'); else table(); },
      onNav: function (id) {
        if (id.indexOf('p:') === 0) { var p = id.slice(2); S.product = S.product === p ? null : p; go('devices'); }
        else { S.product = null; go(id); }
      },
    });
    var insp = h('div', { class: 'ui-inspector', role: 'region', 'aria-label': 'Device details' });
    W.main.append(insp);
    var k1, ch, tableCard, lastBig;
    function go(p) {
      S.pane = p; insp.classList.remove('open'); S.sel = null;
      W.nav(S.product ? 'p:' + S.product : p);
      if (p === 'devices') devices(); else if (p === 'models') models(); else if (p === 'deployments') deployments(); else overview();
    }
    function kpis(pane) {
      k1 = kpi('Median inference', '12', 'ms', 'On device, no cloud round trip');
      pane.append(k1.el, kpi('Devices online', '127', 'of 128', '1 running offline, as designed').el, kpi('Data kept on site', '100', '%', 'Raw readings never leave').el, kpi('Fleet model', 'v4.2', null, 'Retrained on site last night').el);
    }
    function devices() {
      W.title(S.product ? S.product + ' devices' : 'Devices', '4 sites · 128 edge devices · all models current');
      var p = h('div', { class: 'ui-pane' }); kpis(p);
      lastBig = h('div', { class: 'ui-chart-big' });
      ch = chart({ color: '#007aff', w: 1120, h: 92, minSpan: 10, fmt: function (v) { return v.toFixed(1) + ' ms'; } });
      p.append(h('div', { class: 'ui-card raised ui-c4' }, h('div', { class: 'ui-chart-h' }, h('b', null, 'Inference latency, all devices'), h('span', null, 'Last 24 hours · live')), lastBig, ch.el, ch.axis));
      tableCard = h('div', { class: 'ui-card ui-table ui-c4' }); p.append(tableCard);
      W.show(p); drawLat(); table();
    }
    function drawLat() { ch.set(lat, latLabels, null); lastBig.textContent = lat[lat.length - 1].toFixed(1) + ' ms'; lastBig.append(h('em', { style: 'color:#34c759' }, 'Within target')); }
    function table() {
      var g = '1.2fr 1.1fr 1.1fr 0.7fr 1.2fr';
      tableCard.textContent = '';
      tableCard.append(h('div', { class: 'ui-row h', style: 'grid-template-columns:' + g }, ['Device', 'Site', 'Model', 'Latency', 'Status'].map(function (x) { return h('span', null, x); })));
      var rows = DEV.filter(function (d) {
        if (S.product && d.product !== S.product) return false;
        if (S.seg === 'Online' && d.status === 'Offline') return false;
        if (S.seg === 'Updating' && d.status !== 'Updating') return false;
        return !S.query || (d.id + ' ' + d.site + ' ' + d.model + ' ' + d.product).toLowerCase().indexOf(S.query) >= 0;
      });
      if (!rows.length) tableCard.append(h('div', { class: 'ui-empty' }, 'No devices match'));
      rows.forEach(function (d) {
        var latEl = h('span', { class: 'ui-tnum' }, d.status === 'Offline' ? '·' : d.lat + ' ms'); d._lat = latEl;
        tableCard.append(h('button', { type: 'button', class: 'ui-row' + (S.sel === d ? ' on' : ''), style: 'grid-template-columns:' + g, onclick: function () { inspect(d); } },
          h('span', { class: 'ui-strong' }, d.id), h('span', { class: 'ui-sub' }, d.site), h('span', null, d.model), latEl,
          h('span', { class: 'ui-st' }, h('i', { class: 'ui-dot', style: 'background:' + STC[d.status] }), d.status === 'Offline' ? 'Offline, synced 6 h ago' : d.status === 'Updating' ? 'Updating model' : 'Running')));
      });
      tableCard.append(h('div', { class: 'ui-empty', style: 'padding:10px' }, 'Showing ' + rows.length + ' of 128'));
    }
    function inspect(d) {
      S.sel = d; table();
      insp.textContent = '';
      var npu = h('i', { style: 'width:' + d.npu + '%' }), mem = h('i', { style: 'width:' + d.mem + '%;background:#5856d6' });
      d._npu = npu;
      insp.append(
        h('div', { class: 'ui-insp-h' }, h('b', null, d.id), h('button', { class: 'ui-x', type: 'button', 'aria-label': 'Close', onclick: function () { insp.classList.remove('open'); S.sel = null; table(); } }, '✕')),
        h('div', { class: 'ui-st' }, badgeIcon(PROD[d.product][0], PROD[d.product][1]), h('span', null, d.product + ' · ' + d.site)),
        h('div', null, [['Model', d.model], ['Latency', d.status === 'Offline' ? 'Offline' : d.lat + ' ms'], ['Uptime', d.status === 'Offline' ? 'Runs offline' : '41 days'], ['Last retrain', 'Last night, on site'], ['Precision', 'INT8']].map(function (kv) { return h('div', { class: 'ui-kv' }, h('span', null, kv[0]), h('b', { class: 'ui-tnum' }, kv[1])); })),
        h('div', null, h('div', { class: 'ui-kv', style: 'border:0' }, h('span', null, 'NPU load'), h('span', { class: 'ui-tnum' }, d.npu + '%')), h('div', { class: 'ui-bar' }, npu)),
        h('div', null, h('div', { class: 'ui-kv', style: 'border:0' }, h('span', null, 'Memory'), h('span', { class: 'ui-tnum' }, d.mem + '%')), h('div', { class: 'ui-bar' }, mem)),
        h('div', { class: 'ui-btns', style: 'margin-top:auto' },
          h('button', { class: 'ui-btn', type: 'button', onclick: function () { W.notify('#8e8e93', 'doc', d.id + ' logs', 'Last 24 hours exported. No errors.'); } }, 'Export Logs'),
          h('button', { class: 'ui-btn p', type: 'button', onclick: function () { W.notify('#007aff', 'sync', d.id + ' restarting', 'Back online in about 40 seconds. The model keeps running locally.'); } }, 'Restart')));
      insp.classList.add('open');
    }
    function models() {
      W.title('Models', '4 models · compressed INT8 · trained per asset');
      var g = '1.3fr 1fr 0.6fr 0.6fr 0.6fr 0.9fr';
      var card = h('div', { class: 'ui-card ui-table ui-c4' }, h('div', { class: 'ui-row h', style: 'grid-template-columns:' + g }, ['Model', 'Product', 'Size', 'Devices', 'Accuracy', 'Status'].map(function (x) { return h('span', null, x); })));
      [['Turbofan 4.2', 'Turbofan', '7.8 MB', 96, '99.2%', 'Current'], ['Clinical 0.9', 'Hospital', '5.1 MB', 12, 'Pilot', 'Pilot'], ['Process 1.1 → 1.2', 'Plant & Process', '6.4 MB', 14, '97.8%', 'Rolling out'], ['Agriculture 0.3', 'Agriculture', '3.2 MB', 6, 'Pilot', 'Pilot']].forEach(function (m) {
        card.append(h('div', { class: 'ui-row', style: 'grid-template-columns:' + g }, h('span', { class: 'ui-strong' }, m[0]), h('span', { class: 'ui-st' }, badgeIcon(PROD[m[1]][0], PROD[m[1]][1]), m[1]), h('span', { class: 'ui-tnum' }, m[2]), h('span', { class: 'ui-tnum' }, m[3]), h('span', { class: 'ui-tnum' }, m[4]), h('span', null, pill(m[5], m[5] === 'Current' ? '#34c759' : m[5] === 'Pilot' ? '#8e8e93' : '#007aff'))));
      });
      W.show(h('div', { class: 'ui-pane' }, card));
    }
    var bar, pct, rstatus;
    function deployments() {
      W.title('Deployments', 'Staged rollouts · automatic rollback on regression');
      bar = h('i', { style: 'width:' + S.rollout + '%' }); pct = h('b', { class: 'ui-tnum' }, S.rollout + '%'); rstatus = h('span', { class: 'ui-sub' }, S.rollout >= 100 ? 'Complete · no regressions' : 'Rolling out to Mill North · 9 of 14 devices');
      var p = h('div', { class: 'ui-pane' },
        h('div', { class: 'ui-card raised ui-c4' }, h('div', { class: 'ui-chart-h' }, h('b', null, 'Process 1.2'), pct), h('div', { style: 'margin:10px 0 8px' }, h('div', { class: 'ui-bar', style: 'height:8px' }, bar)), rstatus),
        h('div', { class: 'ui-card ui-table ui-c4' }, [['Turbofan 4.2', 'All 96 devices', 'Yesterday'], ['Clinical 0.9', 'Pilot hospital, 12 devices', 'Oct 12'], ['Agriculture 0.3', 'Fields 7 and 8', 'Oct 3']].map(function (r) {
          return h('div', { class: 'ui-row', style: 'grid-template-columns:1fr 1.4fr 0.6fr' }, h('span', { class: 'ui-strong' }, r[0]), h('span', { class: 'ui-sub' }, r[1]), h('span', { class: 'ui-st' }, h('i', { class: 'ui-dot', style: 'background:#34c759' }), r[2]));
        })));
      W.show(p);
    }
    function overview() {
      W.title('Overview', 'One foundation across four products');
      var p = h('div', { class: 'ui-pane' }); kpis(p);
      var card = h('div', { class: 'ui-card raised ui-c4' }, h('div', { class: 'ui-chart-h' }, h('b', null, 'Devices by product'), h('span', null, '128 total')));
      Object.keys(PROD).forEach(function (k) {
        card.append(h('button', { type: 'button', class: 'ui-row', style: 'grid-template-columns:180px 1fr 50px;border:0;padding:0', onclick: function () { S.product = k; go('devices'); } },
          h('span', { class: 'ui-st' }, badgeIcon(PROD[k][0], PROD[k][1]), k), h('div', { class: 'ui-bar', style: 'height:8px' }, h('i', { style: 'width:' + (PROD[k][2] / 96 * 100) + '%;background:' + PROD[k][0] })), h('span', { class: 'ui-tnum', style: 'text-align:right' }, PROD[k][2])));
      });
      p.append(card); W.show(p);
    }
    go('devices');
    return {
      el: W.root,
      tick: function () {
        lat.push(+(12 + (Math.random() - 0.5) * 1.2).toFixed(2)); lat.shift();
        if (S.pane === 'devices' && ch) { drawLat(); k1.set(lat[lat.length - 1].toFixed(0), 'ms'); }
        DEV.forEach(function (d) { if (d.status !== 'Offline') { d.lat = clamp(Math.round(d.lat + (Math.random() - 0.5) * 2), 8, 19); if (d._lat && d._lat.isConnected) d._lat.textContent = d.lat + ' ms'; } d.npu = clamp(d.npu + Math.round((Math.random() - 0.5) * 8), 18, 86); if (d._npu && d._npu.isConnected) d._npu.style.width = d.npu + '%'; });
        if (S.rollout < 100) { S.rollout = Math.min(100, S.rollout + 3); if (bar && bar.isConnected) { bar.style.width = S.rollout + '%'; pct.textContent = S.rollout + '%'; if (S.rollout >= 100) { rstatus.textContent = 'Complete · no regressions'; W.notify('#34c759', 'check', 'Process 1.2 rolled out', 'All 14 Mill North devices updated. No regressions.'); } } }
      },
    };
  }

  /* ═════════ shared iPhone ═════════ */
  var STATUS_ICONS = '<svg width="18" height="12" viewBox="0 0 18 12" fill="#000"><rect x="0" y="8" width="3" height="4" rx=".7"/><rect x="5" y="5.5" width="3" height="6.5" rx=".7"/><rect x="10" y="3" width="3" height="9" rx=".7"/><rect x="15" y="0" width="3" height="12" rx=".7"/></svg><svg width="17" height="12" viewBox="0 0 17 12" fill="#000"><path d="M8.5 2.3c2.4 0 4.6.9 6.2 2.5l1.2-1.2A10.5 10.5 0 0 0 1.1 3.6l1.2 1.2a8.7 8.7 0 0 1 6.2-2.5zm0 3.4c1.5 0 2.8.5 3.8 1.5l1.2-1.2a7 7 0 0 0-10 0l1.2 1.2c1-1 2.3-1.5 3.8-1.5zm0 3.4c.6 0 1.1.2 1.5.6L8.5 11.2 7 9.7c.4-.4.9-.6 1.5-.6z"/></svg><svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.8" fill="none" stroke="#000" stroke-opacity=".35"/><rect x="2" y="2" width="20" height="9" rx="2.5" fill="#000"/><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2z" fill="#000" fill-opacity=".4"/></svg>';
  function phone(o) {
    var right = h('span', { class: 'r' }); right.innerHTML = STATUS_ICONS;
    var clock = h('span', { class: 'ui-tnum' }, '9:41');
    var stackEl = h('div', { class: 'ui-stack' });
    var tabBtns = {}, tabBadges = {};
    var tabbar = h('nav', { class: 'ui-tabbar' }, o.tabs.map(function (t) {
      var b = h('button', { type: 'button', class: 'ui-tab', onclick: function () { api.tab(t.id); } }, ic(t.icon, 25), t.label);
      tabBadges[t.id] = h('span', { class: 'ui-badge ui-hide' }); b.append(tabBadges[t.id]);
      tabBtns[t.id] = b; return b;
    }));
    var dim = h('div', { class: 'ui-dim' }), sheet = h('div', { class: 'ui-bsheet', role: 'dialog' }), banner = h('div', { class: 'ui-banner', role: 'status' });
    var screen = h('div', { class: 'ui-screen' }, stackEl, h('div', { class: 'ui-island' }), h('div', { class: 'ui-status' }, clock, right), tabbar, dim, sheet, banner, h('div', { class: 'ui-homebar' }));
    var root = h('div', { class: 'ui-ios' }, h('div', { class: 'ui-bezel' }, screen));
    var views = [], bt;
    function view(v) {
      var nav = h('div', { class: 'ui-navbar' + (v.large ? '' : ' always') }, h('div', { class: 't' }, v.title), v.back ? h('button', { class: 'ui-back', type: 'button', onclick: api.pop }, v.back) : null);
      var scroll = h('div', { class: 'ui-scroll' });
      if (v.large) scroll.append(h('div', { class: 'ui-large' }, h('div', { class: 'h' }, v.title), v.trailing || null));
      else scroll.append(h('div', { style: 'height:44px' }));
      v.build(scroll);
      scroll.addEventListener('scroll', function () { nav.classList.toggle('solid', scroll.scrollTop > (v.large ? 42 : 2)); });
      return h('div', { class: 'ui-view' }, scroll, nav);
    }
    var api = {
      root: root,
      tab: function (id) {
        Object.keys(tabBtns).forEach(function (k) { tabBtns[k].classList.toggle('on', k === id); });
        stackEl.textContent = ''; views = [];
        var v = view(o.screens[id]()); stackEl.append(v); views.push(v);
      },
      push: function (spec) {
        var v = view(spec), prev = views[views.length - 1];
        v.classList.add('enter'); stackEl.append(v); views.push(v);
        void v.offsetWidth;
        requestAnimationFrame(function () { v.classList.remove('enter'); if (prev) prev.classList.add('under'); });
      },
      pop: function () {
        if (views.length < 2) return;
        var top = views.pop(), prev = views[views.length - 1];
        top.classList.add('enter'); prev.classList.remove('under');
        setTimeout(function () { top.remove(); }, 460);
      },
      badge: function (id, n) { tabBadges[id].textContent = n; tabBadges[id].classList.toggle('ui-hide', !n); },
      banner: function (color, icon, title, text, action) {
        banner.textContent = '';
        banner.append(h('span', { class: 'ui-ico', style: 'background:' + color }, ic(icon, 20, '#fff')), h('div', null, h('b', null, title), h('span', null, text)));
        if (action) banner.append(h('button', { type: 'button', onclick: function () { action.fn(); banner.classList.remove('open'); } }, action.label));
        banner.classList.add('open'); clearTimeout(bt); bt = setTimeout(function () { banner.classList.remove('open'); }, action ? 5000 : 3400);
      },
      sheet: function (content) { sheet.textContent = ''; sheet.append(h('div', { class: 'ui-grab' }), content); sheet.classList.add('open'); dim.classList.add('open'); },
      closeSheet: function () { sheet.classList.remove('open'); dim.classList.remove('open'); },
    };
    dim.addEventListener('click', api.closeSheet);
    var tick = setInterval(function () { var d = new Date(); clock.textContent = (d.getHours() % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0'); }, 20000);
    void tick;
    clock.textContent = (new Date().getHours() % 12 || 12) + ':' + String(new Date().getMinutes()).padStart(2, '0');
    return api;
  }
  function li(o) {
    return h(o.onclick ? 'button' : 'div', { type: o.onclick ? 'button' : null, class: 'ui-li', onclick: o.onclick },
      o.ico ? h('span', { class: 'ui-ico', style: 'background:' + o.ico[0] }, ic(o.ico[1], 16, '#fff')) : null,
      h('div', null, h('div', { class: 't' }, o.t), o.d ? h('div', { class: 'd' }, o.d) : null),
      o.v != null ? h('span', { class: 'v' }, o.v) : null, o.toggle ? null : o.onclick ? h('span', { class: 'ui-chev' }, '›') : null, o.toggle || null);
  }
  function toggle(on) { var b = h('button', { type: 'button', class: 'ui-switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(!!on) }); b.addEventListener('click', function (e) { e.stopPropagation(); b.classList.toggle('on'); b.setAttribute('aria-checked', String(b.classList.contains('on'))); }); return b; }
  function ring(pct, color, size) {
    var r = 35, c = 2 * Math.PI * r, t = document.createElement('template');
    t.innerHTML = '<svg class="ui-ring" width="' + (size || 86) + '" height="' + (size || 86) + '" viewBox="0 0 86 86"><circle cx="43" cy="43" r="35" fill="none" stroke="' + color + '" stroke-opacity=".18" stroke-width="12"/><circle cx="43" cy="43" r="35" fill="none" stroke="' + color + '" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + c.toFixed(1) + '" transform="rotate(-90 43 43)"/></svg>';
    var el = t.content.firstChild;
    setTimeout(function () { el.lastChild.setAttribute('stroke-dashoffset', (c * (1 - pct)).toFixed(1)); }, 120);
    return el;
  }
  function tile(label, color, icon, value, unit, sub) {
    var v = h('div', { class: 'v' }, value, h('small', null, unit));
    return { el: h('div', { class: 'ui-tile' }, h('div', { class: 'l', style: 'color:' + color }, ic(icon, 14), label), v, h('div', { class: 's' }, sub)), set: function (x) { v.firstChild.textContent = x; } };
  }

  /* ═════════ Turbofan for iPhone ═════════ */
  function turbofanPhone() {
    var UNITS = [
      { id: 'GT-07', kind: 'Frame 7', color: '#ff9500', state: 'Combustion watch', rul: 552, egt: 614, health: 71 },
      { id: 'GT-01', kind: 'Frame 7', color: '#ffcc00', state: 'Compressor fouling', rul: 1240, egt: 588, health: 78 },
      { id: 'GT-04', kind: 'LM6000', color: '#34c759', state: 'Normal', rul: 2340, egt: 579, health: 96 },
      { id: 'GT-02', kind: 'LM6000', color: '#34c759', state: 'Normal', rul: 1920, egt: 581, health: 92 },
    ];
    var S = { dismissed: false, wos: [['GT-01', 'Compressor wash', 'Oct 27'], ['GT-02', 'Lube oil sample', 'Oct 22']], live: [] };
    var P = phone({
      tabs: [{ id: 'fleet', label: 'Fleet', icon: 'grid' }, { id: 'alerts', label: 'Alerts', icon: 'bell' }, { id: 'maint', label: 'Maintenance', icon: 'cal' }, { id: 'account', label: 'Account', icon: 'person' }],
      screens: {
        fleet: function () { return { title: 'Fleet', large: true, trailing: h('div', { class: 'ui-avatar', style: 'background:linear-gradient(#a3a3ab,#85858d)' }, 'PA'), build: fleet }; },
        alerts: function () { return { title: 'Alerts', large: true, build: function (s) { s.append(h('div', { class: 'ui-lead' }, S.dismissed ? '1 active' : '2 active'), h('div', { class: 'ui-list' }, (S.dismissed ? [] : [li({ ico: ['#ff3b30', 'alert'], t: 'GT-07 combustion instability', d: 'Critical · 23 days to fault', onclick: function () { detail(UNITS[0]); } })]).concat([li({ ico: ['#ff9500', 'alert'], t: 'GT-01 compressor fouling', d: 'Advisory · efficiency −2.1%', onclick: function () { detail(UNITS[1]); } })]))); } }; },
        maint: function () { return { title: 'Maintenance', large: true, build: function (s) { s.append(h('div', { class: 'ui-lead' }, S.wos.length + ' open work orders'), h('div', { class: 'ui-list' }, S.wos.map(function (w) { return li({ ico: ['#007aff', 'wrench'], t: w[0] + ' · ' + w[1], d: 'Due ' + w[2] }); }))); } }; },
        account: function () { return { title: 'Account', large: true, build: function (s) { s.append(h('div', { class: 'ui-hdr' }, 'Notifications'), h('div', { class: 'ui-list' }, li({ t: 'Critical alerts', toggle: toggle(true) }), li({ t: 'Advisories', toggle: toggle(true) }), li({ t: 'Daily summary', toggle: toggle(false) })), h('div', { class: 'ui-hdr' }, 'Site'), h('div', { class: 'ui-list' }, li({ ico: ['#8e8e93', 'pin'], t: 'Plant Alpha', d: '4 turbines · edge models on site' }))); } }; },
      },
    });
    function fleet(s) {
      S.live = [];
      s.append(h('div', { class: 'ui-lead' }, 'Plant Alpha · 4 turbines'));
      var card = h('div', { class: 'ui-icard' + (S.dismissed ? ' gone' : '') },
        h('div', { class: 'ui-eyebrow', style: 'color:#ff9500' }, excl('#ff9500', 16), 'Critical alert', h('time', null, 'now')),
        h('div', { class: 'ui-ih' }, 'GT-07 combustion instability'),
        h('div', { class: 'ui-ip' }, 'Exhaust gas temperature is 14 °C above trend. Predicted fault in 23 days.'),
        h('div', { class: 'ui-ibtns' }, h('button', { type: 'button', class: 'ui-ibtn p', onclick: function () { detail(UNITS[0]); } }, 'View Details'),
          h('button', { type: 'button', class: 'ui-ibtn', onclick: function () {
            S.dismissed = true; card.classList.add('gone'); P.badge('alerts', 1);
            P.banner('#8e8e93', 'bell', 'Alert dismissed', 'GT-07 stays on watch.', { label: 'Undo', fn: function () { S.dismissed = false; card.classList.remove('gone'); P.badge('alerts', 2); } });
          } }, 'Dismiss')));
      var rulNum = h('b', { class: 'ui-tnum' }, '552 h');
      s.append(card, h('div', { class: 'ui-hdr' }, 'Remaining useful life'),
        h('div', { class: 'ui-icard' }, h('div', { style: 'display:flex;align-items:center;gap:18px' }, ring(0.4, '#ff9500'), h('div', { style: 'display:grid;gap:2px' }, h('span', { style: 'font-size:34px;font-weight:700;letter-spacing:.3px' }, rulNum), h('span', { style: 'font-size:15px;color:#8e8e93' }, 'GT-07 · about 23 days'))),
          h('div', { class: 'ui-istats' }, h('div', null, h('b', null, '87%'), h('span', null, 'Confidence')), h('div', null, h('b', null, '+14 °C'), h('span', null, 'EGT trend')), h('div', null, h('b', null, '4 of 4'), h('span', null, 'Online')))),
        h('div', { class: 'ui-hdr' }, 'Turbines'),
        h('div', { class: 'ui-list' }, UNITS.map(function (u) {
          var row = li({ ico: [u.color, 'fan'], t: u.id + ' · ' + u.kind, d: u.state, v: u.egt + ' °C', onclick: function () { detail(u); } });
          S.live.push({ u: u, el: row.querySelector('.v') });
          return row;
        })));
    }
    function detail(u) {
      P.push({ title: u.id, back: 'Fleet', build: function (s) {
        var data = curve({ all: u.id === 'GT-07' ? { from: 598, to: 614, pow: 2.2, noise: 0.7 } : { from: u.egt - 2, to: u.egt, noise: 1 } }, 'Day', 11);
        var c = chart({ color: u.color === '#34c759' ? '#007aff' : u.color, w: 330, h: 120, fmt: function (v) { return v.toFixed(1) + ' °C'; } });
        var egtTile = tile('Exhaust temp', '#ff9500', 'bolt', u.egt, '°C', u.id === 'GT-07' ? '+14 above trend' : 'On trend');
        s.append(h('div', { class: 'ui-large', style: 'padding-top:4px' }, h('div', null, h('div', { class: 'h' }, u.id), h('div', { style: 'font-size:15px;color:#8e8e93' }, u.kind + ' · ' + u.state))),
          h('div', { class: 'ui-tiles' }, egtTile.el, tile('Health', '#34c759', 'heart', u.health, '/100', 'Model score').el, tile('Remaining', '#007aff', 'cal', u.rul, 'h', 'About ' + Math.round(u.rul / 24) + ' days').el, tile('Confidence', '#5856d6', 'check', u.id === 'GT-07' ? 87 : 94, '%', 'Bayesian estimate').el),
          h('div', { class: 'ui-hdr' }, 'Exhaust gas temperature · 24 h'), h('div', { class: 'ui-icard' }, c.el, c.axis),
          h('div', { style: 'margin:0 16px 16px' }, h('button', { type: 'button', class: 'ui-ibtn p', style: 'width:100%', onclick: function () { woSheet(u); } }, 'Create Work Order')));
        c.set(data, labels('Day'), u.id === 'GT-07' ? 620 : null);
      } });
    }
    function woSheet(u) {
      var when = 'Tomorrow';
      var seg = h('div', { class: 'ui-iseg' }, ['Tomorrow', 'In 3 days', 'Outage'].map(function (x) { return h('button', { type: 'button', class: x === when ? 'on' : null, onclick: function (e) { when = x; Array.prototype.forEach.call(seg.children, function (c) { c.classList.toggle('on', c === e.currentTarget); }); } }, x); }));
      P.sheet(h('div', null, h('div', { class: 'h' }, 'Work order · ' + u.id), h('div', { class: 'p' }, u.id === 'GT-07' ? 'Inspect fuel nozzles and liner on cans 3 and 7. Procedure attached from the manual.' : 'Inspection based on the latest model findings.'), seg,
        h('div', { class: 'ui-ibtns' }, h('button', { type: 'button', class: 'ui-ibtn', onclick: P.closeSheet }, 'Cancel'), h('button', { type: 'button', class: 'ui-ibtn p', onclick: function () {
          S.wos.unshift([u.id, u.id === 'GT-07' ? 'Combustor inspection' : 'Inspection', when]); P.closeSheet(); P.badge('maint', S.wos.length);
          P.banner('#34c759', 'wrench', 'Work order created', u.id + ' · due ' + when.toLowerCase() + '. Assigned to the on-call crew.');
        } }, 'Create'))));
    }
    P.tab('fleet'); P.badge('alerts', 2);
    return { el: P.root, tick: function () { S.live.forEach(function (x) { if (!x.el.isConnected) return; x.u.egt = Math.round(x.u.egt + (Math.random() - 0.5) * 2); x.el.textContent = x.u.egt + ' °C'; }); } };
  }

  /* ═════════ Hospital for iPhone ═════════ */
  function hospitalPhone() {
    var BEDS = [
      { id: 'Bed 3', hr: 72, rr: 16, sp: 98, bp: '118/76', watch: false },
      { id: 'Bed 5', hr: 81, rr: 17, sp: 97, bp: '124/80', watch: false },
      { id: 'Bed 7', hr: 88, rr: 24, sp: 95, bp: '131/84', watch: true },
      { id: 'Bed 12', hr: 68, rr: 15, sp: 99, bp: '112/70', watch: false },
    ];
    var S = { ack: false, live: [] };
    var P = phone({
      tabs: [{ id: 'ward', label: 'Ward', icon: 'bed' }, { id: 'alerts', label: 'Alerts', icon: 'bell' }, { id: 'mon', label: 'Monitors', icon: 'wave' }, { id: 'account', label: 'Account', icon: 'person' }],
      screens: {
        ward: function () { return { title: 'Ward 4B', large: true, trailing: h('div', { class: 'ui-avatar', style: 'background:linear-gradient(#ff6482,#ff2d55)' }, 'RN'), build: ward }; },
        alerts: function () { return { title: 'Alerts', large: true, build: function (s) { s.append(h('div', { class: 'ui-lead' }, S.ack ? 'All acknowledged' : '1 needs review'), h('div', { class: 'ui-list' }, li({ ico: [S.ack ? '#8e8e93' : '#ff9500', 'alert'], t: 'Bed 7 · breathing rate rising', d: S.ack ? 'Acknowledged by you' : 'Early warning · 2 min ago', onclick: function () { bed(BEDS[2]); } }))); } }; },
        mon: function () { return { title: 'Monitors', large: true, build: function (s) { s.append(h('div', { class: 'ui-lead' }, '12 bedside monitors · inference on the ward gateway'), h('div', { class: 'ui-list' }, BEDS.map(function (b) { return li({ ico: ['#34c759', 'wave'], t: 'Monitor · ' + b.id, d: 'Online · streaming every second', v: '9 ms' }); }))); } }; },
        account: function () { return { title: 'Account', large: true, build: function (s) { s.append(h('div', { class: 'ui-hdr' }, 'Alerts'), h('div', { class: 'ui-list' }, li({ t: 'Early warnings', toggle: toggle(true) }), li({ t: 'Escalate after 10 min', toggle: toggle(true) }), li({ t: 'Quiet hours', toggle: toggle(false) })), h('div', { class: 'ui-hdr' }, 'Privacy'), h('div', { class: 'ui-list' }, li({ ico: ['#8e8e93', 'lock'], t: 'On device', d: 'Patient data never leaves the building' }))); } }; },
      },
    });
    function ward(s) {
      S.live = [];
      s.append(h('div', { class: 'ui-lead' }, '12 beds · monitored on device'));
      var eb = h('div', { class: 'ui-eyebrow', style: 'color:' + (S.ack ? '#8e8e93' : '#ff9500') }, excl(S.ack ? '#8e8e93' : '#ff9500', 16), S.ack ? 'Acknowledged' : 'Early warning', h('time', null, S.ack ? 'by you · now' : '2 min ago'));
      var trend = chart({ color: '#ff9500', w: 330, h: 64, fmt: function (v) { return v.toFixed(0) + ' breaths/min'; } });
      var ackBtn = h('button', { type: 'button', class: 'ui-ibtn', disabled: S.ack ? true : null, onclick: function () {
        S.ack = true; ackBtn.setAttribute('disabled', ''); ackBtn.textContent = 'Acknowledged';
        eb.style.color = '#8e8e93'; eb.lastChild.textContent = 'by you · now'; eb.childNodes[1].textContent = 'Acknowledged'; P.badge('alerts', 0);
        P.banner('#ff2d55', 'heart', 'Acknowledged', 'Bed 7 stays on the watch list. Charge nurse notified.');
      } }, S.ack ? 'Acknowledged' : 'Acknowledge');
      s.append(h('div', { class: 'ui-icard' }, eb, h('div', { class: 'ui-ih' }, 'Bed 7 · breathing rate rising'), h('div', { class: 'ui-ip' }, 'Up 6 breaths a minute over 40 minutes. Oxygen saturation stable at 95%.'), h('div', { style: 'margin-top:10px' }, trend.el),
        h('div', { class: 'ui-ibtns' }, h('button', { type: 'button', class: 'ui-ibtn p', onclick: function () { bed(BEDS[2]); } }, 'Review'), ackBtn)));
      trend.set(curve({ all: { from: 18, to: 24, pow: 1.6, noise: 0.4 } }, 'Day', 5), labels('Day'), null);
      trend.axis.remove();
      s.append(h('div', { class: 'ui-hdr' }, 'Beds'), h('div', { class: 'ui-list' }, BEDS.map(function (b) {
        var row = li({ ico: [b.watch ? '#ff9500' : '#34c759', 'heart'], t: b.id, d: (b.watch ? 'Watch' : 'Stable') + ' · HR ' + b.hr + ' · SpO₂ ' + b.sp + '%', onclick: function () { bed(b); } });
        S.live.push({ b: b, el: row.querySelector('.d') }); return row;
      })), h('div', { class: 'ui-list' }, li({ ico: ['#8e8e93', 'lock'], t: 'On device', d: 'Patient data never leaves the building' })));
    }
    function bed(b) {
      P.push({ title: b.id, back: 'Ward 4B', build: function (s) {
        var hr = tile('Heart rate', '#ff2d55', 'heart', b.hr, 'bpm', 'Resting'), rr = tile('Breathing', '#ff9500', 'wave', b.rr, '/min', b.watch ? 'Rising for 40 min' : 'Normal'),
          sp = tile('SpO₂', '#007aff', 'drop', b.sp, '%', 'Stable'), bp = tile('Blood pressure', '#5856d6', 'bolt', b.bp, 'mmHg', 'Last 5 min');
        S.detail = { b: b, hr: hr, rr: rr, sp: sp };
        var c = chart({ color: b.watch ? '#ff9500' : '#007aff', w: 330, h: 110, fmt: function (v) { return v.toFixed(0) + ' breaths/min'; } });
        s.append(h('div', { class: 'ui-large', style: 'padding-top:4px' }, h('div', null, h('div', { class: 'h' }, b.id), h('div', { style: 'font-size:15px;color:#8e8e93' }, b.watch ? 'On watch · early warning' : 'Stable'))),
          h('div', { class: 'ui-tiles' }, hr.el, rr.el, sp.el, bp.el), h('div', { class: 'ui-hdr' }, 'Breathing rate · 24 h'), h('div', { class: 'ui-icard' }, c.el, c.axis),
          h('div', { style: 'margin:0 16px 16px' }, h('button', { type: 'button', class: 'ui-ibtn p', style: 'width:100%', onclick: function () { P.banner('#ff2d55', 'heart', 'Charge nurse notified', b.id + ' flagged for review now.'); } }, 'Notify Charge Nurse')));
        c.set(curve({ all: b.watch ? { from: 16, to: 24, pow: 2.4, noise: 0.5 } : { from: b.rr, to: b.rr, noise: 0.6 } }, 'Day', 23), labels('Day'), null);
      } });
    }
    P.tab('ward'); P.badge('alerts', 1);
    return { el: P.root, tick: function () {
      BEDS.forEach(function (b) { b.hr = clamp(b.hr + Math.round((Math.random() - 0.5) * 3), 60, 99); b.sp = clamp(b.sp + Math.round((Math.random() - 0.45) * 1), 94, 100); });
      S.live.forEach(function (x) { if (x.el.isConnected) x.el.textContent = (x.b.watch ? 'Watch' : 'Stable') + ' · HR ' + x.b.hr + ' · SpO₂ ' + x.b.sp + '%'; });
      if (S.detail) { S.detail.hr.set(S.detail.b.hr); S.detail.sp.set(S.detail.b.sp); }
    } };
  }

  /* ═════════ Precision Ag for iPhone ═════════ */
  function agPhone() {
    var GRID = [[30, 33, 35, 36, 33, 30], [33, 35, 24, 26, 35, 33], [35, 38, 18, 31, 38, 35], [38, 41, 35, 38, 41, 38]];
    var COLS = 'ABCDEF', NEED = 26;
    var S = { sel: [2, 2], done: {} };
    function color(m) { return m < 22 ? '#ffd59e' : m < 26 ? '#ffe7c2' : m < 31 ? '#bcd7ff' : m < 35 ? '#9cc4ff' : m < 38 ? '#7fb2ff' : m < 40 ? '#5b9cff' : '#3d8bff'; }
    var SENSORS = [['Soil probe C3', 18, '%'], ['Soil probe C2', 24, '%'], ['Soil probe B2', 35, '%'], ['Air temperature', 21, '°C'], ['Leaf wetness', 12, '%'], ['Rain gauge', 0, 'mm']];
    var sensorEls = [];
    var P = phone({
      tabs: [{ id: 'fields', label: 'Fields', icon: 'map' }, { id: 'alerts', label: 'Alerts', icon: 'bell' }, { id: 'sensors', label: 'Sensors', icon: 'signal' }, { id: 'account', label: 'Account', icon: 'person' }],
      screens: {
        fields: function () { return { title: 'Field 7', large: true, trailing: h('div', { class: 'ui-avatar', style: 'background:linear-gradient(#5cd67a,#34c759)' }, 'NB'), build: fields }; },
        alerts: function () { return { title: 'Alerts', large: true, build: function (s) { s.append(h('div', { class: 'ui-lead' }, 'Field 7 · this week'), h('div', { class: 'ui-list' }, li({ ico: ['#ff9500', 'drop'], t: 'Zone C3 below crop need', d: 'Soil moisture 18% · irrigate', onclick: function () { P.tab('fields'); } }), li({ ico: ['#5856d6', 'moon'], t: 'Cold night Thursday', d: 'Low of 3 °C forecast' }))); } }; },
        sensors: function () { return { title: 'Sensors', large: true, build: sensorList }; },
        account: function () { return { title: 'Account', large: true, build: function (s) { s.append(h('div', { class: 'ui-hdr' }, 'Field gateway'), h('div', { class: 'ui-list' }, li({ t: 'Offline mode', toggle: toggle(true) }), li({ t: 'Auto-irrigate dry zones', toggle: toggle(false) }), li({ ico: ['#8e8e93', 'sync'], t: 'Last sync', d: 'Syncs when a connection returns', v: '6 h ago' }))); } }; },
      },
    });
    function sensorList(s) {
      sensorEls = [];
      s.append(h('div', { class: 'ui-lead' }, '24 online · inference on the field gateway'), h('div', { class: 'ui-list' }, SENSORS.map(function (x) {
        var row = li({ ico: ['#34c759', 'signal'], t: x[0], d: 'Reporting every minute', v: x[1] + ' ' + x[2] });
        sensorEls.push({ x: x, el: row.querySelector('.v') }); return row;
      })));
    }
    function fields(s) {
      var map = h('div', { class: 'ui-map', role: 'grid', 'aria-label': 'Soil moisture by zone' });
      var card = h('div', { class: 'ui-icard' });
      GRID.forEach(function (row, r) { row.forEach(function (m, c) {
        var id = COLS[c] + (r + 1);
        var b = h('button', { type: 'button', 'aria-label': 'Zone ' + id + ', ' + m + '% moisture', style: 'background:' + color(m), class: (S.sel[0] === r && S.sel[1] === c ? 'sel' : '') + (S.done[id] ? ' done' : ''), onclick: function () {
          S.sel = [r, c]; Array.prototype.forEach.call(map.children, function (x) { x.classList.remove('sel'); }); b.classList.add('sel'); zone();
        } });
        map.append(b);
      }); });
      function zone() {
        var r = S.sel[0], c = S.sel[1], m = GRID[r][c], id = COLS[c] + (r + 1), dry = m < NEED;
        card.textContent = '';
        var hrs = Math.max(1, Math.round((NEED - m) / 4));
        card.append(h('div', { class: 'ui-ih', style: 'margin-top:0' }, dry ? 'Irrigate zone ' + id : 'Zone ' + id + ' is on track'),
          h('div', { class: 'ui-ip' }, dry ? 'Soil moisture ' + m + '%, below the ' + NEED + '% the crop needs this week. About ' + hrs + ' h at current flow.' : 'Soil moisture ' + m + '%. No irrigation needed this week.'),
          h('div', { class: 'ui-ibtns' }, S.done[id] ? h('button', { type: 'button', class: 'ui-ibtn', disabled: true }, 'Scheduled · ' + S.done[id]) : dry ? [h('button', { type: 'button', class: 'ui-ibtn p', onclick: function () { schedule(id, hrs); } }, 'Schedule'), h('button', { type: 'button', class: 'ui-ibtn' }, 'Later')] : h('button', { type: 'button', class: 'ui-ibtn', disabled: true }, 'No action needed')));
      }
      function schedule(id, hrs) {
        var when = '5:00 AM';
        var seg = h('div', { class: 'ui-iseg' }, ['Now', '5:00 AM', 'Tonight'].map(function (x) { return h('button', { type: 'button', class: x === when ? 'on' : null, onclick: function (e) { when = x; Array.prototype.forEach.call(seg.children, function (k) { k.classList.toggle('on', k === e.currentTarget); }); } }, x); }));
        P.sheet(h('div', null, h('div', { class: 'h' }, 'Irrigate zone ' + id), h('div', { class: 'p' }, 'Runs about ' + hrs + ' h. The field gateway starts it even without a connection.'), seg,
          h('div', { class: 'ui-ibtns' }, h('button', { type: 'button', class: 'ui-ibtn', onclick: P.closeSheet }, 'Cancel'), h('button', { type: 'button', class: 'ui-ibtn p', onclick: function () {
            S.done[id] = when; P.closeSheet(); zone();
            Array.prototype.forEach.call(map.children, function (x) { if (x.getAttribute('aria-label').indexOf('Zone ' + id + ',') === 0) x.classList.add('done'); });
            P.banner('#007aff', 'drop', 'Irrigation scheduled', 'Zone ' + id + ' · ' + (when === 'Now' ? 'starting now' : when) + '.');
          } }, 'Schedule'))));
      }
      s.append(h('div', { class: 'ui-lead' }, 'North block · 42 ha · working offline'),
        h('div', { class: 'ui-icard' }, h('div', { class: 'ui-eyebrow', style: 'color:#007aff' }, ic('drop', 16), 'Soil moisture', h('time', null, 'tap a zone')), map, h('div', { class: 'ui-legend' }, h('span', null, 'Dry'), h('span', null, 'Crop need ' + NEED + '%'), h('span', null, 'Wet'))),
        card,
        h('div', { class: 'ui-list' }, li({ ico: ['#34c759', 'signal'], t: 'Sensors', d: 'Inference on the field gateway', v: '24 online', onclick: function () { P.push({ title: 'Sensors', back: 'Field 7', build: sensorList }); } }), li({ ico: ['#8e8e93', 'sync'], t: 'Last sync', d: 'Syncs when a connection returns', v: '6 h ago' })));
      zone();
    }
    P.tab('fields'); P.badge('alerts', 1);
    return { el: P.root, tick: function () {
      SENSORS.forEach(function (x) { if (x[2] === '%' || x[2] === '°C') x[1] = Math.max(0, +(x[1] + (Math.random() - 0.5) * 0.6).toFixed(1)); });
      sensorEls.forEach(function (s) { if (s.el.isConnected) s.el.textContent = (s.x[2] === 'mm' ? s.x[1] : s.x[1].toFixed ? Number(s.x[1]).toFixed(s.x[2] === '%' ? 0 : 1) : s.x[1]) + ' ' + s.x[2]; });
    } };
  }

  /* ═════════ app configs ═════════ */
  var TURBOFAN = {
    site: 'Fleet', unitsLabel: 'Units', title: 'Overview', subtitle: 'Plant Alpha · 4 turbines · updated just now',
    kpis: [['Active alerts', '2', null, '1 critical · 1 advisory'], ['Lowest remaining life', '552', 'h', 'GT-07'], ['Failures prevented', '$1.4', 'M', 'Year to date'], ['Next service', 'Oct 27', null, 'GT-01 compressor wash']],
    metric: { name: 'Exhaust gas temperature', limit: 620, fmt: function (v) { return v.toFixed(1) + ' °C'; } },
    primary: 'Create Work Order', woStart: 420, crew: ['On-call crew A', 'On-call crew B', 'Plant engineer'],
    grid: '1.1fr 1.3fr 0.7fr 1fr 0.8fr',
    cols: [['Unit', function (a) { return h('span', null, h('span', { class: 'ui-strong' }, a.id), h('span', { class: 'ui-sub' }, ' ' + a.kind)); }],
      ['Status', function (a) { return h('span', { class: 'ui-st' }, h('i', { class: 'ui-dot', style: 'background:' + a.color }), a.state); }],
      ['Health', function (a) { return h('span', { class: 'ui-tnum' }, a.health); }], ['Remaining life', function (a) { return h('span', { class: 'ui-tnum' }, a.rul); }],
      ['Heat rate', function (a) { return h('span', { class: 'ui-tnum ui-sub' }, a.heat); }]],
    assets: [
      { id: 'GT-07', kind: 'Frame 7', color: '#ff9500', state: 'Combustion watch', health: 71, rul: '552 h', heat: '+1.2%', next: 'Nov 2', jitter: 0.6,
        spec: { Day: { from: 598, to: 614, pow: 2.2, noise: 0.7 }, Week: { from: 592, to: 614, pow: 1.8, noise: 1 }, Month: { from: 586, to: 614, pow: 1.6, noise: 1.2 } },
        alert: { sev: 'critical', eyebrow: 'Critical alert', time: '3h ago', title: 'Combustion instability precursor', body: 'T4 is rising with dynamic pressure on cans 3 and 7. The pattern matches lean blowout precursors seen before past outages.', meta: [['87%', 'Confidence'], ['23 days', 'To predicted fault'], ['+14 °C', 'EGT above trend']], task: 'Combustor inspection, cans 3 and 7' } },
      { id: 'GT-01', kind: 'Frame 7', color: '#ffcc00', state: 'Compressor fouling', health: 78, rul: '1,240 h', heat: '+2.1%', next: 'Oct 27', jitter: 0.8,
        spec: { all: { from: 582, to: 588, pow: 1.2, noise: 1.2 } },
        alert: { sev: 'advisory', eyebrow: 'Advisory', time: '1d ago', title: 'Compressor efficiency down 2.1%', body: 'Isentropic efficiency has drifted below baseline for 9 days, consistent with blade fouling. An offline wash restores most of it.', meta: [['2.1%', 'Efficiency loss'], ['8 days', 'Wash window'], ['91%', 'Confidence']], task: 'Offline compressor wash' } },
      { id: 'GT-04', kind: 'LM6000', color: '#34c759', state: 'Normal', health: 96, rul: '2,340 h', heat: '+0.2%', next: 'Dec 4', jitter: 0.8, spec: { all: { from: 579, to: 579, noise: 1 } }, alert: null },
      { id: 'GT-02', kind: 'LM6000', color: '#34c759', state: 'Normal', health: 92, rul: '1,920 h', heat: '+0.4%', next: 'Nov 18', jitter: 0.8, spec: { all: { from: 581, to: 581, noise: 1 } }, alert: null },
    ],
    workOrders: [{ id: 'WO-412', asset: 'GT-01', task: 'Offline compressor wash', due: 'Oct 27', status: 'Scheduled' }, { id: 'WO-405', asset: 'GT-02', task: 'Lube oil sample', due: 'Oct 22', status: 'Open' }, { id: 'WO-409', asset: 'GT-04', task: 'Borescope inspection', due: 'Oct 18', status: 'Done' }],
    procedure: ['Confirm the T4 spread across cans 3 and 7 on the HMI', 'Pull the dynamic pressure trend for the last 72 hours', 'Inspect fuel nozzles on cans 3 and 7 at the next opportunity', 'Check the combustor liner through the borescope port', 'Log findings to the work order'],
    reports: [['Fleet health · October', 'PDF · 14 pages'], ['Heat rate and fouling · Q3', 'PDF · 9 pages'], ['Alert audit trail · 90 days', 'CSV · 2,104 rows']],
  };
  var PLANT = {
    site: 'Mill North', unitsLabel: 'Line 3 assets', title: 'Line 3', subtitle: '5 assets · 31 sensors · inference on the line controller',
    kpis: [['Line availability', '98.6', '%', 'This week'], ['Throughput', '412', 't/h', 'At plan'], ['Open anomalies', '1', null, 'Pump P-204'], ['Energy per tonne', '6.8', 'kWh', '−0.3 vs last week']],
    metric: { name: 'Vibration RMS', limit: 7.1, fmt: function (v) { return v.toFixed(2) + ' mm/s'; } },
    primary: 'Plan Replacement', woStart: 1190, crew: ['Mechanical shift A', 'Mechanical shift B', 'Reliability engineer'],
    grid: '1.2fr 1.3fr 0.7fr 1fr 0.7fr',
    cols: [['Asset', function (a) { return h('span', { class: 'ui-strong' }, a.id); }], ['Status', function (a) { return h('span', { class: 'ui-st' }, h('i', { class: 'ui-dot', style: 'background:' + a.color }), a.state); }],
      ['Health', function (a) { return h('span', { class: 'ui-tnum' }, a.health); }], ['Next service', function (a) { return h('span', { class: 'ui-tnum' }, a.next); }], ['Sensors', function (a) { return h('span', { class: 'ui-tnum ui-sub' }, a.sensors); }]],
    assets: [
      { id: 'P-204', kind: 'Pump', color: '#ff9500', state: 'Bearing wear', health: 64, next: 'In 9 days', sensors: 8, jitter: 0.06,
        spec: { Day: { from: 4.2, to: 4.6, pow: 1.4, noise: 0.05 }, Week: { from: 2.3, to: 4.6, pow: 1.9, noise: 0.08 }, Month: { from: 1.9, to: 4.6, pow: 2.4, noise: 0.08 } },
        alert: { sev: 'advisory', eyebrow: 'Bearing wear', time: '1h ago', title: 'Outboard bearing vibration rising', body: 'The 2× running-speed component has doubled in five days, with temperature tracking it. Matches early outer-race wear.', meta: [['9 days', 'To alarm threshold'], ['4.6 mm/s', 'Vibration RMS'], ['82%', 'Confidence']], task: 'Replace outboard bearing' } },
      { id: 'P-205', kind: 'Pump', color: '#34c759', state: 'Normal', health: 93, next: 'Nov 30', sensors: 8, jitter: 0.05, spec: { all: { from: 1.8, to: 1.8, noise: 0.08 } }, alert: null },
      { id: 'C-31', kind: 'Compressor', color: '#34c759', state: 'Normal', health: 90, next: 'Dec 14', sensors: 7, jitter: 0.05, spec: { all: { from: 2.3, to: 2.3, noise: 0.1 } }, alert: null },
      { id: 'K-3', kind: 'Conveyor', color: '#34c759', state: 'Normal', health: 95, next: 'Jan 2', sensors: 5, jitter: 0.05, spec: { all: { from: 1.4, to: 1.4, noise: 0.08 } }, alert: null },
      { id: 'R-1', kind: 'Crusher', color: '#34c759', state: 'Normal', health: 88, next: 'Nov 21', sensors: 3, jitter: 0.06, spec: { all: { from: 2.9, to: 2.9, noise: 0.12 } }, alert: null },
    ],
    workOrders: [{ id: 'WO-1188', asset: 'C-31', task: 'Intake filter change', due: 'Oct 23', status: 'Open' }, { id: 'WO-1186', asset: 'R-1', task: 'Liner wear check', due: 'Oct 25', status: 'Scheduled' }, { id: 'WO-1183', asset: 'K-3', task: 'Belt tension check', due: 'Oct 17', status: 'Done' }],
    procedure: ['Confirm the 2× running-speed peak in the spectrum', 'Check lubrication and bearing temperature', 'Order a replacement outboard bearing', 'Plan the swap at the next shift change', 'Log findings to the work order'],
    reports: [['Line 3 reliability · October', 'PDF · 11 pages'], ['Energy per tonne · Q3', 'PDF · 6 pages'], ['Vibration history · 90 days', 'CSV · 8,640 rows']],
  };

  var APPS = {
    'edge-console': edgeConsole,
    'turbofan-mac': function () { return assetMac(TURBOFAN); },
    'plant-mac': function () { return assetMac(PLANT); },
    'turbofan-ios': turbofanPhone,
    'hospital-ios': hospitalPhone,
    'ag-ios': agPhone,
  };

  /* ═════════ mount, scale to fit, tick while visible ═════════ */
  var mounted = [];
  function mount(box) {
    var make = APPS[box.dataset.app];
    if (!make) return;
    var app;
    try { app = make(); } catch (e) { console.error(e); return; }
    var logical = +box.dataset.w || 1200;
    var scale = h('div', { class: 'ui-scale', style: 'width:' + logical + 'px' }, app.el);
    box.append(scale);
    box.classList.add('live');
    function fit() {
      var s = box.clientWidth / logical;
      scale.style.transform = 'scale(' + s + ')';
      box.style.height = Math.ceil(scale.offsetHeight * s) + 'px';
    }
    if ('ResizeObserver' in window) { var ro = new ResizeObserver(fit); ro.observe(box); ro.observe(scale); }
    window.addEventListener('resize', fit);
    fit();
    var rec = { app: app, visible: false };
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { rec.visible = e[0].isIntersecting; }).observe(box);
    mounted.push(rec);
  }
  function boot() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-app]'), mount);
    setInterval(function () { mounted.forEach(function (m) { if (m.visible && m.app.tick && !document.hidden) m.app.tick(); }); }, 1600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
