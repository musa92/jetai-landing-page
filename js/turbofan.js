/* ═══════════════════════════════════════════════════
   TurboFan Intelligence — 3D Engine Renderer
   Three.js r134 · PBR materials · GSAP ScrollTrigger
   · 18-blade titanium fan on LP spool
   · 3-stage LPC + 6-stage HPC on respective shafts
   · Annular combustor with live glow flicker
   · 2-stage HPT + 4-stage LPT
   · Clipping-plane nacelle cutaway on scroll
   · Camera path: 3/4 front → side → rear on scroll
═══════════════════════════════════════════════════ */
'use strict';

class TurbofanEngine3D {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas || typeof THREE === 'undefined') return;

    this.scrollProgress = 0;
    this.time           = 0;
    this.raf            = null;
    this.last           = 0;
    this.fanAngle       = 0;
    this.hpAngle        = 0;

    /* Titan 350: wide side view of full package at start */
    this._camPos  = new THREE.Vector3(9.5, 4.8, 0.0);
    this._camLook = new THREE.Vector3(0, 0.6, -0.5);
    /* reusable projection vector — avoids per-frame GC */
    this._tmpV    = new THREE.Vector3();

    this._initRenderer();
    this._initScene();
    this._initEnvironment();
    this._initLights();
    this._buildEngine();
    this._buildGroundGlow();
    this._initCamera();

    window.addEventListener('resize', () => this._resize(), { passive: true });
    this._resize();
  }

  /* ─── Renderer ─────────────────────────────────── */
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas:    this.canvas,
      antialias: true,
      alpha:     false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.renderer.shadowMap.enabled   = true;
    this.renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;
  }

  /* ─── Scene ─────────────────────────────────────── */
  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020810);
    /* faint depth fog */
    this.scene.fog = new THREE.FogExp2(0x020810, 0.022);  /* reduced for larger scene */
  }

  /* ─── Environment reflections ───────────────────── */
  /* Procedural studio equirect → PMREM. Gives every PBR metal
     real reflections instead of flat 3-light response. */
  _initEnvironment() {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 256;
    const x = cv.getContext('2d');

    /* dark studio gradient: floor → horizon glow → ceiling */
    const g = x.createLinearGradient(0, 256, 0, 0);
    g.addColorStop(0.00, '#050b14');
    g.addColorStop(0.42, '#0e2236');
    g.addColorStop(0.55, '#1a3850');
    g.addColorStop(0.56, '#16314a');
    g.addColorStop(1.00, '#060d18');
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 256);

    /* softbox strips — create long highlight streaks on metal */
    const box = (bx, by, bw, bh, c) => {
      const bg = x.createLinearGradient(bx, by, bx, by + bh);
      bg.addColorStop(0, 'rgba(0,0,0,0)');
      bg.addColorStop(0.5, c);
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = bg;
      x.fillRect(bx, by, bw, bh);
    };
    box( 40, 30, 150, 26, 'rgba(190,225,255,0.85)');  /* key softbox */
    box(300, 48, 110, 18, 'rgba(120,180,255,0.45)');  /* fill */
    box(190, 86, 70,  10, 'rgba(0,212,255,0.35)');    /* cyan accent */
    box(430, 70, 60,  12, 'rgba(255,140,60,0.30)');   /* warm bounce */

    const tex   = new THREE.CanvasTexture(cv);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    this.scene.environment = pmrem.fromEquirectangular(tex).texture;
    tex.dispose();
    pmrem.dispose();
  }

  /* ─── Ground contact glow ───────────────────────── */
  /* Radial-faded grid disc under the skid — grounds the package
     like a product-render floor without a heavy reflector. */
  _buildGroundGlow() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    const x = cv.getContext('2d');

    /* faint engineering grid */
    x.strokeStyle = 'rgba(0, 212, 255, 0.30)';
    x.lineWidth = 1;
    for (let i = 0; i <= 512; i += 32) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke();
    }
    /* center pool */
    const pool = x.createRadialGradient(256, 256, 30, 256, 256, 150);
    pool.addColorStop(0, 'rgba(0, 212, 255, 0.20)');
    pool.addColorStop(1, 'rgba(0, 212, 255, 0)');
    x.fillStyle = pool;
    x.fillRect(0, 0, 512, 512);

    /* radial alpha falloff — fade grid to nothing at edges */
    const mask = x.createRadialGradient(256, 256, 60, 256, 256, 252);
    mask.addColorStop(0,    'rgba(0,0,0,1)');
    mask.addColorStop(0.55, 'rgba(0,0,0,0.5)');
    mask.addColorStop(1,    'rgba(0,0,0,0)');
    x.globalCompositeOperation = 'destination-in';
    x.fillStyle = mask;
    x.fillRect(0, 0, 512, 512);

    const tex = new THREE.CanvasTexture(cv);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, opacity: 0.85,
    });
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), mat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.80;
    this.engineGroup.add(disc);
  }

  /* ─── Lights ────────────────────────────────────── */
  _initLights() {
    /* sky/ground hemisphere */
    this.scene.add(new THREE.HemisphereLight(0x334466, 0x111122, 0.55));

    /* key light – upper left, warm white */
    const key = new THREE.DirectionalLight(0xfff8f0, 4.0);
    key.position.set(-4, 5, 2);
    key.castShadow = true;
    key.shadow.mapSize.set(window.innerWidth < 768 ? 1024 : 2048, window.innerWidth < 768 ? 1024 : 2048);
    key.shadow.bias = -0.0004;
    this.scene.add(key);

    /* fill – blue-ish right */
    const fill = new THREE.DirectionalLight(0x4488ff, 1.0);
    fill.position.set(5, -2, 4);
    this.scene.add(fill);

    /* rim / backlight – cyan */
    const rim = new THREE.DirectionalLight(0x00d4ff, 0.7);
    rim.position.set(1, 2, -6);
    this.scene.add(rim);

    /* combustor orange point light */
    this.combustorLight = new THREE.PointLight(0xff6a00, 10.0, 4.0);
    this.scene.add(this.combustorLight);

    /* exhaust red glow */
    this.exhaustLight = new THREE.PointLight(0xff2200, 4.0, 2.8);
    this.scene.add(this.exhaustLight);
  }

  /* ─── Camera ────────────────────────────────────── */
  _initCamera() {
    const el  = this.canvas.parentElement;
    const w   = el ? el.clientWidth  : window.innerWidth;
    const h   = el ? el.clientHeight : window.innerHeight;
    this._isMobile = w < 768;
    const asp = w / h;
    const fov = this._isMobile ? 62 : 42;
    this.camera = new THREE.PerspectiveCamera(fov, asp, 0.05, 120);
    if (this._isMobile) {
      // Pull camera further back so full engine fits portrait screen
      this._camPos.set(14.0, 6.5, 0.0);
    }
    this.camera.position.copy(this._camPos);
    this.camera.lookAt(this._camLook);
  }

  _resize() {
    const el = this.canvas.parentElement;
    if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    this._isMobile = w < 768;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this._isMobile ? 1.5 : 2));
    this.renderer.setSize(w, h);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.fov    = this._isMobile ? 62 : 42;
      this.camera.updateProjectionMatrix();
    }
  }

  /* ═══════════════════════════════════════════════════
     ENGINE GEOMETRY
  ═══════════════════════════════════════════════════ */
  _buildEngine() {
    /* Clip plane: top-down Y cut — reveals turbine interior like a cutaway diagram
       normal (0,-1,0), constant d: visible when y <= d
       d=0.65 → nothing cut   d→-0.07 → top half removed, blades visible */
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.65);

    /* ── material palette ── */
    this.M = {
      /* stage casings — clipped open to expose interior when camera zooms in */
      nacelle: new THREE.MeshStandardMaterial({
        color:          0x9097a0,   /* brushed aluminium casing */
        metalness:      0.90,
        roughness:      0.34,
        side:           THREE.DoubleSide,
        clippingPlanes: [this.clipPlane],
        clipShadows:    true,
      }),
      nacelleInner: new THREE.MeshStandardMaterial({
        color:    0x3c4046,
        metalness: 0.7,
        roughness: 0.5,
        side:     THREE.BackSide,
      }),
      titaniumFan: new THREE.MeshStandardMaterial({
        color:     0xc6ccd2,   /* polished steel nose */
        metalness: 0.94,
        roughness: 0.16,
      }),
      nickelBlade: new THREE.MeshStandardMaterial({
        color:     0xbcc2c9,   /* bright polished compressor blades */
        metalness: 0.95,
        roughness: 0.22,
      }),
      hotBlade: new THREE.MeshStandardMaterial({
        color:             0x70747a,   /* gunmetal turbine blades */
        metalness:         0.92,
        roughness:         0.30,
        emissive:          new THREE.Color(0x140d08),
        emissiveIntensity: 0.14,
      }),
      disc: new THREE.MeshStandardMaterial({
        color:     0x868c93,
        metalness: 0.92,
        roughness: 0.28,
      }),
      steelShaft: new THREE.MeshStandardMaterial({
        color:     0xced4da,   /* bright polished forged rotor */
        metalness: 0.96,
        roughness: 0.15,
      }),
      combustor: new THREE.MeshStandardMaterial({
        color:             0x1a0808,
        metalness:         0.6,
        roughness:         0.5,
        emissive:          new THREE.Color(0xff4400),
        emissiveIntensity: 1.2,
        side:              THREE.DoubleSide,
      }),
      combustorGlow: new THREE.MeshStandardMaterial({
        color:             0xff6600,
        emissive:          new THREE.Color(0xff4400),
        emissiveIntensity: 2.5,
        transparent:       true,
        opacity:           0.55,
        depthWrite:        false,
      }),
      exhaust: new THREE.MeshStandardMaterial({
        color:             0x1e0e06,
        metalness:         0.88,
        roughness:         0.28,
        emissive:          new THREE.Color(0x200600),
        emissiveIntensity: 0.35,
        side:              THREE.DoubleSide,
      }),
      /* enclosure / skid steel — gray industrial panels */
      enclosureSteel: new THREE.MeshStandardMaterial({
        color:     0x2a3848,
        metalness: 0.72,
        roughness: 0.40,
        side:      THREE.DoubleSide,
      }),
      darkMetal: new THREE.MeshStandardMaterial({
        color:     0x565b61,   /* neutral dark steel */
        metalness: 0.88,
        roughness: 0.36,
      }),
      ogvVane: new THREE.MeshStandardMaterial({
        color:     0xa9afb6,   /* steel stator vanes */
        metalness: 0.90,
        roughness: 0.24,
      }),
      /* ── Generator materials ── */
      copper: new THREE.MeshStandardMaterial({
        color:             0xc87030,
        metalness:         0.95,
        roughness:         0.18,
        emissive:          new THREE.Color(0x1a0500),
        emissiveIntensity: 0.3,
      }),
      genBody: new THREE.MeshStandardMaterial({
        color:     0x1c2a38,
        metalness: 0.85,
        roughness: 0.30,
      }),
      /* rear compressor blades — color lerps to fouled brown during cutaway */
      hpcFoul: new THREE.MeshStandardMaterial({
        color:     0xbcc2c9,
        metalness: 0.92,
        roughness: 0.26,
      }),
    };

    /* env reflection strength — bright on polished parts, restrained on casings */
    const envI = {
      titaniumFan: 1.45, nickelBlade: 1.30, steelShaft: 1.45, ogvVane: 1.25,
      disc: 1.05, copper: 1.20, nacelle: 0.95, enclosureSteel: 0.55,
      darkMetal: 0.65, genBody: 0.65, exhaust: 0.75, hpcFoul: 1.25,
    };
    Object.keys(this.M).forEach(k => {
      if ('envMapIntensity' in this.M[k]) {
        this.M[k].envMapIntensity = envI[k] !== undefined ? envI[k] : 0.8;
      }
    });

    /* Single rotor — compressor + turbine + nose + plug + generator rotor */
    this.lpGroup = new THREE.Group();
    /* kept for the rotation hook in _update; unused on a single-shaft machine */
    this.hpGroup = new THREE.Group();

    this.engineGroup = new THREE.Group();
    this.engineGroup.add(this.lpGroup);
    this.engineGroup.add(this.hpGroup);

    /* ── Titan 350 package structure ── */
    this._buildSkidFrame();
    this._buildControlCabinet();
    this._buildInletSystem();

    /* ── Exposed heavy-duty core: 17-stage axial compressor · annular
          combustor · 4-stage turbine — all on a single shaft ── */
    this._buildCoreCasings();
    this._buildInletNose();   /* polished inlet bullet */
    this._buildIGV();         /* inlet guide vane ring */
    this._buildCoreShaft();   /* fore/aft shaft + polished mid rotor */
    this._buildCompressor();  /* 17 dense stages on a tapering drum */
    this._buildCombustor();
    this._buildTurbine();     /* 4 large stages + nozzle guide vanes */
    this._buildExhaust();

    /* ── Hot section, coupling, alternator ── */
    this._buildExhaustCollector();
    this._buildGearbox();
    this._buildGeneratorBox();
    this._buildPowerDriveline();   /* shaft + coupling + oil lines between gearbox and gen */
    this._buildExternalPlumbing(); /* fuel manifold, bleed air, lube oil along casing */

    /* 3/4 view yaw — match the Titan 350 product render angle */
    this.engineGroup.rotation.y = 0.30;

    /* sensor markers — desktop only (too cluttered on mobile) */
    if (!this._isMobile) this._buildSensorMarkers();

    /* effects */
    this._buildExhaustParticles();
    this._buildIntakeVortex();
    this._buildCombustionParticles();
    this._buildScanBeams();

    this.scene.add(this.engineGroup);
  }

  /* ─── Titan 350 Skid Frame ──────────────────────── */
  /* Heavy-duty common baseplate, full package length */
  _buildSkidFrame() {
    const BY = -0.68, Z1 = -6.50, Z2 = 5.90, XO = 1.10;
    const mat = this.M.darkMetal;

    /* Two longitudinal main stringers */
    [-XO, XO].forEach(x => {
      const g = new THREE.BoxGeometry(0.06, 0.14, Z2 - Z1);
      const b = new THREE.Mesh(g, mat);
      b.position.set(x, BY - 0.07, (Z1 + Z2) / 2);
      this.engineGroup.add(b);
      /* top flange cap */
      const fg = new THREE.BoxGeometry(0.16, 0.024, Z2 - Z1);
      const fl = new THREE.Mesh(fg, mat);
      fl.position.set(x, BY, (Z1 + Z2) / 2);
      this.engineGroup.add(fl);
    });

    /* Cross beams */
    for (let z = Z1; z <= Z2 + 0.01; z += 0.65) {
      const g = new THREE.BoxGeometry(XO * 2 + 0.12, 0.09, 0.058);
      const c = new THREE.Mesh(g, mat);
      c.position.set(0, BY - 0.045, z);
      this.engineGroup.add(c);
    }

    /* Bottom plate */
    const bg = new THREE.BoxGeometry(XO * 2 + 0.12, 0.045, Z2 - Z1);
    const bm = new THREE.Mesh(bg, mat);
    bm.position.set(0, BY - 0.135, (Z1 + Z2) / 2);
    this.engineGroup.add(bm);

    /* Leg supports every ~2 units */
    [-5.8, -3.8, -1.2, 1.5, 3.8, 5.5].forEach(z => {
      [-XO, XO].forEach(x => {
        const lg = new THREE.BoxGeometry(0.09, 0.22, 0.09);
        const lm = new THREE.Mesh(lg, mat);
        lm.position.set(x, BY - 0.24, z);
        this.engineGroup.add(lm);
      });
    });
  }

  /* ─── Control & Starter Cabinet ─────────────────── */
  /* Small electrical cabinet on the far-left end of skid */
  _buildControlCabinet() {
    const CZ = -5.90, CW = 0.78, CH = 1.25, CD = 0.85, CY = -0.06;
    const mat = this.M.enclosureSteel;
    const imat = this.M.darkMetal;

    const addP = (w, h, rx, ry, px, py, pz) => {
      const g = new THREE.PlaneGeometry(w, h);
      if (rx) g.rotateX(rx); if (ry) g.rotateY(ry);
      const m = new THREE.Mesh(g, mat);
      m.position.set(px, py, pz);
      this.engineGroup.add(m);
    };
    const cy = CY + CH / 2;
    addP(CW, CH, 0, 0,          0,    cy, CZ + CD / 2);
    addP(CW, CH, 0, Math.PI,    0,    cy, CZ - CD / 2);
    addP(CD, CH, 0, Math.PI/2, -CW/2, cy, CZ);
    addP(CD, CH, 0,-Math.PI/2,  CW/2, cy, CZ);
    addP(CW, CD,-Math.PI/2, 0,  0, CY + CH, CZ);

    /* Door panel */
    const dp = new THREE.BoxGeometry(CW * 0.42, CH * 0.48, 0.028);
    const dm = new THREE.Mesh(dp, imat);
    dm.position.set(-CW * 0.18, cy + CH * 0.0, CZ + CD / 2 + 0.015);
    this.engineGroup.add(dm);

    /* Conduit runs down from cabinet */
    const cg = new THREE.CylinderGeometry(0.020, 0.020, 0.40, 8);
    const cm = new THREE.Mesh(cg, imat);
    cm.position.set(CW * 0.28, CY - 0.20, CZ + CD * 0.25);
    this.engineGroup.add(cm);
  }

  /* ─── Titan 350 Air Inlet Hopper / Silencer ─────── */
  /* Large upward-angled plenum + inlet silencer, left of turbine */
  _buildInletSystem() {
    const mat  = this.M.enclosureSteel;
    const imat = this.M.darkMetal;

    /* ── Main silencer plenum (tall rectangular box) ── */
    const PZ1 = -5.10, PZ2 = -3.40;
    const PX  = 0.88,  PY_BOT = -0.20, PY_TOP = 2.50;
    const PW  = PX * 2, PH = PY_TOP - PY_BOT, PD = PZ2 - PZ1;
    const PCY = (PY_BOT + PY_TOP) / 2, PCZ = (PZ1 + PZ2) / 2;

    const addFace = (w, h, rx, ry, px, py, pz) => {
      const g = new THREE.PlaneGeometry(w, h);
      if (rx) g.rotateX(rx); if (ry) g.rotateY(ry);
      const m = new THREE.Mesh(g, mat);
      m.position.set(px, py, pz);
      this.engineGroup.add(m);
    };

    addFace(PW, PH, 0, 0,         0,    PCY, PZ2);       /* near face */
    addFace(PW, PH, 0, Math.PI,   0,    PCY, PZ1);       /* far face */
    addFace(PD, PH, 0, Math.PI/2,-PX,   PCY, PCZ);       /* left */
    addFace(PD, PH, 0,-Math.PI/2,  PX,  PCY, PCZ);       /* right */
    addFace(PW, PD,-Math.PI/2, 0,  0, PY_TOP, PCZ);      /* top */
    addFace(PW, PD, Math.PI/2, 0,  0, PY_BOT, PCZ);      /* bottom */

    /* Horizontal louver baffles on near face */
    for (let i = 0; i < 20; i++) {
      const fy = PY_BOT + (i + 0.5) * (PH / 20);
      const fg = new THREE.BoxGeometry(PW * 0.86, 0.018, 0.060);
      const fm = new THREE.Mesh(fg, imat);
      fm.position.set(0, fy, PZ2 + 0.004);
      fm.rotation.x = 0.14;
      this.engineGroup.add(fm);
    }

    /* Corner uprights / stiffeners */
    [[PX, PZ1],[PX, PZ2],[-PX, PZ1],[-PX, PZ2]].forEach(([x, z]) => {
      const cg = new THREE.BoxGeometry(0.042, PH + 0.04, 0.042);
      const cm = new THREE.Mesh(cg, this.M.disc);
      cm.position.set(x, PCY, z);
      this.engineGroup.add(cm);
    });

    /* ── Angled transition section (hopper narrows to duct) ── */
    /* Tapered box from plenum bottom → inlet duct */
    const TZ1 = -3.80, TZ2 = -2.50;
    const tg  = new THREE.BoxGeometry(PW * 0.58, 0.62, TZ2 - TZ1);
    const tm  = new THREE.Mesh(tg, mat);
    tm.position.set(0, -0.52, (TZ1 + TZ2) / 2);
    this.engineGroup.add(tm);

    /* Flanged inlet duct to compressor */
    const dg = new THREE.CylinderGeometry(0.55, 0.58, 0.68, 36, 1, true);
    dg.rotateX(Math.PI / 2);
    const dm = new THREE.Mesh(dg, imat);
    dm.position.z = -2.18;
    this.engineGroup.add(dm);

    /* Inlet bellmouth */
    const bg = new THREE.TorusGeometry(0.55, 0.042, 12, 52);
    bg.rotateX(Math.PI / 2);
    const bm = new THREE.Mesh(bg, this.M.disc);
    bm.position.z = -1.85;
    this.engineGroup.add(bm);

    /* Access pipes / blow-off valves on side of plenum */
    [PCZ - 0.40, PCZ + 0.40].forEach(z => {
      const pg = new THREE.CylinderGeometry(0.030, 0.030, 0.30, 8);
      const pm = new THREE.Mesh(pg, imat);
      pm.rotation.z = Math.PI / 2;
      pm.position.set(PX + 0.15, PCY - PH * 0.22, z);
      this.engineGroup.add(pm);
    });
  }

  /* ─── Core Stage Casings (split, bolted, brushed steel) ─── */
  _buildCoreCasings() {
    const N = this.M.nacelle;

    /* Casing barrels follow the compressor taper → combustor bulge → turbine
       expansion. Clipped open on cutaway (nacelle material). */
    const SECTIONS = [
      { z: -1.45, len: 0.30, rF: 0.500, rR: 0.500 }, /* inlet            */
      { z: -0.95, len: 0.78, rF: 0.498, rR: 0.405 }, /* compressor front */
      { z: -0.30, len: 0.74, rF: 0.405, rR: 0.330 }, /* compressor rear  */
      { z:  0.10, len: 0.20, rF: 0.330, rR: 0.360 }, /* diffuser         */
      { z:  0.42, len: 0.50, rF: 0.420, rR: 0.420 }, /* combustor bulge  */
      { z:  0.98, len: 0.66, rF: 0.405, rR: 0.500 }, /* turbine expand   */
      { z:  1.50, len: 0.34, rF: 0.510, rR: 0.560 }, /* exhaust diffuser */
    ];
    SECTIONS.forEach(({ z, len, rF, rR }) => {
      const g = new THREE.CylinderGeometry(rF, rR, len, 48, 1, true);
      g.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(g, N);
      m.position.z = z;
      this.engineGroup.add(m);
    });

    /* Bolted flange ring: torus rim + instanced bolt circle at a casing joint */
    const boltFlange = (z, r, nb) => {
      const fg = new THREE.TorusGeometry(r + 0.012, 0.020, 8, 56);
      fg.rotateX(Math.PI / 2);
      const f = new THREE.Mesh(fg, this.M.disc);
      f.position.z = z;
      this.engineGroup.add(f);

      const bg = new THREE.CylinderGeometry(0.009, 0.009, 0.030, 6);
      bg.rotateX(Math.PI / 2);
      const bolts = new THREE.InstancedMesh(bg, this.M.darkMetal, nb);
      bolts.frustumCulled = false;
      const mtx = new THREE.Matrix4();
      for (let i = 0; i < nb; i++) {
        const a = (i / nb) * Math.PI * 2;
        mtx.makeTranslation(Math.cos(a) * (r + 0.012), Math.sin(a) * (r + 0.012), z);
        bolts.setMatrixAt(i, mtx);
      }
      bolts.instanceMatrix.needsUpdate = true;
      this.engineGroup.add(bolts);
    };
    boltFlange(-1.60, 0.500, 36);  /* front inlet ring      */
    boltFlange(-0.56, 0.405, 30);  /* compressor mid        */
    boltFlange( 0.18, 0.360, 26);  /* compressor exit       */
    boltFlange( 0.67, 0.420, 30);  /* combustor → turbine   */
    boltFlange( 1.31, 0.500, 34);  /* turbine exit big ring */
    boltFlange( 1.67, 0.560, 40);  /* exhaust ring          */

    /* interstage diffuser cone (compressor → combustor) */
    const dg = new THREE.CylinderGeometry(0.300, 0.330, 0.16, 40, 1, true);
    dg.rotateX(Math.PI / 2);
    const dm = new THREE.Mesh(dg, this.M.darkMetal);
    dm.position.z = 0.22;
    this.engineGroup.add(dm);

    /* inlet flare bellmouth */
    const ifg = new THREE.CylinderGeometry(0.500, 0.62, 0.30, 48, 1, true);
    ifg.rotateX(Math.PI / 2);
    const ifc = new THREE.Mesh(ifg, this.M.darkMetal);
    ifc.position.z = -1.74;
    this.engineGroup.add(ifc);
  }

  /* ─── Inlet nose bullet ─────────────────────────── */
  _buildInletNose() {
    /* Polished ogive bullet fairing the rotor into the intake airflow */
    const g = new THREE.ConeGeometry(0.135, 0.46, 40);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -1.59);
    const nose = new THREE.Mesh(g, this.M.steelShaft);
    this.lpGroup.add(nose);

    /* back collar onto the first compressor disc */
    const cg = new THREE.CylinderGeometry(0.135, 0.135, 0.05, 36);
    cg.rotateX(Math.PI / 2);
    const collar = new THREE.Mesh(cg, this.M.disc);
    collar.position.z = -1.35;
    this.lpGroup.add(collar);
  }

  /* ─── Inlet Guide Vanes (static, ahead of stage 1) ── */
  _buildIGV() {
    /* Variable inlet guide vanes — single static row metering intake air */
    this._buildStatorRing(-1.40, 0.145, 0.46, 40, this.M.ogvVane);
  }

  /* ─── Core shaft + polished mid rotor ───────────── */
  _buildCoreShaft() {
    /* Aft shaft stub (turbine → gearbox) on the single rotor */
    const ag = new THREE.CylinderGeometry(0.10, 0.10, 1.1, 28);
    ag.rotateX(Math.PI / 2);
    const aft = new THREE.Mesh(ag, this.M.steelShaft);
    aft.position.z = 1.85;
    this.lpGroup.add(aft);

    /* Forward stub through the inlet */
    const fg = new THREE.CylinderGeometry(0.085, 0.085, 0.5, 24);
    fg.rotateX(Math.PI / 2);
    const fwd = new THREE.Mesh(fg, this.M.steelShaft);
    fwd.position.z = -1.45;
    this.lpGroup.add(fwd);

    /* Prominent polished forged mid rotor: compressor discharge → turbine
       inlet. Stays slender through the combustor annulus so the annular
       can wrap around it. */
    const profile = [
      { z: 0.06, r: 0.250 },  /* compressor discharge drum  */
      { z: 0.18, r: 0.150 },
      { z: 0.62, r: 0.135 },  /* slender run through combustor */
      { z: 0.74, r: 0.250 },  /* turbine inlet wheel rim    */
    ];
    for (let i = 0; i < profile.length - 1; i++) {
      const a = profile[i], b = profile[i + 1];
      const cg = new THREE.CylinderGeometry(b.r, a.r, b.z - a.z, 32);
      cg.rotateX(Math.PI / 2);
      const cm = new THREE.Mesh(cg, this.M.steelShaft);
      cm.position.z = (a.z + b.z) / 2;
      this.lpGroup.add(cm);
    }
  }

  /* ─── Generic stage builder (InstancedMesh: dense, clean, 1 draw call) ───── */
  _buildStage(group, material, { z, hubR, tipR, n, chord, thick, pitch }) {
    /* rotor drum / hub disc — slightly proud so the bladed disk reads as a unit */
    const dg = new THREE.CylinderGeometry(hubR, hubR, 0.046, 32);
    dg.rotateX(Math.PI / 2);
    const disc = new THREE.Mesh(dg, this.M.disc);
    disc.position.z = z;
    group.add(disc);

    /* one tapered+staggered blade geometry, baked out to mid-span radius */
    const span     = tipR - hubR;
    const midChord = chord || 0.022;
    const t        = thick || 0.005;
    const bladeGeom = new THREE.BoxGeometry(midChord, span, t, 1, 2, 1);

    /* taper chord toward the tip (root wider than tip) */
    const pos = bladeGeom.attributes.position;
    for (let vi = 0; vi < pos.count; vi++) {
      const tt = (pos.getY(vi) / (span / 2) + 1) / 2;     // 0 at root → 1 at tip
      pos.setX(vi, pos.getX(vi) * (1 - tt * 0.32));
    }
    pos.needsUpdate = true;
    bladeGeom.computeVertexNormals();
    bladeGeom.rotateZ(pitch || 0.25);                     // stagger (same for all blades)
    bladeGeom.translate(0, hubR + span / 2, 0);           // out to mid-span

    /* dense ring of blades as a single instanced mesh */
    const inst = new THREE.InstancedMesh(bladeGeom, material, n);
    inst.position.z = z;
    inst.frustumCulled = false;
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      m.makeRotationZ((i / n) * Math.PI * 2);
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  }

  /* ─── Axial Compressor — 17 dense stages on a tapering drum ─── */
  /* Single-shaft heavy-duty layout: blade height shrinks and blade count
     rises stage-to-stage as the annulus closes down — the characteristic
     dense "cone of blades" of a frame gas turbine. */
  _buildCompressor() {
    const N  = 17;
    const z0 = -1.30, z1 = 0.04;
    const dz = (z1 - z0) / (N - 1);
    for (let i = 0; i < N; i++) {
      const f     = i / (N - 1);                 /* 0 front → 1 rear */
      const z     = z0 + i * dz;
      const tipR  = 0.455 - f * 0.170;           /* 0.455 → 0.285 */
      const hubR  = 0.135 + f * 0.120;           /* 0.135 → 0.255 (rising drum) */
      const n     = Math.round(34 + f * 36);     /* 34 → 70 blades */
      const chord = 0.050 - f * 0.028;           /* 0.050 → 0.022 */
      const pitch = 0.34  - f * 0.17;
      /* rear third fouls — drives the cutaway "fouling" scroll narrative */
      const mat   = i >= 11 ? this.M.hpcFoul : this.M.nickelBlade;
      this._buildStage(this.lpGroup, mat,
        { z, hubR, tipR, n, chord, thick: 0.006, pitch });

      /* static stator row just downstream of each rotor (except the last) */
      if (i < N - 1) {
        this._buildStage(this.engineGroup, this.M.ogvVane, {
          z: z + dz * 0.5, hubR: hubR + 0.006, tipR: tipR - 0.004,
          n: n + 4, chord: chord * 0.8, thick: 0.004, pitch: -0.24,
        });
      }
    }
  }

  /* ─── Stator ring helper ────────────────────────── */
  _buildStatorRing(z, hubR, tipR, n, mat) {
    const span = tipR - hubR;
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2;
      const vg = new THREE.BoxGeometry(0.005, span, 0.018);
      const pivot = new THREE.Group();
      pivot.rotation.z = angle;
      pivot.position.z = z;
      const vane = new THREE.Mesh(vg, mat);
      vane.position.y = hubR + span / 2;
      vane.rotation.z = 0.18;
      pivot.add(vane);
      this.engineGroup.add(pivot);
    }
  }

  /* ─── Combustor ─────────────────────────────────── */
  _buildCombustor() {
    const CZ  = 0.40;  /* combustor center Z */
    const LEN = 0.48;

    /* outer casing */
    const og = new THREE.CylinderGeometry(0.32, 0.30, LEN, 48, 1, true);
    og.rotateX(Math.PI / 2);
    const outerCasing = new THREE.Mesh(og, this.M.darkMetal);
    outerCasing.position.z = CZ;
    this.engineGroup.add(outerCasing);

    /* inner liner (emissive) */
    const ig = new THREE.CylinderGeometry(0.21, 0.19, LEN * 0.88, 48, 1, true);
    ig.rotateX(Math.PI / 2);
    this.combustorLiner = new THREE.Mesh(ig, this.M.combustor);
    this.combustorLiner.position.z = CZ;
    this.engineGroup.add(this.combustorLiner);

    /* combustion core glow sphere */
    const gg = new THREE.SphereGeometry(0.14, 24, 16);
    this.combustorGlow = new THREE.Mesh(gg, this.M.combustorGlow);
    this.combustorGlow.position.z = CZ;
    this.engineGroup.add(this.combustorGlow);

    /* fuel injector nozzles — 12 around annulus */
    for (let i = 0; i < 12; i++) {
      const a  = (i / 12) * Math.PI * 2;
      const r  = 0.26;
      const ng = new THREE.SphereGeometry(0.012, 8, 6);
      const nm = new THREE.MeshStandardMaterial({
        color: 0xff6600, emissive: new THREE.Color(0xff4000), emissiveIntensity: 2.0,
      });
      const nozzle = new THREE.Mesh(ng, nm);
      nozzle.position.set(Math.cos(a) * r, Math.sin(a) * r, CZ - LEN * 0.44);
      this.engineGroup.add(nozzle);
    }

    /* set light positions */
    this.combustorLight.position.set(0, 0, CZ);
    this.exhaustLight.position.set(0, 0, CZ + 1.1);
  }

  /* ─── Turbine — 4 large stages + nozzle guide vanes ─── */
  /* Fewer, much larger blades than the compressor; annulus expands
     downstream as the gas does work. */
  _buildTurbine() {
    const stages = [
      { z: 0.80, hubR: 0.250, tipR: 0.345, n: 64, chord: 0.050, pitch: 0.34 },
      { z: 0.99, hubR: 0.246, tipR: 0.390, n: 58, chord: 0.058, pitch: 0.32 },
      { z: 1.18, hubR: 0.242, tipR: 0.435, n: 52, chord: 0.066, pitch: 0.30 },
      { z: 1.37, hubR: 0.238, tipR: 0.475, n: 46, chord: 0.074, pitch: 0.28 },
    ];
    /* first-stage nozzle guide vanes (static) ahead of the HP turbine */
    this._buildStage(this.engineGroup, this.M.ogvVane,
      { z: 0.69, hubR: 0.250, tipR: 0.335, n: 48, chord: 0.052, thick: 0.010, pitch: -0.36 });

    stages.forEach((s, i) => {
      this._buildStage(this.lpGroup, this.M.hotBlade, { ...s, thick: 0.013 });
      if (i < stages.length - 1) {
        const nz = stages[i + 1];
        this._buildStage(this.engineGroup, this.M.ogvVane, {
          z: (s.z + nz.z) / 2, hubR: s.hubR + 0.002, tipR: s.tipR + 0.012,
          n: s.n - 6, chord: s.chord * 0.72, thick: 0.007, pitch: -0.32,
        });
      }
    });
  }

  /* ─── Exhaust ───────────────────────────────────── */
  _buildExhaust() {
    /* exhaust diffuser inner cone — widens downstream from turbine exit */
    const eg = new THREE.CylinderGeometry(0.46, 0.30, 0.42, 40, 1, true);
    eg.rotateX(Math.PI / 2);
    const duct = new THREE.Mesh(eg, this.M.exhaust);
    duct.position.z = 1.68;
    this.engineGroup.add(duct);

    /* exhaust plug bullet — on the rotor, fairing the rotor tail */
    const pg = new THREE.ConeGeometry(0.235, 0.62, 32);
    pg.rotateX(Math.PI / 2);
    const plug = new THREE.Mesh(pg, this.M.steelShaft);
    plug.position.z = 1.62;
    this.lpGroup.add(plug);
  }

  /* ─── Titan 350 Exhaust Collector ───────────────── */
  /* Large upward-facing rectangular exhaust plenum above the hot turbine */
  _buildExhaustCollector() {
    const mat  = this.M.enclosureSteel;
    const imat = this.M.darkMetal;
    const ECZ  = 1.10, EX = 0.75, EZH = 0.58;   /* center, half-width, half-depth */
    const EYB  = 0.52, EYT = 2.75;               /* bottom / top Y */
    const EH   = EYT - EYB, CY = (EYB + EYT) / 2;

    const addP = (w, h, rx, ry, px, py, pz) => {
      const g = new THREE.PlaneGeometry(w, h);
      if (rx) g.rotateX(rx); if (ry) g.rotateY(ry);
      const m = new THREE.Mesh(g, mat);
      m.position.set(px, py, pz);
      this.engineGroup.add(m);
    };
    /* Four vertical sides */
    addP(EX*2, EH, 0, 0,         0,  CY, ECZ + EZH);   /* near */
    addP(EX*2, EH, 0, Math.PI,   0,  CY, ECZ - EZH);   /* far */
    addP(EZH*2, EH, 0,-Math.PI/2, EX,  CY, ECZ);        /* right */
    addP(EZH*2, EH, 0, Math.PI/2,-EX,  CY, ECZ);        /* left */
    /* Top opening rim */
    addP(EX*2, EZH*2,-Math.PI/2, 0, 0, EYT, ECZ);

    /* Horizontal stiffening ribs */
    [0.28, 0.55, 0.80].forEach(t => {
      const rg = new THREE.BoxGeometry(EX*2+0.04, 0.032, 0.032);
      const rm = new THREE.Mesh(rg, this.M.disc);
      rm.position.set(0, EYB + t * EH, ECZ + EZH + 0.002);
      this.engineGroup.add(rm);
    });

    /* Top cap frame */
    const tfG = new THREE.BoxGeometry(EX*2 + 0.05, 0.048, EZH*2 + 0.05);
    const tf  = new THREE.Mesh(tfG, this.M.disc);
    tf.position.set(0, EYT, ECZ);
    this.engineGroup.add(tf);

    /* Bottom transition flange (connects to turbine exit) */
    const bfG = new THREE.BoxGeometry(EX*2 - 0.06, 0.060, EZH*2 - 0.06);
    const bf  = new THREE.Mesh(bfG, this.M.disc);
    bf.position.set(0, EYB, ECZ);
    this.engineGroup.add(bf);

    /* Cross brace pipe on the side */
    const pg = new THREE.CylinderGeometry(0.025, 0.025, EH * 0.55, 8);
    const pm = new THREE.Mesh(pg, imat);
    pm.position.set(EX + 0.025, CY, ECZ);
    this.engineGroup.add(pm);
  }

  /* ─── Reduction Gearbox / Coupling ──────────────── */
  _buildGearbox() {
    const GZ = 2.60, GR = 0.38, GL = 0.85;
    const mat = this.M.darkMetal;

    /* Main casing */
    const cg = new THREE.CylinderGeometry(GR, GR, GL, 32, 1, true);
    cg.rotateX(Math.PI / 2);
    const cm = new THREE.Mesh(cg, mat);
    cm.position.z = GZ;
    this.engineGroup.add(cm);

    /* End flanges */
    [GZ - GL/2, GZ + GL/2].forEach(z => {
      const eg = new THREE.TorusGeometry(GR * 0.92, 0.028, 8, 30);
      eg.rotateX(Math.PI / 2);
      const em = new THREE.Mesh(eg, this.M.disc);
      em.position.z = z;
      this.engineGroup.add(em);
    });

    /* Oil cooler box on side */
    const ocG = new THREE.BoxGeometry(0.12, 0.26, 0.28);
    const oc  = new THREE.Mesh(ocG, mat);
    oc.position.set(GR + 0.06, 0.13, GZ + 0.18);
    this.engineGroup.add(oc);

    /* Oil cooler fins */
    for (let i = 0; i < 6; i++) {
      const fg = new THREE.BoxGeometry(0.028, 0.22, 0.006);
      const fm = new THREE.Mesh(fg, this.M.disc);
      fm.position.set(GR + 0.06 + i * 0.016 - 0.04, 0.13, GZ + 0.18);
      this.engineGroup.add(fm);
    }

    /* Mounting feet */
    [-GR*0.45, GR*0.45].forEach(x => {
      const mg = new THREE.BoxGeometry(0.16, 0.09, GL * 0.48);
      const mm = new THREE.Mesh(mg, this.M.disc);
      mm.position.set(x, -GR - 0.045, GZ);
      this.engineGroup.add(mm);
    });
  }

  /* ─── Titan 350 Generator (38 MW Alternator) ─────── */
  _buildGeneratorBox() {
    const GZ = 4.30, GW = 1.42, GH = 1.52, GD = 2.30, CY = 0.0;
    const mat  = this.M.enclosureSteel;
    const imat = this.M.darkMetal;

    const addP = (w, h, rx, ry, px, py, pz) => {
      const g = new THREE.PlaneGeometry(w, h);
      if (rx) g.rotateX(rx); if (ry) g.rotateY(ry);
      const m = new THREE.Mesh(g, mat);
      m.position.set(px, py, pz);
      this.engineGroup.add(m);
    };
    /* Six faces */
    addP(GW, GH, 0, 0,         0,   CY, GZ + GD/2);       /* near */
    addP(GW, GH, 0, Math.PI,   0,   CY, GZ - GD/2);       /* far */
    addP(GD, GH, 0,-Math.PI/2,  GW/2, CY, GZ);            /* right */
    addP(GD, GH, 0, Math.PI/2, -GW/2, CY, GZ);            /* left */
    addP(GW, GD,-Math.PI/2, 0,  0, CY + GH/2, GZ);        /* top */
    addP(GW, GD, Math.PI/2, 0,  0, CY - GH/2, GZ);        /* bottom */

    /* Horizontal cooling vent strips on side faces */
    const VN = 16;
    for (let i = 0; i < VN; i++) {
      const vy = CY - GH*0.40 + i * (GH * 0.80 / (VN - 1));
      [GW/2 + 0.005, -(GW/2 + 0.005)].forEach(x => {
        const vg = new THREE.BoxGeometry(0.032, 0.016, GD * 0.84);
        const vm = new THREE.Mesh(vg, imat);
        vm.position.set(x, vy, GZ);
        this.engineGroup.add(vm);
      });
    }

    /* Terminal box on top */
    const tbG = new THREE.BoxGeometry(GW * 0.38, 0.24, 0.44);
    const tb  = new THREE.Mesh(tbG, imat);
    tb.position.set(0, CY + GH/2 + 0.12, GZ - GD * 0.12);
    this.engineGroup.add(tb);

    /* Exciter on the far end — smaller cylinder */
    const exG = new THREE.CylinderGeometry(GW*0.28, GW*0.28, 0.58, 28, 1, true);
    exG.rotateX(Math.PI / 2);
    const exM = new THREE.Mesh(exG, mat);
    exM.position.z = GZ + GD/2 + 0.29;
    this.engineGroup.add(exM);

    /* Exciter end cap */
    const ecG = new THREE.CylinderGeometry(GW*0.28, GW*0.28, 0.038, 28);
    ecG.rotateX(Math.PI / 2);
    const ecM = new THREE.Mesh(ecG, this.M.disc);
    ecM.position.z = GZ + GD/2 + 0.56;
    this.engineGroup.add(ecM);

    /* Mounting feet */
    [GZ - GD*0.36, GZ + GD*0.36].forEach(z => {
      [-GW/2, GW/2].forEach(x => {
        const fg = new THREE.BoxGeometry(0.14, 0.11, 0.16);
        const fm = new THREE.Mesh(fg, imat);
        fm.position.set(x, CY - GH/2 - 0.055, z);
        this.engineGroup.add(fm);
      });
    });

    /* Generator rotor (spins with LP spool) */
    const rg = new THREE.CylinderGeometry(0.22, 0.22, GD * 0.88, 28);
    rg.rotateX(Math.PI / 2);
    this.generatorRotor = new THREE.Mesh(rg, this.M.steelShaft);
    this.generatorRotor.position.z = GZ;
    this.lpGroup.add(this.generatorRotor);

    /* Power output point light */
    this.generatorLight = new THREE.PointLight(0x00d4ff, 3.0, 3.5);
    this.generatorLight.position.set(0, CY + 1.0, GZ);
    this.engineGroup.add(this.generatorLight);
    this.termGlow = null;
  }

  /* ─── Power Driveline: Gearbox ↔ Generator ─────── */
  /* LP shaft extension + rigid disk coupling + lube oil lines */
  _buildPowerDriveline() {
    const imat = this.M.darkMetal;
    const disc  = this.M.disc;

    /* Geometry values derived from _buildGearbox / _buildGeneratorBox:
       Gearbox:   center z=2.60, GL=0.85  → input z=2.175, output z=3.025
       Generator: center z=4.30, GD=2.30  → front face z=3.15
       Gen rotor: on lpGroup, starts at z = 4.30 - GD*0.44 = 3.288            */

    /* ── LP shaft extension: turbine exit (z≈1.98) → gearbox input (z=2.175) ── */
    const s1g = new THREE.CylinderGeometry(0.058, 0.058, 0.22, 20);
    s1g.rotateX(Math.PI / 2);
    const s1  = new THREE.Mesh(s1g, this.M.steelShaft);
    s1.position.z = 2.078;   /* midpoint of 1.98 → 2.175 */
    this.lpGroup.add(s1);

    /* ── Gearbox input flange ring ── */
    const fi1g = new THREE.TorusGeometry(0.155, 0.019, 8, 28);
    fi1g.rotateX(Math.PI / 2);
    const fi1  = new THREE.Mesh(fi1g, disc);
    fi1.position.z = 2.175;
    this.engineGroup.add(fi1);

    /* ── Gearbox output flange ring ── */
    const fo1g = new THREE.TorusGeometry(0.155, 0.019, 8, 28);
    fo1g.rotateX(Math.PI / 2);
    const fo1  = new THREE.Mesh(fo1g, disc);
    fo1.position.z = 3.025;
    this.engineGroup.add(fo1);

    /* ── Flexible disk coupling between gearbox (3.025) and gen (3.15) ──
       Three laminated discs: flange plate / flex element / flange plate    */
    const coupZ = 3.088;
    [{ r: 0.225, t: 0.014, m: disc },
     { r: 0.130, t: 0.022, m: imat },
     { r: 0.225, t: 0.014, m: disc }].forEach(({ r, t, m }, i) => {
      const cg   = new THREE.CylinderGeometry(r, r, t, 28);
      cg.rotateX(Math.PI / 2);
      const cm   = new THREE.Mesh(cg, m);
      cm.position.z = coupZ + (i - 1) * 0.022;
      this.engineGroup.add(cm);
    });

    /* 6 coupling bolts evenly spaced */
    for (let i = 0; i < 6; i++) {
      const a   = (i / 6) * Math.PI * 2;
      const bg  = new THREE.CylinderGeometry(0.007, 0.007, 0.068, 6);
      const bm  = new THREE.Mesh(bg, disc);
      bm.position.set(Math.cos(a) * 0.190, Math.sin(a) * 0.190, coupZ);
      this.engineGroup.add(bm);
    }

    /* ── Generator input flange ring ── */
    const fi2g = new THREE.TorusGeometry(0.185, 0.022, 8, 28);
    fi2g.rotateX(Math.PI / 2);
    const fi2  = new THREE.Mesh(fi2g, disc);
    fi2.position.z = 3.15;
    this.engineGroup.add(fi2);

    /* ── LP coupling shaft: gearbox output (3.025) → gen rotor front (3.288) ── */
    const s2g  = new THREE.CylinderGeometry(0.052, 0.052, 0.30, 20);
    s2g.rotateX(Math.PI / 2);
    const s2   = new THREE.Mesh(s2g, this.M.steelShaft);
    s2.position.z = 3.163;   /* midpoint 3.025 → 3.288 */
    this.lpGroup.add(s2);

    /* ── Lube oil supply + return pipes (gearbox → generator, outside casings) ── */
    const oilSpan = 4.30 - 2.60;        /* 1.70 */
    const oilCenZ = (2.60 + 4.30) / 2;  /* 3.45 */
    /* x=±0.82 clears gearbox GR=0.38 and generator GW/2=0.71 with margin */
    [{x:  0.82, y: -0.18},
     {x: -0.82, y: -0.18}].forEach(({ x, y }) => {
      const pg = new THREE.CylinderGeometry(0.013, 0.013, oilSpan, 8);
      pg.rotateX(Math.PI / 2);
      const pm = new THREE.Mesh(pg, imat);
      pm.position.set(x, y, oilCenZ);
      this.engineGroup.add(pm);
    });

    /* ── Electrical cable tray — runs outside exhaust collector (EX=0.75) ── */
    const trayZ1  = -4.80;   /* near control cabinet */
    const trayZ2  =  3.15;   /* generator input flange */
    const trayLen = trayZ2 - trayZ1;
    const trayG   = new THREE.BoxGeometry(0.08, 0.022, trayLen);
    const trayM   = new THREE.Mesh(trayG, imat);
    trayM.position.set(0.88, 0.85, (trayZ1 + trayZ2) / 2);  /* x=0.88 clears exhaust collector */
    this.engineGroup.add(trayM);
  }

  /* ─── External Plumbing — combustor fuel manifold only ─── */
  /* Kept deliberately minimal for a clean OEM-cutaway look: one
     circumferential fuel manifold around the combustor with injector stubs,
     fed by two short pipes tucked along the bottom of the casing. No long
     hoses sweeping across the exposed rotor. */
  _buildExternalPlumbing() {
    const imat = this.M.darkMetal;

    /* Circumferential fuel manifold ring around the combustor casing */
    const CZ = 0.40, MR = 0.45;
    const ringG = new THREE.TorusGeometry(MR, 0.016, 10, 56);
    ringG.rotateX(Math.PI / 2);
    const ring = new THREE.Mesh(ringG, imat);
    ring.position.z = CZ;
    this.engineGroup.add(ring);

    /* injector branch stubs from the manifold inward to each port */
    for (let i = 0; i < 12; i++) {
      const a  = (i / 12) * Math.PI * 2;
      const sg = new THREE.CylinderGeometry(0.007, 0.007, 0.07, 6);
      const sm = new THREE.Mesh(sg, imat);
      sm.position.set(Math.cos(a) * (MR - 0.03), Math.sin(a) * (MR - 0.03), CZ + 0.04);
      sm.rotation.x = Math.PI / 2;
      this.engineGroup.add(sm);
    }

    /* Two short straight fuel-feed pipes tucked along the bottom, running
       back to the manifold ring — kept low so they stay out of the cutaway. */
    const feedZ0 = -0.10, feedZ1 = CZ, len = feedZ1 - feedZ0;
    [-0.15, 0.15].forEach(dx => {
      const pg = new THREE.CylinderGeometry(0.012, 0.012, len, 10);
      const pm = new THREE.Mesh(pg, imat);
      pm.rotation.x = Math.PI / 2;
      pm.position.set(dx, -0.42, (feedZ0 + feedZ1) / 2);
      this.engineGroup.add(pm);
    });
  }

  /* ═══════════════════════════════════════════════════
     SENSOR NODES + HUD
     Each sensor: emissive sphere + billboard ring pulses
     + screen-space CSS label with live telemetry values
  ═══════════════════════════════════════════════════ */
  _buildSensorMarkers() {
    /* Severity palette */
    const C = { N: 0x00d4ff, W: 0xf59e0b, A: 0xff2d78, O: 0xaef03f };

    /*  id, label, unit, value function, severity, alarm state, 3-D position
        Positions are in engineGroup local space (engine along +Z)  */
    this._sensors = [
      {
        id: 'BRG1',  label: 'BRG-1',      detail: 'Front Bearing',      unit: 'g',
        valueFn: t => (0.82 + Math.sin(t * 0.0011) * 0.02).toFixed(2),
        severity: 'normal',   alarm: false,
        color: C.N,  pos: [0, 0, -0.92],
      },
      {
        id: 'FAN',   label: 'FAN η_is',   detail: 'Isentropic Eff.',    unit: '%',
        valueFn: t => (94.2 + Math.sin(t * 0.0008) * 0.4).toFixed(1),
        severity: 'warning',  alarm: true,  alarmText: 'BELOW BASELINE',
        color: C.W,  pos: [0, 0.33, -0.88],
      },
      {
        id: 'T3P3',  label: 'T3 / P3',   detail: 'HPC Exit',           unit: 'bar',
        valueFn: t => (14.2 + Math.sin(t * 0.0012) * 0.1).toFixed(1),
        severity: 'normal',   alarm: false,
        color: C.N,  pos: [0, 0.20, 0.28],
      },
      {
        id: 'EGT',   label: 'EGT',        detail: 'Exhaust Gas Temp.',  unit: '°C',
        valueFn: t => String(Math.round(618 + Math.sin(t * 0.0009) * 4)),
        severity: 'critical', alarm: true,  alarmText: 'THRESHOLD +14 °C',
        color: C.A,  pos: [0, 0.22, 0.42],
      },
      {
        id: 'FF',    label: 'FUEL FLOW',  detail: 'Fuel Mass Flow',     unit: 'kg/s',
        valueFn: t => (38.1 + Math.sin(t * 0.0007) * 0.3).toFixed(1),
        severity: 'normal',   alarm: false,
        color: C.O,  pos: [0, -0.28, 0.38],
      },
      {
        id: 'BLADE', label: 'η_is HPT',  detail: 'Blade Efficiency',   unit: '%',
        valueFn: t => (87.1 - Math.abs(Math.sin(t * 0.0006)) * 1.2).toFixed(1),
        severity: 'critical', alarm: true,  alarmText: 'INEFFICIENCY DETECTED',
        color: C.A,  pos: [0, 0.24, 0.80],
      },
      {
        id: 'BRG2',  label: 'BRG-2',      detail: 'Rear Bearing',       unit: 'g',
        valueFn: t => (1.42 + Math.sin(t * 0.0013) * 0.06).toFixed(2),
        severity: 'warning',  alarm: true,  alarmText: 'VIBRATION ELEVATED',
        color: C.W,  pos: [0, 0, 1.30],
      },
      {
        id: 'GENOUT', label: 'GEN OUTPUT', detail: 'Alternator Power',   unit: 'MW',
        valueFn: t => (28.4 + Math.sin(t * 0.0006) * 0.8).toFixed(1),
        severity: 'normal',   alarm: false,
        color: C.N,  pos: [0, 0.42, 4.30],
      },
    ];

    /* ── Ring gradient textures (one per severity) ── */
    const mkRingTex = (r, g, b) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const x   = cv.getContext('2d');
      const grd = x.createRadialGradient(32, 32, 11, 32, 32, 31);
      grd.addColorStop(0,    `rgba(${r},${g},${b},0)`);
      grd.addColorStop(0.30, `rgba(${r},${g},${b},0.9)`);
      grd.addColorStop(0.65, `rgba(${r},${g},${b},0.5)`);
      grd.addColorStop(1,    `rgba(${r},${g},${b},0)`);
      x.fillStyle = grd;
      x.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(cv);
    };
    this._ringTex = {
      normal:   mkRingTex(0,   212, 255),
      warning:  mkRingTex(245, 158, 11),
      critical: mkRingTex(239, 68,  68),
    };

    /* ── HUD DOM container — absolute over canvas ── */
    const vp  = this.canvas.parentElement;
    const hud = document.createElement('div');
    hud.id    = 'sensor-hud';
    vp.appendChild(hud);
    this._hudEl = hud;

    /* ── Per-sensor 3D objects + DOM label ── */
    this._sensors.forEach(s => {
      /* Emissive marker sphere */
      const geo = new THREE.SphereGeometry(0.013, 8, 6);
      const mat = new THREE.MeshStandardMaterial({
        color: s.color, emissive: new THREE.Color(s.color),
        emissiveIntensity: 1.8,
        metalness: 0, roughness: 1,
        transparent: true, depthWrite: false,
      });
      s._sphere = new THREE.Mesh(geo, mat);
      s._sphere.position.set(...s.pos);
      this.engineGroup.add(s._sphere);

      /* 3 staggered ring sprites (billboard — always faces camera) */
      const ringTex = this._ringTex[s.severity];
      s._rings = [0, 0.33, 0.67].map(phase => {
        const sm  = new THREE.SpriteMaterial({
          map: ringTex, transparent: true, opacity: 0,
          depthWrite: false, blending: THREE.AdditiveBlending,
        });
        const sp  = new THREE.Sprite(sm);
        sp.position.set(...s.pos);
        sp._t = phase;
        this.engineGroup.add(sp);
        return sp;
      });

      /* DOM label element */
      const el      = document.createElement('div');
      el.className  = `s-tag s-tag--${s.severity}`;
      el.innerHTML  =
        `<div class="s-tag-head">` +
          `<span class="s-tag-name">${s.label}</span>` +
          (s.alarm ? `<span class="s-tag-blink"></span>` : '') +
        `</div>` +
        `<div class="s-tag-val">` +
          `<span class="s-tag-num">─</span>` +
          `<span class="s-tag-unit"> ${s.unit}</span>` +
        `</div>` +
        (s.alarm ? `<div class="s-tag-alarm-line">${s.alarmText}</div>` : '');
      this._hudEl.appendChild(el);
      s._el    = el;
      s._numEl = el.querySelector('.s-tag-num');
    });

    this._buildHUDLines();
  }

  _updateSensorMarkers(dt) {
    if (!this._sensors) return;
    const f = dt / 16;

    this._sensors.forEach(s => {
      const speed = s.severity === 'critical' ? 1.65 : s.severity === 'warning' ? 1.15 : 0.80;
      const maxSc = s.severity === 'critical' ? 0.13  : s.severity === 'warning' ? 0.09 : 0.065;

      /* Marker emissive flicker */
      s._sphere.material.emissiveIntensity =
        (s.alarm ? 2.1 : 1.5) +
        0.35 * Math.sin(this.time * 0.0038 + s._rings[0]._t * 5.8);

      /* Expanding ring pulse */
      s._rings.forEach(r => {
        r._t = (r._t + 0.0065 * f * speed) % 1;
        r.scale.setScalar(0.032 + r._t * maxSc);
        r.material.opacity = (1 - r._t) * (s.alarm ? 0.78 : 0.38);
      });
    });
  }

  _updateSensorHUD() {
    if (!this._sensors || !this._hudEl) return;

    /* Fade HUD in as stage casings cut open (scroll 0.38 → 0.52) */
    const vis = Math.max(0, Math.min(1, (this.scrollProgress - 0.38) / 0.14));
    this._hudEl.style.opacity = String(vis);
    if (vis < 0.02) return;

    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;

    this._sensors.forEach(s => {
      /* World-space → NDC */
      s._sphere.getWorldPosition(this._tmpV);
      this._tmpV.project(this.camera);

      /* Behind camera or outside frustum → hide */
      if (this._tmpV.z >= 1) { s._el.style.display = 'none'; return; }

      const sx = (this._tmpV.x  *  0.5 + 0.5) * W;
      const sy = (-this._tmpV.y *  0.5 + 0.5) * H;

      if (sx < -140 || sx > W + 140 || sy < -60 || sy > H + 60) {
        s._el.style.display = 'none'; return;
      }

      /* Put label on the outer side of the screen relative to sensor */
      const onRight = this._tmpV.x >= 0;
      const onTop   = this._tmpV.y >= 0;
      const ox = onRight ?  52 : -130;
      const oy = onTop   ? -46 :   8;
      s._el.setAttribute('data-side', onRight ? 'right' : 'left');

      s._el.style.display   = '';
      s._el.style.transform = `translate(${sx + ox}px,${sy + oy}px)`;

      /* Live telemetry */
      if (s._numEl) s._numEl.textContent = s.valueFn(this.time);
    });
  }

  /* ═══════════════════════════════════════════════════
     EFFECT 1 — EXHAUST JET PARTICLES
  ═══════════════════════════════════════════════════ */
  _buildExhaustParticles() {
    const N = 200;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    this._exParts = [];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.07;
      this._exParts.push({
        x: Math.cos(a) * r, y: Math.sin(a) * r, z: 1.95,
        vx: (Math.random() - 0.5) * 0.014, vy: (Math.random() - 0.5) * 0.014,
        vz: 0.055 + Math.random() * 0.095,
        life: Math.random(), maxLife: 0.5 + Math.random() * 0.5,
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this._exPoints = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.028, vertexColors: true, transparent: true, opacity: 0.75,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.engineGroup.add(this._exPoints);
  }

  _updateExhaustParticles(dt) {
    if (!this._exPoints) return;
    const f = dt / 16;
    const pos = this._exPoints.geometry.attributes.position;
    const col = this._exPoints.geometry.attributes.color;
    this._exParts.forEach((p, i) => {
      p.life += 0.020 * f;
      if (p.life >= p.maxLife) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 0.07;
        p.x = Math.cos(a) * r; p.y = Math.sin(a) * r; p.z = 1.95;
        p.vx = (Math.random() - 0.5) * 0.014; p.vy = (Math.random() - 0.5) * 0.014;
        p.vz = 0.055 + Math.random() * 0.095;
        p.life = 0; p.maxLife = 0.5 + Math.random() * 0.5;
      }
      p.x += p.vx * f; p.y += p.vy * f; p.z += p.vz * f;
      const t = p.life / p.maxLife;
      col.setXYZ(i, 1.0, Math.max(0, 0.55 - t * 0.5), Math.max(0, 0.2 - t * 0.2));
      pos.setXYZ(i, p.x, p.y, p.z);
    });
    pos.needsUpdate = true; col.needsUpdate = true;
  }

  /* ═══════════════════════════════════════════════════
     EFFECT 2 — FAN INTAKE VORTEX
  ═══════════════════════════════════════════════════ */
  _buildIntakeVortex() {
    const N = 130;
    const pos = new Float32Array(N * 3);
    this._inParts = [];
    for (let i = 0; i < N; i++) {
      this._inParts.push({
        angle: Math.random() * Math.PI * 2,
        r: 0.14 + Math.random() * 0.36,
        z: -1.36 + Math.random() * 0.22,
        omega: 0.035 + Math.random() * 0.025,
        dr: 0.003 + Math.random() * 0.002,
        dz: 0.012 + Math.random() * 0.010,
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this._inPoints = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.016, color: 0x44ccff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.engineGroup.add(this._inPoints);
  }

  _updateIntakeVortex(dt) {
    if (!this._inPoints) return;
    const f = dt / 16;
    const pos = this._inPoints.geometry.attributes.position;
    this._inParts.forEach((p, i) => {
      p.angle += p.omega * f; p.r -= p.dr * f; p.z += p.dz * f;
      if (p.r < 0.035 || p.z > -0.85) {
        p.angle = Math.random() * Math.PI * 2;
        p.r = 0.18 + Math.random() * 0.32;
        p.z = -1.38 + Math.random() * 0.12;
      }
      pos.setXYZ(i, Math.cos(p.angle) * p.r, Math.sin(p.angle) * p.r, p.z);
    });
    pos.needsUpdate = true;
    this._inPoints.material.opacity = Math.max(0, 1 - this.scrollProgress * 5) * 0.52;
  }

  /* ═══════════════════════════════════════════════════
     EFFECT 3 — COMBUSTION SPARK PARTICLES
  ═══════════════════════════════════════════════════ */
  _buildCombustionParticles() {
    const N = 110;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    this._combParts = [];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.10 + Math.random() * 0.13;
      this._combParts.push({
        x: Math.cos(a) * r, y: Math.sin(a) * r, z: 0.22 + Math.random() * 0.38,
        vx: (Math.random() - 0.5) * 0.007, vy: (Math.random() - 0.5) * 0.007,
        vz: 0.010 + Math.random() * 0.016,
        life: Math.random(), bright: 0.5 + Math.random() * 0.5,
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this._combPoints = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.020, vertexColors: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.engineGroup.add(this._combPoints);
  }

  _updateCombustionParticles(dt) {
    if (!this._combPoints) return;
    const f = dt / 16;
    const pos = this._combPoints.geometry.attributes.position;
    const col = this._combPoints.geometry.attributes.color;
    this._combParts.forEach((p, i) => {
      p.life += 0.022 * f;
      if (p.life >= 1.0 || p.z > 0.72) {
        const a = Math.random() * Math.PI * 2, r = 0.10 + Math.random() * 0.13;
        p.x = Math.cos(a) * r; p.y = Math.sin(a) * r; p.z = 0.22 + Math.random() * 0.08;
        p.vx = (Math.random() - 0.5) * 0.007; p.vy = (Math.random() - 0.5) * 0.007;
        p.vz = 0.010 + Math.random() * 0.016; p.life = 0; p.bright = 0.5 + Math.random() * 0.5;
      }
      const a = Math.atan2(p.y, p.x) + 0.012 * f;
      const r = Math.sqrt(p.x * p.x + p.y * p.y);
      p.x = Math.cos(a) * r + p.vx * f;
      p.y = Math.sin(a) * r + p.vy * f;
      p.z += p.vz * f;
      const flk = p.bright * (0.7 + 0.3 * Math.sin(this.time * 0.014 + i * 0.5));
      col.setXYZ(i, flk, Math.max(0, flk * (0.4 - p.life * 0.3)), 0);
      pos.setXYZ(i, p.x, p.y, p.z);
    });
    pos.needsUpdate = true; col.needsUpdate = true;
    this._combPoints.material.opacity =
      Math.max(0, Math.min(1, (this.scrollProgress - 0.40) / 0.10)) * 0.88;
  }

  /* ═══════════════════════════════════════════════════
     EFFECT 4 — ANOMALY SCAN BEAMS
  ═══════════════════════════════════════════════════ */
  _buildScanBeams() {
    const mk = (color, z) => {
      const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.008, 48, 1, false);
      geo.rotateX(Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({
        color, emissive: new THREE.Color(color), emissiveIntensity: 4.0,
        transparent: true, opacity: 0, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.z = z;
      this.engineGroup.add(mesh);
      return { mesh, mat, baseZ: z };
    };
    this._scanEGT = mk(0xff2d78, 0.42);   /* critical — red   */
    this._scanBRG = mk(0xf59e0b, 1.30);   /* warning  — amber */
    this._scanVIB = mk(0x00d4ff, -0.55);  /* vibration — cyan */
  }

  _updateScanBeams() {
    const t = this.time, p = this.scrollProgress;
    if (this._scanEGT) {
      const vis = Math.max(0, Math.min(1, (p - 0.44) / 0.08)) *
                  Math.max(0, Math.min(1, (0.66 - p) / 0.06));
      this._scanEGT.mesh.position.z = this._scanEGT.baseZ + Math.sin(t * 0.0025) * 0.14;
      this._scanEGT.mat.opacity = vis * (0.14 + 0.06 * Math.sin(t * 0.005));
      this._scanEGT.mat.emissiveIntensity = 3.5 + Math.sin(t * 0.004) * 1.0;
    }
    if (this._scanBRG) {
      const vis = Math.max(0, Math.min(1, (p - 0.67) / 0.08));
      this._scanBRG.mesh.position.z = this._scanBRG.baseZ + Math.sin(t * 0.0022 + 1.5) * 0.11;
      this._scanBRG.mat.opacity = vis * (0.13 + 0.05 * Math.sin(t * 0.004));
      this._scanBRG.mat.emissiveIntensity = 3.0 + Math.sin(t * 0.0038) * 0.8;
    }
    if (this._scanVIB) {
      const vis = Math.max(0, Math.min(1, (p - 0.28) / 0.08)) *
                  Math.max(0, Math.min(1, (0.50 - p) / 0.06));
      this._scanVIB.mesh.position.z = this._scanVIB.baseZ + Math.sin(t * 0.003 + 0.8) * 0.18;
      this._scanVIB.mat.opacity = vis * (0.12 + 0.05 * Math.sin(t * 0.006));
      this._scanVIB.mat.emissiveIntensity = 3.2 + Math.sin(t * 0.005) * 0.9;
    }
  }

  /* ═══════════════════════════════════════════════════
     EFFECT 5 — HPC FOULING GRADIENT
  ═══════════════════════════════════════════════════ */
  _updateFouling() {
    if (!this.M.hpcFoul) return;
    const vis = Math.max(0, Math.min(1, (this.scrollProgress - 0.40) / 0.18));
    /* lerp: clean steel 0xbcc2c9 → fouled brown 0x6b4a28 */
    this.M.hpcFoul.color.setRGB(
      0.737 - vis * 0.317,
      0.761 - vis * 0.471,
      0.788 - vis * 0.628
    );
    this.M.hpcFoul.roughness = 0.26 + vis * 0.22;
  }

  /* ═══════════════════════════════════════════════════
     EFFECT 6 — SENSOR → HUD CONNECTOR LINES (SVG)
  ═══════════════════════════════════════════════════ */
  _buildHUDLines() {
    const vp  = this.canvas.parentElement;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'sensor-hud-lines';
    svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;overflow:visible;';
    vp.appendChild(svg);
    this._hudSVG   = svg;
    this._hudLines = {};
    this._sensors.forEach(s => {
      const ln  = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      const hex = '#' + new THREE.Color(s.color).getHexString();
      ln.setAttribute('stroke', hex);
      ln.setAttribute('stroke-width', '1');
      ln.setAttribute('stroke-dasharray', '3 3');
      ln.setAttribute('opacity', '0');
      svg.appendChild(ln);
      this._hudLines[s.id] = ln;
    });
  }

  _updateHUDLines() {
    if (!this._hudSVG || !this._sensors || !this._hudLines) return;
    const vis = Math.max(0, Math.min(1, (this.scrollProgress - 0.40) / 0.12));
    const W   = this.canvas.clientWidth, H = this.canvas.clientHeight;
    this._sensors.forEach(s => {
      const ln = this._hudLines[s.id];
      if (!ln) return;
      if (!s._el || s._el.style.display === 'none') { ln.setAttribute('opacity', '0'); return; }
      s._sphere.getWorldPosition(this._tmpV);
      this._tmpV.project(this.camera);
      if (this._tmpV.z >= 1) { ln.setAttribute('opacity', '0'); return; }
      const sx = (this._tmpV.x *  0.5 + 0.5) * W;
      const sy = (-this._tmpV.y * 0.5 + 0.5) * H;
      const ox = this._tmpV.x >= 0 ?  52 : -130;
      const oy = this._tmpV.y >= 0 ? -46 :    8;
      ln.setAttribute('x1', sx.toFixed(1));
      ln.setAttribute('y1', sy.toFixed(1));
      ln.setAttribute('x2', (sx + ox * 0.5).toFixed(1));
      ln.setAttribute('y2', (sy + oy * 0.5).toFixed(1));
      ln.setAttribute('opacity', (vis * 0.55).toFixed(2));
    });
  }

  /* ═══════════════════════════════════════════════════
     ANIMATION
  ═══════════════════════════════════════════════════ */
  start() {
    const tick = (ts) => {
      const dt = Math.min(ts - this.last, 50);
      this.last = ts;
      this._update(dt);
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() { if (this.raf) cancelAnimationFrame(this.raf); }

  _update(dt) {
    this.time += dt;
    const f = dt / 16;

    /* LP shaft ~3 600 RPM */
    this.fanAngle        += 0.010 * f;
    this.lpGroup.rotation.z = this.fanAngle;

    /* HP shaft ~9 500 RPM ≈ 2.6× LP */
    this.hpAngle         += 0.026 * f;
    this.hpGroup.rotation.z = this.hpAngle;

    /* combustor flicker */
    const flk = 0.78 + 0.22 * Math.sin(this.time * 0.0058) * Math.sin(this.time * 0.0097);
    if (this.combustorGlow)
      this.combustorGlow.material.emissiveIntensity = 1.8 + flk * 1.2;
    if (this.combustorLight)
      this.combustorLight.intensity = 7.0 * flk + 3.0;

    /* generator electric glow pulse */
    if (this.generatorLight) {
      const gf = 0.82 + 0.18 * Math.sin(this.time * 0.0044) * Math.sin(this.time * 0.0071);
      this.generatorLight.intensity = 3.5 * gf + 1.0;
    }
    if (this.termGlow) {
      this.termGlow.material.emissiveIntensity = 2.5 + 0.8 * Math.sin(this.time * 0.0053);
    }

    this._updateCamera();
    this._updateClipping();
    this._updateSensorMarkers(dt);
    this._updateSensorHUD();
    this._updateExhaustParticles(dt);
    this._updateIntakeVortex(dt);
    this._updateCombustionParticles(dt);
    this._updateScanBeams();
    this._updateFouling();
    this._updateHUDLines();
  }

  /* ─── Camera path — Solar Titan 350 style ──────── */
  /* Phase 0→0.20: wide side view of entire package  (inlet→turbine→gen)
     Phase 0.20→0.42: 3/4 orbit + zoom toward exposed turbine core
     Phase 0.42→0.65: close-up interior with cutaway  (compressor/combustor)
     Phase 0.65→1.00: drift right to reveal gearbox + 38 MW alternator */
  _updateCamera() {
    const p   = this.scrollProgress;
    /* Portrait scale-back factor on the camera's x/y distance. Mobile uses a
       much wider FOV (62° vs 42°), which makes everything look smaller — so:
         • WIDE (1.55) for the establishing shot + final reveal: pulled back
           far enough that the whole package fits a portrait screen.
         • NEAR (0.64) for the interior cutaway: pushed in CLOSER than desktop
           to cancel the wide FOV, so the opened engine actually fills the
           frame and you can see inside instead of a tiny distant tube.
       Continuous at every phase boundary. */
    let mob = 1.0;
    if (this._isMobile) {
      const WIDE = 1.55, NEAR = 0.46;
      if      (p < 0.20) mob = WIDE;
      else if (p < 0.42) mob = WIDE + (NEAR - WIDE) * ((p - 0.20) / 0.22);
      else if (p < 0.65) mob = NEAR;
      else               mob = NEAR + (WIDE - NEAR) * ((p - 0.65) / 0.35);
    }
    let tx, ty, tz, lx, ly, lz;

    if (p < 0.20) {
      /* Full package elevation side-view */
      const t = p / 0.20;
      tx = (9.5  - t * 1.2) * mob;
      ty = (4.8  - t * 0.8) * mob;
      tz = 0.0  + t * 1.5;
      lx = 0; ly = 0.60; lz = -0.5 + t * 0.8;
    } else if (p < 0.42) {
      /* Zoom to turbine core 3/4 view */
      const t = (p - 0.20) / 0.22;
      tx = (8.3  - t * 5.0) * mob;
      ty = (4.0  - t * 2.2) * mob;
      tz = 1.5  - t * 2.5;
      lx = 0; ly = 0.30 - t * 0.25; lz = 0.3 - t * 0.6;
    } else if (p < 0.65) {
      /* Interior cutaway close-up */
      const t = (p - 0.42) / 0.23;
      tx = (3.3  - t * 0.6) * mob;
      ty = (1.8  - t * 0.5) * mob;
      tz = -1.0 + t * 1.2;
      lx = 0; ly = 0.05; lz = -0.3 + t * 0.9;
    } else {
      /* Reveal gearbox + alternator */
      const t = (p - 0.65) / 0.35;
      tx = (2.7  + t * 6.5) * mob;
      ty = (1.3  + t * 2.0) * mob;
      tz = 0.2  + t * 5.0;
      lx = 0; ly = 0.20; lz = -0.3 + t * 4.9;
    }

    const k = 0.065;
    this._camPos.x  += (tx - this._camPos.x)  * k;
    this._camPos.y  += (ty - this._camPos.y)  * k;
    this._camPos.z  += (tz - this._camPos.z)  * k;
    this._camLook.x += (lx - this._camLook.x) * k;
    this._camLook.y += (ly - this._camLook.y) * k;
    this._camLook.z += (lz - this._camLook.z) * k;

    this.camera.position.copy(this._camPos);

    /* idle micro-drift — keeps the shot alive between scroll moves */
    const idle = this.time * 0.00042;
    this.camera.position.x += Math.sin(idle)       * 0.05;
    this.camera.position.y += Math.cos(idle * 1.3) * 0.035;

    this.camera.lookAt(this._camLook);
  }

  /* ─── Clipping ──────────────────────────────────── */
  /* Top-down Y cut reveals the turbine interior like a cutaway diagram.
     d=0.65 (intact) → d=-0.07 (top half removed, blades visible) */
  _updateClipping() {
    const p = this.scrollProgress;
    if (p < 0.32) { this.clipPlane.constant = 0.65; return; }
    const t = Math.min(1, (p - 0.32) / 0.26);
    this.clipPlane.constant = 0.65 - t * 0.74;   /* 0.65 → -0.09 */
  }
}

/* ── Bootstrap ───────────────────────────────────── */
let _engine3d = null;

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('engine-canvas');
  if (!canvas) return;

  if (typeof THREE !== 'undefined') {
    _engine3d = new TurbofanEngine3D('engine-canvas');
    _engine3d.start();
  } else {
    console.warn('[TurboFan] Three.js not loaded — 3D engine disabled');
  }

  const section = document.getElementById('turbofan-explore');
  const fill    = document.getElementById('explore-progress-fill');
  const label   = document.getElementById('stage-label');
  const hint    = document.getElementById('stage-hint');
  const panelL  = document.getElementById('panel-sensors');
  const panelR  = document.getElementById('panel-ai');

  const STAGES = [
    { p: 0.00, l: 'Solar Titan 350 · 38 MW',   h: 'Inlet silencer · gas turbine · alternator' },
    { p: 0.20, l: 'Gas Turbine Core',           h: '16-stage axial compressor · PR 24:1' },
    { p: 0.42, l: 'Cutaway Interior',           h: 'SoLoNOx combustor · HPT · power turbine' },
    { p: 0.65, l: 'Hot Section · EGT 490°C',   h: '2-stage gas gen turbine · 2-stage power turbine' },
    { p: 0.85, l: 'Generator · 38.1 MW Output', h: 'Synchronous alternator · exciter · load coupling' },
  ];

  if (typeof ScrollTrigger !== 'undefined') {
    const isMob = window.innerWidth < 769;
    ScrollTrigger.create({
      trigger:    section,
      start:      'top top',
      end:        'bottom bottom',
      pin:        isMob ? false : '.explore-sticky',
      pinSpacing: !isMob,
      scrub:      isMob ? 2.5 : 1.5,
      onUpdate(self) {
        const p = self.progress;
        if (_engine3d) _engine3d.scrollProgress = p;
        if (fill) fill.style.width = (p * 100) + '%';

        let cur = STAGES[0];
        STAGES.forEach(s => { if (p >= s.p) cur = s; });
        if (label) label.textContent = cur.l;
        if (hint)  hint.textContent  = cur.h;

        if (panelL) panelL.classList.toggle('visible', p > 0.42);
        if (panelR) panelR.classList.toggle('visible', p > 0.82);
      },
    });
  }
});
