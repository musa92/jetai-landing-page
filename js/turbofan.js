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

    /* smooth camera target — start from front intake approach */
    this._camPos  = new THREE.Vector3(0.05, 0.12, -4.8);
    this._camLook = new THREE.Vector3(0, 0, -0.8);
    /* reusable projection vector — avoids per-frame GC */
    this._tmpV    = new THREE.Vector3();

    this._initRenderer();
    this._initScene();
    this._initLights();
    this._buildEngine();
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
    this.scene.fog = new THREE.FogExp2(0x020810, 0.055);
  }

  /* ─── Lights ────────────────────────────────────── */
  _initLights() {
    /* sky/ground hemisphere */
    this.scene.add(new THREE.HemisphereLight(0x334466, 0x111122, 0.55));

    /* key light – upper left, warm white */
    const key = new THREE.DirectionalLight(0xfff8f0, 4.0);
    key.position.set(-4, 5, 2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
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
    const asp = el ? el.clientWidth / el.clientHeight : 16 / 9;
    this.camera = new THREE.PerspectiveCamera(42, asp, 0.05, 60);
    this.camera.position.copy(this._camPos);
    this.camera.lookAt(this._camLook);
  }

  _resize() {
    const el = this.canvas.parentElement;
    if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    this.renderer.setSize(w, h);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  /* ═══════════════════════════════════════════════════
     ENGINE GEOMETRY
  ═══════════════════════════════════════════════════ */
  _buildEngine() {
    /* clipping plane: plane normal (0,-1,0), constant=d
       clips everything above y = d
       d=0.65 → nothing clipped; d=-0.25 → top half removed */
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.65);

    /* ── material palette ── */
    this.M = {
      nacelle: new THREE.MeshStandardMaterial({
        color:             0x3c4e60,
        metalness:         0.88,
        roughness:         0.22,
        clippingPlanes:    [this.clipPlane],
        clipShadows:       true,
        side:              THREE.DoubleSide,
      }),
      nacelleInner: new THREE.MeshStandardMaterial({
        color:    0x121e2c,
        metalness: 0.7,
        roughness: 0.45,
        side:     THREE.BackSide,
      }),
      titaniumFan: new THREE.MeshStandardMaterial({
        color:     0x8ca0b4,
        metalness: 0.92,
        roughness: 0.14,
      }),
      nickelBlade: new THREE.MeshStandardMaterial({
        color:     0x5a6e82,
        metalness: 0.90,
        roughness: 0.20,
      }),
      hotBlade: new THREE.MeshStandardMaterial({
        color:             0x7a4010,
        metalness:         0.82,
        roughness:         0.28,
        emissive:          new THREE.Color(0x280800),
        emissiveIntensity: 0.4,
      }),
      disc: new THREE.MeshStandardMaterial({
        color:     0x3a4e60,
        metalness: 0.90,
        roughness: 0.25,
      }),
      steelShaft: new THREE.MeshStandardMaterial({
        color:     0x445566,
        metalness: 0.95,
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
        clippingPlanes:    [this.clipPlane],
        clipShadows:       true,
        side:              THREE.DoubleSide,
      }),
      darkMetal: new THREE.MeshStandardMaterial({
        color:     0x1c2a38,
        metalness: 0.85,
        roughness: 0.35,
      }),
      ogvVane: new THREE.MeshStandardMaterial({
        color:     0x6a7e92,
        metalness: 0.88,
        roughness: 0.22,
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
    };

    /* LP spool (fan + LPC + LPT + spinner + plug) */
    this.lpGroup = new THREE.Group();
    /* HP spool (HPC + HPT) */
    this.hpGroup = new THREE.Group();

    this.engineGroup = new THREE.Group();
    this.engineGroup.add(this.lpGroup);
    this.engineGroup.add(this.hpGroup);

    this._buildNacelle();
    this._buildSpinner();
    this._buildFan();
    this._buildOGV();
    this._buildCoreShaft();
    this._buildLPC();
    this._buildHPC();
    this._buildCombustor();
    this._buildHPT();
    this._buildLPT();
    this._buildExhaust();
    this._buildGenerator();

    /* slight yaw so we see the 3/4 view at start */
    this.engineGroup.rotation.y = 0.12;

    /* sensor markers added after geometry, before scene add */
    this._buildSensorMarkers();

    this.scene.add(this.engineGroup);
  }

  /* ─── Nacelle ───────────────────────────────────── */
  _buildNacelle() {
    /* LatheGeometry profile: Vector2(radius, y-along-engine)
       after rotateX(PI/2): y-axis → z-axis (forward = positive z) */
    /* Power-turbine nacelle: smooth bullet capsule, wide enough to
       fully enclose all fan/compressor stages (max r=0.575 at mid) */
    const outerPts = [
      [0.01, -2.00], [0.09, -1.90], [0.24, -1.72],
      [0.40, -1.46], [0.51, -1.14], [0.548,-0.76],
      [0.568,-0.34], [0.575, 0.12], [0.562, 0.58],
      [0.540, 0.98], [0.500, 1.36], [0.420, 1.62],
      [0.280, 1.84], [0.100, 1.96], [0.010, 2.02],
    ].map(([r, z]) => new THREE.Vector2(r, z));

    const innerPts = outerPts.slice(3, -3).map(v =>
      new THREE.Vector2(v.x * 0.945, v.y)
    );

    const makeLathe = (pts, seg) => {
      const g = new THREE.LatheGeometry(pts, seg);
      g.rotateX(Math.PI / 2);
      return g;
    };

    const outer = new THREE.Mesh(makeLathe(outerPts, 96), this.M.nacelle);
    const inner = new THREE.Mesh(makeLathe(innerPts, 64), this.M.nacelleInner);
    this.engineGroup.add(outer);
    this.engineGroup.add(inner);
    this.nacelleMesh = outer;
  }

  /* ─── Spinner cone ──────────────────────────────── */
  _buildSpinner() {
    /* Ogive nose cone — sits deep inside the widened intake */
    const g = new THREE.ConeGeometry(0.10, 0.52, 36);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -1.72);
    const cap = new THREE.Mesh(g, this.M.steelShaft);
    this.lpGroup.add(cap);

    /* spinner back disc */
    const disc = new THREE.Mesh(
      (() => { const dg = new THREE.CylinderGeometry(0.10,0.10,0.035,32); dg.rotateX(Math.PI/2); return dg; })(),
      this.M.disc
    );
    disc.position.z = -1.46;
    this.lpGroup.add(disc);
  }

  /* ─── Fan ───────────────────────────────────────── */
  _buildFan() {
    /* FAN_Z=-0.88: nacelle inner radius here ≈0.538 — fan tip (0.455) safely inside */
    const FAN_Z    = -0.88;
    const N        = 18;
    const HUB_R    = 0.102;
    const TIP_R    = 0.455;
    const SPAN     = TIP_R - HUB_R;
    const CHORD    = 0.060;  /* blade chord */
    const THICK    = 0.012;  /* blade thickness */
    const PITCH    = 0.28;   /* leading-edge pitch angle (rad) */
    const SWEEP    = 0.22;   /* leading-edge sweep (rad, toward tip) */

    /* hub disc */
    const hubGeom = new THREE.CylinderGeometry(HUB_R, HUB_R, 0.065, 36);
    hubGeom.rotateX(Math.PI / 2);
    const hub = new THREE.Mesh(hubGeom, this.M.disc);
    hub.position.z = FAN_Z;
    this.lpGroup.add(hub);

    /* fan blades — each uses a tapered box with pitch and sweep */
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2;

      /* Build a "blade" as a thin tapered box geometry with 4 segments
         so the normals catch light nicely */
      const bladeGeom = new THREE.BoxGeometry(CHORD, SPAN, THICK, 1, 4, 1);

      /* sweep: shear the top vertices forward (along z) */
      const pos = bladeGeom.attributes.position;
      for (let vi = 0; vi < pos.count; vi++) {
        const localY = pos.getY(vi);
        const t      = (localY / (SPAN / 2) + 1) / 2;   /* 0=hub, 1=tip */
        pos.setZ(vi, pos.getZ(vi) + t * SWEEP * SPAN);
        /* taper chord toward tip */
        pos.setX(vi, pos.getX(vi) * (1 - t * 0.35));
      }
      pos.needsUpdate = true;
      bladeGeom.computeVertexNormals();

      /* pivot group: spin angle around engine Z */
      const pivot = new THREE.Group();
      pivot.rotation.z = angle;
      pivot.position.z = FAN_Z;

      /* blade mesh: offset to hub radius, pitch rotation */
      const blade = new THREE.Mesh(bladeGeom, this.M.titaniumFan);
      blade.position.y = HUB_R + SPAN / 2;
      blade.rotation.z = PITCH;

      pivot.add(blade);
      this.lpGroup.add(pivot);
    }

    /* outer tip shroud ring */
    const shroud = new THREE.Mesh(
      (() => { const tg = new THREE.TorusGeometry(TIP_R + 0.008, 0.006, 12, 80); tg.rotateX(Math.PI/2); return tg; })(),
      this.M.darkMetal
    );
    shroud.position.z = FAN_Z;
    this.engineGroup.add(shroud);
  }

  /* ─── Outlet Guide Vanes (static, after fan) ────── */
  _buildOGV() {
    const OGV_Z = -0.90;
    const N     = 28;
    const HUB   = 0.105;
    const TIP   = 0.455;

    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2;
      const vaneGeom = new THREE.BoxGeometry(0.006, TIP - HUB, 0.042);

      const pivot = new THREE.Group();
      pivot.rotation.z = angle;
      pivot.position.z = OGV_Z;

      const vane = new THREE.Mesh(vaneGeom, this.M.ogvVane);
      vane.position.y  = HUB + (TIP - HUB) / 2;
      vane.rotation.z  = 0.28;
      pivot.add(vane);
      this.engineGroup.add(pivot);
    }
  }

  /* ─── Core shaft tube ───────────────────────────── */
  _buildCoreShaft() {
    const sg = new THREE.CylinderGeometry(0.095, 0.095, 3.6, 28);
    sg.rotateX(Math.PI / 2);
    const shaft = new THREE.Mesh(sg, this.M.steelShaft);
    shaft.position.z = 0.18;
    this.engineGroup.add(shaft);
  }

  /* ─── Generic stage builder ─────────────────────── */
  _buildStage(group, material, { z, hubR, tipR, n, chord, thick, pitch }) {
    /* hub disc */
    const dg = new THREE.CylinderGeometry(hubR * 0.96, hubR * 0.96, 0.030, 24);
    dg.rotateX(Math.PI / 2);
    const disc = new THREE.Mesh(dg, this.M.disc);
    disc.position.z = z;
    group.add(disc);

    /* blades */
    const span   = tipR - hubR;
    const midChord = chord || 0.022;
    const t      = thick  || 0.005;

    for (let i = 0; i < n; i++) {
      const angle    = (i / n) * Math.PI * 2;
      const bladeGeom = new THREE.BoxGeometry(midChord, span, t, 1, 2, 1);

      /* slight pitch taper toward tip */
      const pos = bladeGeom.attributes.position;
      for (let vi = 0; vi < pos.count; vi++) {
        const localY = pos.getY(vi);
        const tt     = (localY / (span / 2) + 1) / 2;
        pos.setX(vi, pos.getX(vi) * (1 - tt * 0.25));
      }
      pos.needsUpdate = true;
      bladeGeom.computeVertexNormals();

      const pivot = new THREE.Group();
      pivot.rotation.z = angle;
      pivot.position.z = z;

      const blade = new THREE.Mesh(bladeGeom, material);
      blade.position.y = hubR + span / 2;
      blade.rotation.z = pitch || 0.25;
      pivot.add(blade);
      group.add(pivot);
    }
  }

  /* ─── LPC (3 stages, LP spool) ──────────────────── */
  _buildLPC() {
    [
      { z: -0.78, hubR: 0.096, tipR: 0.320, n: 20, chord: 0.028, pitch: 0.30 },
      { z: -0.64, hubR: 0.100, tipR: 0.295, n: 24, chord: 0.025, pitch: 0.28 },
      { z: -0.50, hubR: 0.104, tipR: 0.272, n: 26, chord: 0.022, pitch: 0.26 },
    ].forEach(s => this._buildStage(this.lpGroup, this.M.nickelBlade, s));

    /* LPC stator rings */
    [-0.71, -0.57].forEach(z => this._buildStatorRing(z, 0.104, 0.27, 18, this.M.ogvVane));
  }

  /* ─── HPC (6 stages, HP spool) ──────────────────── */
  _buildHPC() {
    [
      { z: -0.34, hubR: 0.106, tipR: 0.240, n: 28, chord: 0.020, pitch: 0.24 },
      { z: -0.23, hubR: 0.108, tipR: 0.225, n: 30, chord: 0.018, pitch: 0.22 },
      { z: -0.12, hubR: 0.110, tipR: 0.210, n: 30, chord: 0.017, pitch: 0.20 },
      { z:  0.00, hubR: 0.112, tipR: 0.200, n: 32, chord: 0.016, pitch: 0.19 },
      { z:  0.12, hubR: 0.113, tipR: 0.195, n: 32, chord: 0.015, pitch: 0.18 },
      { z:  0.24, hubR: 0.115, tipR: 0.190, n: 34, chord: 0.014, pitch: 0.17 },
    ].forEach(s => this._buildStage(this.hpGroup, this.M.nickelBlade, s));

    /* HPC stator rings */
    [-0.28, -0.17, -0.06, 0.06, 0.18].forEach(z =>
      this._buildStatorRing(z, 0.115, 0.19, 22, this.M.ogvVane)
    );
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

  /* ─── HPT (2 stages, HP spool) ──────────────────── */
  _buildHPT() {
    [
      { z: 0.72, hubR: 0.115, tipR: 0.26, n: 24, chord: 0.026, pitch: 0.30 },
      { z: 0.86, hubR: 0.112, tipR: 0.28, n: 22, chord: 0.028, pitch: 0.28 },
    ].forEach(s => this._buildStage(this.hpGroup, this.M.hotBlade, s));

    this._buildStatorRing(0.79, 0.113, 0.27, 18, this.M.hotBlade);
  }

  /* ─── LPT (4 stages, LP spool) ──────────────────── */
  _buildLPT() {
    [
      { z: 1.02, hubR: 0.110, tipR: 0.31, n: 20, chord: 0.032, pitch: 0.32 },
      { z: 1.16, hubR: 0.106, tipR: 0.33, n: 18, chord: 0.034, pitch: 0.30 },
      { z: 1.30, hubR: 0.102, tipR: 0.35, n: 18, chord: 0.036, pitch: 0.29 },
      { z: 1.44, hubR: 0.098, tipR: 0.37, n: 16, chord: 0.038, pitch: 0.27 },
    ].forEach(s => this._buildStage(this.lpGroup, this.M.hotBlade, s));

    [1.09, 1.23, 1.37].forEach(z =>
      this._buildStatorRing(z, 0.104, 0.34, 16, this.M.hotBlade)
    );
  }

  /* ─── Exhaust ───────────────────────────────────── */
  _buildExhaust() {
    /* exhaust duct / nozzle */
    const eg = new THREE.CylinderGeometry(0.28, 0.20, 0.50, 36, 1, true);
    eg.rotateX(Math.PI / 2);
    const duct = new THREE.Mesh(eg, this.M.exhaust);
    duct.position.z = 1.70;
    this.engineGroup.add(duct);

    /* exhaust plug bullet — on LP shaft */
    const pg = new THREE.ConeGeometry(0.08, 0.40, 28);
    pg.rotateX(Math.PI / 2);
    const plug = new THREE.Mesh(pg, this.M.steelShaft);
    plug.position.z = 1.65;
    this.lpGroup.add(plug);
  }

  /* ═══════════════════════════════════════════════════
     ELECTRIC GENERATOR MODULE
     Couples to LP power-turbine shaft — industrial
     alternator style (salient poles, stator windings,
     cooling fins, glowing power output terminal)
  ═══════════════════════════════════════════════════ */
  _buildGenerator() {
    const GZ  = 2.95;   /* generator center Z (behind exhaust) */
    const GR  = 0.34;   /* outer casing radius */
    const GL  = 1.85;   /* generator length */

    /* ── Transition / coupling bell ── */
    const bellG = new THREE.CylinderGeometry(0.20, GR * 0.90, 0.32, 36, 1, true);
    bellG.rotateX(Math.PI / 2);
    const bell = new THREE.Mesh(bellG, this.M.darkMetal);
    bell.position.z = GZ - GL / 2 - 0.16;
    this.engineGroup.add(bell);

    /* coupling ring flange */
    const flangeG = new THREE.TorusGeometry(GR * 0.88, 0.022, 8, 40);
    flangeG.rotateX(Math.PI / 2);
    const flange = new THREE.Mesh(flangeG, this.M.disc);
    flange.position.z = GZ - GL / 2;
    this.engineGroup.add(flange);

    /* ── Main casing (smooth steel cylinder) ── */
    const casingG = new THREE.CylinderGeometry(GR, GR, GL, 56, 1, true);
    casingG.rotateX(Math.PI / 2);
    this.genCasing = new THREE.Mesh(casingG, this.M.genBody);
    this.genCasing.position.z = GZ;
    this.engineGroup.add(this.genCasing);

    /* end caps */
    [-GL / 2, GL / 2].forEach(dz => {
      const capG = new THREE.CylinderGeometry(GR, GR, 0.045, 48);
      capG.rotateX(Math.PI / 2);
      const cap = new THREE.Mesh(capG, this.M.disc);
      cap.position.z = GZ + dz + (dz > 0 ? -0.022 : 0.022);
      this.engineGroup.add(cap);
    });

    /* ── Axial cooling fins (36 radial blades along casing) ── */
    const FIN_N = 36;
    for (let i = 0; i < FIN_N; i++) {
      const a     = (i / FIN_N) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.rotation.z = a;
      pivot.position.z = GZ;
      const finG = new THREE.BoxGeometry(0.006, 0.028, GL * 0.90);
      const fin  = new THREE.Mesh(finG, this.M.disc);
      fin.position.y = GR + 0.014;
      pivot.add(fin);
      this.engineGroup.add(pivot);
    }

    /* ── Stator winding rings (copper coils, 12 evenly spaced) ── */
    const COIL_N = 12;
    for (let i = 0; i < COIL_N; i++) {
      const z     = GZ - GL * 0.43 + i * (GL * 0.86 / (COIL_N - 1));
      const coilG = new THREE.TorusGeometry(GR * 0.70, 0.015, 8, 40);
      coilG.rotateX(Math.PI / 2);
      const coil  = new THREE.Mesh(coilG, this.M.copper);
      coil.position.z = z;
      this.engineGroup.add(coil);
    }

    /* ── Rotor (spins with LP spool) ── */
    const rotorG = new THREE.CylinderGeometry(0.155, 0.155, GL * 0.92, 28);
    rotorG.rotateX(Math.PI / 2);
    this.generatorRotor = new THREE.Mesh(rotorG, this.M.steelShaft);
    this.generatorRotor.position.z = GZ;
    this.lpGroup.add(this.generatorRotor);

    /* 4 salient pole pieces on rotor (copper, spin with LP) */
    for (let i = 0; i < 4; i++) {
      const a    = (i / 4) * Math.PI * 2;
      const poleG = new THREE.BoxGeometry(0.058, 0.062, GL * 0.88);
      const pole  = new THREE.Mesh(poleG, this.M.copper);
      pole.position.set(Math.cos(a) * 0.175, Math.sin(a) * 0.175, GZ);
      pole.rotation.z = a;
      this.lpGroup.add(pole);
    }

    /* ── Drive coupling shaft (between engine exhaust and generator) ── */
    const shaftG = new THREE.CylinderGeometry(0.065, 0.065, 0.62, 20);
    shaftG.rotateX(Math.PI / 2);
    const shaft  = new THREE.Mesh(shaftG, this.M.steelShaft);
    shaft.position.z = GZ - GL / 2 - 0.31 - 0.02;
    this.lpGroup.add(shaft);

    /* ── Terminal box + power output glow ── */
    const boxG  = new THREE.BoxGeometry(0.16, 0.11, 0.14);
    const box   = new THREE.Mesh(boxG, this.M.darkMetal);
    box.position.set(0, GR + 0.055, GZ + GL * 0.22);
    this.engineGroup.add(box);

    /* cyan terminal bushing */
    const bushG = new THREE.CylinderGeometry(0.025, 0.025, 0.08, 12);
    const bushMat = new THREE.MeshStandardMaterial({
      color: 0x00d4ff, emissive: new THREE.Color(0x00aaff),
      emissiveIntensity: 2.5, metalness: 0.2, roughness: 0.5,
    });
    [-0.04, 0, 0.04].forEach(ox => {
      const bush = new THREE.Mesh(bushG, bushMat);
      bush.position.set(ox, GR + 0.11 + 0.04, GZ + GL * 0.22);
      this.engineGroup.add(bush);
    });

    /* glowing output orb */
    const orbG   = new THREE.SphereGeometry(0.05, 14, 10);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0x00d4ff, emissive: new THREE.Color(0x00d4ff),
      emissiveIntensity: 3.0, transparent: true, opacity: 0.80,
      depthWrite: false,
    });
    this.termGlow = new THREE.Mesh(orbG, orbMat);
    this.termGlow.position.set(0, GR + 0.21, GZ + GL * 0.22);
    this.engineGroup.add(this.termGlow);

    /* ── Generator point lights ── */
    this.generatorLight = new THREE.PointLight(0x00d4ff, 4.5, 2.8);
    this.generatorLight.position.set(0, GR + 0.22, GZ + GL * 0.22);
    this.engineGroup.add(this.generatorLight);

    /* warm amber light from copper windings */
    const coilLight = new THREE.PointLight(0xff8800, 1.2, 1.6);
    coilLight.position.set(0, 0, GZ);
    this.engineGroup.add(coilLight);

    /* ── Output shaft stub ── */
    const outG   = new THREE.CylinderGeometry(0.07, 0.07, 0.28, 20);
    outG.rotateX(Math.PI / 2);
    const outShaft = new THREE.Mesh(outG, this.M.steelShaft);
    outShaft.position.z = GZ + GL / 2 + 0.14;
    this.lpGroup.add(outShaft);
  }

  /* ═══════════════════════════════════════════════════
     SENSOR NODES + HUD
     Each sensor: emissive sphere + billboard ring pulses
     + screen-space CSS label with live telemetry values
  ═══════════════════════════════════════════════════ */
  _buildSensorMarkers() {
    /* Severity palette */
    const C = { N: 0x00d4ff, W: 0xf59e0b, A: 0xef4444, O: 0xff6b00 };

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
        color: C.N,  pos: [0, 0.42, 2.95],
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

    /* Fade the whole HUD in once interior is revealed (after nacelle cuts open) */
    const vis = Math.max(0, Math.min(1, (this.scrollProgress - 0.32) / 0.15));
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
  }

  /* ─── Camera path ───────────────────────────────── */
  /* Phase 0→0.20 : head-on intake approach (fly into the fan)
     Phase 0.20→0.42: arc to side, revealing fan & compressors
     Phase 0.42→0.65: combustor zone side view
     Phase 0.65→1.00: pull back to reveal full engine + generator */
  _updateCamera() {
    const p = this.scrollProgress;
    let tx, ty, tz, lx, ly, lz;

    if (p < 0.20) {
      /* Approach dead-ahead into the intake */
      const t = p / 0.20;
      tx =  0.05;
      ty =  0.12 - t * 0.04;
      tz = -4.8  + t * 3.0;   /* -4.8 → -1.8 */
      lx = 0; ly = 0; lz = -0.8 + t * 0.6;
    } else if (p < 0.42) {
      /* Arc to side: see fan blades & compressor interior */
      const t = (p - 0.20) / 0.22;
      tx =  0.05 + t * 2.15;
      ty =  0.08 + t * 1.42;
      tz = -1.80 + t * 1.50;  /* -1.8 → -0.3 */
      lx = 0; ly = 0; lz = -0.2 + t * 0.55;
    } else if (p < 0.65) {
      /* Combustor side view */
      const t = (p - 0.42) / 0.23;
      tx =  2.20 - t * 0.40;
      ty =  1.50 + t * 0.10;
      tz = -0.30 + t * 1.60;  /* -0.3 → 1.3 */
      lx = 0; ly = 0; lz = 0.35 + t * 0.75;
    } else {
      /* Pull back wide — reveal engine + generator together */
      const t = (p - 0.65) / 0.35;
      tx =  1.80 + t * 2.40;
      ty =  1.60 + t * 0.90;
      tz =  1.30 + t * 3.20;  /* 1.3 → 4.5 (behind generator) */
      lx = 0; ly = 0.05; lz = 1.10 + t * 1.90;  /* look toward generator */
    }

    const k = 0.065;
    this._camPos.x  += (tx - this._camPos.x)  * k;
    this._camPos.y  += (ty - this._camPos.y)  * k;
    this._camPos.z  += (tz - this._camPos.z)  * k;
    this._camLook.x += (lx - this._camLook.x) * k;
    this._camLook.y += (ly - this._camLook.y) * k;
    this._camLook.z += (lz - this._camLook.z) * k;

    this.camera.position.copy(this._camPos);
    this.camera.lookAt(this._camLook);
  }

  /* ─── Clipping ──────────────────────────────────── */
  _updateClipping() {
    const p = this.scrollProgress;
    let d;
    if (p < 0.08) {
      d = 0.65;
    } else {
      const t = Math.min(1, (p - 0.08) / 0.30);
      d = 0.65 - t * 0.92;  /* 0.65 → -0.27 */
    }
    this.clipPlane.constant = d;
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
    { p: 0.00, l: 'Intake Approach',         h: 'Fly into the engine front' },
    { p: 0.20, l: 'Entering the Engine',     h: 'Nacelle cutaway revealing' },
    { p: 0.42, l: 'Fan & Compressor Stages', h: '18 titanium fan blades · dual LP/HP spool' },
    { p: 0.65, l: 'Combustion Chamber',      h: 'Fuel injectors · EGT sensors active' },
    { p: 0.82, l: 'Generator Module',        h: 'Power turbine driving the alternator' },
  ];

  if (typeof ScrollTrigger !== 'undefined') {
    ScrollTrigger.create({
      trigger:    section,
      start:      'top top',
      end:        'bottom bottom',
      pin:        '.explore-sticky',
      pinSpacing: false,
      scrub:      1.5,
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
