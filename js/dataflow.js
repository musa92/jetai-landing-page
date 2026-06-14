/* ═══════════════════════════════════════════════
   TurboFan Intelligence — dataflow.js
   UI enhancements: flow arrow particles, parallax,
   card tilt, magnetic buttons, integration ticker,
   dashboard live-tick
═══════════════════════════════════════════════ */
'use strict';

// ── Flow Diagram Arrow Particles ──────────────
(function initArrowParticles() {
  document.querySelectorAll('.flow-arrow').forEach((arrow, idx) => {
    const line = arrow.querySelector('.arrow-line');
    if (!line) return;
    for (let i = 0; i < 2; i++) {
      const p = document.createElement('div');
      p.className = 'arrow-particle';
      p.style.animationDelay    = `${(idx * 0.3 + i * 0.7).toFixed(2)}s`;
      p.style.animationDuration = `${(1.4 + Math.random() * 0.6).toFixed(2)}s`;
      line.appendChild(p);
    }
  });
})();

// ── Dashboard EGT live-tick ───────────────────
(function initDashboardTicker() {
  const egt = document.querySelector('.dash-chart-card:first-child .chart-legend span');
  if (!egt) return;
  let delta = 14;
  setInterval(() => {
    delta = Math.max(9, Math.min(21, delta + (Math.random() - 0.4) * 0.6));
    egt.textContent  = `↑ +${delta.toFixed(1)}°C`;
    egt.style.color  = delta > 16 ? '#ff2d78' : '#aef03f';
  }, 2800);
})();

// ── Terminal typing effect on integration tags ─
(function initTyping() {
  const tags = document.querySelectorAll('.integration-tag');
  const obs  = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el  = e.target;
      const txt = el.textContent;
      el.textContent = '';
      let i = 0;
      const iv = setInterval(() => {
        el.textContent += txt[i++];
        if (i >= txt.length) clearInterval(iv);
      }, 28);
      obs.unobserve(el);
    });
  }, { threshold: 0.85 });
  tags.forEach(t => obs.observe(t));
})();

// ── Hero parallax ─────────────────────────────
(function initParallax() {
  const heroContent = document.querySelector('#hero .hero-content');
  if (!heroContent) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    requestAnimationFrame(() => {
      const sy = window.scrollY;
      if (sy < window.innerHeight) {
        heroContent.style.transform = `translateY(${sy * 0.16}px)`;
        heroContent.style.opacity   = Math.max(0, 1 - sy / window.innerHeight * 1.5);
      }
      ticking = false;
    });
    ticking = true;
  }, { passive: true });
})();

// ── Magnetic hover on primary buttons ─────────
(function initMagnetic() {
  document.querySelectorAll('.btn-primary, .btn-cta-submit, .btn-nav').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r  = btn.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width  / 2) * 0.22;
      const dy = (e.clientY - r.top  - r.height / 2) * 0.22;
      btn.style.transform = `translate(${dx}px,${dy}px) translateY(-2px)`;
    });
    btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
  });
})();

// ── 3-D tilt on cards ─────────────────────────
(function initTilt() {
  document.querySelectorAll(
    '.feature-card, .integration-card, .metric-card, .flow-node'
  ).forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width  - 0.5;
      const y = (e.clientY - r.top)  / r.height - 0.5;
      card.style.transform = `perspective(600px) rotateX(${(-y*5).toFixed(2)}deg) rotateY(${(x*5).toFixed(2)}deg) translateY(-4px)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
})();

// ── Integration-logo scrolling ticker ─────────
(function initTicker() {
  const section = document.getElementById('integration');
  if (!section) return;

  const items = [
    'OSIsoft PI','GE APM','OPC-UA','Honeywell Experion',
    'ABB Symphony','Emerson DeltaV','SAP PM','IBM Maximo',
    'Siemens SPPA-T3000','DNP3','Modbus TCP','IEC 62541',
    'IEC 61850','MQTT','Kafka Streams','InfluxDB',
  ];

  const belt  = document.createElement('div');
  belt.style.cssText = 'overflow:hidden;white-space:nowrap;padding:9px 0;border-top:1px solid rgba(30,74,110,0.3);border-bottom:1px solid rgba(30,74,110,0.3);background:rgba(4,14,28,0.5);';

  const inner = document.createElement('div');
  inner.style.cssText = 'display:inline-block;animation:ticker-scroll 30s linear infinite;';

  const row = items.map(i =>
    `<span style="display:inline-block;padding:0 28px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(71,85,105,.75)">${i}</span><span style="color:rgba(0,212,255,.14);padding:0 4px">·</span>`
  ).join('');

  inner.innerHTML = row + row;
  belt.appendChild(inner);

  if (!document.getElementById('ticker-kf')) {
    const s = document.createElement('style');
    s.id = 'ticker-kf';
    s.textContent = '@keyframes ticker-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}';
    document.head.appendChild(s);
  }

  section.insertBefore(belt, section.firstChild);
})();
