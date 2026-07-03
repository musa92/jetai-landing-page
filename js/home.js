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

/* ── Edge swarm figure — live telemetry mesh streaming into an edge model ── */
(function edgeSwarm() {
  var canvas = document.getElementById('edge-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var countEl = document.querySelector('[data-swarm-count]');

  var INK = '17,17,16', ACCENT = '232,70,42';
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0, cx = 0, cy = 0, tick = 0;
  var sensors = [], packets = [], rings = [], scans = [], processed = 0;
  var mouse = { x: -999, y: -999, on: false };
  var looping = false, raf = null;

  var CHANNELS = [
    { k: 'VIBRATION', v: 4.2,  u: ' mm/s', dec: 1, r: [3.4, 5.4] },
    { k: 'THERMAL',   v: 612,  u: ' °C',   dec: 0, r: [588, 642] },
    { k: 'PRESSURE',  v: 38.0, u: ' bar',  dec: 1, r: [34, 42] },
    { k: 'ACOUSTIC',  v: 71,   u: ' dB',   dec: 0, r: [63, 79] },
    { k: 'CURRENT',   v: 112,  u: ' A',    dec: 0, r: [96, 128] },
    { k: 'SPEED',     v: 3600, u: ' rpm',  dec: 0, r: [3540, 3660] }
  ];

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function build() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (W < 2 || H < 2) return;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W * 0.5; cy = H * 0.52;

    sensors = [];
    var n = Math.max(15, Math.min(28, Math.round(W * H / 9500)));
    var guard = Math.min(W, H) * 0.2, tries = 0;
    while (sensors.length < n && tries < n * 40) {
      tries++;
      var x = rand(W * 0.09, W * 0.91), y = rand(H * 0.13, H * 0.88);
      if (Math.hypot(x - cx, y - cy) < guard) continue;
      var ok = true;
      for (var k = 0; k < sensors.length; k++) if (Math.hypot(x - sensors[k].x, y - sensors[k].y) < W * 0.085) { ok = false; break; }
      if (ok) sensors.push({ x: x, y: y, vx: rand(-0.13, 0.13), vy: rand(-0.13, 0.13), ph: Math.random() * 6.28, flash: 0 });
    }

    var cand = sensors.filter(function (s) { return s.x > W * 0.16 && s.x < W * 0.84 && s.y > H * 0.2 && s.y < H * 0.82; });
    cand.sort(function (a, b) { return (a.x + a.y) - (b.x + b.y); });
    var step = Math.max(1, Math.floor(cand.length / CHANNELS.length));
    for (var c = 0; c < CHANNELS.length && c * step < cand.length; c++) {
      var src = CHANNELS[c];
      cand[c * step].ch = { k: src.k, v: src.v, u: src.u, dec: src.dec, r: src.r.slice() };
    }

    packets = []; rings = []; scans = [];
    var pc = Math.min(26, Math.round(sensors.length * 1.25));
    for (var i = 0; i < pc; i++) packets.push(spawn());
  }

  function spawn() {
    var idx = (Math.random() * sensors.length) | 0;
    var s = sensors[idx] || { x: 0, y: 0 };
    return {
      i: idx, x0: s.x, y0: s.y,
      mx: (s.x + cx) / 2 + rand(-16, 16), my: (s.y + cy) / 2 + rand(-16, 16),
      t: -Math.random(), sp: rand(0.0034, 0.0074), r: rand(1.4, 2.4),
      x: s.x, y: s.y, trail: []
    };
  }
  function bez(a, b, c, t) { var u = 1 - t; return u * u * a + 2 * u * t * b + t * t * c; }

  function label(s) {
    var right = s.x < W * 0.6, lx = s.x + (right ? 10 : -10);
    ctx.textAlign = right ? 'left' : 'right'; ctx.textBaseline = 'alphabetic';
    ctx.font = "500 9px 'JetBrains Mono', monospace";
    ctx.fillStyle = 'rgba(' + INK + ',0.42)';
    ctx.fillText(s.ch.k, lx, s.y - 6);
    ctx.font = "600 10px 'JetBrains Mono', monospace";
    ctx.fillStyle = 'rgba(' + INK + ',0.82)';
    ctx.fillText(s.ch.v.toFixed(s.ch.dec) + s.ch.u, lx, s.y + 7);
    ctx.textAlign = 'left';
  }

  function frame() {
    if (!looping) return;
    tick++;
    ctx.clearRect(0, 0, W, H);
    var i, j, s, m, now = performance.now() / 1000;
    var mnWH = Math.min(W, H);

    // value walk
    if (tick % 46 === 0) for (i = 0; i < sensors.length; i++) if (sensors[i].ch) {
      var ch = sensors[i].ch, span = ch.r[1] - ch.r[0];
      ch.v = clamp(ch.v + rand(-span * 0.06, span * 0.06), ch.r[0], ch.r[1]);
    }

    // periodic radar ping from the edge model
    if (tick % 150 === 0) scans.push({ r: 22, a: 0.30 });
    for (i = scans.length - 1; i >= 0; i--) {
      var sc = scans[i]; sc.r += 2.2; sc.a *= 0.972;
      if (sc.a < 0.02 || sc.r > mnWH * 0.62) { scans.splice(i, 1); continue; }
      ctx.strokeStyle = 'rgba(' + ACCENT + ',' + sc.a.toFixed(3) + ')'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, sc.r, 0, 6.2832); ctx.stroke();
    }

    // drift nodes (labelled ones drift slower for stable text)
    for (i = 0; i < sensors.length; i++) {
      s = sensors[i];
      var slow = s.ch ? 0.4 : 1;
      s.x += s.vx * slow; s.y += s.vy * slow;
      if (s.x < W * 0.06 || s.x > W * 0.94) s.vx *= -1;
      if (s.y < H * 0.1 || s.y > H * 0.9) s.vy *= -1;
      var gdx = s.x - cx, gdy = s.y - cy, gd = Math.hypot(gdx, gdy);
      if (gd < mnWH * 0.19 && gd > 0.1) { s.vx += (gdx / gd) * 0.05; s.vy += (gdy / gd) * 0.05; }
      s.vx = clamp(s.vx, -0.22, 0.22); s.vy = clamp(s.vy, -0.22, 0.22);
      if (mouse.on) {
        var dxm = s.x - mouse.x, dym = s.y - mouse.y, dm = Math.hypot(dxm, dym);
        if (dm < 90 && dm > 0.1) { s.x += (dxm / dm) * (90 - dm) * 0.04; s.y += (dym / dm) * (90 - dm) * 0.04; }
      }
    }

    // mesh links
    var maxd = W * 0.34;
    for (i = 0; i < sensors.length; i++) for (j = i + 1; j < sensors.length; j++) {
      var d = Math.hypot(sensors[i].x - sensors[j].x, sensors[i].y - sensors[j].y);
      if (d < maxd) {
        ctx.strokeStyle = 'rgba(' + INK + ',' + (0.15 * (1 - d / maxd)).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(sensors[i].x, sensors[i].y); ctx.lineTo(sensors[j].x, sensors[j].y); ctx.stroke();
      }
    }

    // sensor nodes + activation flashes
    for (i = 0; i < sensors.length; i++) {
      s = sensors[i];
      if (s.flash > 0.01) {
        ctx.strokeStyle = 'rgba(' + ACCENT + ',' + (s.flash * 0.6).toFixed(3) + ')'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(s.x, s.y, 6 + (1 - s.flash) * 10, 0, 6.2832); ctx.stroke();
        s.flash *= 0.9;
      }
      var pulse = 1 + Math.sin(now * 2 + s.ph) * 0.22;
      if (s.ch) {
        ctx.fillStyle = 'rgba(' + ACCENT + ',0.9)';
        ctx.beginPath(); ctx.arc(s.x, s.y, 2.6, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = 'rgba(' + ACCENT + ',0.3)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(s.x, s.y, 6.5, 0, 6.2832); ctx.stroke();
        label(s);
      } else {
        ctx.fillStyle = 'rgba(' + INK + ',0.62)';
        ctx.beginPath(); ctx.arc(s.x, s.y, 2 * pulse, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = 'rgba(' + INK + ',0.13)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, 6.2832); ctx.stroke();
      }
    }

    // packets with fading trails
    for (i = 0; i < packets.length; i++) {
      m = packets[i]; m.t += m.sp;
      if (m.t >= 1) {
        rings.push({ r: 7, a: 0.55 }); processed++;
        if (sensors[m.i]) sensors[m.i].flash = 1;
        packets[i] = spawn(); continue;
      }
      if (m.t < 0) continue;
      var t = m.t, px = bez(m.x0, m.mx, cx, t), py = bez(m.y0, m.my, cy, t), near = t * t;
      m.trail.push(px); m.trail.push(py);
      if (m.trail.length > 20) { m.trail.splice(0, 2); }
      // trail
      for (var q = 0; q < m.trail.length - 2; q += 2) {
        var seg = q / (m.trail.length - 2);
        ctx.strokeStyle = 'rgba(' + (seg > 0.6 && t > 0.6 ? ACCENT : INK) + ',' + (seg * 0.28 * (0.4 + near)).toFixed(3) + ')';
        ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(m.trail[q], m.trail[q + 1]); ctx.lineTo(m.trail[q + 2], m.trail[q + 3]); ctx.stroke();
      }
      // head
      ctx.fillStyle = 'rgba(' + (t > 0.7 ? ACCENT : INK) + ',' + (0.4 + 0.55 * near).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(px, py, m.r, 0, 6.2832); ctx.fill();
      m.x = px; m.y = py;
    }

    // absorption rings
    for (i = rings.length - 1; i >= 0; i--) {
      var rg = rings[i]; rg.r += 1.5; rg.a *= 0.9;
      if (rg.a < 0.03) { rings.splice(i, 1); continue; }
      ctx.strokeStyle = 'rgba(' + ACCENT + ',' + rg.a.toFixed(3) + ')'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(cx, cy, rg.r, 0, 6.2832); ctx.stroke();
    }

    // edge model chip (soft glow + pulse)
    var ep = 1 + Math.sin(now * 2.4) * 0.14, sz = 13;
    var grd = ctx.createRadialGradient(cx, cy, 4, cx, cy, 46);
    grd.addColorStop(0, 'rgba(' + ACCENT + ',0.16)'); grd.addColorStop(1, 'rgba(' + ACCENT + ',0)');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, 46, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(' + ACCENT + ',0.24)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, 20 * ep, 0, 6.2832); ctx.stroke();
    ctx.fillStyle = 'rgba(' + ACCENT + ',1)'; ctx.fillRect(cx - sz, cy - sz, sz * 2, sz * 2);
    ctx.fillStyle = 'rgba(244,241,234,0.95)'; ctx.fillRect(cx - 4, cy - 4, 8, 8);
    ctx.strokeStyle = 'rgba(' + ACCENT + ',0.8)'; ctx.lineWidth = 1.4;
    for (var g = -1; g <= 1; g++) {
      ctx.beginPath(); ctx.moveTo(cx + g * 7, cy - sz); ctx.lineTo(cx + g * 7, cy - sz - 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + g * 7, cy + sz); ctx.lineTo(cx + g * 7, cy + sz + 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - sz, cy + g * 7); ctx.lineTo(cx - sz - 5, cy + g * 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + sz, cy + g * 7); ctx.lineTo(cx + sz + 5, cy + g * 7); ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.font = "600 10px 'JetBrains Mono', monospace";
    ctx.fillStyle = 'rgba(' + ACCENT + ',1)'; ctx.fillText('EDGE MODEL', cx, cy + sz + 22);
    ctx.font = "500 9px 'JetBrains Mono', monospace";
    ctx.fillStyle = 'rgba(' + INK + ',0.5)'; ctx.fillText('INT8 · 12 MS', cx, cy + sz + 35);
    ctx.textAlign = 'left';

    if (countEl) countEl.textContent = processed.toLocaleString();
    raf = requestAnimationFrame(frame);
  }

  function startLoop() { if (REDUCED || looping) return; looping = true; raf = requestAnimationFrame(frame); }
  function stopLoop() { looping = false; }

  canvas.addEventListener('mousemove', function (e) {
    var r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true;
  });
  canvas.addEventListener('mouseleave', function () { mouse.on = false; mouse.x = -999; mouse.y = -999; });
  window.addEventListener('resize', build);
  document.addEventListener('visibilitychange', function () { if (document.hidden) stopLoop(); else startLoop(); });

  // pause when the hero scrolls out of view (native IntersectionObserver)
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) startLoop(); else stopLoop(); });
    }, { threshold: 0 }).observe(document.getElementById('hero'));
  }

  build();
  if (REDUCED) { looping = true; frame(); looping = false; }
  else startLoop();
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
