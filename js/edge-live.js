/* How Edge Intelligence works: a live machine → edge computer → people diagram.
   Sensor readings tick, the on-site model answers in milliseconds, the alert lands
   on the team's devices, and the cloud counter never moves. Pauses off screen. */
(function () {
  var stage = document.getElementById('el-stage');
  if (!stage) return;
  var root = stage.closest('.edge-live');
  var tabs = Array.prototype.slice.call(root.querySelectorAll('.el-switch button'));
  var thumb = root.querySelector('.el-thumb');
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // [label, base, noise, unit, decimals]
  var M = {
    turbine: {
      name: 'GT-07', where: 'Frame 7 gas turbine · Plant Alpha', ms: 11, model: 'Turbofan 4.2 · 7.8 MB', app: 'Turbofan',
      sensors: [['Vibration', 3.1, .12, 'mm/s', 1], ['Exhaust temp', 614, 2.5, '°C', 0], ['Dynamic pressure', 1.82, .06, 'psi', 2], ['Fuel flow', 7.94, .05, 'kg/s', 2]],
      title: 'GT-07 combustion instability', body: 'Can 4 dynamic pressure up 18% in six hours. Inspect before the next start.',
      status: 'Live today as Turbofan Intelligence'
    },
    ward: {
      name: 'Bed 7 · Ward 4B', where: 'Step-down unit · pilot hospital', ms: 9, model: 'Ward 1.0 · 5.1 MB', app: 'Ward',
      sensors: [['Heart rate', 96, 2, 'bpm', 0], ['Breathing rate', 24, .8, '/min', 0], ['SpO₂', 93, .5, '%', 0], ['Temperature', 37.9, .05, '°C', 1]],
      title: 'Bed 7 breathing rate rising', body: 'Up 40% in three hours while SpO₂ falls. Review the patient now.',
      status: 'Hospital Intelligence · in development'
    },
    line: {
      name: 'Pump P-204 · Line 3', where: 'Pulp mill · rotating equipment', ms: 14, model: 'Plant 0.9 · 6.4 MB', app: 'Plant',
      sensors: [['Bearing vibration', 4.6, .18, 'mm/s', 1], ['Motor current', 61, 1.2, 'A', 0], ['Bearing temp', 71, .6, '°C', 0], ['Speed', 1482, 4, 'rpm', 0]],
      title: 'P-204 outboard bearing wear', body: 'Pattern matches early wear, nine days before the alarm threshold.',
      status: 'Plant & Process Intelligence · in development'
    },
    field: {
      name: 'Zone C3 · Field 7', where: 'No cellular signal · solar gateway', ms: 18, model: 'Field 0.6 · 3.2 MB', app: 'Field',
      sensors: [['Soil moisture', 18, .4, '%', 0], ['Soil temp', 22, .3, '°C', 0], ['Air humidity', 41, 1, '%', 0], ['Wind', 3.2, .3, 'm/s', 1]],
      title: 'Irrigate zone C3 tonight', body: 'Moisture below target for two days. 38 mm recommended, decided offline.',
      status: 'Precision Ag Intelligence · exploring'
    }
  };

  function el(k) { return stage.querySelector('[data-k="' + k + '"]') || root.querySelector('[data-k="' + k + '"]'); }
  var list = el('sensors'), msEl = el('ms'), countEl = el('count'), note = el('note');
  var cur = 'turbine', series = [], count = 1284302, auto = true, visible = false, timer = null, cycle = 0;

  function fmt(v, d) { return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function spark(pts) {
    var lo = Math.min.apply(null, pts), hi = Math.max.apply(null, pts), r = hi - lo || 1;
    return pts.map(function (p, i) { return (i ? 'L' : 'M') + (i * 60 / (pts.length - 1)).toFixed(1) + ' ' + (16 - (p - lo) / r * 14).toFixed(1); }).join('');
  }

  function show(key) {
    var m = M[key]; cur = key;
    stage.dataset.m = key;
    tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.m === key)); });
    placeThumb();
    el('name').textContent = m.name; el('where').textContent = m.where;
    el('model').textContent = m.model; el('app').textContent = m.app;
    el('title').textContent = m.title; el('body').textContent = m.body;
    el('status').textContent = m.status;
    series = m.sensors.map(function (s) {
      var pts = []; for (var i = 0; i < 24; i++) pts.push(s[1] + (Math.random() - .5) * 2 * s[2]);
      return pts;
    });
    list.innerHTML = m.sensors.map(function (s, i) {
      return '<li><span>' + s[0] + '</span><svg viewBox="0 0 60 18" aria-hidden="true"><path d="' + spark(series[i]) + '"/></svg><b>' + fmt(series[i][23], s[4]) + ' ' + s[3] + '</b></li>';
    }).join('');
    msEl.textContent = fmt(m.ms, 1);
    note.classList.remove('pop'); void note.offsetWidth; note.classList.add('pop');
  }

  function step() {
    var m = M[cur], rows = list.children;
    m.sensors.forEach(function (s, i) {
      var pts = series[i], last = pts[pts.length - 1];
      var v = last + (s[1] - last) * .3 + (Math.random() - .5) * 2 * s[2];
      pts.push(v); pts.shift();
      rows[i].querySelector('path').setAttribute('d', spark(pts));
      rows[i].querySelector('b').textContent = fmt(v, s[4]) + ' ' + s[3];
    });
    msEl.textContent = fmt(m.ms + (Math.random() - .5) * 1.6, 1);
    count += 40 + Math.floor(Math.random() * 60);
    countEl.textContent = count.toLocaleString('en-US');
    // tour the machines until the visitor picks one
    if (auto && ++cycle % 9 === 0) {
      var keys = Object.keys(M);
      show(keys[(keys.indexOf(cur) + 1) % keys.length]);
    }
  }

  function placeThumb() {
    var on = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0];
    if (!on || !thumb) return;
    thumb.style.width = on.offsetWidth + 'px';
    thumb.style.transform = 'translateX(' + (on.offsetLeft - 4) + 'px)';
  }

  function run() {
    clearInterval(timer); timer = null;
    if (visible && !still) timer = setInterval(step, 850);
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () { auto = false; show(t.dataset.m); });
  });
  root.querySelector('.el-switch').addEventListener('keydown', function (e) {
    var i = tabs.findIndex(function (t) { return t.dataset.m === cur; });
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      i = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
      auto = false; show(tabs[i].dataset.m); tabs[i].focus(); e.preventDefault();
    }
  });
  window.addEventListener('resize', placeThumb);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeThumb);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; run(); }, { threshold: .15 }).observe(stage);
  } else { visible = true; run(); }

  show(cur);
})();
