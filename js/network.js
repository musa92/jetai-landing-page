/* ═══════════════════════════════════════════════
   TurboFan Intelligence — Network Flow Canvas
   Fleet nodes → TI ENGINE → Operator layer
   Animated bezier particle streams, cursor probe
═══════════════════════════════════════════════ */
'use strict';

(function initNetworkFlow() {
  const canvas = document.getElementById('network-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, dpr = Math.min(window.devicePixelRatio || 1, 2);
  let time = 0;
  let particles = [];
  let cX, cY;
  let tNodes = [], oNodes = [];
  let hovTurbine = null;

  /* ── Fleet + output definitions ── */
  const FLEET = [
    { id:'7EA-04', status:'ok',      r:78,  g:188, b:88,  rul:94 },
    { id:'LM2500', status:'ok',      r:112, g:178, b:72,  rul:88 },
    { id:'7EA-05', status:'ok',      r:76,  g:175, b:102, rul:91 },
    { id:'7EA-06', status:'warning', r:218, g:138, b:35,  rul:62 },
    { id:'FR5-01', status:'ok',      r:86,  g:175, b:90,  rul:78 },
    { id:'LM6000', status:'alert',   r:210, g:60,  b:50,  rul:31 },
  ];

  const OUTPUTS = [
    { id:'Dashboard', r:58,  g:128, b:218 },
    { id:'ERP',       r:52,  g:118, b:205 },
    { id:'CMMS',      r:56,  g:126, b:215 },
    { id:'Reports',   r:50,  g:114, b:198 },
    { id:'Alerts',    r:60,  g:130, b:220 },
  ];

  /* ── cursor ── */
  let mx = -9999, my = -9999, mouseActive = false, scanPhase = 0;

  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mx = e.clientX - r.left;
    my = e.clientY - r.top;
    mouseActive = true;
    hovTurbine = null;
    tNodes.forEach((n, i) => {
      const dx = mx - n.x, dy = my - n.y;
      if (dx * dx + dy * dy < 30 * 30) hovTurbine = i;
    });
  }, { passive: true });
  canvas.addEventListener('mouseleave', () => { mouseActive = false; hovTurbine = null; });

  /* ── layout ── */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.offsetWidth;
    H = canvas.offsetHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    layout();
  }

  function layout() {
    cX = W * 0.5;
    cY = H * 0.5;

    const tX = W * 0.10;
    const tSpread = H * 0.72;
    const tTop = cY - tSpread / 2;
    tNodes = FLEET.map((f, i) => ({
      ...f, x: tX,
      y: tTop + (i / (FLEET.length - 1)) * tSpread,
    }));

    const oX = W * 0.90;
    const oSpread = H * 0.60;
    const oTop = cY - oSpread / 2;
    oNodes = OUTPUTS.map((o, i) => ({
      ...o, x: oX,
      y: oTop + (i / (OUTPUTS.length - 1)) * oSpread,
    }));
  }

  /* ── bezier helpers ── */
  function bpt(x0,y0,x1,y1,x2,y2,x3,y3, t) {
    const u=1-t, u2=u*u, u3=u2*u, t2=t*t, t3=t2*t;
    return {
      x: u3*x0 + 3*u2*t*x1 + 3*u*t2*x2 + t3*x3,
      y: u3*y0 + 3*u2*t*y1 + 3*u*t2*y2 + t3*y3,
    };
  }

  function inCurve(n)  {
    const cpx = W * 0.36;
    return [n.x, n.y, cpx, n.y, cpx, cY, cX - 68, cY];
  }
  function outCurve(n) {
    const cpx = W * 0.64;
    return [cX + 68, cY, cpx, cY, cpx, n.y, n.x, n.y];
  }

  /* ── particles ── */
  function spawnParticles() {
    tNodes.forEach((n, i) => {
      if (Math.random() < 0.024) {
        particles.push({
          type:'in', i, t:0,
          speed: 0.0040 + Math.random() * 0.0032,
          r:n.r, g:n.g, b:n.b, a:0,
          sz: 3.5 + Math.random() * 2.2,
        });
      }
    });
    oNodes.forEach((n, i) => {
      if (Math.random() < 0.018) {
        particles.push({
          type:'out', i, t:0,
          speed: 0.0036 + Math.random() * 0.0030,
          r:n.r, g:n.g, b:n.b, a:0,
          sz: 3.0 + Math.random() * 1.8,
        });
      }
    });
  }

  function tickParticles() {
    particles = particles.filter(p => {
      p.t += p.speed;
      if (p.t < 0.10)      p.a = p.t / 0.10;
      else if (p.t > 0.88) p.a = (1 - p.t) / 0.12;
      else                  p.a = 1;
      return p.t < 1;
    });
  }

  /* ── draw ── */
  function drawBackground() {
    ctx.fillStyle = '#020810';
    ctx.fillRect(0, 0, W, H);
    /* subtle grid */
    ctx.strokeStyle = 'rgba(110, 147, 179,0.022)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= W; x += 72) {
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += 72) {
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    }
  }

  function drawCurves() {
    tNodes.forEach((n, i) => {
      const c   = inCurve(n);
      const hov = hovTurbine === i;
      ctx.beginPath();
      ctx.moveTo(c[0],c[1]);
      ctx.bezierCurveTo(c[2],c[3],c[4],c[5],c[6],c[7]);
      ctx.strokeStyle = `rgba(${n.r},${n.g},${n.b},${hov ? 0.30 : 0.09})`;
      ctx.lineWidth   = hov ? 1.4 : 0.9;
      ctx.stroke();
    });
    oNodes.forEach(n => {
      const c = outCurve(n);
      ctx.beginPath();
      ctx.moveTo(c[0],c[1]);
      ctx.bezierCurveTo(c[2],c[3],c[4],c[5],c[6],c[7]);
      ctx.strokeStyle = `rgba(${n.r},${n.g},${n.b},0.09)`;
      ctx.lineWidth   = 0.9;
      ctx.stroke();
    });
  }

  function drawParticles() {
    particles.forEach(p => {
      let pos;
      if (p.type === 'in') {
        const c = inCurve(tNodes[p.i]);
        pos = bpt(c[0],c[1],c[2],c[3],c[4],c[5],c[6],c[7], p.t);
      } else {
        const c = outCurve(oNodes[p.i]);
        pos = bpt(c[0],c[1],c[2],c[3],c[4],c[5],c[6],c[7], p.t);
      }
      const al = p.a;
      /* glow halo */
      const g = ctx.createRadialGradient(pos.x,pos.y,0, pos.x,pos.y, p.sz*3.5);
      g.addColorStop(0, `rgba(${p.r},${p.g},${p.b},${al*0.48})`);
      g.addColorStop(1, `rgba(${p.r},${p.g},${p.b},0)`);
      ctx.beginPath(); ctx.arc(pos.x,pos.y, p.sz*3.5, 0, Math.PI*2);
      ctx.fillStyle = g; ctx.fill();
      /* core dot */
      ctx.beginPath(); ctx.arc(pos.x,pos.y, p.sz, 0, Math.PI*2);
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${al})`;
      ctx.fill();
    });
  }

  function drawTurbineNodes() {
    tNodes.forEach((n, i) => {
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.0018 + i * 1.08);
      const hov   = hovTurbine === i;

      /* alert pulse */
      if (n.status !== 'ok') {
        ctx.beginPath(); ctx.arc(n.x, n.y, 30 + pulse * 10, 0, Math.PI*2);
        ctx.strokeStyle = `rgba(${n.r},${n.g},${n.b},${0.12 + pulse * 0.13})`;
        ctx.lineWidth = 1; ctx.stroke();
      }

      /* hover glow */
      if (hov) {
        ctx.beginPath(); ctx.arc(n.x, n.y, 32, 0, Math.PI*2);
        ctx.strokeStyle = `rgba(${n.r},${n.g},${n.b},0.52)`;
        ctx.lineWidth = 2; ctx.stroke();
      }

      /* outer ring */
      ctx.beginPath(); ctx.arc(n.x, n.y, 22, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(${n.r},${n.g},${n.b},${hov ? 0.72 : 0.46})`;
      ctx.lineWidth = 1.5; ctx.stroke();

      /* radial fill */
      const gf = ctx.createRadialGradient(n.x,n.y,0, n.x,n.y,18);
      gf.addColorStop(0, `rgba(${n.r},${n.g},${n.b},0.28)`);
      gf.addColorStop(1, `rgba(${n.r},${n.g},${n.b},0.04)`);
      ctx.beginPath(); ctx.arc(n.x,n.y,18,0,Math.PI*2);
      ctx.fillStyle = gf; ctx.fill();

      /* center dot */
      ctx.beginPath(); ctx.arc(n.x,n.y,5.5,0,Math.PI*2);
      ctx.fillStyle = `rgb(${n.r},${n.g},${n.b})`; ctx.fill();

      /* id + RUL label */
      ctx.font      = `600 11px "JetBrains Mono",monospace`;
      ctx.textAlign = 'left';
      ctx.fillStyle = `rgba(${n.r},${n.g},${n.b},${hov ? 1 : 0.88})`;
      ctx.fillText(n.id, n.x + 30, n.y - 4);
      ctx.font      = `400 9px "JetBrains Mono",monospace`;
      ctx.fillStyle = `rgba(${n.r},${n.g},${n.b},${hov ? 0.70 : 0.48})`;
      ctx.fillText(`RUL ${n.rul}%`, n.x + 30, n.y + 10);
    });
  }

  function drawOutputNodes() {
    oNodes.forEach(n => {
      /* ring */
      ctx.beginPath(); ctx.arc(n.x,n.y,18,0,Math.PI*2);
      ctx.strokeStyle = `rgba(${n.r},${n.g},${n.b},0.55)`;
      ctx.lineWidth = 1.5; ctx.stroke();
      /* fill */
      const gf = ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,14);
      gf.addColorStop(0, `rgba(${n.r},${n.g},${n.b},0.22)`);
      gf.addColorStop(1, `rgba(${n.r},${n.g},${n.b},0.04)`);
      ctx.beginPath(); ctx.arc(n.x,n.y,14,0,Math.PI*2);
      ctx.fillStyle = gf; ctx.fill();
      /* center dot */
      ctx.beginPath(); ctx.arc(n.x,n.y,4,0,Math.PI*2);
      ctx.fillStyle = `rgba(${n.r},${n.g},${n.b},0.85)`; ctx.fill();
      /* label */
      ctx.font      = `600 11px "JetBrains Mono",monospace`;
      ctx.textAlign = 'right';
      ctx.fillStyle = `rgba(${n.r},${n.g},${n.b},0.85)`;
      ctx.fillText(n.id, n.x - 26, n.y + 4);
    });
  }

  function drawEngineNode() {
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.0022);

    /* ambient glow */
    const ag = ctx.createRadialGradient(cX,cY,0, cX,cY,135);
    ag.addColorStop(0,   `rgba(255,155,0,${0.045 + pulse * 0.045})`);
    ag.addColorStop(0.5, `rgba(255,90,0,0.02)`);
    ag.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(cX,cY,135,0,Math.PI*2);
    ctx.fillStyle = ag; ctx.fill();

    /* three concentric rings */
    const rings = [
      { r:70,  a:0.17, lw:1   },
      { r:52,  a:0.42, lw:1.5 },
      { r:34,  a:0.72, lw:2   },
    ];
    rings.forEach(({ r, a, lw }) => {
      ctx.beginPath(); ctx.arc(cX,cY,r,0,Math.PI*2);
      ctx.strokeStyle = `rgba(222,152,25,${a + pulse * 0.15})`;
      ctx.lineWidth   = lw; ctx.stroke();
    });

    /* core fill */
    const cf = ctx.createRadialGradient(cX,cY,0, cX,cY,34);
    cf.addColorStop(0,    `rgba(255,196,70,${0.40 + pulse * 0.22})`);
    cf.addColorStop(0.45, `rgba(255,130,15,${0.18 + pulse * 0.10})`);
    cf.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(cX,cY,34,0,Math.PI*2);
    ctx.fillStyle = cf; ctx.fill();

    /* center dot */
    ctx.beginPath(); ctx.arc(cX,cY,8,0,Math.PI*2);
    ctx.fillStyle = `rgba(255,200,75,${0.80 + pulse * 0.20})`; ctx.fill();

    /* label below */
    ctx.font      = `600 11px "JetBrains Mono",monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(220,155,28,0.90)`;
    ctx.fillText('TI ENGINE', cX, cY + 92);
  }

  function drawFooter() {
    const y = H - 22;
    ctx.font      = `500 10px "JetBrains Mono",monospace`;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(140,155,172,0.58)';
    ctx.fillText('TURBINE FLEET', W * 0.04, y - 14);
    ctx.font      = `400 9px "JetBrains Mono",monospace`;
    ctx.fillStyle = 'rgba(100,115,132,0.40)';
    ctx.fillText('12 assets · 847 sensor tags', W * 0.04, y);

    ctx.font      = `500 10px "JetBrains Mono",monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(200,140,30,0.70)';
    ctx.fillText('TURBINE INTELLIGENCE', cX, y - 14);
    ctx.font      = `400 9px "JetBrains Mono",monospace`;
    ctx.fillStyle = 'rgba(158,110,20,0.50)';
    ctx.fillText('Anomaly detection · RUL · Alerts', cX, y);

    ctx.font      = `500 10px "JetBrains Mono",monospace`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(140,155,172,0.58)';
    ctx.fillText('OPERATOR LAYER', W * 0.96, y - 14);
    ctx.font      = `400 9px "JetBrains Mono",monospace`;
    ctx.fillStyle = 'rgba(100,115,132,0.40)';
    ctx.fillText('Dashboard · CMMS · ERP', W * 0.96, y);
  }

  function drawCursorProbe() {
    if (!mouseActive) return;
    scanPhase += 0.025;

    /* soft spotlight */
    const sg = ctx.createRadialGradient(mx,my,0, mx,my,105);
    sg.addColorStop(0, 'rgba(110, 147, 179,0.055)');
    sg.addColorStop(1, 'rgba(110, 147, 179,0)');
    ctx.beginPath(); ctx.arc(mx,my,105,0,Math.PI*2);
    ctx.fillStyle = sg; ctx.fill();

    /* scan rings */
    for (let i = 0; i < 3; i++) {
      const t = ((scanPhase * 0.42 + i / 3) % 1);
      ctx.beginPath(); ctx.arc(mx,my, t * 78, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(110, 147, 179,${(1 - t) * 0.22})`;
      ctx.lineWidth = 1; ctx.stroke();
    }

    /* reticle circle */
    ctx.beginPath(); ctx.arc(mx,my,14,0,Math.PI*2);
    ctx.strokeStyle = 'rgba(110, 147, 179,0.48)';
    ctx.lineWidth = 1.1; ctx.stroke();

    /* center fill */
    ctx.beginPath(); ctx.arc(mx,my,2.8,0,Math.PI*2);
    ctx.fillStyle = 'rgba(110, 147, 179,0.78)'; ctx.fill();

    /* crosshair arms */
    ctx.strokeStyle = 'rgba(110, 147, 179,0.38)';
    ctx.lineWidth   = 0.9;
    [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dx,dy]) => {
      ctx.beginPath();
      ctx.moveTo(mx + dx*5,  my + dy*5);
      ctx.lineTo(mx + dx*16, my + dy*16);
      ctx.stroke();
    });

    /* turbine hover: show highlighted ring at that node */
    if (hovTurbine !== null) {
      const n = tNodes[hovTurbine];
      ctx.beginPath(); ctx.arc(n.x,n.y,34,0,Math.PI*2);
      ctx.strokeStyle = `rgba(${n.r},${n.g},${n.b},0.55)`;
      ctx.lineWidth = 2; ctx.stroke();
    }
  }

  /* ── main loop ── */
  function frame() {
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.restore();

    ctx.save();
    ctx.scale(dpr, dpr);

    drawBackground();
    spawnParticles();
    tickParticles();
    drawCurves();
    drawParticles();
    drawTurbineNodes();
    drawOutputNodes();
    drawEngineNode();
    drawFooter();
    drawCursorProbe();

    ctx.restore();
    time += 16;
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();
  frame();
})();
