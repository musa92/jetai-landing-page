/* Research article behaviour: smooth scroll, reading progress, reveals, calculator. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- smooth scroll (Lenis) ------------------------------------------ */
  if (window.Lenis && !reduced) {
    var lenis = new window.Lenis({ duration: 1.05, smoothWheel: true });
    var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  /* ---- reading progress ------------------------------------------------ */
  var bar = document.getElementById('progress');
  var tick = function () {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
  };
  document.addEventListener('scroll', tick, { passive: true });
  tick();

  /* ---- section reveals ------------------------------------------------- */
  /* IntersectionObserver rather than a scroll-driven tween library: the end
     state is a CSS class, so it survives a throttled frame loop, and the
     failsafe guarantees the article is readable even if the observer never
     fires at all. */
  var targets = document.querySelectorAll(
    '.hero .standfirst, .hero .byline, section > .wrap > .article, ' +
    'section > .wrap > .wide, figure, .calc');

  var revealAll = function () {
    Array.prototype.forEach.call(targets, function (el) { el.classList.add('in'); });
  };

  if (reduced || !('IntersectionObserver' in window)) {
    revealAll();
  } else {
    document.documentElement.classList.add('js-anim');
    Array.prototype.forEach.call(targets, function (el, i) {
      el.classList.add('reveal');
      el.style.transitionDelay = (i === 0 ? 0 : 0.04) + 's';
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.04 });

    Array.prototype.forEach.call(targets, function (el) { io.observe(el); });

    // Anything still hidden after three seconds is a bug, not a design choice.
    setTimeout(revealAll, 3000);
    window.addEventListener('pageshow', revealAll);
  }

  /* ---- revenue model --------------------------------------------------- */
  // Split from SPEC.md §10.1: node 6500 bps, exchange 2000, steward 1500.
  var NODE_BPS = 6500, STEWARD_BPS = 1500;
  var H100_MONTHLY_USD = 1440;   // ~$2/hr on-demand

  var f = {
    dau: document.getElementById('dau'),
    turns: document.getElementById('turns'),
    load: document.getElementById('load'),
    cpm: document.getElementById('cpm')
  };
  var out = {
    node: document.getElementById('o-node'),
    steward: document.getElementById('o-steward'),
    imps: document.getElementById('o-imps'),
    gpu: document.getElementById('o-gpu')
  };

  var money = function (n) {
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(n < 1e7 ? 2 : 1) + 'M';
    if (n >= 1000) return '$' + Math.round(n / 1000) + 'k';
    return '$' + Math.round(n);
  };
  var count = function (n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1000) return Math.round(n / 1000) + 'k';
    return String(Math.round(n));
  };
  var num = function (el, fallback) {
    var v = parseFloat(el && el.value);
    return isFinite(v) && v > 0 ? v : fallback;
  };

  var recompute = function () {
    var dau = num(f.dau, 10000);
    var turns = num(f.turns, 5);
    var load = Math.max(1, num(f.load, 3));
    var cpm = num(f.cpm, 40);

    // Multiply before dividing: (dau*turns/load)*30 drifts, because 50000/3
    // is not representable and the error survives into the displayed dollars.
    var impsPerMonth = (dau * turns * 30) / load;
    var grossMonthly = (impsPerMonth * cpm) / 1000;

    out.node.textContent = money(grossMonthly * NODE_BPS / 10000);
    out.steward.textContent = money(grossMonthly * STEWARD_BPS / 10000);
    out.imps.textContent = count(impsPerMonth);
    out.gpu.textContent = Math.floor((grossMonthly * NODE_BPS / 10000) / H100_MONTHLY_USD);
  };

  Object.keys(f).forEach(function (k) {
    if (f[k]) f[k].addEventListener('input', recompute);
  });
  recompute();
})();

/* ── market chart: part-to-whole with one emphasised share ───────────────
   Two tones only, and they are not a categorical pair: cyan carries the
   argument, the neutral is the remainder. Palette checked against the
   #0a0a0c surface — cyan/neutral separation dE 31, both clear 3:1.        */
(function () {
  'use strict';
  var host = document.getElementById('chart');
  if (!host || !window.d3) return;

  var TOTAL = 800;                       // USD bn, global digital ad spend 2026
  var data = [
    { key: 'through open inference', value: 120, color: '#22d3ee' },
    { key: 'everywhere else',        value: 680, color: '#6b6960' }
  ];

  var tip = d3.select(document.body).append('div').attr('class', 'ch-tip');

  function draw() {
    host.innerHTML = '';
    var W = host.clientWidth || 640;
    var barH = 54, top = 44, bottom = 34;
    var H = top + barH + bottom;
    var GAP = 2;                          // surface gap between fills

    var svg = d3.select(host).append('svg')
      .attr('viewBox', '0 0 ' + W + ' ' + H)
      .attr('role', 'img')
      .attr('aria-label',
        'Global digital advertising spend 2026, 800 billion dollars. 120 billion, ' +
        'fifteen percent, is the share that would flow through open inference.');

    var x = d3.scaleLinear().domain([0, TOTAL]).range([0, W]);
    var acc = 0;
    var segs = data.map(function (d) {
      var s = { d: d, x0: acc, x1: acc + d.value };
      acc += d.value;
      return s;
    });

    // rounded outer ends, square inner ones
    function path(s, i) {
      var x0 = x(s.x0) + (i ? GAP : 0), x1 = x(s.x1), r = 4;
      var w = Math.max(1, x1 - x0), y = top, h = barH;
      var left = i === 0, right = i === segs.length - 1;
      return 'M' + (x0 + (left ? r : 0)) + ',' + y +
        'H' + (x1 - (right ? r : 0)) +
        (right ? 'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + r : '') +
        'V' + (y + h - (right ? r : 0)) +
        (right ? 'a' + r + ',' + r + ' 0 0 1 ' + -r + ',' + r : '') +
        'H' + (x0 + (left ? r : 0)) +
        (left ? 'a' + r + ',' + r + ' 0 0 1 ' + -r + ',' + -r : '') +
        'V' + (y + (left ? r : 0)) +
        (left ? 'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + -r : '') + 'Z';
    }

    svg.selectAll('path.ch-seg').data(segs).enter().append('path')
      .attr('class', 'ch-seg')
      .attr('d', path)
      .attr('fill', function (s) { return s.d.color; })
      .on('mousemove', function (ev, s) {
        tip.style('opacity', 1)
          .style('left', ev.pageX + 'px')
          .style('top', (ev.pageY - 14) + 'px')
          .html('<b>$' + s.d.value + 'B</b>' + s.d.key +
                ' <span>· ' + Math.round(s.d.value / TOTAL * 100) + '%</span>');
      })
      .on('mouseleave', function () { tip.style('opacity', 0); });

    // direct labels: the emphasised share above, the remainder below
    svg.append('text').attr('class', 'ch-val').attr('fill', '#22d3ee')
      .attr('x', 0).attr('y', top - 16).text('$120B');
    svg.append('text').attr('class', 'ch-sub')
      .attr('x', 74).attr('y', top - 16).text('15% — THROUGH OPEN INFERENCE');

    svg.append('text').attr('class', 'ch-sub').attr('text-anchor', 'end')
      .attr('x', W).attr('y', top + barH + 22)
      .text('$800B TOTAL DIGITAL AD SPEND, 2026');

    // tick at the boundary so the 15% reads as a position, not just a colour
    svg.append('line')
      .attr('x1', x(120)).attr('x2', x(120))
      .attr('y1', top - 8).attr('y2', top + barH + 8)
      .attr('stroke', '#22d3ee').attr('stroke-width', 1).attr('opacity', .45);
  }

  draw();
  var t; window.addEventListener('resize', function () {
    clearTimeout(t); t = setTimeout(draw, 140);
  });

  // legend + table fallback, so identity is never colour alone
  var legend = document.createElement('div');
  legend.className = 'ch-legend';
  legend.innerHTML = data.map(function (d) {
    return '<span class="ch-key"><span class="ch-dot" style="background:' + d.color +
           '"></span>' + d.key + ' · $' + d.value + 'B</span>';
  }).join('');
  host.parentNode.appendChild(legend);

  var table = document.createElement('table');
  table.className = 'sr-only';
  table.innerHTML = '<caption>Global digital ad spend 2026</caption><tbody>' +
    data.map(function (d) {
      return '<tr><th scope="row">' + d.key + '</th><td>$' + d.value + ' billion</td>' +
             '<td>' + Math.round(d.value / TOTAL * 100) + '%</td></tr>';
    }).join('') + '</tbody>';
  host.parentNode.appendChild(table);
})();
