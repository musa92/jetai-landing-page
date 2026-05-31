/* ═══════════════════════════════════════════════
   TurboFan Intelligence — App.js
   Main initialization, scroll effects, counters
═══════════════════════════════════════════════ */
'use strict';

// ── Preloader ─────────────────────────────────
(function initPreloader() {
  var loader = document.getElementById('preloader');
  if (!loader) return;
  document.body.style.overflow = 'hidden';

  function dismiss() {
    loader.classList.add('out');
    document.body.style.overflow = '';
    setTimeout(function () { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 750);
  }

  var minWait = new Promise(function (resolve) { setTimeout(resolve, 1500); });
  var pageReady = new Promise(function (resolve) {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve, { once: true });
  });

  Promise.all([minWait, pageReady]).then(dismiss);
})();

// ── Register GSAP Plugins ──────────────────────
gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

// ── Lenis smooth scroll ────────────────────────
var lenis = null;
(function initLenis() {
  if (typeof Lenis === 'undefined') return;
  lenis = new Lenis({
    duration: 1.2,
    easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
    smoothTouch: false,
  });
  gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
  gsap.ticker.lagSmoothing(0);
  lenis.on('scroll', ScrollTrigger.update);
})();

// ── Scroll progress bar + back to top ─────────
(function initScrollUX() {
  const bar = document.getElementById('scroll-progress');
  const btn = document.getElementById('back-to-top');

  window.addEventListener('scroll', function () {
    const scrolled = window.scrollY;
    const total = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.width = (total > 0 ? (scrolled / total) * 100 : 0) + '%';
    if (btn) btn.classList.toggle('visible', scrolled > 400);
  }, { passive: true });

  if (btn) btn.addEventListener('click', function () {
    lenis ? lenis.scrollTo(0) : window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

// ── SplitType headline reveals ─────────────────
(function initTextReveal() {
  if (typeof SplitType === 'undefined') return;

  // Hero headline — animate whole element (has <br>+<span> inside, can't split)
  var heroEl = document.querySelector('.hero-headline');
  if (heroEl) {
    gsap.from(heroEl, {
      opacity: 0, y: 32, duration: 0.9, ease: 'power3.out', delay: 0.15,
    });
  }

  // Section + CTA headlines — words slide in on scroll
  document.querySelectorAll('.section-headline, .cta-headline').forEach(function (el) {
    var split = new SplitType(el, { types: 'words' });
    gsap.from(split.words, {
      scrollTrigger: { trigger: el, start: 'top 88%' },
      opacity: 0, y: 28, stagger: 0.07, duration: 0.65, ease: 'power3.out',
    });
  });
})();

// ── Custom cursor ──────────────────────────────
(function initCursor() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var dot  = document.createElement('div');
  var ring = document.createElement('div');
  dot.id = 'cursor-dot'; ring.id = 'cursor-ring';
  document.body.append(dot, ring);

  var mx = -100, my = -100, rx = -100, ry = -100;

  document.addEventListener('mousemove', function (e) {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = 'translate(' + mx + 'px,' + my + 'px)';
  });

  (function tickRing() {
    rx += (mx - rx) * 0.11;
    ry += (my - ry) * 0.11;
    ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';
    requestAnimationFrame(tickRing);
  })();

  document.querySelectorAll('a, button, [role="button"], input, select, label').forEach(function (el) {
    el.addEventListener('mouseenter', function () { dot.classList.add('cursor-hover'); ring.classList.add('cursor-hover'); });
    el.addEventListener('mouseleave', function () { dot.classList.remove('cursor-hover'); ring.classList.remove('cursor-hover'); });
  });

  document.addEventListener('mouseleave', function () { dot.style.opacity = '0'; ring.style.opacity = '0'; });
  document.addEventListener('mouseenter', function () { dot.style.opacity = ''; ring.style.opacity = ''; });
})();

// ── Magnetic buttons ───────────────────────────
(function initMagnetic() {
  if (!window.matchMedia('(hover: hover)').matches) return;

  document.querySelectorAll('.btn-nav, .btn-primary, .btn-cta-submit').forEach(function (btn) {
    btn.addEventListener('mousemove', function (e) {
      var r = btn.getBoundingClientRect();
      var x = (e.clientX - r.left - r.width  / 2) * 0.32;
      var y = (e.clientY - r.top  - r.height / 2) * 0.32;
      gsap.to(btn, { x: x, y: y, duration: 0.35, ease: 'power2.out' });
    });
    btn.addEventListener('mouseleave', function () {
      gsap.to(btn, { x: 0, y: 0, duration: 0.65, ease: 'elastic.out(1, 0.45)' });
    });
  });
})();

// ── Hero content fade + lift on scroll ────────
(function initHeroFade() {
  const hero    = document.querySelector('.hero-content');
  const hint    = document.querySelector('.hero-scroll-hint');
  if (!hero) return;
  let ticking = false;

  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      const progress = Math.min(window.scrollY / window.innerHeight, 1);
      const opacity  = Math.max(0, 1 - progress * 2);
      const lift     = progress * 48;
      hero.style.opacity   = opacity;
      hero.style.transform = 'translateY(-' + lift + 'px)';
      if (hint) hint.style.opacity = Math.max(0, 0.5 - progress * 4);
      ticking = false;
    });
  }, { passive: true });
})();

// ── Nav logo scroll spin ───────────────────────
(function initLogoSpin() {
  const logo = document.getElementById('nav-logo-spin');
  if (!logo) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const deg = window.scrollY * 0.12;
      logo.style.transform = `rotate(${deg}deg)`;
      ticking = false;
    });
  }, { passive: true });
})();

// ── Navbar scroll state ────────────────────────
(function initNavbar() {
  const nav = document.getElementById('navbar');
  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

// ── Hero particle canvas ───────────────────────
(function initHeroCanvas() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [], animId;
  const COUNT = 130;

  /* cursor state — listen on #hero so events fire over text too */
  let mx = -9999, my = -9999, mouseActive = false;
  let scanPhase = 0;
  const heroSection = document.getElementById('hero') || canvas.parentElement;

  heroSection.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mx = (e.clientX - r.left) * (W / r.width);
    my = (e.clientY - r.top)  * (H / r.height);
    mouseActive = true;
  }, { passive: true });
  heroSection.addEventListener('mouseleave', () => { mouseActive = false; });

  /* ── floating telemetry badges ── */
  const TELEM = [
    { label:'EGT',    value:'621°C',    hot:true  },
    { label:'T3/P3',  value:'14.2 bar', hot:false },
    { label:'BRG-1',  value:'0.82g',    hot:false },
    { label:'FF',     value:'38.1 kg/s',hot:true  },
    { label:'N1',     value:'96.2%',    hot:false },
    { label:'RUL',    value:'89%',      hot:false },
    { label:'VIBR',   value:'NORMAL',   hot:false },
    { label:'P1',     value:'1.013 bar',hot:false },
  ];

  let badges = [];

  function initBadges() {
    badges = TELEM.map((t, i) => ({
      ...t,
      x:  W * (0.05 + Math.random() * 0.9),
      y:  H * (0.08 + Math.random() * 0.84),
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.12,
      phase: Math.random() * Math.PI * 2,
      w: 0, /* computed */
    }));
  }

  function updateBadges() {
    badges.forEach(b => {
      b.x += b.vx;
      b.y += b.vy;
      b.phase += 0.008;
      /* soft boundary bounce */
      if (b.x < 30 || b.x > W - 80)  b.vx *= -1;
      if (b.y < 30 || b.y > H - 30)  b.vy *= -1;
    });
  }

  function drawBadges() {
    badges.forEach(b => {
      const a   = 0.22 + 0.10 * Math.sin(b.phase);
      const col = b.hot ? '255,107,0' : '0,212,255';
      const text = `${b.label}  ${b.value}`;

      ctx.font = '500 9px "JetBrains Mono",monospace';
      const tw  = ctx.measureText(text).width;
      const pad = 8, h = 18, r = 4;
      const bx = b.x, by = b.y - h * 0.5;
      const bw = tw + pad * 2;

      /* glass pill */
      ctx.beginPath();
      ctx.moveTo(bx + r, by);
      ctx.lineTo(bx + bw - r, by); ctx.arcTo(bx+bw, by, bx+bw, by+r, r);
      ctx.lineTo(bx+bw, by+h-r);   ctx.arcTo(bx+bw, by+h, bx+bw-r, by+h, r);
      ctx.lineTo(bx+r, by+h);      ctx.arcTo(bx, by+h, bx, by+h-r, r);
      ctx.lineTo(bx, by+r);        ctx.arcTo(bx, by, bx+r, by, r);
      ctx.closePath();
      ctx.fillStyle   = `rgba(${col},${a * 0.18})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${col},${a})`;
      ctx.lineWidth   = 0.7;
      ctx.stroke();

      /* text */
      ctx.fillStyle = `rgba(${col},${a * 1.8})`;
      ctx.fillText(text, bx + pad, by + 12);
    });
  }

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x  = Math.random() * W;
      this.y  = Math.random() * H;
      this.r  = Math.random() * 1.2 + 0.3;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = (Math.random() - 0.5) * 0.3;
      this.o  = Math.random() * 0.5 + 0.1;
      this.cyan = Math.random() > 0.25;
    }
    update() {
      /* cursor repulsion field (radius 110px) */
      if (mouseActive) {
        const dx = this.x - mx;
        const dy = this.y - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < 110 * 110 && d2 > 0.1) {
          const d     = Math.sqrt(d2);
          const force = ((110 - d) / 110) * 0.06;
          this.vx += (dx / d) * force;
          this.vy += (dy / d) * force;
        }
      }
      /* soft damping to prevent runaway speeds */
      this.vx *= 0.985;
      this.vy *= 0.985;
      this.x  += this.vx;
      this.y  += this.vy;
      if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.cyan
        ? `rgba(0,212,255,${this.o})`
        : `rgba(124,58,237,${this.o * 0.6})`;
      ctx.fill();
    }
  }

  function drawConnections() {
    const maxDist = 100;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < maxDist) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0,212,255,${(1 - d / maxDist) * 0.08})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  function drawCursorProbe() {
    if (!mouseActive) return;
    scanPhase += 0.022;

    /* large spotlight illuminating the particle field */
    const spot = ctx.createRadialGradient(mx, my, 0, mx, my, 220);
    spot.addColorStop(0,   'rgba(0,212,255,0.06)');
    spot.addColorStop(0.4, 'rgba(0,212,255,0.025)');
    spot.addColorStop(1,   'rgba(0,212,255,0.00)');
    ctx.fillStyle = spot;
    ctx.beginPath(); ctx.arc(mx, my, 220, 0, Math.PI * 2); ctx.fill();

    /* soft glow behind probe */
    const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 52);
    glow.addColorStop(0,   'rgba(0,212,255,0.10)');
    glow.addColorStop(0.4, 'rgba(0,212,255,0.04)');
    glow.addColorStop(1,   'rgba(0,212,255,0.00)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(mx, my, 52, 0, Math.PI * 2); ctx.fill();

    /* expanding scan rings (3 staggered) */
    for (let i = 0; i < 3; i++) {
      const t = ((scanPhase * 0.5 + i / 3) % 1);
      const r = t * 90;
      const a = (1 - t) * 0.32;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,212,255,${a})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    /* reticle: outer circle */
    ctx.beginPath(); ctx.arc(mx, my, 18, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,212,255,0.55)';
    ctx.lineWidth = 1.1; ctx.stroke();

    /* inner dot */
    ctx.beginPath(); ctx.arc(mx, my, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,212,255,0.80)'; ctx.fill();

    /* crosshair arms with gap */
    ctx.strokeStyle = 'rgba(0,212,255,0.45)';
    ctx.lineWidth = 0.9;
    const arm = 12, gap = 5;
    [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(mx + dx * gap,    my + dy * gap);
      ctx.lineTo(mx + dx * (gap + arm), my + dy * (gap + arm));
      ctx.stroke();
    });

    /* sensor readout label */
    const ix = Math.round(mx * 10) / 10;
    const iy = Math.round(my * 10) / 10;
    ctx.font = '500 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,212,255,0.55)';
    ctx.fillText(`P: ${ix},${iy}`, mx + 24, my - 6);
    ctx.font = '400 8px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(0,212,255,0.35)';
    ctx.fillText('SENSOR PROBE', mx + 24, my + 6);
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    updateBadges();
    particles.forEach(p => { p.update(); p.draw(); });
    drawConnections();
    drawBadges();
    drawCursorProbe();
    animId = requestAnimationFrame(loop);
  }

  function init() {
    resize();
    particles = Array.from({ length: COUNT }, () => new Particle());
    initBadges();
    cancelAnimationFrame(animId);
    loop();
  }

  window.addEventListener('resize', () => { resize(); initBadges(); }, { passive: true });
  init();
})();

// ── Hero stat counters ─────────────────────────
(function initHeroCounters() {
  const items = document.querySelectorAll('.hero-stats .stat-num[data-count]');
  const hasAnimated = new Set();

  const observer = new IntersectionObserver(entries => {
    entries.forEach(el => {
      if (!el.isIntersecting || hasAnimated.has(el.target)) return;
      hasAnimated.add(el.target);
      const target = +el.target.dataset.count;
      const duration = 1200;
      const start = performance.now();
      function tick(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        el.target.textContent = Math.floor(eased * target);
        if (t < 1) requestAnimationFrame(tick);
        else el.target.textContent = target;
      }
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.5 });

  items.forEach(el => observer.observe(el));
})();

// ── Generic scroll-reveal (data-animate) ──────
(function initScrollReveal() {
  const elements = document.querySelectorAll('[data-animate]');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el  = entry.target;
      const delay = parseFloat(el.dataset.delay || 0) * 1000;
      setTimeout(() => el.classList.add('animated'), delay);
      observer.unobserve(el);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

  elements.forEach(el => observer.observe(el));
})();

// ── Scroll-reveal for card classes ────────────
(function initCardReveal() {
  const cards = document.querySelectorAll(
    '.problem-stat, .integration-card, .feature-card, .metric-card, .flow-node'
  );

  const observer = new IntersectionObserver(entries => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      // stagger by DOM position
      const siblings = Array.from(el.parentNode.children);
      const idx = siblings.indexOf(el);
      setTimeout(() => {
        el.classList.add('visible');
      }, idx * 80);
      observer.unobserve(el);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  cards.forEach(el => observer.observe(el));
})();

// ── Dashboard reveal ──────────────────────────
(function initDashboardReveal() {
  /* support both old .dashboard-mockup and new .dashboard-layout */
  const dash = document.querySelector('.dashboard-layout, .dashboard-mockup');
  if (!dash) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        dash.classList.add('visible');
        observer.unobserve(dash);
      }
    });
  }, { threshold: 0.08 });

  observer.observe(dash);
})();

// ── Dashboard clock ───────────────────────────
(function initDashClock() {
  const el = document.getElementById('dash-clock');
  if (!el) return;
  function tick() {
    const d = new Date();
    const hh = String(d.getUTCHours()).padStart(2,'0');
    const mm = String(d.getUTCMinutes()).padStart(2,'0');
    const ss = String(d.getUTCSeconds()).padStart(2,'0');
    el.textContent = `${hh}:${mm}:${ss} UTC`;
  }
  tick();
  setInterval(tick, 1000);
})();

// ── EGT live tick ─────────────────────────────
(function initEGTTick() {
  const el = document.getElementById('egt-live');
  if (!el) return;
  let base = 614;
  setInterval(() => {
    base += (Math.random() - 0.46) * 1.2;
    base = Math.max(608, Math.min(622, base));
    el.textContent = base.toFixed(0) + '°C';
  }, 1200);
})();

// ── Problem callout reveal ────────────────────
(function initCalloutReveal() {
  const callout = document.querySelector('.problem-callout');
  if (!callout) return;

  // Wrap inner content in .callout-inner div for the flex layout
  const children = Array.from(callout.children);
  const inner = document.createElement('div');
  inner.className = 'callout-inner';
  children.forEach(c => inner.appendChild(c));
  callout.appendChild(inner);

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        callout.classList.add('visible');
        observer.unobserve(callout);
      }
    });
  }, { threshold: 0.2 });

  observer.observe(callout);
})();

// ── Metrics section counters ──────────────────
(function initMetricCounters() {
  const counters = document.querySelectorAll('.counter[data-target]');
  const hasAnimated = new Set();

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting || hasAnimated.has(entry.target)) return;
      hasAnimated.add(entry.target);
      const el  = entry.target;
      const target = +el.dataset.target;
      const duration = 1400;
      const start = performance.now();
      function tick(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.floor(eased * target);
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = target;
      }
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.3 });

  counters.forEach(el => observer.observe(el));
})();

// ── Smooth scroll for anchor links ────────────
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const offset = 80; // navbar height
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();

// ── CTA form submission ────────────────────────
(function initForm() {
  const form = document.getElementById('demo-form');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const btn = form.querySelector('.btn-cta-submit');
    const originalHTML = btn.innerHTML;

    btn.textContent = 'Sending...';
    btn.style.opacity = '0.7';
    btn.disabled = true;

    fetch('https://formspree.io/f/xaqkakev', {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.ok) {
        btn.textContent = 'Demo Booked — Check Your Email';
        btn.style.opacity = '1';
        btn.style.background = '#10b981';
        form.reset();
      } else {
        throw new Error('submission failed');
      }
    })
    .catch(function () {
      btn.innerHTML = originalHTML;
      btn.style.opacity = '1';
      btn.disabled = false;
      btn.style.background = '#ef4444';
      btn.textContent = 'Something went wrong — please try again';
      setTimeout(function () {
        btn.innerHTML = originalHTML;
        btn.style.background = '';
      }, 3000);
    });
  });
})();

// ── Dashboard interactivity ───────────────────
(function initDashboardInteractivity() {
  /* ── Fleet + anomaly data per asset ── */
  const ASSETS = {
    'GT-07': {
      egt: 614, egtDelta: '↑ +14°C', rulMax: 2000, rul: 847, conf: 87,
      action: 'Inspect in 23d', color: '#ff6b00',
      alertLevel: 'HIGH', alertPillClass: 'alert-pill-high',
      alertTitle: 'Combustion Instability Precursor · GT-07',
      alertSub: 'T4↑ cross-correlated with ΔP dynamic pressure. 87% confidence. Detected 3h 14m ago.',
      alertTime: '~23 days to fault', alertCI: 'CI: 18–31 days',
      egtLine: 'M0,48 C20,45 35,43 55,40 C75,37 90,34 110,30 C130,26 148,22 168,18 C188,14 208,11 228,8 C248,5 268,4 300,2',
      egtStroke: '#ff6b00',
    },
    'GT-01': {
      egt: 589, egtDelta: '↑ +6°C', rulMax: 2000, rul: 312, conf: 91,
      action: 'Schedule wash', color: '#ef4444',
      alertLevel: 'MED', alertPillClass: 'alert-pill-med',
      alertTitle: 'HPC Fouling Stage 5 · GT-01',
      alertSub: 'Isentropic efficiency −2.1% from baseline. Offline compressor wash recommended within 8 days.',
      alertTime: '~8 days to threshold', alertCI: 'Stage 5 of 6',
      egtLine: 'M0,40 C20,39 40,38 70,36 C100,34 130,32 160,29 C190,26 220,23 260,20 C280,18 290,17 300,16',
      egtStroke: '#ef4444',
    },
    'GT-04': {
      egt: 571, egtDelta: '±1°C', rulMax: 3000, rul: 2340, conf: 99,
      action: 'No action', color: '#22c55e',
      alertLevel: 'OK', alertPillClass: 'alert-pill-ok',
      alertTitle: 'No Active Anomalies · GT-04',
      alertSub: 'All readings nominal. EGT within ±2°C of baseline. Next scheduled inspection Aug 19, 2026.',
      alertTime: 'No predicted fault', alertCI: 'Healthy',
      egtLine: 'M0,30 C60,30 120,31 180,30 C220,29 260,30 300,30',
      egtStroke: '#22c55e',
    },
    'GT-02': {
      egt: 564, egtDelta: '±2°C', rulMax: 3000, rul: 1920, conf: 98,
      action: 'No action', color: '#22c55e',
      alertLevel: 'OK', alertPillClass: 'alert-pill-ok',
      alertTitle: 'No Active Anomalies · GT-02',
      alertSub: 'Minor LPT efficiency trend (−0.4%) under passive monitoring. No action required at this time.',
      alertTime: 'No predicted fault', alertCI: 'Monitor only',
      egtLine: 'M0,32 C60,32 120,33 180,32 C220,31 260,32 300,32',
      egtStroke: '#22c55e',
    },
  };

  /* ── Anomaly detail data ── */
  const ANOM_DETAILS = {
    gt07: {
      pill: 'HIGH', pillClass: 'alert-pill-high',
      title: 'Combustion Instability Precursor',
      asset: 'GT-07 · Frame 7 · Plant Alpha',
      rows: [
        ['Root cause',     'T4 temp rising above trend. Cross-correlated with ΔP oscillation at 200 Hz band.'],
        ['Confidence',     '<span style="color:#f59e0b">87% — High</span>'],
        ['Predicted fault','<span style="color:#ff6b00">~23 days (CI: 18–31d)</span>'],
        ['Recommended',    'Borescope inspection · hot section'],
      ],
    },
    gt01: {
      pill: 'MED', pillClass: 'alert-pill-med',
      title: 'HPC Fouling Stage 5',
      asset: 'GT-01 · Frame 5 · Plant Alpha',
      rows: [
        ['Root cause',     'Isentropic efficiency −2.1% from baseline across stages 4–6. Salt/dust accumulation suspected.'],
        ['Confidence',     '<span style="color:#f59e0b">91% — High</span>'],
        ['Predicted fault','<span style="color:#f59e0b">~8 days to degradation threshold</span>'],
        ['Recommended',    'Offline compressor wash within 8 days'],
      ],
    },
    gt04: {
      pill: 'LOW', pillClass: 'alert-pill-ok',
      title: 'Bearing Vib. Slight Uptick',
      asset: 'GT-04 · LM6000 · Plant Alpha',
      rows: [
        ['Root cause',     'BPFO signal +0.3 g above trend at 84 Hz. Early-stage indication, within spec limits.'],
        ['Confidence',     '<span style="color:#00d4ff">72% — Medium</span>'],
        ['Predicted fault','No fault expected within 90 days'],
        ['Recommended',    'Continue monitoring · re-assess in 30 days'],
      ],
    },
    gt02: {
      pill: 'INFO', pillClass: '',
      title: 'LPT Efficiency Trend −0.4%',
      asset: 'GT-02 · Frame 6 · Plant Alpha',
      rows: [
        ['Root cause',     'Low-pressure turbine efficiency slightly below trend. Within normal variation range.'],
        ['Confidence',     '<span style="color:#94a3b8">68% — Low</span>'],
        ['Predicted fault','No action required'],
        ['Recommended',    'Passive monitoring only'],
      ],
    },
  };

  /* ── Fleet row click → update right panel ── */
  const fleetRows = document.querySelectorAll('.fleet-row');
  let hintDone = false;
  fleetRows.forEach(row => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => {
      fleetRows.forEach(r => r.classList.remove('fleet-row-selected'));
      row.classList.add('fleet-row-selected');

      /* Dismiss click hint on first use */
      if (!hintDone) {
        hintDone = true;
        const hint = document.querySelector('.dash-click-hint');
        if (hint) hint.classList.add('hint-done');
      }

      const nameEl = row.querySelector('.fleet-name');
      if (!nameEl) return;
      const assetKey = (row.dataset.turbine || nameEl.dataset.turbine || nameEl.textContent.trim().split(' ')[0]);
      const data = ASSETS[assetKey];
      if (!data) return;

      /* EGT live value */
      const egtEl = document.getElementById('egt-live');
      if (egtEl) {
        egtEl.textContent = data.egt + '°C';
        egtEl.style.transition = 'color 0.3s';
        egtEl.style.color = data.color;
        setTimeout(() => egtEl.style.color = '', 1200);
      }

      /* EGT delta */
      const deltaEl = document.getElementById('egt-delta');
      if (deltaEl) { deltaEl.textContent = data.egtDelta; deltaEl.style.color = data.color; }

      /* EGT chart paths */
      const linePath = document.getElementById('egt-line-path');
      const fillPath = document.getElementById('egt-fill-path');
      if (linePath) { linePath.setAttribute('d', data.egtLine); linePath.setAttribute('stroke', data.egtStroke); }
      if (fillPath) { fillPath.setAttribute('d', data.egtLine + ' L300,56 L0,56 Z'); }

      /* Trend label */
      const trendLabel = document.querySelector('.trend-label');
      if (trendLabel) trendLabel.textContent = `EGT · ${assetKey}`;

      /* Priority alert panel */
      const pill = document.getElementById('dash-alert-pill');
      if (pill) {
        pill.textContent = data.alertLevel;
        pill.className = 'alert-pill ' + data.alertPillClass;
      }
      const alertTitle = document.getElementById('dash-alert-title');
      if (alertTitle) alertTitle.textContent = data.alertTitle;
      const alertSub = document.getElementById('dash-alert-sub');
      if (alertSub) alertSub.textContent = data.alertSub;
      const alertTime = document.getElementById('dash-alert-time');
      if (alertTime) alertTime.lastChild.textContent = ' ' + data.alertTime;
      const alertCI = document.getElementById('dash-alert-ci');
      if (alertCI) alertCI.textContent = data.alertCI;

      /* RUL gauge */
      const rulText = document.querySelector('.rul-gauge-svg text:first-of-type');
      if (rulText) rulText.textContent = data.rul.toLocaleString();
      const rulRows = document.querySelectorAll('.rul-row .rul-val');
      const typeEl = row.querySelector('.fleet-type');
      if (rulRows[0]) rulRows[0].textContent = `${assetKey} ${typeEl?.textContent || ''}`;
      if (rulRows[1]) { rulRows[1].textContent = data.conf + '%'; rulRows[1].style.color = data.color; }
      if (rulRows[2]) { rulRows[2].textContent = data.action; rulRows[2].style.color = data.action === 'No action' ? '#22c55e' : '#ff6b00'; }
      const arc = document.querySelector('.rul-gauge-svg path[stroke-dasharray]');
      if (arc) {
        const filled = (data.rul / data.rulMax) * 169.6;
        arc.style.transition = 'stroke-dashoffset 0.6s ease';
        arc.style.strokeDashoffset = 169.6 - filled;
      }
    });
  });

  /* ── Sidebar nav → switch panels ── */
  const PANEL_IDS = ['dash-view-fleet', 'dash-view-anomalies', 'dash-view-analytics', 'dash-view-maintenance'];
  const VIEW_NAMES = ['Fleet Overview', 'Anomalies', 'Analytics', 'Maintenance'];
  const navItems   = document.querySelectorAll('.dash-nav-items .dash-nav-item');
  let analyticsAnimated = false;

  function showPanel(idx) {
    PANEL_IDS.forEach((id, j) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (j === idx) {
        el.style.display = '';
        el.classList.add('active');
      } else {
        el.classList.remove('active');
        el.style.display = 'none';
      }
    });
    /* Animate analytics bars when first shown */
    if (idx === 2 && !analyticsAnimated) {
      analyticsAnimated = true;
      setTimeout(() => {
        document.querySelectorAll('.ab-fill[data-width]').forEach(bar => {
          bar.style.width = bar.dataset.width + '%';
        });
      }, 80);
    }
  }

  navItems.forEach((item, i) => {
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('dash-nav-active'));
      item.classList.add('dash-nav-active');
      const crumb = document.querySelector('.dash-breadcrumb-active');
      if (crumb) crumb.textContent = VIEW_NAMES[i] || 'Fleet Overview';
      showPanel(i);
    });
  });

  /* Ensure fleet view visible on load */
  showPanel(0);

  /* ── Anomaly row click → update detail pane ── */
  document.querySelectorAll('.anom-row').forEach(row => {
    row.addEventListener('click', () => {
      document.querySelectorAll('.anom-row').forEach(r => r.classList.remove('anom-selected'));
      row.classList.add('anom-selected');
      const key  = row.dataset.anom;
      const d    = ANOM_DETAILS[key];
      if (!d) return;
      const pill = document.getElementById('adp-pill');
      if (pill) { pill.textContent = d.pill; pill.className = 'alert-pill ' + d.pillClass; }
      const title = document.getElementById('adp-title');
      if (title) title.textContent = d.title;
      const asset = document.getElementById('adp-asset');
      if (asset) asset.textContent = d.asset;
      const rowsEl = document.getElementById('adp-rows');
      if (rowsEl) {
        rowsEl.innerHTML = d.rows.map(([k, v]) =>
          `<div class="adp-row"><span class="adp-k">${k}</span><span class="adp-v">${v}</span></div>`
        ).join('');
      }
    });
  });

  /* ── Anomaly panel "Create WO" ── */
  const adpWO = document.getElementById('adp-wo-btn');
  if (adpWO) {
    adpWO.addEventListener('click', () => {
      adpWO.textContent = '✓ WO Created';
      adpWO.style.color = '#22c55e';
      adpWO.style.cursor = 'default';
    });
  }

  /* ── KPI card click → press feedback ── */
  document.querySelectorAll('.kpi-card').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('mousedown', function () { this.style.transform = 'translateY(-1px) scale(0.975)'; });
    card.addEventListener('mouseup',   function () { this.style.transform = ''; });
    card.addEventListener('mouseleave',function () { this.style.transform = ''; });
  });

  /* ── "Create WO →" in fleet alert panel ── */
  const createWO = document.querySelector('.alert-meta-action');
  if (createWO) {
    createWO.addEventListener('click', () => {
      createWO.textContent = '✓ WO #4821 Created';
      createWO.style.color = '#22c55e';
      createWO.style.cursor = 'default';
      const badge = document.querySelector('.dash-alert-badge span');
      if (badge) badge.textContent = '1 Alert';
    });
  }

  /* ── Maintenance "Create →" row ── */
  document.querySelectorAll('.maint-wo-create').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      el.textContent = '✓ WO-1862';
      el.classList.remove('maint-wo-create');
      el.style.color = '#22c55e';
    });
  });

  /* ── iPhone notification buttons ── */
  const viewBtn    = document.querySelector('.notif-btn-primary');
  const dismissBtn = document.querySelector('.notif-btn-ghost');
  const critCard   = document.querySelector('.notif-card.notif-critical');
  if (viewBtn) {
    viewBtn.addEventListener('click', () => {
      viewBtn.textContent = '✓ Opened';
      viewBtn.style.background = '#22c55e';
      setTimeout(() => { viewBtn.textContent = 'View Details'; viewBtn.style.background = ''; }, 1800);
    });
  }
  if (dismissBtn && critCard) {
    dismissBtn.addEventListener('click', () => {
      critCard.style.transition = 'transform 0.28s ease, opacity 0.28s ease';
      critCard.style.transform  = 'translateX(110%)';
      critCard.style.opacity    = '0';
      setTimeout(() => { critCard.style.display = 'none'; }, 300);
    });
  }

  /* ── Alert badge pulse on first load ── */
  const alertBadge = document.querySelector('.dash-alert-badge');
  if (alertBadge) {
    setTimeout(() => { alertBadge.style.animation = 'alert-pulse 0.6s ease 2'; }, 1200);
  }
})();

// ── Flow diagram visibility ───────────────────
(function initFlowDiagram() {
  const diagram = document.getElementById('flow-diagram');
  if (!diagram) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const nodes = diagram.querySelectorAll('.flow-node');
      nodes.forEach((node, i) => {
        setTimeout(() => node.classList.add('visible'), i * 150);
      });
      observer.unobserve(diagram);
    });
  }, { threshold: 0.2 });

  observer.observe(diagram);
})();

// ── Card tilt on hover ────────────────────────
(function initCardTilt() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  document.querySelectorAll('.feature-card, .integration-card, .metric-card').forEach(function (card) {
    card.addEventListener('mouseenter', function () {
      card.style.transition = 'transform 0.12s ease, box-shadow 0.3s ease';
    });
    card.addEventListener('mousemove', function (e) {
      var r = card.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width  - 0.5;
      var y = (e.clientY - r.top)  / r.height - 0.5;
      card.style.transform = 'perspective(700px) rotateX(' + (-y * 10) + 'deg) rotateY(' + (x * 10) + 'deg) translateZ(6px)';
    });
    card.addEventListener('mouseleave', function () {
      card.style.transition = 'transform 0.55s cubic-bezier(0.23,1,0.32,1), box-shadow 0.3s ease';
      card.style.transform  = 'perspective(700px) rotateX(0deg) rotateY(0deg) translateZ(0)';
    });
  });
})();


// ── GSAP ScrollTrigger for section headers ─────
(function initGsapSections() {
  const headlines = document.querySelectorAll('.section-headline');

  headlines.forEach(el => {
    gsap.fromTo(el,
      { opacity: 0, y: 20 },
      {
        opacity: 1, y: 0, duration: 0.8, ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none'
        }
      }
    );
  });

  const eyebrows = document.querySelectorAll('.section-eyebrow');
  eyebrows.forEach(el => {
    gsap.fromTo(el,
      { opacity: 0, x: -12 },
      {
        opacity: 1, x: 0, duration: 0.6, ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          toggleActions: 'play none none none'
        }
      }
    );
  });
})();

// ── Premium animations: SplitType word reveals + GSAP ScrollTrigger ──────
(function initPremiumAnimations() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  // ── Word-by-word headline reveals with blur ──
  if (typeof SplitType !== 'undefined') {
    document.querySelectorAll('.section-headline, .hero-headline').forEach(function(el) {
      // Skip if already inside a GSAP timeline
      var split = new SplitType(el, { types: 'words', tagName: 'span' });
      gsap.fromTo(split.words,
        { opacity: 0, y: 22, filter: 'blur(6px)' },
        {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: 0.65,
          stagger: 0.055,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            toggleActions: 'play none none none'
          }
        }
      );
    });

    // Eyebrow slide-in from left with line reveal
    document.querySelectorAll('.section-eyebrow').forEach(function(el) {
      gsap.fromTo(el,
        { opacity: 0, x: -16 },
        {
          opacity: 1, x: 0, duration: 0.5, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none none' }
        }
      );
    });
  }

  // ── Staggered card grid reveals ──
  ['.problem-stat', '.integration-card', '.metric-card'].forEach(function(sel) {
    var cards = document.querySelectorAll(sel);
    if (!cards.length) return;
    gsap.fromTo(cards,
      { opacity: 0, y: 36, scale: 0.97 },
      {
        opacity: 1, y: 0, scale: 1,
        duration: 0.6, stagger: 0.08, ease: 'power3.out',
        scrollTrigger: {
          trigger: cards[0].closest('section') || cards[0],
          start: 'top 78%',
          toggleActions: 'play none none none'
        }
      }
    );
  });

  // ── Pipeline strip reveal ──
  var ps = document.querySelector('.pipeline-strip');
  if (ps) {
    var nodes = ps.querySelectorAll('.pipe-node');
    var connectors = ps.querySelectorAll('.pipe-connector');
    var tl = gsap.timeline({
      scrollTrigger: { trigger: ps, start: 'top 90%', toggleActions: 'play none none none' }
    });
    tl.fromTo(ps,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
    );
    tl.fromTo(nodes,
      { opacity: 0, x: 10 },
      { opacity: 1, x: 0, duration: 0.35, stagger: 0.12, ease: 'power2.out' },
      '-=0.1'
    );
    tl.fromTo(connectors,
      { scaleX: 0, transformOrigin: 'left center' },
      { scaleX: 1, duration: 0.25, stagger: 0.1, ease: 'power1.inOut' },
      '-=0.3'
    );
  }

  // ── Ambient glow parallax on section backgrounds ──
  document.querySelectorAll('#hero, #problem, #integration, #results').forEach(function(sec) {
    var glow = document.createElement('div');
    glow.className = 'ambient-glow';
    glow.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 50% 35% at 50% 50%,rgba(0,212,255,0.04) 0%,transparent 70%);will-change:transform;';
    sec.style.position = 'relative';
    sec.appendChild(glow);
    gsap.to(glow, {
      y: -40,
      ease: 'none',
      scrollTrigger: {
        trigger: sec,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1.5
      }
    });
  });

  // ── Hero stat numbers: dramatic count-up with GSAP ──
  document.querySelectorAll('.stat-num[data-count]').forEach(function(el) {
    var target = +el.getAttribute('data-count');
    gsap.fromTo({ v: 0 },
      { v: 0 },
      {
        v: target,
        duration: 1.8,
        ease: 'power2.out',
        onUpdate: function() { el.textContent = Math.round(this.targets()[0].v); },
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' }
      }
    );
  });

  // ── Results metric counters ──
  document.querySelectorAll('.counter[data-target]').forEach(function(el) {
    var target = +el.getAttribute('data-target');
    gsap.fromTo({ v: 0 },
      { v: 0 },
      {
        v: target,
        duration: 1.6,
        ease: 'power2.out',
        onUpdate: function() { el.textContent = Math.round(this.targets()[0].v); },
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' }
      }
    );
  });

  // ── Inject section dividers ──
  ['#problem','#integration','#results','#dashboard'].forEach(function(id) {
    var sec = document.querySelector(id);
    if (!sec) return;
    var d = document.createElement('div');
    d.className = 'section-divider';
    d.style.padding = '0 48px';
    sec.insertAdjacentElement('beforebegin', d);
  });

})();
