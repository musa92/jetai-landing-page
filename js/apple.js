/* Turbnetic.ai: apple.com-style motion, vanilla JS.
   One damped "shadow scroll" value drives every scroll-linked effect, so motion
   eases into place instead of snapping to the scrollbar. Everything is readable
   without this file; it only adds motion and the AJAX form submit. */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a || 0, v)); };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };

  var year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  /* ── nav: frosted once scrolled, light or dark to match the section beneath ── */
  var gn = $('#gn');
  var navSections = $$('[data-nav]');
  function updateNav() {
    var probe = 24, theme = 'light';
    for (var i = 0; i < navSections.length; i++) {
      var r = navSections[i].getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) { theme = navSections[i].dataset.nav; break; }
    }
    gn.classList.toggle('on-dark', theme === 'dark');
    gn.classList.toggle('scrolled', window.scrollY > 8);
  }

  /* ── mobile menu ── */
  var burger = $('#gn-burger'), menu = $('#gn-menu');
  function setMenu(open) {
    burger.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
  }
  burger.addEventListener('click', function () { setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

  /* ── in-page links glide instead of jumping ── */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href') === '#') return;
    var t = document.querySelector(a.getAttribute('href'));
    if (!t) return;
    e.preventDefault();
    window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 48, behavior: REDUCED ? 'auto' : 'smooth' });
  });

  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();

  /* ── AJAX submit for the Netlify form, with a mailto fallback ── */
  var form = $('#demo-form');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var status = form.querySelector('.form-status'), btn = form.querySelector('button[type="submit"]');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    btn.disabled = true;
    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(form)).toString(),
    }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      status.hidden = false; status.className = 'form-status ok';
      status.textContent = 'Thanks. We will be in touch within 24 hours to set up your demo.';
      form.reset();
    }).catch(function () {
      status.hidden = false; status.className = 'form-status err';
      status.textContent = 'That did not send. Email us at service@turbnetic.ai and we will reply within 24 hours.';
    }).then(function () { btn.disabled = false; });
  });

  if (REDUCED) return; // everything below is motion

  /* ═════════ damped scroll engine ═════════ */
  var target = window.scrollY, cur = target, running = false, vh = window.innerHeight;
  var laptop = $('#hero-window'), engineShot = $('#engine-shot');
  var pin = $('#why'), pinBg = $('#pin-bg'), steps = $$('.step'), dots = $$('.step-dots i');
  var wipes = $$('[data-wipe]'), reveals = $$('[data-reveal]'), draws = $$('.tile .draw');
  var dive = $('#dive'), caps = $$('.cap'), diveBar = $('#dive-bar'), engine = null;

  // top of an element as the damped scroll sees it (it lags the real scroll slightly)
  function dampedTop(el) { return el.getBoundingClientRect().top + (window.scrollY - cur); }

  function render() {
    // hero: the laptop rises and settles as you begin to scroll
    if (laptop) {
      var p = easeOut(clamp(cur / (vh * 0.55)));
      laptop.style.transform = 'translateY(' + (40 * (1 - p)).toFixed(1) + 'px) scale(' + (0.9 + 0.1 * p).toFixed(4) + ')';
    }

    // engine render: gentle parallax plus a settle-in scale
    if (engineShot) {
      var rt = dampedTop(engineShot), h = engineShot.offsetHeight;
      var pe = clamp((vh - rt) / (vh + h));
      engineShot.style.transform = 'translateY(' + ((0.5 - pe) * 90).toFixed(1) + 'px) scale(' + (1.08 - 0.08 * easeOut(clamp(pe * 1.8))).toFixed(4) + ')';
    }

    // pinned scene: three statements, one per scroll beat, over a slowly receding cutaway
    if (pin) {
      var top = dampedTop(pin), span = pin.offsetHeight - vh;
      var prog = clamp(-top / span);
      if (pinBg) {
        pinBg.style.transform = 'scale(' + (1.18 - 0.16 * prog).toFixed(4) + ')';
        pinBg.style.opacity = (0.28 + 0.22 * prog).toFixed(3);
      }
      var n = steps.length;
      steps.forEach(function (s, i) {
        var local = prog * n - i;
        var fadeIn = i === 0 ? 1 : clamp(local / 0.22);
        var fadeOut = i === n - 1 ? 1 : 1 - clamp((local - 0.78) / 0.22);
        var a = Math.min(fadeIn, fadeOut);
        s.style.opacity = a.toFixed(3);
        s.style.transform = 'translateY(calc(-50% + ' + ((1 - fadeIn) * 40 - (1 - fadeOut) * 40).toFixed(1) + 'px))';
        s.style.visibility = a < 0.01 ? 'hidden' : 'visible';
        var h2 = s.firstElementChild;
        if (h2) h2.style.clipPath = 'inset(0 0 ' + ((1 - fadeIn) * 100).toFixed(1) + '% 0)';
      });
      var on = clamp(Math.floor(prog * n), 0, n - 1);
      dots.forEach(function (d, i) { d.classList.toggle('on', i === on); });
    }

    // the dive: pinned scroll drives the 3D camera into the turbine, captions step with it
    if (dive) {
      var dt = dampedTop(dive), dspan = dive.offsetHeight - vh;
      var dp = clamp(-dt / dspan);
      if (engine) engine.diveProgress = dp;
      if (diveBar) diveBar.style.width = (dp * 100).toFixed(1) + '%';
      caps.forEach(function (c) {
        c.classList.toggle('on', dp >= +c.dataset.from && dp < +c.dataset.to);
      });
    }

    // headline wipes: each line reveals top-to-bottom as it rises into view
    wipes.forEach(function (el) {
      var q = easeOut(clamp((vh * 0.94 - dampedTop(el)) / (vh * 0.34)));
      el.style.clipPath = 'inset(-0.1em 0 ' + ((1 - q) * 100).toFixed(1) + '% 0)';
      el.style.transform = 'translateY(' + ((1 - q) * 28).toFixed(1) + 'px)';
    });

    // cards and tiles fade up continuously as they enter
    reveals.forEach(function (el) {
      var o = easeOut(clamp((vh * 0.98 - dampedTop(el)) / (vh * 0.24)));
      el.style.opacity = (0.001 + o).toFixed(3);
      el.style.transform = 'translateY(' + ((1 - o) * 36).toFixed(1) + 'px)';
    });

    // line art in the tiles draws itself as its tile arrives
    draws.forEach(function (path) {
      var tile = path.closest('.tile');
      var q = clamp((vh * 0.92 - dampedTop(tile)) / (vh * 0.6));
      path.style.strokeDashoffset = (1 - easeOut(q)).toFixed(4);
    });
  }

  function tick() {
    target = window.scrollY;
    cur += (target - cur) * 0.12;
    if (Math.abs(target - cur) < 0.1) cur = target;
    render();
    if (cur !== target) requestAnimationFrame(tick);
    else running = false;
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(tick); } }

  window.addEventListener('scroll', kick, { passive: true });

  /* ── live 3D engine for the dive: loaded only when the section approaches ── */
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var el = document.createElement('script');
      el.src = src; el.onload = res; el.onerror = rej;
      document.head.appendChild(el);
    });
  }
  if (dive && 'IntersectionObserver' in window) {
    var visible = false, booted = false;
    var boot = function () {
      booted = true;
      loadScript('https://unpkg.com/three@0.134.0/build/three.min.js')
        .then(function () { return loadScript('js/turbofan.js?v=20261019-6'); })
        .then(function () {
          /* eslint-disable-next-line no-undef */
          engine = new TurbofanEngine3D('dive-canvas', { mode: 'dive', apple: true });
          if (!engine.renderer) throw new Error('no WebGL');
          render();
          if (visible) { engine.start(); engine._running = true; }
          dive.classList.add('ready');
        })
        .catch(function () { engine = null; }); // the studio render and captions remain
    };
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting && !booted) boot(); });
    }, { rootMargin: '150% 0px' }).observe(dive);
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (!engine) return;
      if (visible && !engine._running) { engine.last = performance.now(); engine.start(); engine._running = true; }
      else if (!visible && engine._running) { engine.stop(); engine._running = false; }
    }).observe(dive);
  }
  window.addEventListener('resize', function () { vh = window.innerHeight; render(); }, { passive: true });
  render();
})();
