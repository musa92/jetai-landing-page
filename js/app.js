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
  /* ── Fleet data per asset ── */
  const ASSETS = {
    'GT-07': { egt: 614, rul: 847,  rulMax: 2000, conf: 87, action: 'Inspect in 23d', status: 'Combustion anomaly · 87% conf.', color: '#ff6b00' },
    'GT-01': { egt: 601, rul: 312,  rulMax: 2000, conf: 91, action: 'Schedule wash',  status: 'Fouling stage 5 · schedule wash', color: '#ef4444' },
    'GT-04': { egt: 589, rul: 2340, rulMax: 3000, conf: 99, action: 'Normal',         status: 'Normal operations', color: '#22c55e' },
    'GT-02': { egt: 594, rul: 1920, rulMax: 3000, conf: 98, action: 'Normal',         status: 'Normal operations', color: '#22c55e' },
  };

  /* ── Fleet row click → update right panel ── */
  const fleetRows = document.querySelectorAll('.fleet-row');
  fleetRows.forEach(row => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => {
      fleetRows.forEach(r => r.classList.remove('fleet-row-selected'));
      row.classList.add('fleet-row-selected');

      /* Determine which asset was clicked from the name text */
      const nameEl = row.querySelector('.fleet-name');
      if (!nameEl) return;
      const assetKey = nameEl.textContent.trim().split(' ')[0];
      const data = ASSETS[assetKey];
      if (!data) return;

      /* Update EGT live value */
      const egtEl = document.getElementById('egt-live');
      if (egtEl) {
        egtEl.textContent = data.egt + '°C';
        egtEl.style.transition = 'color 0.3s';
        egtEl.style.color = data.color;
        setTimeout(() => egtEl.style.color = '', 1200);
      }

      /* Update trend label */
      const trendLabel = document.querySelector('.trend-label');
      if (trendLabel) trendLabel.textContent = `EGT · ${assetKey}`;

      /* Update RUL gauge number */
      const rulText = document.querySelector('.rul-gauge-svg text:first-of-type');
      if (rulText) rulText.textContent = data.rul.toLocaleString();

      /* Update RUL breakdown rows */
      const rulRows = document.querySelectorAll('.rul-row .rul-val');
      if (rulRows[0]) rulRows[0].textContent = `${assetKey} ${row.querySelector('.fleet-type')?.textContent || ''}`;
      if (rulRows[1]) { rulRows[1].textContent = data.conf + '%'; rulRows[1].style.color = data.color; }
      if (rulRows[2]) { rulRows[2].textContent = data.action; rulRows[2].style.color = data.action === 'Normal' ? '#22c55e' : '#ff6b00'; }

      /* Update RUL arc fill — stroke-dashoffset proportional to rul/rulMax */
      const arc = document.querySelector('.rul-gauge-svg path[stroke-dasharray]');
      if (arc) {
        const total     = 169.6;
        const filled    = (data.rul / data.rulMax) * total;
        const offset    = total - filled;
        arc.style.strokeDashoffset = offset;
        arc.style.transition = 'stroke-dashoffset 0.6s ease';
      }
    });
  });

  /* ── Sidebar nav click → switch active view ── */
  const VIEWS = ['Fleet Overview', 'Anomalies', 'Analytics', 'Maintenance'];
  const navItems = document.querySelectorAll('.dash-nav-items .dash-nav-item');
  navItems.forEach((item, i) => {
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => {
      document.querySelectorAll('.dash-nav-item').forEach(n => n.classList.remove('dash-nav-active'));
      item.classList.add('dash-nav-active');
      const crumb = document.querySelector('.dash-breadcrumb-active');
      if (crumb && VIEWS[i]) crumb.textContent = VIEWS[i];

      /* Brief flash on the content area to signal view change */
      const content = document.querySelector('.dash-content');
      if (content) {
        content.style.opacity = '0.6';
        content.style.transition = 'opacity 0.15s';
        setTimeout(() => { content.style.opacity = '1'; }, 180);
      }
    });
  });

  /* ── KPI card click → press feedback ── */
  document.querySelectorAll('.kpi-card').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('mousedown', function () {
      this.style.transform = 'translateY(-1px) scale(0.975)';
    });
    card.addEventListener('mouseup', function () {
      this.style.transform = '';
    });
    card.addEventListener('mouseleave', function () {
      this.style.transform = '';
    });
  });

  /* ── "Create WO →" action ── */
  const createWO = document.querySelector('.alert-meta-action');
  if (createWO) {
    createWO.addEventListener('click', () => {
      createWO.textContent = '✓ WO #4821 Created';
      createWO.style.color = '#22c55e';
      createWO.style.cursor = 'default';
      /* update alert badge count */
      const badge = document.querySelector('.dash-alert-badge span');
      if (badge) badge.textContent = '1 Alert';
    });
  }

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
    setTimeout(() => {
      alertBadge.style.animation = 'alert-pulse 0.6s ease 2';
    }, 1200);
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

// ── Feature card mini visualizations ──────────
(function initFeatureViz() {
  var sin = Math.sin;

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function setup(canvas) {
    var dpr = window.devicePixelRatio || 1;
    var W = canvas.offsetWidth || 280;
    var H = 92;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.height = H + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, W: W, H: H };
  }

  // ── 1. Combustion: scrolling pressure waveform ─
  function startCombustion(canvas) {
    var s = setup(canvas), ctx = s.ctx, W = s.W, H = s.H, t = 0, raf;
    function draw() {
      ctx.clearRect(0, 0, W, H);
      rrect(ctx, 0, 0, W, H, 6); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
      var cy = H / 2, ox = W * 0.55;

      // Normal region
      ctx.beginPath(); ctx.moveTo(0, cy);
      for (var x = 0; x <= ox; x += 1.5) {
        ctx.lineTo(x, cy + sin(x * 0.25 + t) * 1.5 + sin(x * 0.53 + t * 1.4) * 1.2 + sin(x * 0.91 + t * 0.8) * 0.7);
      }
      ctx.strokeStyle = 'rgba(0,212,255,0.75)'; ctx.lineWidth = 1.5; ctx.stroke();

      // Instability region (growing amplitude, cyan → orange)
      ctx.beginPath(); ctx.moveTo(ox, cy);
      for (var x2 = ox; x2 <= W; x2 += 1.5) {
        var p = (x2 - ox) / (W - ox);
        var amp = 3 + p * p * 20 + sin(t * 1.8) * p * 5;
        ctx.lineTo(x2, cy + sin(x2 * 0.18 + t * 2.5) * amp + sin(x2 * 0.43 + t * 1.3) * amp * 0.3);
      }
      var g = ctx.createLinearGradient(ox, 0, W, 0);
      g.addColorStop(0, 'rgba(0,212,255,0.75)'); g.addColorStop(0.4, 'rgba(255,140,0,0.8)'); g.addColorStop(1, 'rgba(255,60,0,0.9)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.5; ctx.stroke();

      // Onset marker
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(ox, 6); ctx.lineTo(ox, H - 6);
      ctx.strokeStyle = 'rgba(255,107,0,0.45)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '500 7.5px "JetBrains Mono",monospace';
      ctx.fillStyle = 'rgba(255,107,0,0.9)'; ctx.fillText('ONSET', ox + 4, 11);

      ctx.font = '400 7px "JetBrains Mono",monospace'; ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillText('ΔP', 4, H - 5);
      ctx.textAlign = 'right'; ctx.fillText('t →', W - 4, H - 5); ctx.textAlign = 'left';
      t += 0.022; raf = requestAnimationFrame(draw);
    }
    draw(); return function () { cancelAnimationFrame(raf); };
  }

  // ── 2. Blade fouling: efficiency degradation curve ─
  function startFouling(canvas) {
    var s = setup(canvas), ctx = s.ctx, W = s.W, H = s.H, progress = 0, raf;
    var PL = 8, PR = 8, PT = 10, PB = 12, gW = W - PL - PR, gH = H - PT - PB;
    var EMIN = 91, EMAX = 97, HMAX = 9800;
    function xOf(h) { return PL + (h / HMAX) * gW; }
    function yOf(e) { return PT + gH - ((e - EMIN) / (EMAX - EMIN)) * gH; }

    var hist = [[0,96.4],[900,96.2],[1800,96.0],[2800,95.7],[3800,95.3],[4800,94.8],[5800,94.2],[6800,93.6],[7200,93.2]];
    var pred = [[7200,93.2],[8000,92.7],[8800,92.1],[9400,91.7],[9800,91.4]];

    function draw() {
      ctx.clearRect(0, 0, W, H);
      rrect(ctx, 0, 0, W, H, 6); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.5;
      [92,93,94,95,96].forEach(function (e) {
        ctx.beginPath(); ctx.moveTo(PL, yOf(e)); ctx.lineTo(W - PR, yOf(e)); ctx.stroke();
      });

      // Wash threshold
      var wy = yOf(92);
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(PL, wy); ctx.lineTo(W - PR, wy);
      ctx.strokeStyle = 'rgba(255,107,0,0.55)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '500 7px "JetBrains Mono",monospace'; ctx.fillStyle = 'rgba(255,107,0,0.75)';
      ctx.textAlign = 'right'; ctx.fillText('WASH', W - PR - 2, wy - 3); ctx.textAlign = 'left';

      var hp = Math.min(progress / 0.72, 1);
      var pp = Math.max(0, Math.min((progress - 0.72) / 0.28, 1));

      // Confidence band + prediction line
      if (pp > 0) {
        var endH = 7200 + pp * 2600;
        var vp = pred.filter(function (pt) { return pt[0] <= endH; });
        if (vp.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(xOf(vp[0][0]), yOf(vp[0][1] + 0.32));
          vp.forEach(function (pt) { ctx.lineTo(xOf(pt[0]), yOf(pt[1] + 0.32)); });
          for (var i = vp.length - 1; i >= 0; i--) { ctx.lineTo(xOf(vp[i][0]), yOf(vp[i][1] - 0.42)); }
          ctx.closePath(); ctx.fillStyle = 'rgba(0,212,255,0.07)'; ctx.fill();

          ctx.beginPath(); ctx.moveTo(xOf(vp[0][0]), yOf(vp[0][1]));
          vp.forEach(function (pt) { ctx.lineTo(xOf(pt[0]), yOf(pt[1])); });
          ctx.strokeStyle = 'rgba(0,212,255,0.45)'; ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
        }
      }

      // Historical line
      var vh = hist.filter(function (pt) { return pt[0] <= hp * 7200; });
      if (vh.length >= 2) {
        ctx.beginPath(); ctx.moveTo(xOf(vh[0][0]), yOf(vh[0][1]));
        vh.forEach(function (pt) { ctx.lineTo(xOf(pt[0]), yOf(pt[1])); });
        ctx.strokeStyle = 'rgba(0,212,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
        var last = vh[vh.length - 1];
        ctx.beginPath(); ctx.arc(xOf(last[0]), yOf(last[1]), 3, 0, Math.PI * 2);
        ctx.fillStyle = '#00d4ff'; ctx.fill();
      }

      ctx.font = '400 7px "JetBrains Mono",monospace'; ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillText('η%', PL, PT - 2);
      ctx.textAlign = 'right'; ctx.fillText('hours →', W - PR, H - 2); ctx.textAlign = 'left';

      if (progress < 1) { progress = Math.min(progress + 0.011, 1); raf = requestAnimationFrame(draw); }
    }
    draw(); return function () { cancelAnimationFrame(raf); };
  }

  // ── 3. Bearing: FFT frequency spectrum ────────
  function startBearing(canvas) {
    var s = setup(canvas), ctx = s.ctx, W = s.W, H = s.H, t = 0, raf;
    var BINS = 100, PL = 8, PR = 6, PT = 14, PB = 10;
    var gW = W - PL - PR, gH = H - PT - PB, bW = gW / BINS;

    // Pre-bake stable spectrum shape
    var base = [];
    for (var i = 0; i < BINS; i++) {
      var f = i / BINS;
      var a = 0.015 + sin(i * 2.1) * 0.004 + sin(i * 3.7) * 0.003;
      if (Math.abs(f - 0.10) < 0.02)  a += 0.22 * Math.max(0, 1 - Math.abs(f - 0.10) / 0.015);
      if (Math.abs(f - 0.20) < 0.015) a += 0.10 * Math.max(0, 1 - Math.abs(f - 0.20) / 0.012);
      if (Math.abs(f - 0.30) < 0.012) a += 0.06 * Math.max(0, 1 - Math.abs(f - 0.30) / 0.010);
      if (Math.abs(f - 0.47) < 0.013) a += 0.20 * Math.max(0, 1 - Math.abs(f - 0.47) / 0.010);
      if (Math.abs(f - 0.57) < 0.013) a += 0.17 * Math.max(0, 1 - Math.abs(f - 0.57) / 0.010);
      if (Math.abs(f - 0.68) < 0.014) a += 0.24 * Math.max(0, 1 - Math.abs(f - 0.68) / 0.010);
      base.push(Math.max(0, Math.min(a, 1)));
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      rrect(ctx, 0, 0, W, H, 6); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.5;
      [0.25, 0.5, 0.75].forEach(function (frac) {
        var y = PT + gH * (1 - frac);
        ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(W - PR, y); ctx.stroke();
      });

      var pulse = 1 + 0.15 * sin(t * 2.2);
      for (var i = 0; i < BINS; i++) {
        var f = i / BINS;
        var isBPFO = Math.abs(f - 0.52) < 0.022;
        var is2x   = Math.abs(f - 0.68) < 0.018;
        var amp = base[i] + (isBPFO ? 0.68 * pulse * Math.max(0, 1 - Math.abs(f - 0.52) / 0.016) : 0);
        amp = Math.min(amp, 1);
        var bh = amp * gH, bx = PL + i * bW, by = PT + gH - bh;
        var gr = ctx.createLinearGradient(bx, by, bx, PT + gH);
        if (isBPFO) { gr.addColorStop(0, 'rgba(255,100,0,0.95)'); gr.addColorStop(1, 'rgba(255,100,0,0.12)'); }
        else if (is2x) { gr.addColorStop(0, 'rgba(255,160,0,0.70)'); gr.addColorStop(1, 'rgba(255,160,0,0.08)'); }
        else { gr.addColorStop(0, 'rgba(0,212,255,0.75)'); gr.addColorStop(1, 'rgba(0,212,255,0.08)'); }
        ctx.fillStyle = gr;
        ctx.fillRect(bx, by, Math.max(bW - 0.8, 0.6), bh);
      }

      // Labels
      ctx.textAlign = 'center';
      ctx.font = '600 7.5px "JetBrains Mono",monospace'; ctx.fillStyle = 'rgba(255,100,0,0.92)';
      ctx.fillText('BPFO', PL + 0.52 * gW, PT - 3);
      ctx.font = '500 7px "JetBrains Mono",monospace'; ctx.fillStyle = 'rgba(255,160,0,0.72)';
      ctx.fillText('2×BPFO', PL + 0.68 * gW, PT - 3);
      ctx.textAlign = 'left';
      ctx.font = '400 7px "JetBrains Mono",monospace'; ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillText('g', 0, PT - 2);
      ctx.textAlign = 'right'; ctx.fillText('Hz →', W - PR, H - 2); ctx.textAlign = 'left';

      t += 0.016; raf = requestAnimationFrame(draw);
    }
    draw(); return function () { cancelAnimationFrame(raf); };
  }

  // ── Start each viz when it scrolls into view ──
  var stops = {};
  var starters = { 'viz-combustion': startCombustion, 'viz-fouling': startFouling, 'viz-bearing': startBearing };

  Object.keys(starters).forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !stops[id]) {
          stops[id] = starters[id](el);
          obs.unobserve(el);
        }
      });
    }, { threshold: 0.2 });
    obs.observe(el);
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
