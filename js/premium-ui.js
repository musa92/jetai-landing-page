/* ═══════════════════════════════════════════════════
   Premium UI layer
   · vanilla-tilt 3D card tilt + glare (desktop only)
   · GSAP magnetic buttons
   · cursor-tracked spotlight on large panels
═══════════════════════════════════════════════════ */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const isDesktop = window.matchMedia('(min-width: 900px) and (hover: hover)').matches;
  const reduced   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!isDesktop || reduced) return;

  /* ── 1 · 3D tilt + glare on cards ───────────────── */
  if (typeof VanillaTilt !== 'undefined') {
    const tiltTargets = document.querySelectorAll(
      '.metric-card, .problem-stat, .integration-card, .agent-step, .edge-node'
    );
    VanillaTilt.init(tiltTargets, {
      max: 5,
      speed: 600,
      scale: 1.015,
      perspective: 900,
      glare: true,
      'max-glare': 0.12,
      gyroscope: false,
    });

    /* pager mock gets a slightly deeper, slower tilt — hero object */
    const pager = document.querySelector('.pager-mock');
    if (pager) {
      VanillaTilt.init(pager, {
        max: 7, speed: 900, scale: 1.02, perspective: 1100,
        glare: true, 'max-glare': 0.18, gyroscope: false,
      });
    }
  }

  /* ── 2 · Magnetic buttons (GSAP) ────────────────── */
  if (typeof gsap !== 'undefined') {
    document.querySelectorAll('.btn-primary, .btn-nav, .btn-cta-submit').forEach(btn => {
      const strength = 0.32;            /* how far the button follows, 0–1 */
      const radius   = 90;              /* px capture distance beyond bounds */

      const xTo = gsap.quickTo(btn, 'x', { duration: 0.45, ease: 'power3.out' });
      const yTo = gsap.quickTo(btn, 'y', { duration: 0.45, ease: 'power3.out' });

      btn.addEventListener('mousemove', e => {
        const r  = btn.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width  / 2);
        const dy = e.clientY - (r.top  + r.height / 2);
        xTo(dx * strength);
        yTo(dy * strength);
      });
      btn.addEventListener('mouseleave', () => {
        gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.45)' });
      });

      /* label drifts slightly more than the shell — depth */
      const label = btn.querySelector('span');
      if (label) {
        const lxTo = gsap.quickTo(label, 'x', { duration: 0.45, ease: 'power3.out' });
        const lyTo = gsap.quickTo(label, 'y', { duration: 0.45, ease: 'power3.out' });
        btn.addEventListener('mousemove', e => {
          const r  = btn.getBoundingClientRect();
          lxTo((e.clientX - (r.left + r.width  / 2)) * 0.14);
          lyTo((e.clientY - (r.top  + r.height / 2)) * 0.14);
        });
        btn.addEventListener('mouseleave', () => {
          gsap.to(label, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.45)' });
        });
      }
    });
  }

  /* ── 3 · Cursor spotlight on large panels ───────── */
  /* Radial highlight tracks the cursor via CSS vars — the
     Linear/Stripe "lit from your hand" card effect. */
  document.querySelectorAll(
    '.feature-panel, .browser-chrome, .ai-loop-cycle, .info-panel, .pager-mock'
  ).forEach(panel => {
    panel.classList.add('spotlight');
    panel.addEventListener('mousemove', e => {
      const r = panel.getBoundingClientRect();
      panel.style.setProperty('--spot-x', ((e.clientX - r.left) / r.width  * 100) + '%');
      panel.style.setProperty('--spot-y', ((e.clientY - r.top)  / r.height * 100) + '%');
    });
  });
});

/* ═══════════════════════════════════════════════════
   Robotic hero headline — "decode / scramble" reveal
   Runs on all devices (mobile included). Each character
   flickers through random glyphs, then resolves to the
   real letter left-to-right, like a terminal decode.
═══════════════════════════════════════════════════ */
(function roboticHeadline() {
  const headline = document.querySelector('.hero-headline--robotic');
  if (!headline) return;
  const lines = Array.from(headline.querySelectorAll('.hl-line'));
  if (!lines.length) return;

  /* preserve the real text + respect reduced motion (leave text untouched) */
  lines.forEach(l => { l.dataset.scramble = l.dataset.scramble || l.textContent; });
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const CHARS = '01<>-_/\\[]{}=+*#%&!?ABCDEFGHJKLMNPQRSTUVWXYZ';
  const rnd   = () => CHARS[(Math.random() * CHARS.length) | 0];

  function scramble(el, finalText) {
    return new Promise(resolve => {
      const queue = [];
      for (let i = 0; i < finalText.length; i++) {
        const start = (Math.random() * 18) | 0;
        queue.push({ to: finalText[i], start, end: start + 12 + ((Math.random() * 22) | 0), char: null });
      }
      let frame = 0;
      (function update() {
        let out = '', done = 0;
        for (const q of queue) {
          if (q.to === ' ') { out += ' '; done++; }
          else if (frame >= q.end) { out += q.to; done++; }
          else if (frame >= q.start) {
            if (!q.char || Math.random() < 0.3) q.char = rnd();
            out += '<span class="dud">' + q.char + '</span>';
          } else {
            out += '<span class="dud">' + rnd() + '</span>';
          }
        }
        el.innerHTML = out;
        if (done >= queue.length) { resolve(); return; }
        frame++;
        requestAnimationFrame(update);
      })();
    });
  }

  let started = false;
  function run() {
    if (started) return;
    started = true;
    scramble(lines[0], lines[0].dataset.scramble);
    if (lines[1]) {
      setTimeout(() => {
        scramble(lines[1], lines[1].dataset.scramble).then(() => {
          headline.classList.add('glitch-flash');
          setTimeout(() => headline.classList.remove('glitch-flash'), 500);
        });
      }, 380);
    }
  }

  /* Start as the preloader curtain lifts (so the decode is actually visible).
     The preloader can outlast a fixed timer because Three.js is slow to load,
     so only use a short fallback when there is NO preloader; otherwise give a
     long safety fallback that won't fire before the curtain is gone. */
  const hasPreloader = !!document.getElementById('preloader');
  document.addEventListener('preloader:done', () => setTimeout(run, 250), { once: true });
  setTimeout(run, hasPreloader ? 9000 : 500);
})();
