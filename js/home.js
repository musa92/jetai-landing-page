/* ═══════════════════════════════════════════════════════════
   Turbnetic.ai — Edge AI umbrella landing · interactions
   WebGL shader hero · Lenis↔ScrollTrigger · SplitType reveals ·
   magnetic buttons · count-up · vanilla-tilt
═══════════════════════════════════════════════════════════ */
'use strict';

var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var COARSE  = window.matchMedia('(pointer: coarse)').matches;

/* ── Preloader ── */
(function preloader() {
  var el = document.getElementById('preloader');
  var fill = el && el.querySelector('.pre-fill');
  if (!el) return;
  var p = 0;
  var t = setInterval(function () {
    p = Math.min(100, p + (8 + (100 - p) * 0.06));
    if (fill) fill.style.width = p + '%';
    if (p >= 99.5) {
      clearInterval(t);
      setTimeout(function () {
        el.classList.add('done');
        document.body.classList.add('loaded');
        window.dispatchEvent(new Event('tn:loaded'));
      }, 240);
    }
  }, 80);
})();

/* ── Nav: scrolled state + mobile menu ── */
(function nav() {
  var bar = document.getElementById('nav');
  var burger = document.querySelector('.nav-burger');
  var menu = document.getElementById('mobile-menu');
  function onScroll() { if (bar) bar.classList.toggle('scrolled', window.scrollY > 24); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (burger && menu) {
    burger.addEventListener('click', function () {
      var open = burger.classList.toggle('open');
      menu.classList.toggle('open');
      burger.setAttribute('aria-expanded', open);
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        burger.classList.remove('open'); menu.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }
})();

/* ── Lenis smooth scroll, synced to GSAP ticker + ScrollTrigger ── */
var lenis = null;
(function smooth() {
  if (typeof Lenis === 'undefined' || REDUCED) {
    // native anchor scroll fallback
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href'); if (id.length < 2) return;
        var t = document.querySelector(id); if (!t) return;
        e.preventDefault(); t.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
      });
    });
    return;
  }
  lenis = new Lenis({ duration: 1.15, smoothWheel: true, lerp: 0.09 });
  if (typeof gsap !== 'undefined') {
    lenis.on('scroll', function () { if (window.ScrollTrigger) ScrollTrigger.update(); });
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  } else {
    function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
  }
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href'); if (id.length < 2) return;
      var t = document.querySelector(id); if (!t) return;
      e.preventDefault(); lenis.scrollTo(t, { offset: -70 });
    });
  });
})();

/* ── SplitType headline + GSAP scroll reveals ── */
(function reveals() {
  var hasGSAP = typeof gsap !== 'undefined';
  if (hasGSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  // Hero headline: split to words, mask-reveal on load
  var h1 = document.querySelector('[data-split]');
  function playHero() {
    var heroBits = document.querySelectorAll('#hero [data-reveal]');
    if (!hasGSAP || REDUCED) {
      if (h1) h1.classList.add('in');
      heroBits.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    // SplitType freezes line widths, which breaks reflow on small screens — only split on wide viewports
    var canSplit = h1 && typeof SplitType !== 'undefined' && window.innerWidth > 720;
    if (canSplit) {
      var split = new SplitType(h1, { types: 'lines,words' });
      h1.classList.add('in');
      tl.from(split.words, { yPercent: 118, duration: 0.9, stagger: 0.045 }, 0);
    } else if (h1) {
      h1.classList.add('in'); tl.from(h1, { y: 30, opacity: 0, duration: 0.9 }, 0);
    }
    tl.from(heroBits, { y: 24, opacity: 0, duration: 0.8, stagger: 0.09 }, 0.28);
  }

  if (document.body.classList.contains('loaded')) playHero();
  else window.addEventListener('tn:loaded', playHero, { once: true });
  // safety: never leave hero hidden
  setTimeout(function () {
    if (h1 && !h1.classList.contains('in')) playHero();
  }, 2600);

  // Section reveals — native IntersectionObserver (fires on real scroll, no ScrollTrigger/Lenis dependency)
  var all = document.querySelectorAll('[data-reveal], .reveal');
  var items = [];
  for (var a = 0; a < all.length; a++) {
    if (!(all[a].closest && all[a].closest('#hero'))) items.push(all[a]);
  }
  if (REDUCED || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('rv-in'); });
    return;
  }
  items.forEach(function (el) {
    el.classList.add('rv-init');
    // cascade: stagger items that share a parent (project rows, stack cells, specs…)
    var idx = 0, sib = el.previousElementSibling;
    while (sib) { if (sib.classList && sib.classList.contains('rv-init')) idx++; sib = sib.previousElementSibling; }
    if (idx > 0) el.style.transitionDelay = Math.min(idx, 6) * 80 + 'ms';
  });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('rv-in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
  items.forEach(function (el) { io.observe(el); });
})();

/* ── Count-up stats ── */
(function counters() {
  var els = document.querySelectorAll('[data-count]');
  if (!els.length) return;
  function run(el) {
    var end = parseFloat(el.getAttribute('data-count')) || 0;
    var suf = el.getAttribute('data-suffix') || '';
    if (REDUCED || typeof gsap === 'undefined') { el.textContent = end + suf; return; }
    var obj = { v: 0 };
    gsap.to(obj, {
      v: end, duration: 1.4, ease: 'power2.out',
      onUpdate: function () { el.textContent = Math.round(obj.v) + suf; }
    });
  }
  if ('IntersectionObserver' in window) {
    var io2 = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { run(en.target); io2.unobserve(en.target); } });
    }, { threshold: 0.6 });
    els.forEach(function (el) { io2.observe(el); });
  } else { els.forEach(run); }
})();

/* ── Magnetic buttons ── */
(function magnetic() {
  if (COARSE || REDUCED || typeof gsap === 'undefined') return;
  document.querySelectorAll('[data-magnetic]').forEach(function (el) {
    var strength = 0.35;
    el.addEventListener('mousemove', function (e) {
      var r = el.getBoundingClientRect();
      var x = (e.clientX - r.left - r.width / 2) * strength;
      var y = (e.clientY - r.top - r.height / 2) * strength;
      gsap.to(el, { x: x, y: y, duration: 0.4, ease: 'power3.out' });
    });
    el.addEventListener('mouseleave', function () {
      gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    });
  });
})();

/* ── Masked line-reveal for section headings (SplitType + IntersectionObserver) ── */
(function headingReveal() {
  if (REDUCED || typeof gsap === 'undefined' || typeof SplitType === 'undefined') return;
  if (!('IntersectionObserver' in window) || window.innerWidth <= 720) return;
  var heads = document.querySelectorAll('.section-title, .cta-copy h2');
  heads.forEach(function (h) {
    var split;
    try { split = new SplitType(h, { types: 'lines' }); } catch (e) { return; }
    if (!split.lines || !split.lines.length) return;
    gsap.set(split.lines, { yPercent: 115 });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          gsap.to(split.lines, { yPercent: 0, duration: 1.0, ease: 'power4.out', stagger: 0.09 });
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.25 });
    io.observe(h);
  });
})();

/* ── Scroll progress bar ── */
(function progress() {
  var bar = document.createElement('div');
  bar.className = 'scroll-prog';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  var ticking = false;
  function update() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var p = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
    bar.style.transform = 'scaleX(' + p + ')';
    ticking = false;
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

/* ── vanilla-tilt on the "more" card ── */
(function tilt() {
  if (typeof VanillaTilt === 'undefined' || COARSE) return;
  var el = document.querySelector('.proj-more');
  if (el) VanillaTilt.init(el, { max: 4, speed: 500, glare: true, 'max-glare': 0.1, scale: 1.01, perspective: 1400 });
})();

/* ── Edge swarm — full-bleed living telemetry mesh (dark) ── */
(function edgeSwarm() {
  var canvas = document.getElementById('edge-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var countEl = document.querySelector('[data-swarm-count]');

  var INK = '235,232,224', ACCENT = '232,70,42';
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0, cx = 0, cy = 0, tick = 0;
  var sensors = [], far = [], packets = [], rings = [], scans = [], sparks = [], processed = 0;
  var mouse = { x: 0, y: 0, on: false }, par = { x: 0, y: 0 };
  var looping = false, raf = null;

  var CHANNELS = [
    { k: 'VIBRATION', v: 4.2,  u: ' mm/s', dec: 1, r: [3.4, 5.4] },
    { k: 'THERMAL',   v: 612,  u: ' °C',   dec: 0, r: [588, 642] },
    { k: 'PRESSURE',  v: 38.0, u: ' bar',  dec: 1, r: [34, 42] },
    { k: 'SPEED',     v: 3600, u: ' rpm',  dec: 0, r: [3540, 3660] }
  ];

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function build() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (W < 2 || H < 2) return;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W * 0.64; cy = H * 0.4;
    mouse.x = W / 2; mouse.y = H / 2;

    // near layer — the mesh
    sensors = [];
    var n = Math.max(18, Math.min(44, Math.round(W * H / 26000)));
    var guard = Math.min(W, H) * 0.16, tries = 0;
    while (sensors.length < n && tries < n * 40) {
      tries++;
      var x = rand(W * 0.04, W * 0.96), y = rand(H * 0.06, H * 0.94);
      if (Math.hypot(x - cx, y - cy) < guard) continue;
      var ok = true;
      for (var k = 0; k < sensors.length; k++) if (Math.hypot(x - sensors[k].x, y - sensors[k].y) < W * 0.07) { ok = false; break; }
      if (ok) sensors.push({ x: x, y: y, vx: rand(-0.14, 0.14), vy: rand(-0.14, 0.14), ph: Math.random() * 6.28, flash: 0 });
    }

    // far layer — dim drifting stars for depth
    far = [];
    var fn = Math.round(n * 1.5);
    for (var q = 0; q < fn; q++) {
      far.push({ x: rand(0, W), y: rand(0, H), vx: rand(-0.05, 0.05), vy: rand(-0.05, 0.05), r: rand(0.5, 1.1), ph: Math.random() * 6.28 });
    }

    // label a spread subset with live channels
    var cand = sensors.filter(function (s) { return s.x > W * 0.12 && s.x < W * 0.9 && s.y > H * 0.14 && s.y < H * 0.86; });
    cand.sort(function (a, b) { return (a.x + a.y) - (b.x + b.y); });
    var step = Math.max(1, Math.floor(cand.length / CHANNELS.length));
    for (var c = 0; c < CHANNELS.length && c * step < cand.length; c++) {
      var src = CHANNELS[c];
      cand[c * step].ch = { k: src.k, v: src.v, u: src.u, dec: src.dec, r: src.r.slice() };
    }

    packets = []; rings = []; scans = []; sparks = [];
    var pc = Math.min(34, Math.round(sensors.length * 1.1));
    for (var i = 0; i < pc; i++) packets.push(spawn());
  }

  function spawn() {
    var idx = (Math.random() * sensors.length) | 0;
    var s = sensors[idx] || { x: 0, y: 0 };
    return {
      i: idx, x0: s.x, y0: s.y,
      mx: (s.x + cx) / 2 + rand(-18, 18), my: (s.y + cy) / 2 + rand(-18, 18),
      t: -Math.random(), sp: rand(0.003, 0.007), r: rand(1.3, 2.3), trail: []
    };
  }
  function bez(a, b, c, t) { var u = 1 - t; return u * u * a + 2 * u * t * b + t * t * c; }

  function label(s) {
    var right = s.x < W * 0.62, lx = s.x + (right ? 11 : -11);
    ctx.textAlign = right ? 'left' : 'right'; ctx.textBaseline = 'alphabetic';
    ctx.font = "500 9px 'Space Mono', monospace";
    ctx.fillStyle = 'rgba(' + INK + ',0.4)';
    ctx.fillText(s.ch.k, lx, s.y - 7);
    ctx.font = "600 10.5px 'Space Mono', monospace";
    ctx.fillStyle = 'rgba(' + INK + ',0.85)';
    ctx.fillText(s.ch.v.toFixed(s.ch.dec) + s.ch.u, lx, s.y + 7);
    ctx.textAlign = 'left';
  }

  function frame() {
    if (!looping) return;
    tick++;
    ctx.clearRect(0, 0, W, H);
    var i, j, s, m, now = performance.now() / 1000;
    var mnWH = Math.min(W, H);

    // smoothed mouse parallax
    par.x += ((mouse.x - W / 2) * 0.03 - par.x) * 0.04;
    par.y += ((mouse.y - H / 2) * 0.03 - par.y) * 0.04;

    // ── far layer (half parallax, twinkling) ──
    ctx.save();
    ctx.translate(par.x * 0.4, par.y * 0.4);
    for (i = 0; i < far.length; i++) {
      var fz = far[i];
      fz.x += fz.vx; fz.y += fz.vy;
      if (fz.x < -4) fz.x = W + 4; if (fz.x > W + 4) fz.x = -4;
      if (fz.y < -4) fz.y = H + 4; if (fz.y > H + 4) fz.y = -4;
      var tw = 0.14 + 0.12 * Math.sin(now * 1.4 + fz.ph);
      ctx.fillStyle = 'rgba(' + INK + ',' + tw.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(fz.x, fz.y, fz.r, 0, 6.2832); ctx.fill();
    }
    ctx.restore();

    // value walk
    if (tick % 46 === 0) for (i = 0; i < sensors.length; i++) if (sensors[i].ch) {
      var ch = sensors[i].ch, span = ch.r[1] - ch.r[0];
      ch.v = clamp(ch.v + rand(-span * 0.06, span * 0.06), ch.r[0], ch.r[1]);
    }

    // occasional accent spark along a random mesh link
    if (tick % 34 === 0 && sensors.length > 3) {
      var a1 = (Math.random() * sensors.length) | 0, b1 = (Math.random() * sensors.length) | 0;
      if (a1 !== b1 && Math.hypot(sensors[a1].x - sensors[b1].x, sensors[a1].y - sensors[b1].y) < W * 0.3) {
        sparks.push({ a: a1, b: b1, life: 1 });
      }
    }

    // ── near layer (full parallax) ──
    ctx.save();
    ctx.translate(par.x, par.y);

    // radar ping
    if (tick % 140 === 0) scans.push({ r: 24, a: 0.32 });
    for (i = scans.length - 1; i >= 0; i--) {
      var sc = scans[i]; sc.r += 2.4; sc.a *= 0.973;
      if (sc.a < 0.02 || sc.r > mnWH * 0.7) { scans.splice(i, 1); continue; }
      ctx.strokeStyle = 'rgba(' + ACCENT + ',' + sc.a.toFixed(3) + ')'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, sc.r, 0, 6.2832); ctx.stroke();
    }

    // drift + cursor repel (mouse mapped into the parallax layer's space)
    var mx = mouse.x - par.x, my = mouse.y - par.y;
    for (i = 0; i < sensors.length; i++) {
      s = sensors[i];
      if (mouse.on) {
        var dxm = s.x - mx, dym = s.y - my, dm = Math.hypot(dxm, dym);
        if (dm < 130 && dm > 0.1) {
          var push = (130 - dm) / 130;
          s.x += (dxm / dm) * push * 2.4;
          s.y += (dym / dm) * push * 2.4;
        }
      }
      var slow = s.ch ? 0.35 : 1;
      s.x += s.vx * slow; s.y += s.vy * slow;
      if (s.x < W * 0.02 || s.x > W * 0.98) s.vx *= -1;
      if (s.y < H * 0.04 || s.y > H * 0.96) s.vy *= -1;
      var gdx = s.x - cx, gdy = s.y - cy, gd = Math.hypot(gdx, gdy);
      if (gd < mnWH * 0.15 && gd > 0.1) { s.vx += (gdx / gd) * 0.05; s.vy += (gdy / gd) * 0.05; }
      s.vx = clamp(s.vx, -0.24, 0.24); s.vy = clamp(s.vy, -0.24, 0.24);
    }

    // breathing mesh links
    var maxd = W * 0.24;
    for (i = 0; i < sensors.length; i++) for (j = i + 1; j < sensors.length; j++) {
      var d = Math.hypot(sensors[i].x - sensors[j].x, sensors[i].y - sensors[j].y);
      if (d < maxd) {
        var breathe = 0.7 + 0.3 * Math.sin(now * 0.9 + (i * 7 + j) * 0.6);
        ctx.strokeStyle = 'rgba(' + INK + ',' + (0.16 * (1 - d / maxd) * breathe).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(sensors[i].x, sensors[i].y); ctx.lineTo(sensors[j].x, sensors[j].y); ctx.stroke();
      }
    }

    // accent sparks
    for (i = sparks.length - 1; i >= 0; i--) {
      var sp2 = sparks[i]; sp2.life *= 0.92;
      if (sp2.life < 0.04 || !sensors[sp2.a] || !sensors[sp2.b]) { sparks.splice(i, 1); continue; }
      ctx.strokeStyle = 'rgba(' + ACCENT + ',' + (sp2.life * 0.5).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sensors[sp2.a].x, sensors[sp2.a].y); ctx.lineTo(sensors[sp2.b].x, sensors[sp2.b].y); ctx.stroke();
    }

    // cursor probe — faint threads to nearby nodes + reticle
    if (mouse.on) {
      var nearest = 1e9;
      for (i = 0; i < sensors.length; i++) {
        s = sensors[i];
        var dc = Math.hypot(s.x - mx, s.y - my);
        if (dc < nearest) nearest = dc;
        if (dc < 160) {
          ctx.strokeStyle = 'rgba(' + INK + ',' + ((1 - dc / 160) * 0.3).toFixed(3) + ')';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(s.x, s.y); ctx.stroke();
        }
      }
      var hot = nearest < 160 ? 1 : 0.4;
      ctx.strokeStyle = 'rgba(' + ACCENT + ',' + (0.55 * hot).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(mx, my, 5, 0, 6.2832); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx - 9, my); ctx.lineTo(mx - 4, my); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx + 4, my); ctx.lineTo(mx + 9, my); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx, my - 9); ctx.lineTo(mx, my - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx, my + 4); ctx.lineTo(mx, my + 9); ctx.stroke();
    }

    // nodes
    for (i = 0; i < sensors.length; i++) {
      s = sensors[i];
      if (s.flash > 0.01) {
        ctx.strokeStyle = 'rgba(' + ACCENT + ',' + (s.flash * 0.6).toFixed(3) + ')'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(s.x, s.y, 6 + (1 - s.flash) * 12, 0, 6.2832); ctx.stroke();
        s.flash *= 0.9;
      }
      var pulse = 1 + Math.sin(now * 2 + s.ph) * 0.25;
      if (s.ch) {
        ctx.fillStyle = 'rgba(' + ACCENT + ',0.95)';
        ctx.beginPath(); ctx.arc(s.x, s.y, 2.7, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = 'rgba(' + ACCENT + ',0.3)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, 6.2832); ctx.stroke();
        label(s);
      } else {
        ctx.fillStyle = 'rgba(' + INK + ',0.8)';
        ctx.beginPath(); ctx.arc(s.x, s.y, 2.1 * pulse, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = 'rgba(' + INK + ',0.14)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(s.x, s.y, 5.5, 0, 6.2832); ctx.stroke();
      }
    }

    // packets + trails
    for (i = 0; i < packets.length; i++) {
      m = packets[i]; m.t += m.sp;
      if (m.t >= 1) {
        rings.push({ r: 8, a: 0.55 }); processed++;
        if (sensors[m.i]) sensors[m.i].flash = 1;
        packets[i] = spawn(); continue;
      }
      if (m.t < 0) continue;
      var t = m.t, px = bez(m.x0, m.mx, cx, t), py = bez(m.y0, m.my, cy, t), near = t * t;
      m.trail.push(px, py);
      if (m.trail.length > 24) m.trail.splice(0, 2);
      for (var q2 = 0; q2 < m.trail.length - 2; q2 += 2) {
        var seg = q2 / (m.trail.length - 2);
        ctx.strokeStyle = 'rgba(' + (seg > 0.6 && t > 0.6 ? ACCENT : INK) + ',' + (seg * 0.3 * (0.4 + near)).toFixed(3) + ')';
        ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(m.trail[q2], m.trail[q2 + 1]); ctx.lineTo(m.trail[q2 + 2], m.trail[q2 + 3]); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(' + (t > 0.7 ? ACCENT : INK) + ',' + (0.45 + 0.5 * near).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(px, py, m.r, 0, 6.2832); ctx.fill();
    }

    // absorption rings
    for (i = rings.length - 1; i >= 0; i--) {
      var rg = rings[i]; rg.r += 1.6; rg.a *= 0.9;
      if (rg.a < 0.03) { rings.splice(i, 1); continue; }
      ctx.strokeStyle = 'rgba(' + ACCENT + ',' + rg.a.toFixed(3) + ')'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(cx, cy, rg.r, 0, 6.2832); ctx.stroke();
    }

    // ── edge model chip ──
    var ep = 1 + Math.sin(now * 2.4) * 0.14, sz = 14;
    var grd = ctx.createRadialGradient(cx, cy, 4, cx, cy, 70);
    grd.addColorStop(0, 'rgba(' + ACCENT + ',0.22)'); grd.addColorStop(1, 'rgba(' + ACCENT + ',0)');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, 70, 0, 6.2832); ctx.fill();
    // rotating dashed orbit
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(now * 0.4);
    ctx.setLineDash([3, 7]);
    ctx.strokeStyle = 'rgba(' + ACCENT + ',0.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, 6.2832); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    ctx.strokeStyle = 'rgba(' + ACCENT + ',0.26)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, 22 * ep, 0, 6.2832); ctx.stroke();
    ctx.fillStyle = 'rgba(' + ACCENT + ',1)'; ctx.fillRect(cx - sz, cy - sz, sz * 2, sz * 2);
    ctx.fillStyle = 'rgba(6,6,7,0.95)'; ctx.fillRect(cx - 4.5, cy - 4.5, 9, 9);
    ctx.strokeStyle = 'rgba(' + ACCENT + ',0.8)'; ctx.lineWidth = 1.4;
    for (var g = -1; g <= 1; g++) {
      ctx.beginPath(); ctx.moveTo(cx + g * 7, cy - sz); ctx.lineTo(cx + g * 7, cy - sz - 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + g * 7, cy + sz); ctx.lineTo(cx + g * 7, cy + sz + 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - sz, cy + g * 7); ctx.lineTo(cx - sz - 5, cy + g * 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + sz, cy + g * 7); ctx.lineTo(cx + sz + 5, cy + g * 7); ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.font = "600 10px 'Space Mono', monospace";
    ctx.fillStyle = 'rgba(' + ACCENT + ',1)'; ctx.fillText('EDGE MODEL', cx, cy + sz + 24);
    ctx.font = "500 9px 'Space Mono', monospace";
    ctx.fillStyle = 'rgba(' + INK + ',0.5)'; ctx.fillText('INT8 · 12 MS', cx, cy + sz + 37);
    ctx.textAlign = 'left';

    ctx.restore(); // near layer parallax

    if (countEl) countEl.textContent = processed.toLocaleString();
    raf = requestAnimationFrame(frame);
  }

  function startLoop() { if (REDUCED || looping) return; looping = true; raf = requestAnimationFrame(frame); }
  function stopLoop() { looping = false; }

  // listen on window — content sits above the canvas
  window.addEventListener('mousemove', function (e) {
    var r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    mouse.on = mouse.y > -40 && mouse.y < H + 40;
  }, { passive: true });
  document.addEventListener('mouseleave', function () { mouse.on = false; });
  window.addEventListener('resize', build);
  document.addEventListener('visibilitychange', function () { if (document.hidden) stopLoop(); else startLoop(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) startLoop(); else stopLoop(); });
    }, { threshold: 0 }).observe(document.getElementById('hero'));
  }

  build();
  if (REDUCED) { looping = true; frame(); looping = false; }
  else startLoop();
})();

/* ── Hero scroll parallax — headline drifts up, mesh scales as you leave ── */
(function heroParallax() {
  if (REDUCED || typeof gsap === 'undefined' || !window.ScrollTrigger) return;
  gsap.to('.hero-inner', {
    yPercent: -14, opacity: 0.25, ease: 'none',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true }
  });
  gsap.to('#edge-canvas', {
    scale: 1.08, ease: 'none', transformOrigin: '50% 30%',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true }
  });
})();

/* ── Contact form → Netlify Forms (AJAX, stays on page) ── */
(function contactForm() {
  var form = document.getElementById('demo-form');
  if (!form) return;
  var status = form.querySelector('.form-status');
  var btn = form.querySelector('button[type="submit"]');

  function show(msg, cls) {
    if (!status) return;
    status.hidden = false;
    status.className = 'form-status ' + cls;
    status.textContent = msg;
  }

  form.addEventListener('submit', function (e) {
    // No fetch support → let the browser POST normally (Netlify still captures it)
    if (typeof fetch === 'undefined') return;
    e.preventDefault();

    var required = form.querySelectorAll('[required]');
    for (var i = 0; i < required.length; i++) {
      if (!required[i].value.trim()) { required[i].focus(); show('Please add your name and a work email.', 'err'); return; }
    }

    var data = new URLSearchParams(new FormData(form)).toString();
    if (btn) { btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.textContent = 'Sending…'; }

    fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: data })
      .then(function (r) {
        if (!r.ok) throw new Error('bad status ' + r.status);
        form.reset();
        show('Thanks — we got it. Expect a reply within one business day.', 'ok');
        if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.label || 'Request a demo'; }
      })
      .catch(function () {
        show('Something went wrong. Email us directly at service@turbnetic.ai.', 'err');
        if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.label || 'Request a demo'; }
      });
  });
})();

/* ── Year in footer ── */
(function year() {
  var el = document.getElementById('foot-year');
  if (el) el.textContent = new Date().getFullYear();
})();
