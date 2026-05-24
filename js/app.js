/* ═══════════════════════════════════════════════
   TurboFan Intelligence — App.js
   Main initialization, scroll effects, counters
═══════════════════════════════════════════════ */
'use strict';

// ── Register GSAP Plugins ──────────────────────
gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

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

  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('.btn-cta-submit');
    btn.textContent = 'Submitting...';
    btn.style.opacity = '0.7';
    btn.disabled = true;

    setTimeout(() => {
      btn.textContent = 'Demo Booked — Check Your Email';
      btn.style.opacity = '1';
      btn.style.background = '#10b981';
    }, 1500);
  });
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
