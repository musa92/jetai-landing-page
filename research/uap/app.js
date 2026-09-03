/* UAP research note — WebGL ground, scroll choreography, chart, model.
   Every enhancement is additive: with JS off or a library blocked, the article
   renders and reads. Nothing is hidden that JS is required to reveal.        */
(function () {
  'use strict';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── WebGL ground ───────────────────────────────────────────────────────
     A slow drifting field, not a centrepiece. Two warm lobes moving through
     fbm noise on near-black, heavily vignetted so it never competes with type.
     Capped at 1.5x DPR and paused off-screen.                              */
  (function ground() {
    var cv = document.getElementById('gl');
    if (!cv || !window.THREE || reduced) return;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: false });
    } catch (e) { return; }                       // no WebGL: leave the flat bg
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    var scene = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    var uniforms = {
      u_time: { value: 0 },
      u_res:  { value: new THREE.Vector2(1, 1) }
    };

    var frag = [
      'precision highp float;',
      'uniform float u_time; uniform vec2 u_res;',
      'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
      'float noise(vec2 p){',
      '  vec2 i = floor(p), f = fract(p);',
      '  vec2 u = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),',
      '             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);',
      '}',
      'float fbm(vec2 p){',
      '  float v = 0.0, a = 0.5;',
      '  for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.02; a *= 0.5; }',
      '  return v;',
      '}',
      'void main(){',
      '  vec2 uv = gl_FragCoord.xy / u_res;',
      '  vec2 p = uv * vec2(u_res.x / u_res.y, 1.0);',
      '  float t = u_time * 0.017;',
      '  float n = fbm(p * 1.7 + vec2(t, t * 0.6));',
      '  float m = fbm(p * 2.6 - vec2(t * 0.8, t * 0.35));',
      // two warm lobes drifting on their own clocks
      '  float lobeA = smoothstep(0.62, 1.0, n) * 0.55;',
      '  float lobeB = smoothstep(0.70, 1.0, m) * 0.32;',
      '  vec3 warm   = vec3(0.431, 0.541, 1.000);',
      '  vec3 cool   = vec3(0.380, 0.400, 0.680);',
      '  vec3 col = vec3(0.043, 0.043, 0.047);',
      '  col += warm * lobeA * 0.075;',
      '  col += cool * lobeB * 0.050;',
      // vignette, then a touch of grain so gradients never band
      '  float d = distance(uv, vec2(0.5));',
      '  col *= smoothstep(1.05, 0.18, d);',
      '  col += (hash(gl_FragCoord.xy + u_time) - 0.5) * 0.012;',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n');

    scene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: 'void main(){ gl_Position = vec4(position, 1.0); }',
        fragmentShader: frag
      })
    ));

    var resize = function () {
      var w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false);
      uniforms.u_res.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    };
    resize();
    window.addEventListener('resize', resize);

    var visible = true;
    document.addEventListener('visibilitychange', function () { visible = !document.hidden; });

    var start = performance.now();
    (function loop(now) {
      requestAnimationFrame(loop);
      if (!visible) return;
      uniforms.u_time.value = (now - start) * 0.001;
      renderer.render(scene, camera);
    })(start);

    requestAnimationFrame(function () { cv.classList.add('on'); });
  })();

  /* ── smooth scroll ─────────────────────────────────────────────────────── */
  var lenis = null;
  if (window.Lenis && !reduced) {
    lenis = new window.Lenis({ duration: 1.1, smoothWheel: true });
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
  }

  /* ── reading progress ──────────────────────────────────────────────────── */
  var bar = document.getElementById('progress');
  var tick = function () {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
  };
  document.addEventListener('scroll', tick, { passive: true });
  tick();

  /* ── headline ──────────────────────────────────────────────────────────
     Words are wrapped and released by class. No tween library touches
     visibility: a stalled animation must never be able to hide the title.  */
  (function headline() {
    var h = document.getElementById('hd');
    if (!h) return;

    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (tok) {
            if (!tok.trim()) return frag.appendChild(document.createTextNode(tok));
            var sp = document.createElement('span');
            sp.className = 'word'; sp.textContent = tok;
            frag.appendChild(sp);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) { walk(n); }
      });
    };
    walk(h);

    var intro = document.querySelectorAll('.kicker, .abstract, .meta-line');
    if (reduced) return;

    var words = h.querySelectorAll('.word');
    Array.prototype.forEach.call(words, function (w, i) {
      w.style.transitionDelay = (i * 0.045).toFixed(3) + 's';
    });
    Array.prototype.forEach.call(intro, function (el, i) {
      el.classList.add('intro', 'intro-anim');
      el.style.transitionDelay = (0.45 + i * 0.09).toFixed(3) + 's';
    });
    h.classList.add('hd-anim');

    var release = function () {
      h.classList.add('hd-in');
      Array.prototype.forEach.call(intro, function (el) { el.classList.add('intro-in'); });
    };
    // A timer, not requestAnimationFrame: rAF is throttled in a backgrounded or
    // busy tab, and the title must not wait on a frame that may not come.
    setTimeout(release, 60);
    setTimeout(release, 1200);          // failsafe: never leave the title hidden
    window.addEventListener('pageshow', release);
  })();

  /* ── reveals ───────────────────────────────────────────────────────────── */
  var targets = document.querySelectorAll('figure, .calc, .note, .tbl, pre, .pull');
  var revealAll = function () {
    Array.prototype.forEach.call(targets, function (el) { el.classList.add('in'); });
  };

  if (reduced || !('IntersectionObserver' in window)) {
    revealAll();
  } else {
    document.documentElement.classList.add('js-anim');
    Array.prototype.forEach.call(targets, function (el) { el.classList.add('reveal'); });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    Array.prototype.forEach.call(targets, function (el) { io.observe(el); });
    // Anything still hidden after three seconds is a bug, not a design choice.
    setTimeout(revealAll, 3000);
    window.addEventListener('pageshow', revealAll);
  }

  /* ── revenue model ─────────────────────────────────────────────────────── */
  // Split from SPEC.md §10.1: node 6500 bps, exchange 2000, steward 1500.
  var NODE_BPS = 6500, STEWARD_BPS = 1500, H100_MONTH = 1440;
  var f = { dau: 'dau', turns: 'turns', load: 'load', cpm: 'cpm' };
  var o = { node: 'o-node', steward: 'o-steward', imps: 'o-imps', gpu: 'o-gpu' };
  Object.keys(f).forEach(function (k) { f[k] = document.getElementById(f[k]); });
  Object.keys(o).forEach(function (k) { o[k] = document.getElementById(o[k]); });

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
  var num = function (el, d) { var v = parseFloat(el && el.value); return isFinite(v) && v > 0 ? v : d; };

  var recompute = function () {
    if (!o.node) return;
    var dau = num(f.dau, 10000), turns = num(f.turns, 5);
    var load = Math.max(1, num(f.load, 3)), cpm = num(f.cpm, 40);
    // Multiply before dividing: (dau*turns/load)*30 drifts on non-representable
    // intermediates and the error reaches the displayed dollars.
    var imps = (dau * turns * 30) / load;
    var gross = (imps * cpm) / 1000;
    o.node.textContent = money(gross * NODE_BPS / 10000);
    o.steward.textContent = money(gross * STEWARD_BPS / 10000);
    o.imps.textContent = count(imps);
    o.gpu.textContent = Math.floor((gross * NODE_BPS / 10000) / H100_MONTH);
  };
  Object.keys(f).forEach(function (k) { if (f[k]) f[k].addEventListener('input', recompute); });
  recompute();

  /* ── coverage chart ───────────────────────────────────────────────────
     How many times over ad revenue covers the cost of serving one turn, as a
     function of CPM, at three ad loads. Log y, because the answer spans two
     orders of magnitude and a linear axis would flatten every curve against
     the top. Palette checked on the #131315 surface.                        */
  (function chart() {
    var host = document.getElementById('chart');
    if (!host || !window.d3) return;

    // Cost of one turn, derived in the copy above and recomputed here so the
    // figure and the prose cannot drift apart.
    var GPU_HR = 2.0, TOK_S = 3000, OUT_TOK = 400, PREFILL = 0.25;
    var COST = (GPU_HR / 3600 / TOK_S) * OUT_TOK * (1 + PREFILL);   // ~$0.000093
    var NODE = 0.65, MARKET_CPM = 60, XMAX = 60;

    var loads = [
      { L: 3,  label: 'one ad every 3 turns',  c: '#6e8aff', w: 2 },
      { L: 10, label: 'one ad every 10 turns', c: '#9aa8ff', w: 1.7 },
      { L: 20, label: 'one ad every 20 turns', c: '#6a6a73', w: 1.7 }
    ];
    var cover = function (p, L) { return (p / 1000) * (1 / L) * NODE / COST; };
    var tip = d3.select(document.body).append('div').attr('class', 'ch-tip');

    function draw() {
      host.innerHTML = '';
      var W = host.clientWidth || 640;
      var H = Math.max(260, Math.min(340, W * 0.46));
      var m = { t: 22, r: 116, b: 56, l: 52 };
      var iw = W - m.l - m.r, ih = H - m.t - m.b;

      var svg = d3.select(host).append('svg')
        .attr('viewBox', '0 0 ' + W + ' ' + H).attr('role', 'img')
        .attr('aria-label', 'Coverage of serving cost by ad revenue against CPM. ' +
          'Break-even is reached below three dollars CPM at every ad load tested.');
      var g = svg.append('g').attr('transform', 'translate(' + m.l + ',' + m.t + ')');

      var x = d3.scaleLinear().domain([0, XMAX]).range([0, iw]);
      var y = d3.scaleLog().domain([0.3, 300]).range([ih, 0]).clamp(true);

      var ticks = [0.3, 1, 3, 10, 30, 100, 300];
      g.selectAll('line.grid').data(ticks).enter().append('line')
        .attr('x1', 0).attr('x2', iw).attr('y1', y).attr('y2', y)
        .attr('stroke', function (d) { return d === 1 ? 'rgba(237,237,239,.22)' : 'rgba(237,237,239,.055)'; })
        .attr('stroke-dasharray', function (d) { return d === 1 ? '4 4' : null; });

      g.append('text').attr('class', 'ch-sub').attr('x', iw).attr('y', y(1) - 9)
        .attr('text-anchor', 'end').text('BREAK-EVEN — FREE TO SERVE ABOVE THIS LINE');

      var line = d3.line()
        .x(function (d) { return x(d); })
        .y(function (d, i, a) { return 0; });

      loads.forEach(function (s0) {
        var pts = d3.range(0.2, XMAX + 0.01, 0.2);
        g.append('path')
          .attr('d', d3.line().x(function (p) { return x(p); })
                              .y(function (p) { return y(cover(p, s0.L)); })(pts))
          .attr('fill', 'none').attr('stroke', s0.c).attr('stroke-width', s0.w);

        // direct label at the right edge, so the legend is not load-bearing
        g.append('text').attr('class', 'ch-sub').attr('fill', s0.c)
          .attr('x', iw + 8).attr('y', y(cover(XMAX, s0.L)) + 3)
          .text('1 IN ' + s0.L + ' · ' + Math.round(cover(MARKET_CPM, s0.L)) + 'x');

        // break-even marker
        var be = COST * 1000 * s0.L / NODE;
        g.append('circle').attr('cx', x(be)).attr('cy', y(1)).attr('r', 3.5)
          .attr('fill', s0.c).attr('stroke', '#131315').attr('stroke-width', 1.5);
      });

      // the observed market CPM
      g.append('line').attr('x1', x(MARKET_CPM)).attr('x2', x(MARKET_CPM))
        .attr('y1', 0).attr('y2', ih)
        .attr('stroke', 'rgba(237,237,239,.2)').attr('stroke-dasharray', '3 3');
      g.append('text').attr('class', 'ch-sub').attr('x', x(MARKET_CPM) - 8).attr('y', 10)
        .attr('text-anchor', 'end').text('MARKET CPM');

      // break-even band callout
      g.append('text').attr('class', 'ch-val').attr('fill', '#6e8aff')
        .attr('x', x(6)).attr('y', y(1) + 34).text('$0.43–2.85');
      g.append('text').attr('class', 'ch-sub')
        .attr('x', x(6)).attr('y', y(1) + 50).text('CPM NEEDED TO BREAK EVEN');

      // axes
      g.selectAll('text.yt').data(ticks).enter().append('text')
        .attr('class', 'ch-sub').attr('x', -10).attr('y', function (d) { return y(d) + 3; })
        .attr('text-anchor', 'end')
        .text(function (d) { return d < 1 ? d + 'x' : d + 'x'; });
      g.selectAll('text.xt').data([0, 15, 30, 45, 60]).enter().append('text')
        .attr('class', 'ch-sub').attr('x', x).attr('y', ih + 22)
        .attr('text-anchor', 'middle').text(function (d) { return '$' + d; });
      g.append('text').attr('class', 'ch-sub')
        .attr('x', iw / 2).attr('y', ih + 44).attr('text-anchor', 'middle')
        .text('CPM PAID FOR THE PLACEMENT');
      svg.append('text').attr('class', 'ch-sub')
        .attr('transform', 'rotate(-90)').attr('x', -(m.t + ih / 2)).attr('y', 13)
        .attr('text-anchor', 'middle').text('COST COVERED');

      // hover
      var focus = g.append('g').attr('opacity', 0);
      focus.append('line').attr('y1', 0).attr('y2', ih)
        .attr('stroke', 'rgba(237,237,239,.3)');
      g.append('rect').attr('width', iw).attr('height', ih).attr('fill', 'transparent')
        .on('mousemove', function (ev) {
          var px = d3.pointer(ev, this)[0];
          var p = Math.max(0.2, Math.min(XMAX, x.invert(px)));
          focus.attr('opacity', 1).attr('transform', 'translate(' + x(p) + ',0)');
          tip.style('opacity', 1)
             .style('left', ev.pageX + 'px').style('top', (ev.pageY - 14) + 'px')
             .html('<b>$' + p.toFixed(2) + ' CPM</b>' + loads.map(function (s0) {
               var c = cover(p, s0.L);
               return '1 in ' + s0.L + ': <span>' +
                      (c >= 1 ? c.toFixed(1) + 'x covered' : 'short of break-even') + '</span>';
             }).join('<br>'));
        })
        .on('mouseleave', function () { focus.attr('opacity', 0); tip.style('opacity', 0); });
    }

    draw();
    var t; window.addEventListener('resize', function () {
      clearTimeout(t); t = setTimeout(draw, 150);
    });

    var legend = document.createElement('div');
    legend.className = 'ch-legend';
    legend.innerHTML = loads.map(function (s0) {
      return '<span class="ch-key"><span class="ch-dot" style="background:' + s0.c +
             '"></span>' + s0.label + '</span>';
    }).join('') +
      '<span class="ch-key">cost basis · $0.000093 a turn</span>';
    host.parentNode.appendChild(legend);

    var table = document.createElement('table');
    table.className = 'sr-only';
    table.innerHTML = '<caption>Coverage of serving cost by ad revenue</caption><tbody>' +
      [1, 2, 5, 10, 20, 40, 60].map(function (p) {
        return '<tr><th scope="row">$' + p + ' CPM</th>' + loads.map(function (s0) {
          return '<td>1 in ' + s0.L + ': ' + cover(p, s0.L).toFixed(1) + ' times covered</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody>';
    host.parentNode.appendChild(table);
  })();
})();
