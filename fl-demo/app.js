(() => {
  const els = {
    cohort: document.getElementById("ctl-cohort"),
    k: document.getElementById("ctl-k"),
    valK: document.getElementById("val-k"),
    cohortStatus: document.getElementById("cohort-status"),
    model: document.getElementById("ctl-model"),
    modelFile: document.getElementById("model-file-input"),
    modelError: document.getElementById("model-error"),
    epochs: document.getElementById("ctl-epochs"),
    clip: document.getElementById("ctl-clip"),
    noise: document.getElementById("ctl-noise"),
    valEpochs: document.getElementById("val-epochs"),
    valClip: document.getElementById("val-clip"),
    valNoise: document.getElementById("val-noise"),
    snrHint: document.getElementById("snr-hint"),
    start: document.getElementById("btn-start"),
    reset: document.getElementById("btn-reset"),
    btnSaveModel: document.getElementById("btn-save-model"),
    saveStatus: document.getElementById("save-status"),
    svg: document.getElementById("network-svg"),
    chart: document.getElementById("chart-canvas"),
    roundCounter: document.getElementById("round-counter"),
    federationCount: document.getElementById("federation-count"),
    epsilonReadout: document.getElementById("epsilon-readout"),
    epsilonFill: document.getElementById("epsilon-fill"),
    clientsGrid: document.getElementById("clients-grid"),
    liveDot: document.getElementById("live-dot"),
    navBadgeText: document.getElementById("nav-badge-text"),

    modeSwitch: document.getElementById("mode-switch"),
    modeThumb: document.getElementById("mode-thumb"),
    modeBtns: Array.from(document.querySelectorAll(".mode-btn")),
    modeTrain: document.getElementById("mode-train"),
    modeEval: document.getElementById("mode-eval"),
    modeDeploy: document.getElementById("mode-deploy"),
    modeInference: document.getElementById("mode-inference"),
    modeRuns: document.getElementById("mode-runs"),
    pipelineRail: document.getElementById("pipeline-rail"),
    pipelineStatus: document.getElementById("pipeline-status"),
    btnRunPipeline: document.getElementById("btn-run-pipeline"),
    runsTable: document.getElementById("runs-table"),
    runsCount: document.getElementById("runs-count"),
    btnClearRuns: document.getElementById("btn-clear-runs"),

    evalVerdict: document.getElementById("eval-verdict"),
    evalMae: document.getElementById("eval-mae"),
    evalRmse: document.getElementById("eval-rmse"),
    evalLoss: document.getElementById("eval-loss"),
    evalCycles: document.getElementById("eval-cycles"),
    evalBaseline: document.getElementById("eval-baseline"),
    evalRounds: document.getElementById("eval-rounds"),
    evalAuc: document.getElementById("eval-auc"),
    evalNdcg: document.getElementById("eval-ndcg"),
    evalMrr: document.getElementById("eval-mrr"),
    evalEce: document.getElementById("eval-ece"),
    rankLabelNote: document.getElementById("rank-label-note"),
    evalCalibrationCanvas: document.getElementById("eval-calibration-canvas"),
    evalNote: document.getElementById("eval-note"),
    evalScatterCanvas: document.getElementById("eval-scatter-canvas"),
    evalBucketRows: document.getElementById("eval-bucket-rows"),
    btnRunEval: document.getElementById("btn-run-eval"),
    evalModelSelect: document.getElementById("eval-model-select"),

    computeBackend: document.getElementById("compute-backend"),
    computeRoundTime: document.getElementById("compute-round-time"),
    computeThroughput: document.getElementById("compute-throughput"),
    computeMemory: document.getElementById("compute-memory"),
    computeCoverage: document.getElementById("compute-coverage"),

    epsilonChartCanvas: document.getElementById("epsilon-chart-canvas"),
    latencyChartCanvas: document.getElementById("latency-chart-canvas"),
    latencyCurrent: document.getElementById("latency-current"),
    cliprateChartCanvas: document.getElementById("cliprate-chart-canvas"),
    cliprateCurrent: document.getElementById("cliprate-current"),
    cliprateNote: document.getElementById("cliprate-note"),
    lossdivChartCanvas: document.getElementById("lossdiv-chart-canvas"),
    lossdivCurrent: document.getElementById("lossdiv-current"),
    normdistChartCanvas: document.getElementById("normdist-chart-canvas"),
    normdistCurrent: document.getElementById("normdist-current"),
    normdistNote: document.getElementById("normdist-note"),
    throughputChartCanvas: document.getElementById("throughput-chart-canvas"),
    throughputCurrent: document.getElementById("throughput-current"),
    devicemixRows: document.getElementById("devicemix-rows"),
    devicemixCurrent: document.getElementById("devicemix-current"),

    deployArch: document.getElementById("deploy-arch"),
    deployRounds: document.getElementById("deploy-rounds"),
    deployParams: document.getElementById("deploy-params"),
    deployMae: document.getElementById("deploy-mae"),
    deployEps: document.getElementById("deploy-eps"),
    deploySize: document.getElementById("deploy-size"),
    deployModelSelect: document.getElementById("deploy-model-select"),
    deployTarget: document.getElementById("deploy-target"),
    deployStatus: document.getElementById("deploy-status"),
    deployProgress: document.getElementById("deploy-progress"),
    deployProgressFill: document.getElementById("deploy-progress-fill"),
    rolloutRows: document.getElementById("rollout-rows"),
    btnDeploy: document.getElementById("btn-deploy"),
    btnBenchmark: document.getElementById("btn-benchmark"),
    benchTable: document.getElementById("bench-table"),
    btnCompress: document.getElementById("btn-compress"),
    cfgFramework: document.getElementById("cfg-framework"),
    cfgStrategy: document.getElementById("cfg-strategy"),
    cfgWorld: document.getElementById("cfg-world"),
    cfgPrecision: document.getElementById("cfg-precision"),
    cfgReadout: document.getElementById("cfg-readout"),
    cfgCommand: document.getElementById("cfg-command"),
    compressTable: document.getElementById("compress-table"),
    adapterRank: document.getElementById("adapter-rank"),
    adapterCohort: document.getElementById("adapter-cohort"),
    btnLora: document.getElementById("btn-lora"),
    btnQlora: document.getElementById("btn-qlora"),

    inferencePanel: document.querySelector(".inference-panel"),
    rulRingFg: document.getElementById("rul-ring-fg"),
    rulValue: document.getElementById("rul-value"),
    rulDetail: document.getElementById("rul-detail"),
    sensorGrid: document.getElementById("sensor-grid"),
    inferenceLatency: document.getElementById("inference-latency"),
    mapsPins: document.getElementById("maps-pins"),
    mapsPlaceList: document.getElementById("maps-place-list"),
    mapsSheetTitle: document.getElementById("maps-sheet-title"),
    injectSteps: document.getElementById("inject-steps"),
    auctionCard: document.getElementById("auction-card"),
    auctionTable: document.getElementById("auction-table"),
    auctionClearing: document.getElementById("auction-clearing"),
    placeCard: document.getElementById("place-card"),
    reportCard: document.getElementById("report-card"),
    reportPipe: document.getElementById("report-pipe"),
    reportTable: document.getElementById("report-table"),
    reportStat: document.getElementById("report-stat"),
    reportNote: document.getElementById("report-note"),
    btnTraffic: document.getElementById("btn-traffic"),
    mapsSearchInput: document.getElementById("maps-search-input"),
    btnRandomize: document.getElementById("btn-randomize"),
    btnPersonalize: document.getElementById("btn-personalize"),
    personalizeStats: document.getElementById("personalize-stats"),
    secureAgg: document.getElementById("ctl-secure-agg"),
    dropout: document.getElementById("ctl-dropout"),
    valDropout: document.getElementById("val-dropout"),
    dropoutChartCanvas: document.getElementById("dropout-chart-canvas"),
    dropoutCurrent: document.getElementById("dropout-current"),
    dropoutNote: document.getElementById("dropout-note"),
    preddistChartCanvas: document.getElementById("preddist-chart-canvas"),
    preddistCurrent: document.getElementById("preddist-current"),
    preddistNote: document.getElementById("preddist-note"),
    budgetChartCanvas: document.getElementById("budget-chart-canvas"),
    budgetCurrent: document.getElementById("budget-current"),
    budgetNote: document.getElementById("budget-note"),

    statLoss: document.getElementById("stat-loss"),
    statCycles: document.getElementById("stat-cycles"),
    terminalBody: document.getElementById("terminal-body"),
    terminalPoll: document.getElementById("terminal-poll"),
    terminalPanel: document.getElementById("terminal-panel"),
    termSuggest: document.getElementById("term-suggest"),
    terminalExpandBtn: document.getElementById("terminal-expand-btn"),
    terminalExpandIcon: document.querySelector(".terminal-expand-icon"),
    terminalExpandLabel: document.querySelector(".terminal-expand-label"),
    terminalInput: document.getElementById("terminal-input"),
    terminalPanel: document.getElementById("terminal-panel"),
    terminalDragHandle: document.getElementById("terminal-drag-handle"),

    codeToggle: document.getElementById("code-toggle"),
    codePanel: document.getElementById("code-panel"),
    codeBackdrop: document.getElementById("code-backdrop"),
    codeClose: document.getElementById("code-close"),
    heroProof: document.getElementById("hero-proof"),
    proofMae: document.getElementById("proof-mae"),
    proofAuc: document.getElementById("proof-auc"),
    proofEps: document.getElementById("proof-eps"),
    proofDevices: document.getElementById("proof-devices"),
    proofBackend: document.getElementById("proof-backend"),
    sbDot: document.getElementById("sb-dot"),
    sbStateText: document.getElementById("sb-state-text"),
    sbModel: document.getElementById("sb-model"),
    sbRound: document.getElementById("sb-round"),
    sbEps: document.getElementById("sb-eps"),
    sbTensors: document.getElementById("sb-tensors"),
    sbBackend: document.getElementById("sb-backend"),
    palette: document.getElementById("palette"),
    paletteBackdrop: document.getElementById("palette-backdrop"),
    paletteInput: document.getElementById("palette-input"),
    paletteResults: document.getElementById("palette-results"),
    codeSidebar: document.getElementById("code-sidebar"),
    codePanelPath: document.getElementById("code-panel-path"),
    codePanelMeta: document.getElementById("code-panel-meta"),
    codeViewCode: document.getElementById("code-view-code"),
  };

  const SVG_NS = "http://www.w3.org/2000/svg";
  const CENTER = { x: 180, y: 130 };
  const RADIUS = 96;
  const MAX_ROUNDS = 60;
  const RING_CIRCUMFERENCE = 326.7;

  let trainer = null;
  let modelSpec = null;
  // The model actually deployed to devices (set by runDeployRollout()), not
  // just whatever's live-training. Inference/Maps gate on this, not on
  // trainer.round, so a checkpoint deployed with zero live training this
  // session still lights up the playground.
  let deployedTarget = null;
  let lastInferenceMeta = null;
  let lastAuction = null;
  let lastSignalRow = null;
  let lastSignalY = null;
  let sessionSeed = Math.floor(Math.random() * 1e9);
  let running = false;
  let stopRequested = false;
  let roundLatencyHistory = [];
  let dropoutHistory = [];
  let touchedFleets = new Set();

  function fmt(n, d = 3) {
    return Number.isFinite(n) ? n.toFixed(d) : "∞";
  }
  function fmtInt(n) {
    return n.toLocaleString("en-US");
  }

  function currentCohort() {
    return COHORTS.find((c) => c.id === els.cohort.value) || COHORTS[0];
  }

  // ---------- ambient hero background ----------
  // Devices sit on a ring around a breathing coordinator point; every so
  // often one fires a pulse inward. This is the actual shape of the product
  // (edge devices -> central aggregation), not a generic connect-the-dots
  // mesh, so the hero motion reads as "federated learning" at a glance.
  function initHeroField(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, dpr = 1, cx = 0, cy = 0, devices = [], pulses = [], frame = 0;
    const COUNT = 22;

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w * 0.5; cy = h * 0.42;
    }

    function seed() {
      devices = Array.from({ length: COUNT }, () => {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.min(w, h) * (0.26 + Math.random() * 0.36);
        return {
          angle,
          radius,
          drift: (Math.random() - 0.5) * 0.00045,
          phase: Math.random() * Math.PI * 2,
          r: Math.random() * 1.2 + 1,
          x: 0, y: 0,
        };
      });
      pulses = [];
    }

    function spawnPulse() {
      const from = devices[Math.floor(Math.random() * devices.length)];
      pulses.push({ from, t: 0 });
    }

    function step() {
      frame++;
      ctx.clearRect(0, 0, w, h);

      const breathe = 0.55 + Math.sin(frame * 0.02) * 0.12;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 46);
      glow.addColorStop(0, `rgba(10,132,255,${0.32 * breathe})`);
      glow.addColorStop(1, "rgba(10,132,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, 46, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fill();

      devices.forEach((d) => {
        d.angle += d.drift;
        d.x = cx + Math.cos(d.angle) * d.radius;
        d.y = cy + Math.sin(d.angle) * d.radius;
        const twinkle = 0.32 + Math.sin(frame * 0.03 + d.phase) * 0.16;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
        ctx.fill();
      });

      if (frame % 26 === 0 && pulses.length < 5) spawnPulse();
      pulses = pulses.filter((p) => p.t < 1);
      pulses.forEach((p) => {
        p.t += 0.014;
        const ease = 1 - Math.pow(1 - p.t, 3);
        const x = p.from.x + (cx - p.from.x) * ease;
        const y = p.from.y + (cy - p.from.y) * ease;
        const alpha = Math.sin(Math.min(p.t, 1) * Math.PI);
        ctx.beginPath();
        ctx.moveTo(p.from.x, p.from.y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = `rgba(10,132,255,${alpha * 0.28})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(120,190,255,${alpha})`;
        ctx.fill();
      });

      requestAnimationFrame(step);
    }

    resize();
    seed();
    window.addEventListener("resize", () => { resize(); seed(); });
    requestAnimationFrame(step);
  }

  // ---------- hero aurora parallax ----------
  // Cursor position gently nudges the aurora glow layers via CSS custom
  // properties (--px/--py), each layer already weighted differently in CSS
  // so they drift at different rates — cheap, GPU-friendly depth cue.
  function initHeroParallax(hero) {
    if (!hero) return;
    const MAX_OFFSET = 26;
    let targetX = 0, targetY = 0, curX = 0, curY = 0;

    hero.addEventListener("mousemove", (e) => {
      const rect = hero.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - rect.top) / rect.height - 0.5;
      targetX = relX * MAX_OFFSET * 2;
      targetY = relY * MAX_OFFSET * 2;
    });
    hero.addEventListener("mouseleave", () => { targetX = 0; targetY = 0; });

    function tick() {
      curX += (targetX - curX) * 0.06;
      curY += (targetY - curY) * 0.06;
      hero.style.setProperty("--px", `${curX.toFixed(2)}px`);
      hero.style.setProperty("--py", `${curY.toFixed(2)}px`);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ---------- scroll reveal ----------
  // Elements start plainly visible; only once we successfully attach the
  // IntersectionObserver do we arm the hidden/animate-in state. That way a
  // failure anywhere else in setup can never leave content permanently
  // invisible with no error shown.
  function initReveal() {
    if (!("IntersectionObserver" in window)) return;
    const targets = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    targets.forEach((el) => {
      el.classList.add("reveal-armed");
      io.observe(el);
    });
  }

  // ---------- mode switch (train / deploy / inference) ----------
  function initModeSwitch() {
    const panels = { train: els.modeTrain, eval: els.modeEval, deploy: els.modeDeploy, inference: els.modeInference, runs: els.modeRuns };

    function positionThumb(btn) {
      els.modeThumb.style.width = `${btn.offsetWidth}px`;
      els.modeThumb.style.transform = `translateX(${btn.offsetLeft - 4}px)`;
    }

    function setMode(mode) {
      els.modeBtns.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
      Object.entries(panels).forEach(([key, el]) => el.classList.toggle("active", key === mode));
      const activeBtn = els.modeBtns.find((b) => b.dataset.mode === mode);
      if (activeBtn) positionThumb(activeBtn);
      if (mode === "eval") updateEvalSummary();
      if (mode === "deploy") updateDeployStats();
      if (mode === "inference") updateInferenceAvailability();
      if (mode === "runs") renderRunHistory();
    }

    els.modeBtns.forEach((btn) => {
      btn.addEventListener("click", () => setMode(btn.dataset.mode));
    });
    window.addEventListener("resize", () => {
      const active = els.modeBtns.find((b) => b.classList.contains("active"));
      if (active) positionThumb(active);
    });
    positionThumb(els.modeBtns[0]);
  }

  // ---------- terminal expand/collapse (VS Code panel style) ----------
  // The body is also natively drag-resizable via CSS `resize: vertical` — this
  // button is just a one-click jump to a big preset size, same as VS Code's
  // maximize-panel toggle.
  function toggleTerminalExpand() {
    const expanded = els.terminalPanel.classList.toggle("expanded");
    els.terminalExpandIcon.textContent = expanded ? "⤡" : "⤢";
    els.terminalExpandLabel.textContent = expanded ? "Collapse" : "Expand";
    els.terminalExpandBtn.title = expanded ? "Collapse terminal (Ctrl+`)" : "Expand terminal (Ctrl+`)";
    els.terminalExpandBtn.setAttribute("aria-label", els.terminalExpandBtn.title);
    // Clear any inline height left by manual drag-resizing so the expanded/
    // collapsed CSS height presets apply cleanly.
    els.terminalBody.style.height = "";
    els.terminalBody.scrollTop = els.terminalBody.scrollHeight;
  }

  function initTerminalExpand() {
    els.terminalExpandBtn.title = "Expand terminal (Ctrl+`)";
    els.terminalExpandBtn.setAttribute("aria-label", els.terminalExpandBtn.title);
    els.terminalExpandBtn.addEventListener("click", toggleTerminalExpand);
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "`") {
        e.preventDefault();
        // VS Code semantics: bring the terminal up and put the caret in it;
        // press again while already typing there to collapse it.
        if (document.activeElement === els.terminalInput) {
          toggleTerminalExpand();
          if (!els.terminalPanel.classList.contains("expanded")) els.terminalInput.blur();
        } else {
          focusTerminal();
        }
      }
    });
  }

  // ---------- cohort dropdown ----------
  function renderCohortOptions() {
    els.cohort.innerHTML = COHORTS.map(
      (c) => `<option value="${c.id}">${c.label}, ${fmtInt(c.population)}</option>`
    ).join("");
  }

  function updateCohortStatus() {
    const cohort = currentCohort();
    const k = parseInt(els.k.value, 10);
    els.cohortStatus.innerHTML = `<strong>${cohort.label}</strong>, ${fmtInt(cohort.population)} devices eligible · sampling ${k} per round`;
  }

  // ---------- network diagram ----------
  // The clip norm C defines an L2 ball, and clipping is a projection onto it.
  // So the panel draws that ball: each device sits at a radius set by its own
  // ‖Δw‖ relative to C, and anything outside the dashed ring is a device whose
  // update got pulled back to the boundary before it was noised. That makes
  // this a diagnostic you can read at a glance rather than a decorative star,
  // and it puts the DP mechanic on screen instead of in a caption.
  const NET_R_INNER = 30;
  const NET_R_OUTER = 86;

  function netRadius(ratio, maxRatio) {
    // sqrt keeps a device 9x over the clip norm from pinning every other node
    // into the centre, which a linear scale does as soon as one update is large.
    const t = Math.min(1, Math.sqrt(Math.max(0, ratio)) / Math.sqrt(maxRatio));
    return NET_R_INNER + (NET_R_OUTER - NET_R_INNER) * t;
  }

  function shortDevice(name) {
    return name.replace(/^iPhone\s*/, "");
  }

  // Nodes are laid out on evenly spaced spokes. A hash-per-device angle looked
  // principled but collided: two devices could land on the same bearing and
  // render on top of each other. Sorting by the hash keeps the arrangement
  // stable-ish between rounds while guaranteeing no two nodes overlap.
  function netLayout(clients) {
    const order = clients
      .map((c, i) => ({ i, key: ((c.index != null ? c.index : i) * 2654435761) >>> 0 }))
      .sort((a, b) => a.key - b.key);
    const angles = new Array(clients.length);
    order.forEach((entry, slot) => {
      angles[entry.i] = -Math.PI / 2 + (slot * 2 * Math.PI) / clients.length;
    });
    return angles;
  }

  let netNodeRefs = [];

  function buildNetwork(clients, stat) {
    els.svg.innerHTML = "";
    netNodeRefs = [];
    const angles = netLayout(clients);
    const clipNorm = parseFloat(els.clip.value) || 0.5;

    const ring = document.createElementNS(SVG_NS, "circle");
    ring.setAttribute("cx", CENTER.x);
    ring.setAttribute("cy", CENTER.y);
    ring.setAttribute("r", netRadius(1, 2));
    ring.setAttribute("class", "net-clip-ring");
    els.svg.appendChild(ring);

    const sessions = clients.map((c) => c.sessions || 0);
    const maxSessions = Math.max(1, ...sessions);

    clients.forEach((client, i) => {
      const angle = angles[i];
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const link = document.createElementNS(SVG_NS, "line");
      link.setAttribute("x1", CENTER.x);
      link.setAttribute("y1", CENTER.y);
      link.setAttribute("class", "net-link");
      els.svg.appendChild(link);

      const node = document.createElementNS(SVG_NS, "circle");
      node.setAttribute("r", (5 + 3 * Math.sqrt((client.sessions || 0) / maxSessions)).toFixed(1));
      node.setAttribute("class", "net-node-client");
      els.svg.appendChild(node);

      // One label per device, pushed radially outward and anchored by
      // direction, so text never lands on the ring, the hub, or a neighbour.
      const label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("class", "net-label");
      label.setAttribute("text-anchor", cos > 0.35 ? "start" : cos < -0.35 ? "end" : "middle");
      els.svg.appendChild(label);

      netNodeRefs.push({ client, angle, cos, sin, link, node, label });
    });

    const halo = document.createElementNS(SVG_NS, "circle");
    halo.setAttribute("cx", CENTER.x);
    halo.setAttribute("cy", CENTER.y);
    halo.setAttribute("r", 17);
    halo.setAttribute("class", "net-center-halo");
    els.svg.appendChild(halo);

    const center = document.createElementNS(SVG_NS, "circle");
    center.setAttribute("cx", CENTER.x);
    center.setAttribute("cy", CENTER.y);
    center.setAttribute("r", 11);
    center.setAttribute("class", "net-node-center");
    els.svg.appendChild(center);

    const centerLabel = document.createElementNS(SVG_NS, "text");
    centerLabel.setAttribute("x", CENTER.x);
    centerLabel.setAttribute("y", CENTER.y + 3.5);
    centerLabel.setAttribute("text-anchor", "middle");
    centerLabel.setAttribute("class", "net-center-label");
    centerLabel.setAttribute("id", "net-center-glyph");
    els.svg.appendChild(centerLabel);

    // Legend sits in the corner rather than on the ring, where it used to
    // collide with whichever device happened to be at the top.
    const legend = document.createElementNS(SVG_NS, "text");
    legend.setAttribute("x", 10);
    legend.setAttribute("y", 292);
    legend.setAttribute("class", "net-ring-label");
    legend.setAttribute("id", "net-legend");
    els.svg.appendChild(legend);

    updateNetwork(stat, clipNorm);
    return netNodeRefs;
  }

  // Positions are only ever set here, so a round produces one smooth
  // transition rather than two different-looking renders (neutral, then real).
  function updateNetwork(stat, clipNorm) {
    if (!netNodeRefs.length) return;
    const secure = stat ? stat.secureAggregation : !!(els.secureAgg && els.secureAgg.checked);
    const C = clipNorm || parseFloat(els.clip.value) || 0.5;

    const byName = {};
    if (stat) stat.clientStats.forEach((c) => { byName[c.name] = c; });
    const ratios = netNodeRefs.map((n) => {
      const s = byName[n.client.name];
      return s && Number.isFinite(s.preClipNorm) ? s.preClipNorm / C : null;
    });
    const known = ratios.filter((r) => r != null);
    const maxRatio = known.length ? Math.max(2, ...known) : 2;

    const ringEl = els.svg.querySelector(".net-clip-ring");
    if (ringEl) ringEl.setAttribute("r", netRadius(1, maxRatio).toFixed(1));

    netNodeRefs.forEach((n, i) => {
      const ratio = ratios[i];
      const r = secure || ratio == null ? netRadius(1, maxRatio) : netRadius(ratio, maxRatio);
      const x = CENTER.x + r * n.cos;
      const y = CENTER.y + r * n.sin;
      const clipped = ratio != null && ratio > 1;

      n.x = x; n.y = y;
      n.color = secure || ratio == null ? "#64d2ff" : clipped ? "#ff9f0a" : "#0a84ff";

      n.link.setAttribute("x2", x.toFixed(1));
      n.link.setAttribute("y2", y.toFixed(1));
      n.link.setAttribute("class", "net-link" + (clipped ? " clipped" : ""));
      n.node.setAttribute("cx", x.toFixed(1));
      n.node.setAttribute("cy", y.toFixed(1));
      n.node.setAttribute("class", "net-node-client" + (clipped ? " clipped" : ""));
      n.node.style.stroke = n.color;

      const lx = CENTER.x + (r + 13) * n.cos;
      const ly = CENTER.y + (r + 13) * n.sin + (Math.abs(n.sin) > 0.6 ? (n.sin > 0 ? 8 : -3) : 3.5);
      n.label.setAttribute("x", lx.toFixed(1));
      n.label.setAttribute("y", ly.toFixed(1));
      n.label.setAttribute("class", "net-label" + (clipped ? " clipped" : ""));
      n.label.textContent =
        secure || ratio == null ? shortDevice(n.client.device) : `${shortDevice(n.client.device)} · ${ratio.toFixed(1)}×C`;
    });

    const glyph = els.svg.querySelector("#net-center-glyph");
    if (glyph) glyph.textContent = secure ? "🔒" : "Σ";
    const legend = els.svg.querySelector("#net-legend");
    if (legend) {
      legend.textContent = secure
        ? "dashed ring = clip norm C · per-device norms withheld"
        : `dashed ring = ‖Δw‖ = C (${fmt(C, 2)}) · outside it = clipped`;
    }
  }

  // Animates one dot travelling along a link. Each pulse is a real SVG circle
  // driven by rAF and removed on completion, so nothing accumulates in the DOM
  // across rounds.
  function makePulse(x1, y1, x2, y2, duration, color) {
    return new Promise((resolve) => {
      const dot = document.createElementNS(SVG_NS, "circle");
      dot.setAttribute("r", 3);
      dot.setAttribute("class", "net-pulse");
      if (color) dot.style.fill = color;
      els.svg.appendChild(dot);

      const start = performance.now();
      function step(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = t * t * (3 - 2 * t); // smoothstep
        dot.setAttribute("cx", (x1 + (x2 - x1) * eased).toFixed(1));
        dot.setAttribute("cy", (y1 + (y2 - y1) * eased).toFixed(1));
        dot.style.opacity = String(1 - Math.pow(t, 3));
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          dot.remove();
          resolve();
        }
      }
      requestAnimationFrame(step);
    });
  }

  async function animateRound(nodes) {
    nodes.forEach((c) => { c.node.classList.add("active"); c.node.style.stroke = c.color; });
    await Promise.all(nodes.map((c) => makePulse(c.x, c.y, CENTER.x, CENTER.y, 500, c.color)));
    await Promise.all(nodes.map((c) => makePulse(CENTER.x, CENTER.y, c.x, c.y, 420, "#0a84ff")));
    nodes.forEach((c) => c.node.classList.remove("active"));
  }

  // ---------- chart (smoothed) ----------
  function drawChart() {
    const canvas = els.chart;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 640, h = 220;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const history = trainer ? trainer.history : [];
    if (history.length === 0) return;

    const pad = { l: 40, r: 12, t: 14, b: 22 };
    const maes = history.map((h) => h.valMae);
    const maxMae = Math.max(0.08, ...maes) * 1.15;
    const minMae = 0;

    const xAt = (i) => pad.l + (i / Math.max(1, history.length - 1)) * (w - pad.l - pad.r);
    const yAt = (v) => pad.t + (1 - (v - minMae) / (maxMae - minMae)) * (h - pad.t - pad.b);
    const pts = history.map((pt, i) => ({ x: xAt(i), y: yAt(pt.valMae) }));

    // Y-axis gridlines with real MAE values, X-axis with real round numbers
    ctx.font = "10px -apple-system, sans-serif";
    ctx.fillStyle = "#8e8e93";
    ctx.textBaseline = "middle";
    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const v = maxMae * (1 - i / yTicks);
      const y = yAt(v);
      ctx.strokeStyle = "rgba(0,0,0,0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillText(v.toFixed(3), pad.l - 8, y);
    }
    ctx.textAlign = "left";
    ctx.fillText(`R${history[0].round}`, pad.l, h - 6);
    ctx.textAlign = "right";
    ctx.fillText(`R${history[history.length - 1].round}`, w - pad.r, h - 6);

    function smoothPath(ctx2, points) {
      ctx2.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx2.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      const last = points[points.length - 1];
      ctx2.lineTo(last.x, last.y);
    }

    ctx.beginPath();
    smoothPath(ctx, pts);
    ctx.lineTo(pts[pts.length - 1].x, h - pad.b);
    ctx.lineTo(pts[0].x, h - pad.b);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(10,132,255,0.18)");
    grad.addColorStop(1, "rgba(10,132,255,0.0)");
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    smoothPath(ctx, pts);
    ctx.strokeStyle = "#0a84ff";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    const lastPt = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(lastPt.x, lastPt.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#0a84ff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lastPt.x, lastPt.y, 8, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(10,132,255,0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const lastMae = history[history.length - 1].valMae;
    ctx.font = "600 11px -apple-system, sans-serif";
    ctx.fillStyle = "#0a84ff";
    ctx.textBaseline = "bottom";
    ctx.textAlign = lastPt.x > w - 60 ? "right" : "left";
    ctx.fillText(lastMae.toFixed(4), lastPt.x + (lastPt.x > w - 60 ? -10 : 10), lastPt.y - 6);
  }

  // ---------- accuracy stats ----------
  function updateAccuracyStats(stat) {
    if (!stat) {
      els.statLoss.textContent = "—";
      els.statCycles.textContent = "—";
      return;
    }
    els.statLoss.textContent = fmt(stat.valLoss, 5);
    els.statCycles.textContent = `± ${(stat.valMae * 100).toFixed(1)} pts`;
  }

  // ---------- coordinator terminal log ----------
  function timestamp() {
    return new Date().toLocaleTimeString([], { hour12: false });
  }

  function logLine(html) {
    const line = document.createElement("div");
    line.className = "term-line";
    line.innerHTML = html;
    els.terminalBody.appendChild(line);
    while (els.terminalBody.children.length > 400) els.terminalBody.removeChild(els.terminalBody.firstChild);
    els.terminalBody.scrollTop = els.terminalBody.scrollHeight;
  }

  function clearTerminal() {
    els.terminalBody.innerHTML = "";
  }

  function logRoundStart(cohort, roundClients, roundNumber) {
    const pct = ((roundClients.length / cohort.population) * 100).toFixed(2);
    els.terminalPoll.textContent = `${roundClients.length} / ${fmtInt(cohort.population)} devices polling`;
    els.federationCount.textContent = `${roundClients.length} of ${fmtInt(cohort.population)} · round ${roundNumber}`;
    logLine(`<span class="term-time">[${timestamp()}]</span> Polling <span class="term-accent">${cohort.label}</span>, ${fmtInt(cohort.population)} devices eligible`);
    logLine(`<span class="term-time">[${timestamp()}]</span> <span class="term-accent">${roundClients.length}</span> devices responded to round ${roundNumber} <span class="term-dim">(${pct}% of cohort)</span>`);
  }

  function logRoundResult(stat, clipNorm, sigma) {
    stat.clientStats.forEach((cs) => {
      logLine(`<span class="term-time">[${timestamp()}]</span> ${cs.name} <span class="term-dim">(${cs.device})</span>: local loss ${fmt(cs.localLoss, 4)}`);
    });
    logLine(`<span class="term-time">[${timestamp()}]</span> Aggregating ${stat.clientStats.length} noised updates <span class="term-dim">(clip=${clipNorm.toFixed(2)}, σ=${sigma.toFixed(2)})</span>…`);
    const epsTxt = Number.isFinite(stat.epsilonTotal) ? `≈ ${fmt(stat.epsilonTotal, 2)}` : "∞";
    logLine(`<span class="term-time">[${timestamp()}]</span> Round ${stat.round} complete: val MAE ${fmt(stat.valMae, 4)} · ε_total ${epsTxt}`);
  }

  // ---------- terminal console (typable commands) ----------
  // Every command reuses the exact same buttons/handlers the UI already has —
  // it never duplicates state logic, just drives the real controls.
  function clickMode(mode) {
    const btn = els.modeBtns.find((b) => b.dataset.mode === mode);
    if (btn) btn.click();
  }

  // Switching tabs from the palette or the terminal is invisible if you are
  // scrolled somewhere else on the page, so bring the switcher into view too.
  // scroll-margin-top on .mode-switch keeps it clear of the sticky nav.
  function goToMode(mode) {
    clickMode(mode);
    const anchor = document.getElementById("mode-switch");
    if (anchor && typeof anchor.scrollIntoView === "function") {
      anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function termEcho(cmd) {
    logLine(`<span class="term-cmd"><span class="term-prompt-echo">›</span>${cmd}</span>`);
  }
  function termOut(html) {
    logLine(`<span class="term-dim">${html}</span>`);
  }
  function termWarn(html) {
    logLine(`<span class="term-warn">${html}</span>`);
  }

  const TERMINAL_HELP = [
    "train / start [flags] — begin training (resumes if paused). Same flags as the Python CLI:",
    "  --cohort &lt;id&gt;       all/us/eu/apac/commute/travel",
    "  --preset &lt;name&gt;      small/medium/large/transformer/linear",
    "  --k &lt;n&gt;              devices sampled per round",
    "  --clip-norm &lt;c&gt;      clip norm (C)",
    "  --noise &lt;z&gt;          privacy noise multiplier (0 disables DP)",
    "  --dropout &lt;pct&gt;      % of sampled devices that fail to report",
    "  --secure-agg         mask updates so only the sum is recoverable",
    "  --local-epochs &lt;n&gt;   local epochs per client per round",
    "  --rounds &lt;n&gt;         auto-pause after this many more rounds",
    "  e.g. train --cohort us --preset medium --noise 1 --rounds 10",
    "pretrain [flags] — centralized, sharded pre-training on pooled data (server-side, no DP).",
    "  --shards &lt;n&gt;         data-parallel shards (gradients all-reduced per step)",
    "  --devices &lt;n&gt;        devices whose data gets pooled centrally",
    "  --steps &lt;n&gt;          optimizer steps    --batch &lt;n&gt;  per-shard batch",
    "  --lr &lt;x&gt;             learning rate      --cohort &lt;id&gt;",
    "  e.g. pretrain --shards 8 --steps 120, then 'train' to federate from there",
    "posttrain &lt;stage&gt; — post-training: finetune / distill / quantize / prune.",
    "  run 'posttrain' with no stage to list the options",
    "pause / stop  — pause training",
    "reset         — reset the trainer",
    "save          — save a checkpoint",
    "eval          — open the Eval tab",
    "evaluate      — open Eval and run the full evaluation",
    "deploy        — open the Deploy tab",
    "infer         — open Inference and sample a new device signal",
    "status        — print current round / MAE / ε",
    "init          — platform status: compute, model, cohort, privacy, strategy",
    "gpus          — compute devices as a grid, with hardware/software detection",
    "zero &lt;0-3&gt;     — set sharding strategy, print the ZeRO memory table",
    "fsdp &lt;n&gt;       — enable ZeRO-3 at world size n, print the memory saving",
    "compile       — warm the backend, measure kernel compile + per-call latency",
    "devices       — list real compute backends + GPU this is running on",
    "backend &lt;name&gt; — switch TF.js backend (webgl / wasm / cpu)",
    "code          — open the source viewer",
    "clear         — clear this log",
    "",
    "keys: <kbd>Ctrl+`</kbd> open terminal · <kbd>↑</kbd><kbd>↓</kbd> history · <kbd>Tab</kbd> complete · <kbd>Ctrl+L</kbd> clear · <kbd>Ctrl+C</kbd> cancel · <kbd>⌘K</kbd> palette",
  ].join("<br>");

  function parseFlags(argStr) {
    const flags = {};
    const re = /--([\w-]+)(?:[=\s]+(\S+))?/g;
    let m;
    while ((m = re.exec(argStr))) flags[m[1]] = m[2] === undefined ? true : m[2];
    return flags;
  }

  function setSliderFlag(rangeEl, raw, label, out = termOut, warn = termWarn) {
    const v = Math.min(parseFloat(rangeEl.max), Math.max(parseFloat(rangeEl.min), parseFloat(raw)));
    if (Number.isNaN(v)) { warn(`invalid value for ${label}: '${raw}'`); return; }
    rangeEl.value = v;
    rangeEl.dispatchEvent(new Event("input", { bubbles: true }));
    rangeEl.dispatchEvent(new Event("change", { bubbles: true }));
    out(`${label} set to ${v}`);
  }

  let roundsLimit = null;

  // Async, and deliberately does NOT dispatch "change" events for cohort/
  // preset — those listeners each call setupTrainer() themselves, fire-and-
  // forget, which can't be awaited from here. Instead this sets the controls
  // directly and awaits exactly one setupTrainer() call itself at the end,
  // so by the time it returns the trainer is guaranteed ready — critical
  // since the caller (the 'train' command) clicks Start immediately after.
  async function applyTrainFlags(args) {
    if (!args) return;
    const flags = parseFlags(args);
    let needsRebuild = false;
    // setupTrainer() clears the terminal as part of its reset — so anything
    // logged before a rebuild would be wiped the instant it runs. Queue
    // messages and flush them after, so the user still sees confirmation of
    // what their command actually did.
    const pending = [];
    const queueOut = (text) => pending.push({ warn: false, text });
    const queueWarn = (text) => pending.push({ warn: true, text });

    if (flags.cohort) {
      if ([...els.cohort.options].some((o) => o.value === flags.cohort)) {
        els.cohort.value = flags.cohort;
        queueOut(`cohort set to '${flags.cohort}'`);
        needsRebuild = true;
      } else {
        queueWarn(`unknown cohort '${flags.cohort}', valid: ${COHORTS.map((c) => c.id).join(", ")}`);
      }
    }
    if (flags.preset) {
      const validPresets = ["small", "medium", "large", "transformer", "linear"];
      if (validPresets.includes(flags.preset)) {
        els.model.value = flags.preset;
        await loadModelSpec(flags.preset);
        activeModelValue = flags.preset;
        queueOut(`preset set to '${flags.preset}'`);
        needsRebuild = true;
      } else {
        queueWarn(`unknown preset '${flags.preset}', valid: ${validPresets.join(", ")}`);
      }
    }
    if (flags.k !== undefined) setSliderFlag(els.k, flags.k, "devices/round", queueOut, queueWarn);
    if (flags["clip-norm"] !== undefined) setSliderFlag(els.clip, flags["clip-norm"], "clip norm", queueOut, queueWarn);
    if (flags.noise !== undefined) setSliderFlag(els.noise, flags.noise, "noise multiplier", queueOut, queueWarn);
    if (flags.dropout !== undefined) setSliderFlag(els.dropout, flags.dropout, "device dropout %", queueOut, queueWarn);
    if (flags["secure-agg"] !== undefined) {
      const on = flags["secure-agg"] !== "false" && flags["secure-agg"] !== "0";
      els.secureAgg.checked = on;
      queueOut(`secure aggregation ${on ? "enabled" : "disabled"}`);
      needsRebuild = true;
    }
    if (flags["local-epochs"] !== undefined) {
      const v = Math.min(parseFloat(els.epochs.max), Math.max(parseFloat(els.epochs.min), parseFloat(flags["local-epochs"])));
      if (Number.isNaN(v)) { queueWarn(`invalid value for local epochs: '${flags["local-epochs"]}'`); }
      else { els.epochs.value = v; syncLabels(); queueOut(`local epochs set to ${v}`); needsRebuild = true; }
    }
    if (flags.rounds !== undefined) {
      const n = parseInt(flags.rounds, 10);
      if (Number.isFinite(n) && n > 0) {
        roundsLimit = n;
        queueOut(`will auto-pause after ${n} more round(s)`);
      } else {
        queueWarn(`invalid --rounds value '${flags.rounds}'`);
      }
    }

    if (needsRebuild) await setupTrainer();
    pending.forEach((m) => (m.warn ? termWarn(m.text) : termOut(m.text)));
  }


  // ---------- infrastructure commands ----------
  // These read and drive the REAL configuration the Deploy tab exposes, so the
  // terminal and the UI are two views of one state rather than two systems.
  function fmtGrid(rows) {
    const w = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i]).replace(/<[^>]+>/g, "").length)));
    return rows
      .map((r) => r.map((c, i) => String(c) + " ".repeat(Math.max(0, w[i] - String(c).replace(/<[^>]+>/g, "").length))).join("  "))
      .join("<br>");
  }

  function cmdGpus() {
    const active = tf.getBackend();
    const renderer = gpuDeviceString();
    const rows = [["ID", "BACKEND", "TYPE", "STATUS"]];
    availableBackends().forEach((b, i) => {
      const type = b === "webgl" ? (isSoftwareRenderer(renderer) ? "software" : "hardware") : b === "webgpu" ? "hardware" : "cpu";
      rows.push([`dev:${i}`, backendLabel(b), type, b === active ? "ACTIVE" : "idle"]);
    });
    termOut(fmtGrid(rows));
    if (renderer) termOut(`<span class="term-dim">renderer: ${escapeHtml(renderer)}</span>`);
    termOut(
      `<span class="term-dim">cores: ${navigator.hardwareConcurrency || "?"} · ` +
        `tensors: ${fmtInt(tf.memory().numTensors)} · ${(tf.memory().numBytes / 1048576).toFixed(1)} MB</span>`
    );
    termOut(`<span class="term-dim">This browser exposes one compute device. Multi-GPU figures are computed, not executed.</span>`);
  }

  function cmdZero(args) {
    const arg = (args || "").trim().toLowerCase().replace("zero-", "").replace("stage", "").trim();
    const map = { "0": "ddp", "1": "zero1", "2": "zero2", "3": "zero3", ddp: "ddp", off: "single", single: "single" };
    if (arg && map[arg]) {
      els.cfgStrategy.value = map[arg];
      els.cfgStrategy.dispatchEvent(new Event("change", { bubbles: true }));
      termOut(`sharding strategy set to <span class="term-accent">${map[arg]}</span>`);
    } else if (arg) {
      termWarn(`unknown ZeRO stage '${arg}'. Use 0 (DDP), 1, 2 or 3.`);
      return;
    }
    const params = currentConfigParams();
    const world = parseInt(els.cfgWorld.value, 10);
    const prec = els.cfgPrecision.value;
    const rows = [["STAGE", "SHARDS", "WEIGHTS", "GRADS", "OPTIM", "PER GPU"]];
    ["ddp", "zero1", "zero2", "zero3"].forEach((s) => {
      const m = memoryBreakdown(params.params, s, world, prec);
      rows.push([
        s === els.cfgStrategy.value ? `${s} *` : s,
        s === "ddp" ? "none" : s === "zero1" ? "optim" : s === "zero2" ? "optim+grad" : "all",
        formatBytes(m.weights), formatBytes(m.grads), formatBytes(m.optim), formatBytes(m.total),
      ]);
    });
    termOut(fmtGrid(rows));
    termOut(`<span class="term-dim">${fmtInt(params.params)} params · world size ${world} · ${prec} · * = active</span>`);
  }

  function cmdFsdp(args) {
    const n = parseInt((args || "").trim(), 10);
    if (Number.isFinite(n) && n > 0) {
      const opt = [...els.cfgWorld.options].find((o) => +o.value === n);
      if (!opt) { termWarn(`world size ${n} not available. Options: ${[...els.cfgWorld.options].map((o) => o.value).join(", ")}`); return; }
      els.cfgWorld.value = String(n);
    }
    els.cfgStrategy.value = "zero3";
    els.cfgStrategy.dispatchEvent(new Event("change", { bubbles: true }));
    const params = currentConfigParams();
    const world = parseInt(els.cfgWorld.value, 10);
    const full = memoryBreakdown(params.params, "ddp", world, els.cfgPrecision.value);
    const sharded = memoryBreakdown(params.params, "zero3", world, els.cfgPrecision.value);
    termOut(`FSDP (ZeRO-3) enabled · world size <span class="term-accent">${world}</span>`);
    termOut(
      fmtGrid([
        ["", "PER GPU", "TOTAL"],
        ["replicated (DDP)", formatBytes(full.total), formatBytes(full.total * world)],
        ["sharded (FSDP)", formatBytes(sharded.total), formatBytes(sharded.total * world)],
        ["saving", `${(full.total / sharded.total).toFixed(1)}x`, ""],
      ])
    );
    termOut(`<span class="term-dim">Memory arithmetic is real. Execution is single-device: see 'devices'.</span>`);
  }

  async function cmdCompile() {
    termOut("compiling kernels and warming the backend…");
    const t0 = performance.now();
    const m = trainer && trainer.model ? trainer.model : null;
    if (!m) { termWarn("No model yet."); return; }
    const x = tf.randomNormal([1, NUM_FEATURES]);
    for (let i = 0; i < 3; i++) { const o = m.predict(x); await o.data(); o.dispose(); }
    const warm = performance.now() - t0;
    const t1 = performance.now();
    const N = 30;
    for (let i = 0; i < N; i++) { const o = m.predict(x); await o.data(); o.dispose(); }
    const per = (performance.now() - t1) / N;
    x.dispose();
    termOut(
      fmtGrid([
        ["BACKEND", "WARMUP", "PER CALL", "THROUGHPUT"],
        [backendLabel(tf.getBackend()), `${warm.toFixed(0)} ms`, `${per.toFixed(3)} ms`, `${fmtInt(Math.round(1000 / per))}/s`],
      ])
    );
    termOut(`<span class="term-dim">Measured now, on this device. First call includes shader/kernel compilation.</span>`);
  }

  function cmdInit() {
    const p = currentConfigParams();
    termOut(`<span class="term-accent">Federated Ranker</span> <span class="term-dim">unified training + inference platform</span>`);
    termOut(
      fmtGrid([
        ["COMPUTE", backendLabel(tf.getBackend())],
        ["MODEL", `${p.label} · ${fmtInt(p.params)} params`],
        ["COHORT", `${currentCohort().label} · ${fmtInt(currentCohort().population)} devices`],
        ["SAMPLING", `K=${els.k.value} per round · ${els.epochs.value} local epochs`],
        ["PRIVACY", `C=${els.clip.value} · z=${els.noise.value} · secure-agg ${els.secureAgg.checked ? "on" : "off"}`],
        ["STRATEGY", `${els.cfgStrategy.value} · world ${els.cfgWorld.value} · ${els.cfgPrecision.value}`],
        ["CHECKPOINTS", `${fmtInt(getCheckpointIndex().length)} saved`],
      ])
    );
    termOut(`<span class="term-dim">'gpus' devices · 'zero N' sharding · 'fsdp N' · 'compile' · 'help' all commands</span>`);
  }

  const TERMINAL_COMMANDS = {
    help: () => termOut(TERMINAL_HELP),
    train: async (args) => {
      goToMode("train");
      if (running) { termWarn("Already training. Try 'pause'."); return; }
      await applyTrainFlags(args);
      els.start.click();
    },
    start: (args) => TERMINAL_COMMANDS.train(args),
    pretrain: async (args) => { goToMode("train"); await runPretrain(args); },
    posttrain: async (args) => runPosttrain(args),
    pause: () => {
      if (!running) { termWarn("Not currently training."); return; }
      els.start.click();
    },
    stop: () => TERMINAL_COMMANDS.pause(),
    reset: () => { els.reset.click(); termOut("Trainer reset."); },
    save: () => {
      if (els.btnSaveModel.disabled) { termWarn("Train at least one round before saving."); return; }
      els.btnSaveModel.click();
    },
    eval: () => goToMode("eval"),
    evaluate: () => {
      goToMode("eval");
      if (!getSelectedMeta(els.evalModelSelect)) { termWarn("No model to evaluate. Train a round, or pick a saved checkpoint."); return; }
      els.btnRunEval.click();
    },
    deploy: () => {
      goToMode("deploy");
      if (!getSelectedMeta(els.deployModelSelect)) { termWarn("No model to deploy. Train a round, or pick a saved checkpoint."); return; }
      if (els.btnDeploy.disabled) { termWarn("A deploy is already in progress."); return; }
      els.btnDeploy.click();
    },
    infer: () => {
      goToMode("inference");
      if (!deployedTarget) { termWarn("Deploy a model first: run 'deploy'."); return; }
      els.btnRandomize.click();
    },
    inference: () => TERMINAL_COMMANDS.infer(),
    status: () => {
      if (!trainer) { termWarn("No trainer yet."); return; }
      const last = trainer.history[trainer.history.length - 1];
      const epsTxt = Number.isFinite(trainer.epsilonSpent) ? fmt(trainer.epsilonSpent, 2) : "∞";
      termOut(`round ${trainer.round} · val MAE ${last ? fmt(last.valMae, 4) : "—"} · ε ${epsTxt}`);
    },
    devices: () => reportDevices(),
    init: () => cmdInit(),
    gpus: () => cmdGpus(),
    zero: (args) => cmdZero(args),
    fsdp: (args) => cmdFsdp(args),
    compile: async () => cmdCompile(),
    backend: async (args) => {
      const name = (args || "").trim().toLowerCase();
      if (!name) { reportDevices(); return; }
      await switchBackend(name);
    },
    code: () => els.codeToggle.click(),
    clear: () => clearTerminal(),
  };

  function runTerminalCommand(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    termEcho(trimmed);
    const spaceIdx = trimmed.indexOf(" ");
    const cmd = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toLowerCase();
    const args = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1);
    const handler = TERMINAL_COMMANDS[cmd];
    if (!handler) { termWarn(`Unknown command: '${cmd}'. Type 'help'.`); return; }
    // Handlers may be async; surface a thrown error in the terminal instead of
    // letting it vanish into an unhandled rejection.
    try {
      const result = handler(args);
      if (result && typeof result.catch === "function") {
        result.catch((err) => {
          console.error(`[fl-demo] command '${cmd}' failed:`, err);
          termWarn(`'${cmd}' failed: ${(err && err.message) || err}`);
        });
      }
    } catch (err) {
      console.error(`[fl-demo] command '${cmd}' failed:`, err);
      termWarn(`'${cmd}' failed: ${(err && err.message) || err}`);
    }
  }

  // ---------- terminal: history, completion, control keys ----------
  const TERM_HISTORY_KEY = "fl-demo-term-history-v1";
  const MAX_TERM_HISTORY = 100;

  function loadTermHistory() {
    try {
      const v = JSON.parse(localStorage.getItem(TERM_HISTORY_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (err) {
      return [];
    }
  }
  let termHistory = loadTermHistory(); // oldest first, newest last
  let termHistoryIdx = -1; // -1 means "editing a fresh line"
  let termDraft = "";

  function pushTermHistory(cmd) {
    if (!cmd.trim()) return;
    // Don't record an immediate repeat, same as a real shell.
    if (termHistory[termHistory.length - 1] === cmd) return;
    termHistory.push(cmd);
    if (termHistory.length > MAX_TERM_HISTORY) termHistory = termHistory.slice(-MAX_TERM_HISTORY);
    try {
      localStorage.setItem(TERM_HISTORY_KEY, JSON.stringify(termHistory));
    } catch (err) {
      /* history is a convenience, never fail a command over it */
    }
  }

  // Flags each command actually accepts, so completion can't suggest a flag
  // that the parser will ignore.
  const COMMAND_FLAGS = {
    train: ["--cohort", "--preset", "--k", "--clip-norm", "--noise", "--local-epochs", "--rounds", "--dropout", "--secure-agg"],
    pretrain: ["--cohort", "--devices", "--shards", "--steps", "--batch", "--lr", "--preset"],
    posttrain: ["--cohort", "--steps", "--lr", "--shards", "--sparsity", "--devices", "--batch", "--no-save", "--rank", "--alpha", "--qlora"],
  };
  COMMAND_FLAGS.start = COMMAND_FLAGS.train;
  const POSTTRAIN_STAGES = ["finetune", "lora", "qlora", "distill", "quantize", "prune"];
  const FLAG_VALUES = {
    "--cohort": () => COHORTS.map((c) => c.id),
    "--preset": () => ["small", "medium", "large", "transformer", "linear"],
  };

  function longestCommonPrefix(list) {
    if (!list.length) return "";
    let p = list[0];
    list.forEach((s) => {
      while (!s.startsWith(p)) p = p.slice(0, -1);
    });
    return p;
  }

  // Works out what the token under the cursor should complete against.
  function completionsFor(value) {
    const endsWithSpace = /\s$/.test(value);
    const tokens = value.trimStart().split(/\s+/).filter(Boolean);
    const token = endsWithSpace ? "" : tokens[tokens.length - 1] || "";
    const cmd = tokens[0] ? tokens[0].toLowerCase() : "";
    const prev = endsWithSpace ? tokens[tokens.length - 1] : tokens[tokens.length - 2];

    // A value for the preceding flag (e.g. `--cohort ap` -> apac)
    if (prev && FLAG_VALUES[prev]) {
      return { token, list: FLAG_VALUES[prev]().filter((v) => v.startsWith(token)) };
    }
    // First token: complete the command itself
    if (tokens.length === 0 || (tokens.length === 1 && !endsWithSpace)) {
      return { token, list: Object.keys(TERMINAL_COMMANDS).filter((c) => c.startsWith(token)).sort() };
    }
    // posttrain's stage argument
    if (cmd === "posttrain" && (tokens.length === 1 || (tokens.length === 2 && !endsWithSpace)) && !token.startsWith("--")) {
      return { token, list: POSTTRAIN_STAGES.filter((s) => s.startsWith(token)) };
    }
    // Otherwise: flags for this command
    const flags = COMMAND_FLAGS[cmd] || [];
    const used = tokens.filter((t) => t.startsWith("--"));
    const avail = flags.filter((f) => !used.includes(f) || f === token);
    return { token, list: avail.filter((f) => f.startsWith(token)) };
  }

  // Live suggestion list for the next argument, driven by the same
  // completionsFor() that Tab uses, so the menu can never offer something Tab
  // would not insert or the parser would ignore.
  let suggestIndex = -1;
  let suggestList = [];

  const FLAG_HELP = {
    "--cohort": "device segment to sample from",
    "--preset": "model architecture",
    "--k": "devices sampled per round",
    "--clip-norm": "L2 clip threshold C",
    "--noise": "privacy noise multiplier z",
    "--local-epochs": "local epochs per client",
    "--rounds": "auto-pause after N rounds",
    "--dropout": "% of devices that fail to report",
    "--secure-agg": "mask updates, only the sum is recoverable",
    "--devices": "devices whose data is pooled",
    "--shards": "data-parallel shards",
    "--steps": "optimizer steps",
    "--batch": "per-shard batch size",
    "--lr": "learning rate",
    "--sparsity": "fraction of weights to zero",
    "--rank": "LoRA rank r (lower = fewer trainable params)",
    "--alpha": "LoRA scaling, defaults to 2r",
    "--no-save": "measure only, do not keep the artifact",
  };

  function hideSuggest() {
    suggestList = [];
    suggestIndex = -1;
    if (els.termSuggest) els.termSuggest.hidden = true;
  }

  function renderSuggest() {
    if (!els.termSuggest) return;
    const value = els.terminalInput.value;
    // Nothing to suggest on an empty prompt: the help line already covers that.
    if (!value.trim()) { hideSuggest(); return; }
    const { list } = completionsFor(value);
    if (!list.length || (list.length === 1 && value.endsWith(list[0] + " "))) { hideSuggest(); return; }

    suggestList = list.slice(0, 40);
    if (suggestIndex >= suggestList.length) suggestIndex = suggestList.length - 1;

    els.termSuggest.innerHTML = suggestList
      .map((item, i) => {
        const hint = FLAG_HELP[item] || (TERMINAL_COMMANDS[item] ? "command" : "");
        return `<div class="term-suggest-item${i === suggestIndex ? " active" : ""}" data-i="${i}">` +
          `<span class="term-suggest-name">${escapeHtml(item)}</span>` +
          (hint ? `<span class="term-suggest-hint">${escapeHtml(hint)}</span>` : "") +
          `</div>`;
      })
      .join("");
    els.termSuggest.hidden = false;
    const active = els.termSuggest.querySelector(".term-suggest-item.active");
    if (active && typeof active.scrollIntoView === "function") active.scrollIntoView({ block: "nearest" });
    els.termSuggest.querySelectorAll(".term-suggest-item").forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        e.preventDefault(); // keep focus in the input
        acceptSuggest(+el.dataset.i);
      });
    });
  }

  function acceptSuggest(i) {
    const pick = suggestList[i];
    if (pick === undefined) return;
    const input = els.terminalInput;
    const { token } = completionsFor(input.value);
    const base = token ? input.value.slice(0, input.value.length - token.length) : input.value;
    input.value = `${base}${pick} `;
    hideSuggest();
    renderSuggest();
    input.focus();
  }

  function applyCompletion() {
    const input = els.terminalInput;
    const { token, list } = completionsFor(input.value);
    if (!list.length) return;
    const base = token ? input.value.slice(0, input.value.length - token.length) : input.value;
    if (list.length === 1) {
      input.value = `${base}${list[0]} `;
      return;
    }
    const common = longestCommonPrefix(list);
    if (common.length > token.length) input.value = `${base}${common}`;
    // Same as a shell: show the options when the completion is ambiguous.
    termOut(list.join("&nbsp;&nbsp;"));
  }

  // Brings the terminal up: scroll it into view, expand if collapsed, focus
  // the prompt. Previously Ctrl+` only toggled the expanded height, which
  // did not actually get you to a usable prompt.
  function focusTerminal() {
    const panel = els.terminalPanel || document.getElementById("terminal-panel");
    if (panel && typeof panel.scrollIntoView === "function") {
      panel.scrollIntoView({ behavior: "smooth", block: "center" });
      if (!panel.classList.contains("expanded")) toggleTerminalExpand();
    }
    els.terminalInput.focus();
  }

  function initTerminalConsole() {
    const input = els.terminalInput;
    input.addEventListener("input", () => { suggestIndex = -1; renderSuggest(); });
    input.addEventListener("blur", () => setTimeout(hideSuggest, 120));
    input.addEventListener("focus", renderSuggest);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        // Enter takes the highlighted suggestion first, then runs on the next
        // press, so the menu never swallows a command you meant to execute.
        if (suggestIndex >= 0) { e.preventDefault(); acceptSuggest(suggestIndex); return; }
        hideSuggest();
        const value = input.value;
        input.value = "";
        termHistoryIdx = -1;
        termDraft = "";
        pushTermHistory(value);
        runTerminalCommand(value);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        if (suggestIndex >= 0) acceptSuggest(suggestIndex);
        else applyCompletion();
        renderSuggest();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!els.termSuggest.hidden && suggestList.length) {
          suggestIndex = suggestIndex <= 0 ? suggestList.length - 1 : suggestIndex - 1;
          renderSuggest();
          return;
        }
        if (!termHistory.length) return;
        if (termHistoryIdx === -1) termDraft = input.value;
        termHistoryIdx = Math.min(termHistoryIdx + 1, termHistory.length - 1);
        input.value = termHistory[termHistory.length - 1 - termHistoryIdx];
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!els.termSuggest.hidden && suggestList.length) {
          suggestIndex = suggestIndex >= suggestList.length - 1 ? 0 : suggestIndex + 1;
          renderSuggest();
          return;
        }
        if (termHistoryIdx <= 0) {
          termHistoryIdx = -1;
          input.value = termDraft;
        } else {
          termHistoryIdx--;
          input.value = termHistory[termHistory.length - 1 - termHistoryIdx];
        }
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        clearTerminal();
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        if (running) {
          termOut("^C");
          els.start.click(); // pause the run, same path as the button
        } else if (input.value) {
          termOut(`^C ${input.value}`);
          input.value = "";
          termHistoryIdx = -1;
        }
        return;
      }
      if (e.key === "Escape") {
        if (!els.termSuggest.hidden) { hideSuggest(); return; }
        input.blur();
      }
    });
  }

  // ---------- terminal drag-to-resize (from the top edge) ----------
  // CSS `resize: vertical` only grows from the bottom-right corner, which is
  // easy to miss on a panel that sits at the bottom of the page. This handle
  // lets you grab the top edge and drag it up to grow the log, anchored to
  // the same min/max the native resize handle respects.
  function initTerminalDrag() {
    const MIN_HEIGHT = 140;
    const MAX_HEIGHT = 800;
    let dragging = false;
    let startY = 0;
    let startHeight = 0;

    function pointY(e) {
      return e.touches && e.touches.length ? e.touches[0].clientY : e.clientY;
    }

    function onMove(e) {
      if (!dragging) return;
      const delta = startY - pointY(e);
      const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight + delta));
      els.terminalBody.style.height = `${next}px`;
      if (e.cancelable) e.preventDefault();
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      els.terminalDragHandle.classList.remove("dragging");
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    }

    function onDown(e) {
      dragging = true;
      startY = pointY(e);
      startHeight = els.terminalBody.getBoundingClientRect().height;
      els.terminalDragHandle.classList.add("dragging");
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("touchend", onUp);
      e.preventDefault();
    }

    els.terminalDragHandle.addEventListener("mousedown", onDown);
    els.terminalDragHandle.addEventListener("touchstart", onDown, { passive: false });
  }

  // ---------- code viewer (real source, fetched live from this server) ----------
  // Every real file this demo is built from, addressed by its actual server
  // path so the viewer fetches the running source rather than a copy.
  const CODE_FILES = [
    { id: "architecture", label: "Architecture", desc: "System design", isDiagram: true },

    { id: "index.html", stage: "Platform", desc: "page structure", lang: "html" },
    { id: "style.css", stage: "Platform", desc: "all styling", lang: "css" },
    { id: "app.js", stage: "Platform", desc: "UI + orchestration", lang: "js" },
    { id: "fl.js", stage: "Federate", desc: "DP-FedAvg training core", lang: "js" },
    { id: "data.js", stage: "Data", desc: "synthetic device data", lang: "js" },
    { id: "models.js", stage: "Models", desc: "model architectures", lang: "js" },

    { id: "docs/federated-round.md", stage: "Overview", desc: "how one federated round works, step by step", lang: "md" },
    { id: "docs/demo-script.md", stage: "Overview", desc: "10 minute interview walkthrough", lang: "md" },
    { id: "docs/apple-ads-privacy.md", stage: "Overview", desc: "how this maps to Apple Ads privacy by default", lang: "md" },
    { id: "data/README.md", stage: "Data", desc: "how the synthetic population works", lang: "md" },
    { id: "data/sample-devices.json", stage: "Data", desc: "real generator output: 4 simulated iPhones", lang: "json" },
    { id: "places/silicon-valley.json", stage: "Data", desc: "154 real venues (OpenStreetMap)", lang: "json" },
    { id: "pretrained/adrank-us.json", stage: "Deploy", desc: "shipped factory checkpoint", lang: "json" },
    { id: "scripts/make_pretrained.js", stage: "Pre-train", desc: "offline checkpoint generator", lang: "js" },

    { id: "python/README.md", stage: "Platform", desc: "package overview", lang: "md" },
    { id: "python/requirements.txt", stage: "Platform", desc: "pinned deps", lang: "txt" },
    { id: "python/federated_ranker/__init__.py", stage: "Platform", desc: "package exports", lang: "py" },
    { id: "python/federated_ranker/config.py", stage: "Platform", desc: "cohorts + feature names", lang: "py" },
    { id: "python/federated_ranker/data.py", stage: "Data", desc: "synthetic device data", lang: "py" },
    { id: "python/federated_ranker/models.py", stage: "Models", desc: "AdRank nets (PyTorch)", lang: "py" },
    { id: "python/federated_ranker/privacy.py", stage: "Federate", desc: "clip + Gaussian noise", lang: "py" },
    { id: "python/federated_ranker/trainer.py", stage: "Federate", desc: "DP-FedAvg training core", lang: "py" },
    { id: "python/federated_ranker/evaluate.py", stage: "Evaluate", desc: "held-out eval report", lang: "py" },
    { id: "python/scripts/train.py", stage: "Pre-train", desc: "CLI entry point", lang: "py" },
    { id: "python/tests/test_data.py", stage: "Tests", desc: "data invariants", lang: "py" },
    { id: "python/tests/test_privacy.py", stage: "Tests", desc: "clip + noise tests", lang: "py" },
    { id: "python/tests/test_trainer.py", stage: "Tests", desc: "training loop tests", lang: "py" },
  ];
  CODE_FILES.forEach((f) => {
    if (!f.label) f.label = f.id.split("/").pop();
  });
  const CODE_FILE_BY_ID = Object.fromEntries(CODE_FILES.map((f) => [f.id, f]));
  const codeFileCache = {};
  let activeCodeFile = CODE_FILES[0].id;

  // Turns the flat path list into a real directory tree. Declaration order is
  // preserved within each directory, so the listing reads in a deliberate
  // order rather than alphabetically.
  function buildCodeTree(files) {
    const root = { dirs: new Map(), files: [] };
    files.forEach((f) => {
      if (f.isDiagram) return;
      const parts = f.id.split("/");
      const fileName = parts.pop();
      let node = root;
      parts.forEach((dir) => {
        if (!node.dirs.has(dir)) node.dirs.set(dir, { dirs: new Map(), files: [] });
        node = node.dirs.get(dir);
      });
      node.files.push({ ...f, fileName });
    });
    return root;
  }

  const FILE_ICONS = {
    js: "JS", py: "PY", html: "◇", css: "#", json: "{}", md: "M", txt: "T",
  };

  function renderCodeTreeNode(node, depth) {
    let html = "";
    node.dirs.forEach((child, name) => {
      html += `<div class="tree-row tree-folder" data-folder="${name}" style="--depth:${depth}">
        <span class="tree-caret">▾</span><span class="tree-folder-name">${name}</span>
      </div>`;
      html += `<div class="tree-children">${renderCodeTreeNode(child, depth + 1)}</div>`;
    });
    node.files.forEach((f) => {
      html += `<div class="tree-row tree-file" data-file="${f.id}" title="${f.desc}" style="--depth:${depth}">
        <span class="tree-icon tree-icon-${f.lang}">${FILE_ICONS[f.lang] || "•"}</span>
        <span class="tree-file-name">${f.fileName}</span>
      </div>`;
    });
    return html;
  }

  const ARCHITECTURE_STAGES = [
    {
      title: "iPhone devices",
      desc: "Opted-in devices across US/EU/APAC/behavior segments. Raw interaction signals, search, taps, dwell time, never leave the device.",
      tags: ["1.84M devices", "6–10 sampled/round"],
    },
    {
      title: "Local training",
      desc: "Each round, K devices are freshly sampled from the eligible cohort (client sampling, not a fixed roster) and train locally on their own data in parallel. Same data-parallel shape as multi-worker distributed training, just with workers that are phones instead of GPU nodes, and data that never gets shuffled between them.",
      tags: ["data-parallel workers", "Adam optimizer", "2 local epochs", "batch = 16"],
    },
    {
      title: "Differential privacy",
      desc: "Each device's update is clipped to an L2 ball of radius C, then Gaussian noise is added (the Gaussian mechanism) before it ever leaves the device.",
      tags: ["L2 clip (C)", "Gaussian mechanism", "per-round ε tracked"],
    },
    {
      title: "Coordinator: FedAvg",
      desc: () =>
        secureAggOn()
          ? "Noised updates are combined into the global model, the same reduce step a parameter server or an all-reduce collective runs in a GPU cluster. Secure aggregation is ON: every pair of devices shares a mask that one adds and the other subtracts, so the masks cancel in the sum while each individual update is unreadable. The coordinator recovers only the aggregate, never a single device's vector. The Update Norms panel goes dark as a direct consequence, because per-device statistics no longer exist for it to plot."
          : "Noised updates from all sampled devices are averaged into the global model, the same reduce step a parameter server or an all-reduce collective runs in a GPU cluster. Raw interaction data never leaves the device, but this coordinator does see each device's individual noised update: aggregation is in the clear. Turn on Secure aggregation in the Train controls to add pairwise masking (Bonawitz et al. 2017), after which only the sum is recoverable and the Update Norms panel necessarily goes dark.",
      tags: () => [
        "parameter-server-style aggregation",
        "federated averaging",
        "no raw data seen",
        secureAggOn() ? "secure aggregation ON" : "secure aggregation OFF",
      ],
    },
    {
      title: "Global model",
      desc: "AdRank-Net (configurable S/M/L, a 2-head self-attention transformer, a linear baseline, or an imported architecture). Updated every round; checkpoints can be saved and evaluated independently.",
      tags: ["AdRank-Net", "AdRank-Transformer", "versioned checkpoints"],
    },
    {
      title: "Evaluation",
      desc: "Scored on a fixed held-out validation set that's never trained on. Compared against a naive mean-baseline predictor, broken down by engagement tier.",
      tags: ["MAE / RMSE", "baseline lift", "life-stage buckets"],
    },
    {
      title: "Deployment",
      desc: "The evaluated model is pushed to a chosen serving target, each with a different latency/cost profile, benchmarked live on this device.",
      tags: ["Neural Engine", "iCloud batch", "background prefetch"],
    },
    {
      title: "Inference",
      desc: "Real-time ad ranking on-device: a held-out engine's signals go in, a predicted engagement score comes out and re-ranks the Maps result list.",
      tags: ["single-digit ms latency", "on-device ranking"],
    },
  ];

  // Swimlane block diagram: three trust boundaries (device / coordinator /
  // serving) with the data that actually crosses between them labelled on the
  // arrows. Drawn as SVG so it scales with the panel instead of reflowing.
  function secureAggOn() {
    return !!(els.secureAgg && els.secureAgg.checked);
  }

  const ARCH_LANES = [
    {
      title: "ON DEVICE",
      sub: "trust boundary: raw data never leaves",
      accent: "#0a84ff",
      boxes: [
        { title: "Interaction signals", sub: "search · taps · dwell time · 14 features" },
        { title: "Local training", sub: "Adam · 2 epochs · batch 16" },
        { title: "Clip to C, add noise", sub: "Gaussian mechanism, per update" },
      ],
    },
    {
      title: "COORDINATOR",
      sub: "sees noised updates only, never raw data",
      accent: "#30d158",
      boxes: [
        // Rendered from the live toggle, not hardcoded: this box previously
        // claimed "no secure agg" even after the masking protocol shipped.
        {
          title: () => (secureAggOn() ? "Aggregation (masked)" : "Aggregation (in the clear)"),
          sub: () =>
            secureAggOn()
              ? "FedAvg over K devices · only the sum is recoverable"
              : "FedAvg over K devices · server sees each update",
        },
        { title: "Global model", sub: "AdRank-Net / AdRank-Transformer" },
        { title: "Held-out evaluation", sub: "MAE · RMSE · baseline lift · ε spent" },
      ],
    },
    {
      title: "SERVING",
      sub: "compressed, then pushed back to devices",
      accent: "#bf5af2",
      boxes: [
        { title: "Compression", sub: "int8 · magnitude pruning · distillation" },
        { title: "Deploy target", sub: "Neural Engine · iCloud batch · prefetch" },
        { title: "On-device ranking", sub: "sponsored placement in Maps results" },
      ],
    },
  ];

  function renderArchitectureDiagram() {
    const W = 400;
    const BOX_X = 74, BOX_W = 300, BOX_H = 46;
    const LANE_PAD_TOP = 34;
    const LANE_H = LANE_PAD_TOP + 3 * BOX_H + 2 * 14 + 14;
    const LANE_GAP = 26;
    const H = ARCH_LANES.length * LANE_H + (ARCH_LANES.length - 1) * LANE_GAP + 16;

    let svg = `<svg class="arch-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="System architecture diagram">
      <defs>
        <marker id="arch-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" fill="rgba(255,255,255,0.42)"></path>
        </marker>
      </defs>`;

    const boxCentres = [];

    ARCH_LANES.forEach((lane, li) => {
      const laneY = 8 + li * (LANE_H + LANE_GAP);
      svg += `<rect x="8" y="${laneY}" width="${W - 16}" height="${LANE_H}" rx="12" class="arch-lane"></rect>`;
      svg += `<rect x="8" y="${laneY}" width="4" height="${LANE_H}" rx="2" fill="${lane.accent}" opacity="0.85"></rect>`;
      svg += `<text x="24" y="${laneY + 20}" class="arch-lane-title" fill="${lane.accent}">${lane.title}</text>`;
      svg += `<text x="24" y="${laneY + 32}" class="arch-lane-sub">${lane.sub}</text>`;

      lane.boxes.forEach((b, bi) => {
        const y = laneY + LANE_PAD_TOP + bi * (BOX_H + 14);
        boxCentres.push({ lane: li, box: bi, x: BOX_X + BOX_W / 2, top: y, bottom: y + BOX_H });
        svg += `<rect x="${BOX_X}" y="${y}" width="${BOX_W}" height="${BOX_H}" rx="9" class="arch-box"></rect>`;
        svg += `<circle cx="${BOX_X + 18}" cy="${y + BOX_H / 2}" r="4" fill="${lane.accent}"></circle>`;
        const bTitle = typeof b.title === "function" ? b.title() : b.title;
        const bSub = typeof b.sub === "function" ? b.sub() : b.sub;
        svg += `<text x="${BOX_X + 32}" y="${y + 19}" class="arch-box-title">${bTitle}</text>`;
        svg += `<text x="${BOX_X + 32}" y="${y + 34}" class="arch-box-sub">${bSub}</text>`;

        // Vertical arrow to the next box inside the same lane.
        if (bi < lane.boxes.length - 1) {
          svg += `<line x1="${BOX_X + BOX_W / 2}" y1="${y + BOX_H}" x2="${BOX_X + BOX_W / 2}" y2="${y + BOX_H + 10}" class="arch-arrow" marker-end="url(#arch-arrow)"></line>`;
        }
      });
    });

    // Arrows that cross a trust boundary, labelled with what actually moves.
    const crossings = [
      { from: 2, to: 3, label: "Δw only · clipped + noised" },
      { from: 5, to: 6, label: "evaluated checkpoint" },
    ];
    crossings.forEach((c) => {
      const a = boxCentres[c.from], b = boxCentres[c.to];
      svg += `<line x1="${a.x}" y1="${a.bottom}" x2="${b.x}" y2="${b.top - 4}" class="arch-arrow cross" marker-end="url(#arch-arrow)"></line>`;
      svg += `<rect x="${a.x - 78}" y="${(a.bottom + b.top) / 2 - 9}" width="156" height="17" rx="8" class="arch-edge-pill"></rect>`;
      svg += `<text x="${a.x}" y="${(a.bottom + b.top) / 2 + 3}" text-anchor="middle" class="arch-edge-label">${c.label}</text>`;
    });

    // Feedback loop: the updated global model is broadcast back to devices.
    const globalModel = boxCentres[4];
    const firstDevice = boxCentres[0];
    svg += `<path d="M ${BOX_X} ${globalModel.top + BOX_H / 2} H 40 V ${firstDevice.top + BOX_H / 2} H ${BOX_X - 4}" class="arch-arrow feedback" marker-end="url(#arch-arrow)"></path>`;
    svg += `<text x="46" y="${(globalModel.top + firstDevice.top) / 2}" class="arch-edge-label feedback" transform="rotate(-90 46 ${(globalModel.top + firstDevice.top) / 2})" text-anchor="middle">model broadcast</text>`;

    svg += `</svg>`;

    const detail = ARCHITECTURE_STAGES.map(
      (s, i) => `<div class="arch-stage">
          <div class="arch-node">${i + 1}</div>
          <div class="arch-content">
            <h5>${s.title}</h5>
            <p>${typeof s.desc === "function" ? s.desc() : s.desc}</p>
            <div class="arch-meta">${(typeof s.tags === "function" ? s.tags() : s.tags).map((t) => `<span class="arch-tag">${t}</span>`).join("")}</div>
          </div>
        </div>`
    ).join("");

    return `<div class="arch-diagram">${svg}
      <h6 class="arch-detail-head">Stage detail</h6>
      ${detail}</div>`;
  }

  // Single-pass tokenizer: scans the ORIGINAL source once with one combined
  // regex, emitting escaped literal text plus wrapped tokens as it goes.
  // Applying separate regex passes sequentially (comment pass, then string
  // pass, then keyword pass...) is the naive approach, but each later pass
  // ends up re-scanning HTML the earlier passes already inserted — e.g. a
  // string-matching pass will happily match the `"tok-com"` inside a
  // class="tok-com" attribute that a comment pass just emitted, corrupting
  // the markup. Never re-scanning already-generated output avoids that class
  // of bug entirely.
  const JS_KEYWORDS =
    "const|let|var|function|return|if|else|for|while|new|class|extends|async|await|this|typeof|instanceof|true|false|null|undefined|throw|try|catch|finally|break|continue|switch|case|default|of|in|export|import";
  const JS_TOKEN_PATTERN = new RegExp(
    `(\\/\\/[^\\n]*)|` + // 1: line comment
      "(`(?:\\\\.|[^`\\\\])*`|\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*')|" + // 2: string
      `\\b(${JS_KEYWORDS})\\b|` + // 3: keyword
      `\\b(\\d+\\.?\\d*)\\b`, // 4: number
    "g"
  );

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Python uses '#' comments and allows triple-quoted strings (which must be
  // tried before the single/double-quote alternatives so a `"""docstring"""`
  // doesn't get read as an empty string followed by stray quotes).
  const PY_KEYWORDS =
    "def|class|return|if|elif|else|for|while|in|is|not|and|or|import|from|as|with|try|except|finally|raise|pass|break|continue|lambda|yield|global|nonlocal|assert|del|True|False|None|self|async|await";
  const PY_TOKEN_PATTERN = new RegExp(
    `(#[^\\n]*)|` + // 1: comment
      `('''[\\s\\S]*?'''|"""[\\s\\S]*?"""|f?"(?:\\\\.|[^"\\\\])*"|f?'(?:\\\\.|[^'\\\\])*')|` + // 2: string
      `\\b(${PY_KEYWORDS})\\b|` + // 3: keyword
      `\\b(\\d+\\.?\\d*)\\b`, // 4: number
    "g"
  );

  function runTokenPattern(code, pattern) {
    let out = "";
    let lastIndex = 0;
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(code)) !== null) {
      out += escapeHtml(code.slice(lastIndex, match.index));
      if (match[1] !== undefined) out += `<span class="tok-com">${escapeHtml(match[1])}</span>`;
      else if (match[2] !== undefined) out += `<span class="tok-str">${escapeHtml(match[2])}</span>`;
      else if (match[3] !== undefined) out += `<span class="tok-kw">${escapeHtml(match[3])}</span>`;
      else if (match[4] !== undefined) out += `<span class="tok-num">${escapeHtml(match[4])}</span>`;
      lastIndex = pattern.lastIndex;
    }
    out += escapeHtml(code.slice(lastIndex));
    return out;
  }

  function highlightJs(code) {
    return runTokenPattern(code, JS_TOKEN_PATTERN);
  }

  function highlightPython(code) {
    return runTokenPattern(code, PY_TOKEN_PATTERN);
  }

  // CSS: /* */ comments, quoted strings, and numeric/dimension literals.
  const CSS_TOKEN_PATTERN = new RegExp(
    `(\\/\\*[\\s\\S]*?\\*\\/)|` + // 1: comment
      `("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')|` + // 2: string
      `(@[\\w-]+)|` + // 3: at-rule, styled as a keyword
      `\\b(\\d+\\.?\\d*(?:px|em|rem|vh|vw|%|s|ms|deg)?)\\b`, // 4: number
    "g"
  );

  // HTML: comments, tag names, and attribute values.
  const HTML_TOKEN_PATTERN = new RegExp(
    `(<!--[\\s\\S]*?-->)|` + // 1: comment
      `("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')|` + // 2: attribute value
      `(<\\/?[a-zA-Z][\\w-]*)`, // 3: tag name
    "g"
  );

  // JSON has no comments or keywords worth colouring beyond literals, so the
  // string/number halves of the JS pattern already cover it.
  function highlightCode(code, lang) {
    if (lang === "py") return highlightPython(code);
    if (lang === "css") return runTokenPattern(code, CSS_TOKEN_PATTERN);
    if (lang === "html") return runTokenPattern(code, HTML_TOKEN_PATTERN);
    if (lang === "md" || lang === "txt") return escapeHtml(code);
    return highlightJs(code);
  }


  // ---------- markdown rendering ----------
  // Fenced code blocks are lifted out FIRST and restored last, so no inline
  // rule ever rewrites something inside a code sample. This is the same class
  // of bug the syntax highlighter hit: never re-scan generated output.
  function renderMarkdown(text) {
    const blocks = [];
    let src = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const i = blocks.length;
      blocks.push(`<pre class="md-pre"><code>${highlightCode(code.replace(/\n$/, ""), lang || "txt")}</code></pre>`);
      return `\u0000BLOCK${i}\u0000`;
    });

    src = escapeHtml(src);

    const inline = (s) =>
      s
        .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="md-link">$1</a>');

    const out = [];
    const lines = src.split("\n");
    let list = null;

    const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Tables: a header row followed by a |---| separator.
      if (/^\s*\|/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || "")) {
        closeList();
        const cells = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        const head = cells(line);
        let body = "";
        let j = i + 2;
        while (j < lines.length && /^\s*\|/.test(lines[j])) {
          body += `<tr>${cells(lines[j]).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`;
          j++;
        }
        out.push(
          `<table class="md-table"><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`
        );
        i = j - 1;
        continue;
      }

      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) { closeList(); out.push(`<h${h[1].length} class="md-h md-h${h[1].length}">${inline(h[2])}</h${h[1].length}>`); continue; }

      if (/^\s*[-*]\s+/.test(line)) {
        if (list !== "ul") { closeList(); out.push("<ul class=\"md-list\">"); list = "ul"; }
        out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`);
        continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        if (list !== "ol") { closeList(); out.push("<ol class=\"md-list\">"); list = "ol"; }
        out.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ""))}</li>`);
        continue;
      }

      if (/^\s*(---|\*\*\*)\s*$/.test(line)) { closeList(); out.push('<hr class="md-hr">'); continue; }
      // Matches &gt; as well as >: escapeHtml has already run by this point, so
      // testing only for a literal > silently drops every blockquote.
      if (/^\s*(&gt;|>)/.test(line)) {
        closeList();
        out.push(`<blockquote class="md-quote">${inline(line.replace(/^\s*(&gt;|>)\s?/, ""))}</blockquote>`);
        continue;
      }
      if (!line.trim()) { closeList(); continue; }

      out.push(`<p class="md-p">${inline(line)}</p>`);
    }
    closeList();

    return out.join("\n").replace(/<\/blockquote>\n<blockquote class="md-quote">/g, " ").replace(/\u0000BLOCK(\d+)\u0000/g, (_, i) => blocks[+i]);
  }

  async function loadCodeFile(id) {
    if (codeFileCache[id]) return codeFileCache[id];
    const res = await fetch(id);
    const text = await res.text();
    codeFileCache[id] = text;
    return text;
  }

  async function showCodeFile(id) {
    activeCodeFile = id;
    els.codeSidebar.querySelectorAll("[data-file]").forEach((t) => t.classList.toggle("active", t.dataset.file === id));
    els.codeViewCode.parentElement.classList.toggle("diagram-mode", id === "architecture");
    els.codeViewCode.parentElement.classList.remove("md-mode");

    const meta = CODE_FILE_BY_ID[id];
    els.codePanelPath.textContent = id === "architecture" ? "Architecture" : id;
    els.codePanelMeta.textContent = meta ? meta.desc : "";

    if (id === "architecture") {
      els.codeViewCode.innerHTML = renderArchitectureDiagram();
      els.codeViewCode.parentElement.scrollTop = 0;
      return;
    }

    els.codeViewCode.textContent = "Loading…";
    try {
      const text = await loadCodeFile(id);
      const lang = (meta && meta.lang) || "js";
      // Markdown is rendered, not shown as source: these files are documents.
      els.codeViewCode.parentElement.classList.toggle("md-mode", lang === "md");
      els.codeViewCode.innerHTML = lang === "md" ? renderMarkdown(text) : highlightCode(text, lang);
      els.codeViewCode.parentElement.scrollTop = 0;
    } catch (err) {
      els.codeViewCode.textContent = `Couldn't load ${id}: ${err.message}`;
    }
  }

  const CODE_STAGES = ["All", "Overview", "Data", "Models", "Pre-train", "Federate", "Evaluate", "Deploy", "Platform", "Tests"];
  let activeCodeStage = "All";

  // Lifecycle filter over the file tree: the same files, grouped the way the
  // pipeline runs, so the source can be read stage by stage rather than as a
  // flat directory listing.
  function renderCodeSidebar() {
    const files = activeCodeStage === "All" ? CODE_FILES : CODE_FILES.filter((f) => f.stage === activeCodeStage);
    const tree = buildCodeTree(files);
    const menu =
      `<div class="code-stages">` +
      CODE_STAGES.map(
        (s) => `<button type="button" class="code-stage${s === activeCodeStage ? " active" : ""}" data-stage="${s}">${s}</button>`
      ).join("") +
      `</div>`;
    const arch =
      activeCodeStage === "All" || activeCodeStage === "Overview"
        ? `<div class="tree-row tree-special" data-file="architecture" style="--depth:0">
             <span class="tree-icon tree-icon-arch">◈</span><span class="tree-file-name">Architecture</span>
           </div><div class="tree-sep"></div>`
        : "";
    els.codeSidebar.innerHTML =
      menu + arch +
      `<div class="tree-row tree-folder tree-root" data-folder="fl-demo" style="--depth:0">
         <span class="tree-caret">▾</span><span class="tree-folder-name">fl-demo</span>
       </div>
       <div class="tree-children">${renderCodeTreeNode(tree, 1)}</div>`;

    els.codeSidebar.querySelectorAll(".code-stage").forEach((b) =>
      b.addEventListener("click", () => { activeCodeStage = b.dataset.stage; renderCodeSidebar(); })
    );
    els.codeSidebar.querySelectorAll("[data-file]").forEach((row) =>
      row.addEventListener("click", () => showCodeFile(row.dataset.file))
    );
    els.codeSidebar.querySelectorAll(".tree-folder").forEach((row) =>
      row.addEventListener("click", () => {
        const kids = row.nextElementSibling;
        if (!kids || !kids.classList.contains("tree-children")) return;
        row.classList.toggle("collapsed", kids.classList.toggle("collapsed"));
      })
    );
    els.codeSidebar.querySelectorAll("[data-file]").forEach((t) =>
      t.classList.toggle("active", t.dataset.file === activeCodeFile)
    );
  }

  function initCodePanel() {
    renderCodeSidebar();

    function open() {
      els.codePanel.classList.add("open");
      els.codeBackdrop.classList.add("open");
      els.codePanel.setAttribute("aria-hidden", "false");
      showCodeFile(activeCodeFile);
    }
    function close() {
      els.codePanel.classList.remove("open");
      els.codeBackdrop.classList.remove("open");
      els.codePanel.setAttribute("aria-hidden", "true");
    }

    els.codeToggle.addEventListener("click", open);
    els.codeClose.addEventListener("click", close);
    els.codeBackdrop.addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && els.codePanel.classList.contains("open")) close();
    });
  }

  // ---------- generic dark mini line-chart (observability panels) ----------
  // Per-device bar chart with a threshold line, used for the update-norm
  // panel: one bar per sampled device, bars above C are the ones clipped.
  function drawBarChart(canvas, values, opts = {}) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 340, h = rect.height || 130;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!values.length) return;

    const pad = { l: 6, r: 6, t: 12, b: 6 };
    const threshold = opts.threshold;
    const maxV = Math.max(...values, threshold || 0) * 1.2 || 1;
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const slot = innerW / values.length;
    const barW = Math.max(2, Math.min(18, slot * 0.62));

    values.forEach((v, i) => {
      const x = pad.l + slot * i + (slot - barW) / 2;
      const barH = Math.max(1, (v / maxV) * innerH);
      const y = pad.t + innerH - barH;
      ctx.fillStyle = threshold != null && v > threshold ? "#ff9f0a" : "#0a84ff";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, barW, barH, 2);
      else ctx.rect(x, y, barW, barH);
      ctx.fill();
    });

    if (threshold != null) {
      const ty = pad.t + innerH - (threshold / maxV) * innerH;
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.l, ty);
      ctx.lineTo(w - pad.r, ty);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "9px -apple-system, sans-serif";
      ctx.fillText(`C = ${threshold}`, pad.l + 2, Math.max(9, ty - 3));
    }
  }

  function drawMiniChart(canvas, series, opts = {}) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 340, h = rect.height || 130;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const allValues = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v));
    if (allValues.length === 0) return;

    const pad = { l: 6, r: 6, t: 10, b: 6 };
    const maxV = opts.max ?? (Math.max(...allValues, opts.minCeil ?? 0) * 1.15 || 1);
    const minV = opts.min ?? 0;
    const n = Math.max(...series.map((s) => s.values.length));
    const xAt = (i) => pad.l + (i / Math.max(1, n - 1)) * (w - pad.l - pad.r);
    const yAt = (v) => pad.t + (1 - (v - minV) / (maxV - minV || 1)) * (h - pad.t - pad.b);

    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    [0.5, 1].forEach((frac) => {
      const y = pad.t + (h - pad.t - pad.b) * (1 - frac);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
    });

    series.forEach((s) => {
      const values = s.values.filter((v) => Number.isFinite(v));
      if (values.length === 0) return;
      if (values.length === 1) {
        ctx.beginPath();
        ctx.arc(xAt(0), yAt(values[0]), 2.5, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.fill();
        return;
      }
      ctx.beginPath();
      values.forEach((v, i) => {
        const x = xAt(i), y = yAt(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();

      const lastX = xAt(values.length - 1), lastY = yAt(values[values.length - 1]);
      ctx.beginPath();
      ctx.arc(lastX, lastY, 2.8, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
    });
  }

  function clearMiniChart(canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // ---------- observability panels (round latency, clip rate, loss divergence, coverage) ----------
  function updateObservabilityPanels(roundClients) {
    const history = trainer.history;
    const cohort = currentCohort();

    roundClients.forEach((c) => {
      touchedFleets.add(c.index);
      deviceMixCounts[c.device] = (deviceMixCounts[c.device] || 0) + 1;
    });
    const coveragePct = ((touchedFleets.size / cohort.population) * 100).toFixed(2);
    els.computeCoverage.textContent = `${fmtInt(touchedFleets.size)} of ${fmtInt(cohort.population)} (${coveragePct}%)`;

    drawMiniChart(els.latencyChartCanvas, [{ values: roundLatencyHistory, color: "#0a84ff" }]);
    const lastLatency = roundLatencyHistory[roundLatencyHistory.length - 1];
    els.latencyCurrent.textContent = `${lastLatency.toFixed(0)} ms`;

    const clipRates = history.map((h) => h.clipRate * 100);
    drawMiniChart(els.cliprateChartCanvas, [{ values: clipRates, color: "#ff9f0a" }], { max: 100, min: 0 });
    const lastClipRate = clipRates[clipRates.length - 1];
    els.cliprateCurrent.textContent = `${lastClipRate.toFixed(0)}%`;
    const lastNorm = history[history.length - 1].avgPreClipNorm;
    els.cliprateNote.textContent = `Share of client updates exceeding the clip norm (C) before noising · avg pre-clip norm ${fmt(lastNorm, 2)}`;

    const localLosses = history.map((h) => h.clientStats.reduce((a, c) => a + c.localLoss, 0) / h.clientStats.length);
    const globalLosses = history.map((h) => h.valLoss);
    drawMiniChart(els.lossdivChartCanvas, [
      { values: localLosses, color: "#64d2ff" },
      { values: globalLosses, color: "#ff375f" },
    ]);
    els.lossdivCurrent.innerHTML = `local <span style="color:#64d2ff">${fmt(localLosses[localLosses.length - 1], 4)}</span> · global <span style="color:#ff375f">${fmt(globalLosses[globalLosses.length - 1], 4)}</span>`;

    const epsilons = history.map((h) => h.epsilonTotal);
    drawMiniChart(els.epsilonChartCanvas, [{ values: epsilons, color: "#30d158" }]);

    // Per-device update norms for the most recent round, against the clip
    // threshold that was actually in force when they were measured.
    const lastRound = history[history.length - 1];
    const lastStats = lastRound.clientStats;
    const norms = lastStats.map((c) => c.preClipNorm).filter((v) => Number.isFinite(v));
    if (lastRound.secureAggregation) {
      // Not a rendering failure: under pairwise masking the coordinator
      // genuinely cannot see any individual client's update, so there is no
      // per-device norm to plot. This panel going dark IS the guarantee.
      clearMiniChart(els.normdistChartCanvas);
      els.normdistCurrent.innerHTML = `<span style="color:#30d158">withheld</span>`;
      els.normdistNote.innerHTML =
        `Unavailable under secure aggregation: masks make individual updates unreadable, ` +
        `so only the sum exists. Mask residual this round ` +
        `<strong>${lastRound.maskResidual != null ? lastRound.maskResidual.toExponential(1) : "n/a"}</strong> ` +
        `(float32 rounding, proof the masks cancelled).`;
    } else if (norms.length) {
      els.normdistNote.textContent = "Per-device ‖Δw‖₂ before clipping. Bars above the dashed line get clipped to C.";
      const clipNorm = parseFloat(els.clip.value);
      drawBarChart(els.normdistChartCanvas, norms, { threshold: clipNorm });
      const clippedNow = norms.filter((v) => v > clipNorm).length;
      const median = [...norms].sort((a, b) => a - b)[Math.floor(norms.length / 2)];
      els.normdistCurrent.innerHTML =
        `median ${fmt(median, 2)} · <span style="color:#ff9f0a">${clippedNow}/${norms.length} clipped</span>`;
    }

    // Throughput per round: the rows each client actually trained on, times
    // the epochs actually used that round, over that round's measured
    // wall-clock time. All three come from the round itself, so changing a
    // slider later can't rewrite history.
    const throughputs = history.map((h, i) => {
      const ms = roundLatencyHistory[i];
      if (!ms) return NaN;
      const samples = h.clientStats.reduce((a, c) => a + (c.samples || 0), 0);
      return (samples * (h.localEpochs || 1)) / (ms / 1000);
    });
    drawMiniChart(els.throughputChartCanvas, [{ values: throughputs, color: "#bf5af2" }]);
    const lastTp = throughputs[throughputs.length - 1];
    if (Number.isFinite(lastTp)) els.throughputCurrent.textContent = `${fmtInt(Math.round(lastTp))} samples/s`;

    // Device reliability: measured dropout per round, plus how much of the
    // sampled cohort actually contributed to this aggregate.
    if (dropoutHistory.length) {
      drawMiniChart(els.dropoutChartCanvas, [{ values: dropoutHistory, color: "#ff453a" }], { max: 100, min: 0 });
      const lastDrop = dropoutHistory[dropoutHistory.length - 1];
      const reported = lastRound.clientStats.length;
      els.dropoutCurrent.innerHTML = lastDrop > 0
        ? `<span style="color:#ff453a">${lastDrop.toFixed(0)}% lost</span> · ${reported} reported`
        : `all ${reported} reported`;
      els.dropoutNote.innerHTML = lastRound.secureAggregation && lastDrop > 0
        ? `Share of sampled devices that failed to report. <strong>With secure aggregation this is the hard case</strong>: ` +
          `a device that drops after mask agreement leaves its masks uncancelled, so real protocols secret-share ` +
          `each mask for recovery. Here masks are derived over the surviving set, which only a simulation can do.`
        : `Share of sampled devices that failed to report in time. Real cross-device FL loses devices to battery, network and timeouts every round.`;
    }

    // Prediction spread: the diagnostic that catches a collapsed ranker before
    // it silently produces an auction where every candidate scores the same.
    if (lastRound.predHistogram) {
      const hist = lastRound.predHistogram;
      const total = hist.reduce((a, b) => a + b, 0) || 1;
      const topBin = Math.max(...hist) / total;
      // Mass piled into the first AND last bin is saturation: the model still
      // separates, but only into 0 and 1, which is useless for ranking.
      const extremeShare = (hist[0] + hist[hist.length - 1]) / total;
      drawBarChart(els.preddistChartCanvas, hist);
      const span = (lastRound.predMax - lastRound.predMin) * 100;
      const saturated = topBin > 0.9 || extremeShare > 0.85;
      els.preddistCurrent.innerHTML = saturated
        ? `<span style="color:#ff453a">collapsed</span> · ${(lastRound.predMin * 100).toFixed(0)}–${(lastRound.predMax * 100).toFixed(0)}%`
        : `${(lastRound.predMin * 100).toFixed(0)}–${(lastRound.predMax * 100).toFixed(0)}% · spread ${span.toFixed(0)}pp`;
      els.preddistNote.innerHTML = saturated
        ? `<strong>${topBin > 0.9 ? "Model collapsed" : "Model saturated"}:</strong> ${((topBin > 0.9 ? topBin : extremeShare) * 100).toFixed(0)}% of predictions sit ${topBin > 0.9 ? "in a single bin" : "at the extremes (0% / 100%)"}, so it cannot grade one candidate against another. DP noise inflates weights and steepens the sigmoid: lower z, raise K, or train longer.`
        : `Distribution of the global model's predictions over the held-out set. A healthy ranker spreads out; everything in one bin means the model collapsed.`;
    }

    // Privacy budget burn-down against a target, projected from the measured
    // per-round spend rather than the nominal one.
    const EPS_BUDGET = 50;
    const eps = history.map((h) => h.epsilonTotal);
    const spent = eps[eps.length - 1];
    if (Number.isFinite(spent)) {
      drawMiniChart(els.budgetChartCanvas, [{ values: eps, color: "#30d158" }], { max: Math.max(EPS_BUDGET, spent * 1.1), min: 0 });
      const perRound = spent / history.length;
      const remaining = perRound > 0 ? Math.max(0, Math.floor((EPS_BUDGET - spent) / perRound)) : Infinity;
      const pct = (spent / EPS_BUDGET) * 100;
      els.budgetCurrent.innerHTML =
        `ε ${fmt(spent, 1)} / ${EPS_BUDGET} <span style="color:${pct > 80 ? "#ff453a" : pct > 50 ? "#ff9f0a" : "#30d158"}">(${pct.toFixed(0)}%)</span>`;
      els.budgetNote.innerHTML =
        `Cumulative ε against a ${EPS_BUDGET} budget. At ${fmt(perRound, 2)} per round, ` +
        `<strong>${Number.isFinite(remaining) ? remaining : "∞"} rounds</strong> remain. ` +
        `Composed naively, so a real RDP accountant would leave far more headroom.`;
    } else {
      els.budgetCurrent.innerHTML = `<span style="color:#ff453a">ε = ∞</span>`;
      els.budgetNote.textContent = "Privacy noise is off (z = 0), so no formal guarantee applies and the budget is unbounded.";
    }

    renderDeviceMix();
  }

  // Cumulative hardware mix of every device sampled this session, which is
  // real cross-device FL telemetry: it tells you which silicon your training
  // population actually runs on.
  const deviceMixCounts = Object.create(null);
  function renderDeviceMix() {
    const entries = Object.entries(deviceMixCounts).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return;
    // These are participation events, not distinct handsets: a device that is
    // sampled in three rounds counts three times. Labelled as device-rounds so
    // it can't be misread as a unique-device count (that's Device coverage).
    const total = entries.reduce((a, [, n]) => a + n, 0);
    els.devicemixCurrent.textContent = `${fmtInt(total)} device-rounds`;
    els.devicemixRows.innerHTML = entries
      .map(([name, n]) => {
        const pct = (n / total) * 100;
        return `<div class="devicemix-row">
          <span class="devicemix-name">${name}</span>
          <div class="devicemix-bar"><div class="devicemix-bar-fill" style="width:${pct.toFixed(1)}%"></div></div>
          <span class="devicemix-pct">${pct.toFixed(0)}%</span>
        </div>`;
      })
      .join("");
  }

  function resetObservabilityPanels(cohort) {
    roundLatencyHistory = [];
    dropoutHistory = [];
    touchedFleets = new Set();
    els.computeCoverage.textContent = `0 of ${fmtInt(cohort.population)} (0.00%)`;
    els.latencyCurrent.textContent = "—";
    els.cliprateCurrent.textContent = "—";
    els.cliprateNote.textContent = "Share of client updates exceeding the clip norm (C) before noising.";
    els.lossdivCurrent.textContent = "—";
    els.normdistCurrent.textContent = "—";
    els.throughputCurrent.textContent = "—";
    els.devicemixCurrent.textContent = "—";
    els.devicemixRows.innerHTML = "";
    els.dropoutCurrent.textContent = "—";
    els.preddistCurrent.textContent = "—";
    els.budgetCurrent.textContent = "—";
    Object.keys(deviceMixCounts).forEach((k) => delete deviceMixCounts[k]);
    [
      els.latencyChartCanvas, els.cliprateChartCanvas, els.lossdivChartCanvas,
      els.epsilonChartCanvas, els.normdistChartCanvas, els.throughputChartCanvas, els.dropoutChartCanvas, els.preddistChartCanvas, els.budgetChartCanvas,
    ].forEach(clearMiniChart);
  }

  // ---------- client boxes (refreshed every round) ----------
  function renderClientBoxes(clientStats) {
    els.clientsGrid.innerHTML = "";
    clientStats.forEach((cs) => {
      const card = document.createElement("div");
      card.className = "client-card";
      card.style.setProperty("--chip-color", cs.color);
      card.innerHTML = `
        <div class="client-title">
          <h5>${cs.name}</h5>
          <span class="client-samples">${cs.device}</span>
        </div>
        <div class="client-loss">local loss ${fmt(cs.localLoss, 4)} · ${fmtInt(cs.sessions)} sessions</div>
      `;
      els.clientsGrid.appendChild(card);
    });
  }

  // ---------- epsilon gauge ----------
  function updateEpsilon(total) {
    if (!Number.isFinite(total)) {
      els.epsilonReadout.textContent = "ε = ∞";
      els.epsilonFill.style.width = "100%";
      els.epsilonFill.style.background = "#ff453a";
      return;
    }
    els.epsilonReadout.textContent = `ε ≈ ${fmt(total, 2)}`;
    const ceiling = 20;
    const pct = Math.min(100, (total / ceiling) * 100);
    els.epsilonFill.style.width = `${pct}%`;
    els.epsilonFill.style.background = total < 3 ? "#30d158" : total < 8 ? "#ff9f0a" : "#ff453a";
  }

  // ---------- GPU training compute strip ----------
  const BACKEND_LABELS = { wasm: "WASM (SIMD)", cpu: "CPU (JS)", webgpu: "WebGPU" };

  // Browsers can satisfy WebGL with a software rasterizer (SwiftShader,
  // llvmpipe) and still report the webgl backend. Labelling that "GPU" would
  // be a claim the code cannot back, so the label is derived from the renderer
  // string the driver actually reports.
  const SOFTWARE_RENDERER = /swiftshader|llvmpipe|software|basic render|microsoft basic|mesa offscreen/i;

  function isSoftwareRenderer(name) {
    return !!name && SOFTWARE_RENDERER.test(name);
  }

  function backendLabel(name) {
    if (name === "webgl") {
      const renderer = gpuDeviceString();
      if (!renderer) return "WebGL";
      return isSoftwareRenderer(renderer) ? "WebGL (software)" : "WebGL (GPU)";
    }
    return BACKEND_LABELS[name] || (name ? String(name).toUpperCase() : "initializing…");
  }

  // What TF.js is actually executing on, with the real device string the GPU
  // driver reports. This is the compute target, not a modeled one.
  let _gpuDeviceCache;
  function gpuDeviceString() {
    if (_gpuDeviceCache !== undefined) return _gpuDeviceCache;
    _gpuDeviceCache = null;
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) return null;
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      _gpuDeviceCache = renderer ? String(renderer) : null;
      // Free the probe context instead of leaving it alive for the session.
      const lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
    } catch (err) {
      _gpuDeviceCache = null;
    }
    return _gpuDeviceCache;
  }

  function initComputeBackend() {
    const backend = tf.getBackend();
    els.computeBackend.textContent = backendLabel(backend);
    const device = gpuDeviceString();
    if (device) els.computeBackend.title = device;
  }

  // Backends TF.js has actually registered in this browser, so the picker can
  // never offer one that would fail to initialize.
  function availableBackends() {
    const known = ["webgl", "wasm", "cpu", "webgpu"];
    const reg = (tf.engine && tf.engine().registryFactory) || {};
    return known.filter((b) => Object.prototype.hasOwnProperty.call(reg, b));
  }

  async function switchBackend(name, out = termOut, warn = termWarn) {
    if (!availableBackends().includes(name)) {
      warn(`backend '${name}' is not available here. Options: ${availableBackends().join(", ")}`);
      return false;
    }
    if (tf.getBackend() === name) { initComputeBackend(); out(`already on ${backendLabel(name)}`); return true; }
    if (running) { warn("Pause training before switching backend."); return false; }
    try {
      await tf.setBackend(name);
      await tf.ready();
      initComputeBackend();
      out(`compute backend switched to <span class="term-accent">${backendLabel(tf.getBackend())}</span>`);
      // Weights live in the old backend's memory, so the trainer is rebuilt
      // rather than left holding tensors the new backend cannot read.
      await setupTrainer();
      return true;
    } catch (err) {
      warn(`couldn't switch to '${name}': ${(err && err.message) || err}`);
      return false;
    }
  }

  function reportDevices(out = termOut) {
    const active = tf.getBackend();
    const device = gpuDeviceString();
    out(`<strong>Compute targets</strong> (real, from this browser)`);
    availableBackends().forEach((b) => {
      const mark = b === active ? '<span class="term-accent">●</span>' : "<span class=\"term-dim\">○</span>";
      out(`  ${mark} ${b.padEnd(7)} ${backendLabel(b)}${b === active ? "  (active)" : ""}`);
    });
    if (device) {
      const soft = isSoftwareRenderer(device);
      out(
        `  renderer: <span class="term-dim">${escapeHtml(device)}</span>` +
          (soft
            ? ' <span class="term-warn">(software rasterizer, not real GPU)</span>'
            : ' <span class="term-accent">(hardware)</span>')
      );
    } else {
      out(`  renderer: <span class="term-dim">unavailable (browser withheld it), so GPU use is unverified</span>`);
    }
    const mem = tf.memory();
    out(`  tensors in memory: ${fmtInt(mem.numTensors)} · ${(mem.numBytes / (1024 * 1024)).toFixed(1)} MB`);
    out(`  cores reported by browser: ${navigator.hardwareConcurrency || "unknown"}`);
    out(`<span class="term-dim">The simulated iPhones are synthetic; every device trains here, on this backend.</span>`);
  }

  function updateComputeStrip(roundMs, totalSamples, localEpochs) {
    els.computeRoundTime.textContent = `${roundMs.toFixed(0)} ms`;
    const throughput = (totalSamples * localEpochs) / (roundMs / 1000);
    els.computeThroughput.textContent = `${fmtInt(Math.round(throughput))} samples/s`;
    const mem = tf.memory();
    const mb = mem.numBytes / (1024 * 1024);
    els.computeMemory.textContent = `${mem.numTensors} tensors · ${mb.toFixed(1)} MB`;
  }

  // ---------- model registry (saved checkpoints, persisted to IndexedDB) ----------
  // Weights live in IndexedDB via tf.js's own save/load ('indexeddb://...'),
  // so they survive page reloads. A small JSON index in localStorage tracks
  // metadata (round, MAE, normalization stats, the fixed validation set) for
  // every saved checkpoint — loaded eagerly; the actual model weights are
  // only pulled from IndexedDB lazily, the first time a checkpoint is
  // selected, and cached in memory after that.
  const CHECKPOINT_INDEX_KEY = "fl-demo-checkpoints-v1";
  const MAX_CHECKPOINTS = 8;
  const loadedCheckpointModels = {};

  // ---------- factory checkpoint ----------
  // A real model, trained offline by scripts/make_pretrained.js with this
  // exact FederatedTrainer, and shipped as weights + provenance JSON. It
  // exists so the demo can go straight to Deploy/Inference without sitting
  // through a training run first. Its metrics are whatever that run actually
  // measured, not hand-written numbers.
  const FACTORY_ID = "__factory";
  let factoryCheckpoint = null;


  // Fills the hero with numbers this page actually measured, so the claims in
  // the headline are evidenced on first paint instead of asserted. AUC is
  // computed here with a real forward pass over the shipped checkpoint's
  // held-out set; MAE and ε come from the run that produced it.
  async function renderHeroProof() {
    if (!factoryCheckpoint || !els.heroProof) return;
    const meta = factoryCheckpoint.meta;

    els.proofMae.textContent = fmt(meta.valMae, 4);
    els.proofEps.textContent = Number.isFinite(meta.epsilon) ? `≈ ${fmt(meta.epsilon, 1)}` : "∞";
    els.proofDevices.textContent = fmtInt(meta.training ? meta.training.devicesPerRound : 0);
    els.proofBackend.textContent = backendLabel(tf.getBackend());

    try {
      const cohort = COHORTS.find((c) => c.id === meta.cohortId) || COHORTS[0];
      const val = buildCohortValidation(cohort);
      const xs = tf.tensor2d(normalizeRows(val.xs, meta.mean, meta.std));
      const predT = factoryCheckpoint.model.predict(xs);
      const preds = await predT.data();
      xs.dispose();
      predT.dispose();
      const rank = computeRankingMetrics(preds, val.ys);
      els.proofAuc.textContent = Number.isNaN(rank.auc) ? "n/a" : fmt(rank.auc, 3);
    } catch (err) {
      console.warn("[fl-demo] hero AUC unavailable:", err.message);
      els.proofAuc.textContent = "n/a";
    }

    els.heroProof.hidden = false;
  }

  async function loadFactoryCheckpoint() {
    const res = await fetch("pretrained/adrank-us.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const model = buildPresetModel(data.preset, NUM_FEATURES, data.training.learningRate);
    const weights = data.weights.map((w) => tf.tensor(w.data, w.shape));
    model.setWeights(weights);
    weights.forEach((t) => t.dispose());

    factoryCheckpoint = {
      model,
      meta: {
        id: FACTORY_ID,
        label: `${data.label} · ${data.architecture} · r${data.round} · MAE ${fmt(data.valMae, 3)}`,
        architecture: data.architecture,
        round: data.round,
        paramCount: data.paramCount,
        valMae: data.valMae,
        valLoss: data.valLoss,
        epsilon: data.epsilon,
        cohortId: data.cohortId,
        cohortLabel: data.cohortLabel,
        mean: data.mean,
        std: data.std,
        training: data.training,
      },
    };
    return factoryCheckpoint;
  }

  function normalizeRows(rows, mean, std) {
    return rows.map((r) => r.map((v, i) => (v - mean[i]) / std[i]));
  }

  function getCheckpointIndex() {
    try {
      return JSON.parse(localStorage.getItem(CHECKPOINT_INDEX_KEY) || "[]");
    } catch (err) {
      console.error("[fl-demo] checkpoint index corrupted, resetting:", err);
      return [];
    }
  }

  function setCheckpointIndex(list) {
    try {
      localStorage.setItem(CHECKPOINT_INDEX_KEY, JSON.stringify(list));
    } catch (err) {
      console.error("[fl-demo] couldn't persist checkpoint index (storage full?):", err);
    }
  }

  function checkpointLabel(meta) {
    const t = new Date(meta.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return `${t} · ${meta.architecture} · r${meta.round} · MAE ${fmt(meta.valMae, 3)}`;
  }

  function renderModelOptions(selectEl) {
    const current = selectEl.value;
    const liveTrained = trainer && (trainer.round > 0 || trainer.pretrained);
    let liveSuffix = "";
    if (trainer && trainer.round > 0) {
      liveSuffix = ` · r${trainer.round} · MAE ${fmt(trainer.history[trainer.history.length - 1].valMae, 3)}`;
    } else if (trainer && trainer.pretrained) {
      liveSuffix = ` · pretrained · MAE ${fmt(trainer.pretrainedMae, 3)}`;
    }
    const liveOpt = `<option value="__live">Live model (training)${liveSuffix}</option>`;
    const factoryOpt = factoryCheckpoint
      ? `<option value="${FACTORY_ID}">${factoryCheckpoint.meta.label}</option>`
      : "";
    const ckptOpts = getCheckpointIndex()
      .map((m) => `<option value="${m.id}">${m.label}</option>`)
      .join("");
    selectEl.innerHTML = liveOpt + factoryOpt + ckptOpts;

    const hasCurrent = [...selectEl.options].some((o) => o.value === current);
    // "__live" is the browser's default first option even before anything is
    // trained, so it can't be treated as a real selection until it resolves
    // to an actual model.
    const currentIsUsable = hasCurrent && !(current === "__live" && !liveTrained);
    if (currentIsUsable) {
      selectEl.value = current;
    } else if (factoryCheckpoint) {
      // Nothing trained yet: default to the shipped model so Deploy/Inference
      // are usable immediately.
      selectEl.value = FACTORY_ID;
    } else if (hasCurrent) {
      selectEl.value = current;
    }
    // That default is a placeholder, not a choice. Once a live model exists,
    // advance to it unless the user actually picked the factory one.
    if (selectEl.value === FACTORY_ID && liveTrained && selectEl.dataset.userPicked !== "1") {
      selectEl.value = "__live";
    }
  }

  function renderAllModelOptions() {
    renderModelOptions(els.evalModelSelect);
    renderModelOptions(els.deployModelSelect);
  }

  // Cheap, synchronous — just reads cached metadata, never touches IndexedDB.
  function getSelectedMeta(selectEl) {
    const selected = selectEl.value;
    if (selected === FACTORY_ID) return factoryCheckpoint ? factoryCheckpoint.meta : null;
    if (selected === "__live" || !selected) {
      if (!trainer || (trainer.round === 0 && !trainer.pretrained)) return null;
      const lastStat = trainer.history[trainer.history.length - 1];
      return {
        id: "__live",
        architecture: trainer.modelLabel,
        round: trainer.round,
        paramCount: trainer.model ? trainer.model.countParams() : 0,
        valMae: lastStat ? lastStat.valMae : trainer.pretrainedMae,
        valLoss: lastStat ? lastStat.valLoss : trainer.pretrainedLoss,
        epsilon: trainer.epsilonSpent,
        cohortLabel: currentCohort().label,
      };
    }
    return getCheckpointIndex().find((m) => m.id === selected) || null;
  }

  // Async — loads real weights from IndexedDB on first use, then caches.
  async function resolveModelTarget(selectEl) {
    const selected = selectEl.value;
    if (selected === FACTORY_ID) {
      if (!factoryCheckpoint) return null;
      const { model, meta } = factoryCheckpoint;
      // The validation set is a deterministic function of the cohort, so it's
      // rebuilt here rather than shipped inside the checkpoint file.
      const cohort = COHORTS.find((c) => c.id === meta.cohortId) || COHORTS[0];
      return { model, mean: meta.mean, std: meta.std, val: buildCohortValidation(cohort) };
    }
    if (selected === "__live" || !selected) {
      if (!trainer || (trainer.round === 0 && !trainer.pretrained)) return null;
      return { model: trainer.model, mean: trainer.mean, std: trainer.std, val: trainer.val };
    }
    const meta = getCheckpointIndex().find((m) => m.id === selected);
    if (!meta) return null;
    if (!loadedCheckpointModels[selected]) {
      loadedCheckpointModels[selected] = await tf.loadLayersModel(`indexeddb://fl-ckpt-${selected}`);
    }
    return { model: loadedCheckpointModels[selected], mean: meta.mean, std: meta.std, val: { xs: meta.valXs, ys: meta.valYs } };
  }

  // Persists an arbitrary model as a checkpoint in the same registry the
  // Deploy/Eval dropdowns read. Used by post-training so a compressed artifact
  // becomes a real, deployable, reloadable model rather than a printed number.
  async function persistModelAsCheckpoint(model, meta) {
    const topology = model.toJSON(null, false);
    const snapshot = await tf.models.modelFromJSON(topology);
    const weights = model.getWeights().map((w) => w.clone());
    snapshot.setWeights(weights);
    weights.forEach((w) => w.dispose());

    const id = `ckpt-${Date.now()}`;
    const full = Object.assign({ id, createdAt: new Date().toISOString(), paramCount: snapshot.countParams() }, meta);
    full.label = `${full.tag ? full.tag + " · " : ""}${checkpointLabel(full)}`;

    await snapshot.save(`indexeddb://fl-ckpt-${id}`);
    loadedCheckpointModels[id] = snapshot;

    let index = getCheckpointIndex();
    // Re-running the same compression on the same source replaces its previous
    // artifact instead of adding another. Without this, repeatedly quantizing
    // would push real training checkpoints out of a registry that only holds
    // MAX_CHECKPOINTS entries.
    if (full.dedupeKey) {
      const stale = index.filter((m) => m.dedupeKey === full.dedupeKey);
      for (const m of stale) {
        delete loadedCheckpointModels[m.id];
        await tf.io.removeModel(`indexeddb://fl-ckpt-${m.id}`).catch(() => {});
      }
      index = index.filter((m) => m.dedupeKey !== full.dedupeKey);
    }
    index.unshift(full);
    while (index.length > MAX_CHECKPOINTS) {
      const evicted = index.pop();
      delete loadedCheckpointModels[evicted.id];
      await tf.io.removeModel(`indexeddb://fl-ckpt-${evicted.id}`).catch(() => {});
    }
    setCheckpointIndex(index);
    renderAllModelOptions();
    updateDeployStats();
    updateEvalSummary();
    renderPipeline();
    return full;
  }

  async function saveCheckpoint() {
    if (!trainer || trainer.round === 0) return;
    els.btnSaveModel.disabled = true;
    const prevLabel = els.btnSaveModel.textContent;
    els.btnSaveModel.textContent = "Saving…";
    try {
      const topology = trainer.model.toJSON(null, false);
      const snapshot = await tf.models.modelFromJSON(topology);
      const weights = trainer.model.getWeights().map((w) => w.clone());
      snapshot.setWeights(weights);
      weights.forEach((w) => w.dispose());

      const lastStat = trainer.history[trainer.history.length - 1];
      const id = `ckpt-${Date.now()}`;
      const meta = {
        id,
        architecture: trainer.modelLabel,
        round: trainer.round,
        valMae: lastStat.valMae,
        valLoss: lastStat.valLoss,
        epsilon: trainer.epsilonSpent,
        cohortLabel: currentCohort().label,
        mean: trainer.mean,
        std: trainer.std,
        valXs: trainer.val.xs,
        valYs: trainer.val.ys,
        paramCount: snapshot.countParams(),
        createdAt: new Date().toISOString(),
      };
      meta.label = checkpointLabel(meta);

      await snapshot.save(`indexeddb://fl-ckpt-${id}`);
      loadedCheckpointModels[id] = snapshot;

      const index = getCheckpointIndex();
      index.unshift(meta);
      while (index.length > MAX_CHECKPOINTS) {
        const evicted = index.pop();
        delete loadedCheckpointModels[evicted.id];
        await tf.io.removeModel(`indexeddb://fl-ckpt-${evicted.id}`).catch(() => {});
      }
      setCheckpointIndex(index);

      renderAllModelOptions();
      els.evalModelSelect.value = id;
      const stamp = new Date(meta.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      els.saveStatus.textContent = `Saved checkpoint · ${stamp} · round ${meta.round} · MAE ${fmt(meta.valMae, 4)} · stored in IndexedDB`;
      logLine(`<span class="term-time">[${timestamp()}]</span> <span class="term-accent">Checkpoint saved</span>: round ${meta.round}, MAE ${fmt(meta.valMae, 4)} (persisted, survives reload)`);
      updateEvalSummary();
      await runFullEvaluation();
    } finally {
      els.btnSaveModel.disabled = !trainer || trainer.round === 0;
      els.btnSaveModel.textContent = prevLabel;
    }
  }

  // ---------- eval tab ----------
  const EVAL_TARGET_MAE = 0.15;

  function updateEvalSummary() {
    renderModelOptions(els.evalModelSelect);
    const meta = getSelectedMeta(els.evalModelSelect);
    if (!meta) {
      els.btnRunEval.disabled = true;
      els.evalRounds.textContent = trainer ? trainer.round : 0;
      els.evalMae.textContent = "—";
      els.evalLoss.textContent = "—";
      els.evalCycles.textContent = "—";
      els.evalAuc.textContent = "—";
      els.evalNdcg.textContent = "—";
      els.evalMrr.textContent = "—";
      els.evalEce.textContent = "—";
      els.rankLabelNote.textContent = "—";
      els.evalNote.textContent = "Train a model on the Train tab first.";
      els.evalVerdict.textContent = "Not run";
      els.evalVerdict.className = "eval-verdict";
      return;
    }
    els.btnRunEval.disabled = false;
    els.evalRounds.textContent = meta.round;
    els.evalMae.textContent = fmt(meta.valMae, 4);
    els.evalLoss.textContent = fmt(meta.valLoss, 5);
    els.evalCycles.textContent = `± ${(meta.valMae * 100).toFixed(1)} pts`;
    els.evalNote.textContent =
      els.evalModelSelect.value === "__live"
        ? 'Evaluating the live model. Click "Run evaluation" for the full held-out breakdown.'
        : `Evaluating a saved checkpoint (${meta.cohortLabel}). Click "Run evaluation" to refresh the breakdown.`;
  }

  // ---------- ranking metrics ----------
  // MAE/RMSE score a regressor; an ad ranker is judged on whether it puts the
  // right item first. These are the metrics an ads/recsys team actually reads.
  //
  // The labels here are a continuous engagement score in [0,1], so anything
  // needing binary relevance (AUC, MRR) thresholds it into click / no-click.
  // The threshold and the resulting positive rate are both surfaced, because a
  // ranking metric quoted without its label definition is not interpretable.
  const CLICK_THRESHOLD = 0.5;
  const SLATE_SIZE = 5;

  // AUC via the Mann-Whitney U identity: the probability a random positive
  // outranks a random negative. Computed from rank sums, with ties given
  // average ranks, so it is exact rather than trapezoid-approximated.
  function rocAuc(scores, labels) {
    const n = scores.length;
    const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => scores[a] - scores[b]);
    const ranks = new Array(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && scores[idx[j + 1]] === scores[idx[i]]) j++;
      const avgRank = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) ranks[idx[k]] = avgRank;
      i = j + 1;
    }
    let posRankSum = 0, pos = 0;
    for (let k = 0; k < n; k++) {
      if (labels[k]) { posRankSum += ranks[k]; pos++; }
    }
    const neg = n - pos;
    if (pos === 0 || neg === 0) return NaN; // undefined without both classes
    return (posRankSum - (pos * (pos + 1)) / 2) / (pos * neg);
  }

  function dcg(relevances) {
    return relevances.reduce((acc, rel, i) => acc + rel / Math.log2(i + 2), 0);
  }

  // Candidate slates: consecutive held-out rows are grouped into competing
  // candidate sets, mirroring how a real auction ranks N candidates for one
  // slot. The grouping is synthetic and disclosed in the UI.
  function buildSlates(preds, trueY, size) {
    const slates = [];
    for (let s = 0; s + size <= preds.length; s += size) {
      const items = [];
      for (let i = s; i < s + size; i++) items.push({ pred: preds[i], rel: trueY[i] });
      slates.push(items);
    }
    return slates;
  }

  // NDCG uses the continuous engagement score directly as graded relevance,
  // which is what NDCG was designed for: no thresholding needed.
  function ndcgAtK(slates, k) {
    let total = 0, counted = 0;
    slates.forEach((items) => {
      const byPred = [...items].sort((a, b) => b.pred - a.pred).slice(0, k).map((it) => it.rel);
      const ideal = [...items].sort((a, b) => b.rel - a.rel).slice(0, k).map((it) => it.rel);
      const idealDcg = dcg(ideal);
      if (idealDcg > 0) { total += dcg(byPred) / idealDcg; counted++; }
    });
    return counted ? total / counted : NaN;
  }

  // MRR needs binary relevance: reciprocal rank of the first true click.
  function mrr(slates, threshold) {
    let total = 0, counted = 0;
    slates.forEach((items) => {
      const byPred = [...items].sort((a, b) => b.pred - a.pred);
      const hit = byPred.findIndex((it) => it.rel > threshold);
      if (byPred.some((it) => it.rel > threshold)) { total += 1 / (hit + 1); counted++; }
    });
    return counted ? total / counted : NaN;
  }

  // Calibration: does a predicted 0.7 actually convert at 0.7? Critical for
  // auction pricing, where a miscalibrated pCTR misprices every bid.
  function calibration(preds, trueY, bins = 10) {
    const buckets = Array.from({ length: bins }, () => ({ n: 0, sumPred: 0, sumTrue: 0 }));
    for (let i = 0; i < preds.length; i++) {
      const b = Math.min(bins - 1, Math.max(0, Math.floor(preds[i] * bins)));
      buckets[b].n++;
      buckets[b].sumPred += preds[i];
      buckets[b].sumTrue += trueY[i];
    }
    let ece = 0;
    const points = buckets.map((b, i) => {
      const meanPred = b.n ? b.sumPred / b.n : 0;
      const meanTrue = b.n ? b.sumTrue / b.n : 0;
      if (b.n) ece += (b.n / preds.length) * Math.abs(meanPred - meanTrue);
      return { bin: i, n: b.n, meanPred, meanTrue };
    });
    return { points, ece };
  }

  function computeRankingMetrics(preds, trueY) {
    const labels = Array.from(trueY, (y) => (y > CLICK_THRESHOLD ? 1 : 0));
    const positives = labels.reduce((a, b) => a + b, 0);
    const slates = buildSlates(preds, trueY, SLATE_SIZE);
    const cal = calibration(preds, trueY);
    return {
      auc: rocAuc(Array.from(preds), labels),
      ndcg: ndcgAtK(slates, SLATE_SIZE),
      mrr: mrr(slates, CLICK_THRESHOLD),
      ece: cal.ece,
      calPoints: cal.points,
      positives,
      positiveRate: positives / labels.length,
      slateCount: slates.length,
    };
  }

  let lastRankingMetrics = null;

  // Reliability diagram: mean predicted vs mean observed per decile, against
  // the y = x line. Dot area scales with bucket population so a wildly
  // off-diagonal point holding three samples doesn't read as a real problem.
  function drawCalibration(points) {
    const canvas = els.evalCalibrationCanvas;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 460, h = rect.height || 170;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pad = { l: 34, r: 10, t: 10, b: 22 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const xAt = (v) => pad.l + v * iw;
    const yAt = (v) => pad.t + (1 - v) * ih;

    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.lineWidth = 1;
    ctx.strokeRect(pad.l, pad.t, iw, ih);

    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.moveTo(xAt(0), yAt(0));
    ctx.lineTo(xAt(1), yAt(1));
    ctx.stroke();
    ctx.setLineDash([]);

    const total = points.reduce((a, p) => a + p.n, 0) || 1;
    const filled = points.filter((p) => p.n > 0);

    ctx.strokeStyle = "#0a84ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    filled.forEach((p, i) => {
      const x = xAt(p.meanPred), y = yAt(p.meanTrue);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    filled.forEach((p) => {
      const r = 2.5 + Math.sqrt(p.n / total) * 7;
      ctx.beginPath();
      ctx.arc(xAt(p.meanPred), yAt(p.meanTrue), r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(10,132,255,0.75)";
      ctx.fill();
    });

    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.font = "10px -apple-system, sans-serif";
    ctx.fillText("observed", 4, pad.t + 9);
    ctx.fillText("predicted", w - pad.r - 48, h - 6);
    ctx.fillText("0", pad.l - 8, h - pad.b + 12);
    ctx.fillText("1", w - pad.r - 4, h - pad.b + 12);
  }

  async function runFullEvaluation() {
    const meta = getSelectedMeta(els.evalModelSelect);
    if (!meta) return;
    const target = await resolveModelTarget(els.evalModelSelect);
    if (!target) return;
    els.btnRunEval.disabled = true;
    els.btnRunEval.textContent = "Evaluating…";

    const normXs = normalizeRows(target.val.xs, target.mean, target.std);
    const input = tf.tensor2d(normXs);
    const predT = target.model.predict(input);
    const preds = await predT.data();
    input.dispose();
    predT.dispose();

    const trueY = target.val.ys;
    const n = trueY.length;
    const meanY = trueY.reduce((a, b) => a + b, 0) / n;

    let baselineMae = 0, modelMae = 0, sqErr = 0;
    for (let i = 0; i < n; i++) {
      baselineMae += Math.abs(meanY - trueY[i]);
      modelMae += Math.abs(preds[i] - trueY[i]);
      sqErr += (preds[i] - trueY[i]) ** 2;
    }
    baselineMae /= n;
    modelMae /= n;
    const loss = sqErr / n;
    const rmse = Math.sqrt(loss);

    els.evalRounds.textContent = meta.round;
    els.evalMae.textContent = fmt(modelMae, 4);
    els.evalRmse.textContent = fmt(rmse, 4);
    els.evalLoss.textContent = fmt(loss, 5);
    els.evalCycles.textContent = `± ${(modelMae * 100).toFixed(1)} pts`;
    const lift = ((baselineMae - modelMae) / baselineMae) * 100;
    els.evalBaseline.textContent = `${fmt(baselineMae, 4)} baseline · ${lift >= 0 ? "-" : "+"}${Math.abs(lift).toFixed(0)}% ${lift >= 0 ? "better" : "worse"}`;

    const pass = modelMae <= EVAL_TARGET_MAE;
    els.evalVerdict.textContent = pass ? "Pass" : "Needs review";
    els.evalVerdict.className = `eval-verdict ${pass ? "pass" : "warn"}`;
    els.evalNote.innerHTML = `300 held-out devices, never used in training · target MAE ≤ ${EVAL_TARGET_MAE.toFixed(2)}`;

    const rank = computeRankingMetrics(preds, trueY);
    els.evalAuc.textContent = Number.isNaN(rank.auc) ? "n/a" : fmt(rank.auc, 4);
    els.evalNdcg.textContent = Number.isNaN(rank.ndcg) ? "n/a" : fmt(rank.ndcg, 4);
    els.evalMrr.textContent = Number.isNaN(rank.mrr) ? "n/a" : fmt(rank.mrr, 4);
    els.evalEce.textContent = fmt(rank.ece, 4);
    els.rankLabelNote.textContent =
      `click = engagement > ${CLICK_THRESHOLD} · ${fmtInt(rank.positives)}/${fmtInt(n)} positive ` +
      `(${(rank.positiveRate * 100).toFixed(0)}%) · ${fmtInt(rank.slateCount)} synthetic slates of ${SLATE_SIZE}`;
    drawCalibration(rank.calPoints);

    lastRankingMetrics = rank;
    renderPipeline();
    if (meta.id === "__live") attachMetricsToLatestRun(rank);

    drawEvalScatter(preds, trueY);
    renderEvalBuckets(preds, trueY);

    els.btnRunEval.disabled = false;
    els.btnRunEval.textContent = "Re-run evaluation";
  }

  function drawEvalScatter(preds, trueY) {
    const canvas = els.evalScatterCanvas;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 500, h = 260;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pad = { l: 40, r: 12, t: 12, b: 26 };
    const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;
    const xAt = (v) => pad.l + v * plotW;
    const yAt = (v) => pad.t + (1 - v) * plotH;

    ctx.font = "10px -apple-system, sans-serif";
    ctx.fillStyle = "#8e8e93";
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    [0, 0.5, 1].forEach((v) => {
      ctx.beginPath();
      ctx.moveTo(pad.l, yAt(v));
      ctx.lineTo(w - pad.r, yAt(v));
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(v.toFixed(1), pad.l - 6, yAt(v));
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(v.toFixed(1), xAt(v), h - pad.b + 6);
    });

    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(xAt(0), yAt(0));
    ctx.lineTo(xAt(1), yAt(1));
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(10,132,255,0.45)";
    for (let i = 0; i < trueY.length; i++) {
      ctx.beginPath();
      ctx.arc(xAt(trueY[i]), yAt(preds[i]), 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function renderEvalBuckets(preds, trueY) {
    const buckets = [
      { label: "Critical · <33% life", lo: 0, hi: 0.33 },
      { label: "Mid-life · 33–66%", lo: 0.33, hi: 0.66 },
      { label: "Healthy · >66% life", lo: 0.66, hi: 1.001 },
    ];
    const stats = buckets.map((b) => {
      let sum = 0, count = 0;
      for (let i = 0; i < trueY.length; i++) {
        if (trueY[i] >= b.lo && trueY[i] < b.hi) {
          sum += Math.abs(preds[i] - trueY[i]);
          count++;
        }
      }
      return { ...b, mae: count ? sum / count : 0, count };
    });
    const maxMae = Math.max(0.02, ...stats.map((s) => s.mae));
    els.evalBucketRows.innerHTML = stats
      .map(
        (s) => `<div class="bucket-row">
          <span class="bucket-label">${s.label}</span>
          <div class="bucket-bar"><div class="bucket-bar-fill" style="width:${(s.mae / maxMae) * 100}%"></div></div>
          <span class="bucket-value">${fmt(s.mae, 4)} · n=${s.count}</span>
        </div>`
      )
      .join("");
  }

  els.btnRunEval.addEventListener("click", runFullEvaluation);
  els.btnSaveModel.addEventListener("click", saveCheckpoint);
  els.evalModelSelect.addEventListener("change", () => {
    els.evalModelSelect.dataset.userPicked = "1";
    updateEvalSummary();
    runFullEvaluation();
  });
  els.deployModelSelect.addEventListener("change", () => {
    els.deployModelSelect.dataset.userPicked = "1";
    els.deployStatus.dataset.deployed = "0";
    els.rolloutRows.innerHTML = "";
    els.deployProgress.hidden = true;
    els.benchTable.innerHTML = "";
    els.compressTable.innerHTML = "";
    updateDeployStats();
  });

  // ---------- deploy tab ----------
  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes.toFixed(0)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function updateDeployStats() {
    renderModelOptions(els.deployModelSelect);
    els.btnSaveModel.disabled = !trainer || trainer.round === 0;

    const meta = getSelectedMeta(els.deployModelSelect);
    if (!meta) {
      els.deployArch.textContent = "—";
      els.deployRounds.textContent = "0";
      els.deployParams.textContent = "—";
      els.deployMae.textContent = "—";
      els.deployEps.textContent = "—";
      els.deploySize.textContent = "—";
      els.btnDeploy.disabled = true;
      els.deployStatus.textContent = "Train a model on the Train tab first.";
      return;
    }

    const paramCount = meta.id === "__live" ? trainer.model.countParams() : meta.paramCount;
    els.deployArch.textContent = meta.architecture;
    els.deployRounds.textContent = meta.round;
    els.deployParams.textContent = fmtInt(paramCount);
    els.deployMae.textContent = fmt(meta.valMae, 4);
    els.deployEps.textContent = Number.isFinite(meta.epsilon) ? `≈ ${fmt(meta.epsilon, 2)}` : "∞";
    els.deploySize.textContent = `${formatBytes(paramCount * 4)} / ${formatBytes(paramCount)}`;

    els.btnDeploy.disabled = false;
    renderTrainingConfig();
    if (els.deployStatus.dataset.deployed !== "1") {
      els.deployStatus.textContent = "Not deployed yet.";
    }
  }

  const ROLLOUT_REGIONS = ["North America", "EMEA", "APAC", "Latin America & other"];

  async function runDeployRollout() {
    const meta = getSelectedMeta(els.deployModelSelect);
    if (!meta) return;
    els.btnDeploy.disabled = true;
    els.deployStatus.dataset.deployed = "0";
    els.deployStatus.textContent = "Rolling out…";
    els.deployProgress.hidden = false;
    els.deployProgressFill.style.width = "0%";
    els.rolloutRows.innerHTML = "";
    // Built with real DOM refs captured at creation time rather than
    // re-queried by region name each frame: region labels like "Latin
    // America & other" contain characters that broke attribute-selector
    // lookups, silently killing this animation (and the whole deploy flow
    // with it, since the code below never ran).
    const rolloutBars = ROLLOUT_REGIONS.map((r) => {
      const row = document.createElement("div");
      row.className = "rollout-row";
      row.innerHTML = `<span class="rollout-region"></span><div class="rollout-bar"><div class="rollout-bar-fill" style="width:0%"></div></div><span class="rollout-pct">0%</span>`;
      row.querySelector(".rollout-region").textContent = r;
      els.rolloutRows.appendChild(row);
      return { fill: row.querySelector(".rollout-bar-fill"), pct: row.querySelector(".rollout-pct") };
    });

    const duration = 1600;
    const start = performance.now();
    await new Promise((resolve) => {
      function step(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        els.deployProgressFill.style.width = `${eased * 100}%`;
        rolloutBars.forEach((bar, i) => {
          const regionT = Math.max(0, Math.min(1, eased * 1.15 - i * 0.05));
          const pct = Math.round(regionT * 100);
          bar.fill.style.width = `${pct}%`;
          bar.pct.textContent = `${pct}%`;
        });
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });

    const target = els.deployTarget.options[els.deployTarget.selectedIndex].text;
    const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const versionTag =
      meta.id === "__live"
        ? `v${meta.round}-${sessionSeed.toString(36).slice(0, 5)}`
        : meta.id === FACTORY_ID
        ? `factory-r${meta.round}`
        : meta.id.replace("ckpt-", "v");
    deployedTarget = await resolveModelTarget(els.deployModelSelect);
    if (deployedTarget) deployedTarget.architecture = meta.architecture;
    delete els.sensorGrid.dataset.filled;
    els.deployStatus.dataset.deployed = "1";
    els.deployStatus.textContent = `Live · ${versionTag} · ${target} · deployed ${stamp}`;
    els.btnDeploy.disabled = false;
    updateInferenceAvailability();
    renderPipeline();
  }

  async function benchmarkBackend(backendName, model, iterations = 40) {
    const prevBackend = tf.getBackend();
    try {
      await tf.setBackend(backendName);
      await tf.ready();
    } catch (err) {
      return null;
    }
    const input = tf.randomNormal([1, NUM_FEATURES]);
    for (let i = 0; i < 5; i++) {
      const o = model.predict(input);
      await o.data();
      o.dispose();
    }
    const times = [];
    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      const o = model.predict(input);
      await o.data();
      times.push(performance.now() - t0);
      o.dispose();
    }
    input.dispose();
    await tf.setBackend(prevBackend);
    await tf.ready();
    times.sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    return { avgMs: avg, p50Ms: times[Math.floor(times.length / 2)], throughput: 1000 / avg };
  }

  function benchRow(name, badge, avgMs, throughput) {
    const badgeClass = badge === "measured" ? "measured" : "modeled";
    return `<div class="bench-row">
      <div class="bench-row-name">${name} <span class="bench-badge ${badgeClass}">${badge}</span></div>
      <div class="bench-metric"><strong>${avgMs.toFixed(2)} ms</strong></div>
      <div class="bench-metric">${fmtInt(Math.round(throughput))}/s</div>
    </div>`;
  }

  async function runBenchmark() {
    const meta = getSelectedMeta(els.deployModelSelect);
    if (!meta) return;
    const target = await resolveModelTarget(els.deployModelSelect);
    if (!target) return;
    els.btnBenchmark.disabled = true;
    els.btnBenchmark.textContent = "Benchmarking…";
    els.benchTable.innerHTML = "";

    const gpu = await benchmarkBackend("webgl", target.model);
    const cpu = await benchmarkBackend("cpu", target.model);

    let rows = "";
    if (gpu) rows += benchRow("This device: WebGL (GPU)", "measured", gpu.avgMs, gpu.throughput);
    if (cpu) rows += benchRow("This device: CPU (JS)", "measured", cpu.avgMs, cpu.throughput);

    const baseline = cpu || gpu;
    if (baseline) {
      // Modeled: int8-quantized Neural Engine-class accelerator, typically 3-5x
      // a JS CPU backend for small dense nets. Not measured on this device.
      const npuMs = baseline.avgMs / 4;
      rows += benchRow("On-device Neural Engine, int8 quantized (modeled)", "modeled", npuMs, 1000 / npuMs);

      // Modeled: iCloud GPU serving with batching amortizes per-call dispatch overhead.
      const gpuBaseline = gpu || cpu;
      const cloudMs = gpuBaseline.avgMs / 35;
      rows += benchRow("iCloud batch, size 64 (modeled)", "modeled", cloudMs, 1000 / cloudMs);
    }

    els.benchTable.innerHTML = rows || `<p class="panel-note">Benchmark unavailable in this browser.</p>`;
    els.btnBenchmark.disabled = false;
    els.btnBenchmark.textContent = "Run benchmark on this device";
  }

  // ---------- model compression (real quantization / pruning / distillation) ----------
  // Every number here comes from actually mutating a model's real weights and
  // re-running model.predict() against the held-out validation set, the same
  // set Eval uses. Nothing is modeled or interpolated, unlike the benchmark
  // panel's Neural Engine / iCloud rows above, which are explicitly labeled
  // as such.

  async function measureMae(model, xs, ys) {
    const preds = model.predict(xs);
    const predVals = await preds.data();
    const trueVals = await ys.data();
    preds.dispose();
    let mae = 0;
    for (let i = 0; i < trueVals.length; i++) mae += Math.abs(predVals[i] - trueVals[i]);
    return mae / trueVals.length;
  }

  // Per-tensor affine int8 quantization: each weight tensor is mapped to its
  // own [min, max] range, rounded to 256 levels, then immediately dequantized
  // back to float32 so the *same* model can be re-evaluated. This measures
  // the real accuracy cost of quantization; it doesn't measure real int8
  // inference speed (tf.js has no int8 execution path in the browser here).
  function quantizeWeightsInt8(weights) {
    let fp32Bytes = 0, int8Bytes = 0;
    const quantized = weights.map((w) => {
      const data = w.dataSync();
      fp32Bytes += data.length * 4;
      let min = Infinity, max = -Infinity;
      for (let i = 0; i < data.length; i++) {
        if (data[i] < min) min = data[i];
        if (data[i] > max) max = data[i];
      }
      int8Bytes += data.length;
      if (min === max) return w.clone();
      const scale = (max - min) / 255;
      const deq = new Float32Array(data.length);
      for (let i = 0; i < data.length; i++) {
        deq[i] = min + Math.round((data[i] - min) / scale) * scale;
      }
      return tf.tensor(deq, w.shape);
    });
    return { quantized, fp32Bytes, int8Bytes };
  }

  // Global unstructured magnitude pruning (Han et al. 2015): pool every
  // weight's |value| across all tensors, pick the threshold at the target
  // percentile, zero anything below it. Weights stay dense (still fp32
  // arrays with real zeros) so the size number reported is the fp32
  // footprint; a real deployment would re-pack into a sparse format.
  function pruneWeightsMagnitude(weights, sparsity) {
    const allAbs = [];
    weights.forEach((w) => {
      const d = w.dataSync();
      for (let i = 0; i < d.length; i++) allAbs.push(Math.abs(d[i]));
    });
    allAbs.sort((a, b) => a - b);
    const threshold = allAbs[Math.min(Math.floor(allAbs.length * sparsity), allAbs.length - 1)];
    let zeroed = 0, total = 0;
    const pruned = weights.map((w) => {
      const d = Array.from(w.dataSync());
      for (let i = 0; i < d.length; i++) {
        total++;
        if (Math.abs(d[i]) < threshold) { d[i] = 0; zeroed++; }
      }
      return tf.tensor(d, w.shape);
    });
    return { pruned, actualSparsity: total ? zeroed / total : 0 };
  }

  // Trains a small "linear" student on the teacher's own predictions (soft
  // regression targets) over fresh, unlabeled-to-the-student cohort batches,
  // then checks the student against real ground truth on the held-out set.
  // This is genuine knowledge distillation for a regression task: there's no
  // notion of softmax temperature here, just the teacher's continuous score.
  async function distillStudent(teacherModel, mean, std, cohort) {
    const student = buildPresetModel("linear", NUM_FEATURES, 0.05);
    for (let epoch = 0; epoch < 6; epoch++) {
      const batchClients = buildRoundClients(cohort, 6, 90000 + epoch * 7919);
      for (const c of batchClients) {
        const xsT = tf.tensor2d(c.xs.map((r) => r.map((v, i) => (v - mean[i]) / std[i])));
        const softTargets = teacherModel.predict(xsT);
        await student.fit(xsT, softTargets, { epochs: 1, verbose: 0, batchSize: 16 });
        xsT.dispose();
        softTargets.dispose();
      }
    }
    return student;
  }

  function compressRow({ name, sub, badge, params, bytes, mae, baselineMae, isBaseline }) {
    const deltaPct = isBaseline ? null : ((mae - baselineMae) / baselineMae) * 100;
    const deltaHtml = isBaseline
      ? `<span class="compress-delta">baseline</span>`
      : `<span class="compress-delta ${deltaPct <= 0 ? "good" : "warn"}">${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%</span>`;
    return `<div class="compress-row${isBaseline ? " baseline" : ""}">
      <div class="compress-name">${name}${sub ? `<small>${sub}</small>` : ""}</div>
      <div class="compress-metric">${fmtInt(params)}</div>
      <div class="compress-metric">${formatBytes(bytes)}</div>
      <div class="compress-metric">${fmt(mae, 4)}</div>
      ${deltaHtml}
    </div>`;
  }

  async function runCompressionAnalysis() {
    const meta = getSelectedMeta(els.deployModelSelect);
    if (!meta) return;
    const target = await resolveModelTarget(els.deployModelSelect);
    if (!target) return;

    els.btnCompress.disabled = true;
    els.btnCompress.textContent = "Analyzing…";
    els.compressTable.innerHTML = `<div class="compress-head"><span>Technique</span><span style="text-align:right">Params</span><span style="text-align:right">Size</span><span style="text-align:right">MAE</span><span style="text-align:right">Δ</span></div>`;

    const { model, mean, std, val } = target;
    const xs = tf.tensor2d(val.xs.map((r) => r.map((v, i) => (v - mean[i]) / std[i])));
    const ys = tf.tensor2d(val.ys.map((v) => [v]));

    try {
      const teacherParams = model.countParams();
      const originalWeights = model.getWeights().map((w) => w.clone());

      const baselineMae = await measureMae(model, xs, ys);
      const fp32Bytes = teacherParams * 4;
      let rows = compressRow({ name: "fp32 (current model)", sub: meta.architecture, params: teacherParams, bytes: fp32Bytes, mae: baselineMae, baselineMae, isBaseline: true });

      const { quantized, int8Bytes } = quantizeWeightsInt8(model.getWeights());
      model.setWeights(quantized);
      const quantMae = await measureMae(model, xs, ys);
      quantized.forEach((w) => w.dispose());
      model.setWeights(originalWeights.map((w) => w.clone()));
      rows += compressRow({ name: "int8 quantized", sub: "per-tensor affine, dequantized for eval", params: teacherParams, bytes: int8Bytes, mae: quantMae, baselineMae });

      const PRUNE_SPARSITY = 0.4;
      const { pruned, actualSparsity } = pruneWeightsMagnitude(model.getWeights(), PRUNE_SPARSITY);
      model.setWeights(pruned);
      const pruneMae = await measureMae(model, xs, ys);
      pruned.forEach((w) => w.dispose());
      model.setWeights(originalWeights.map((w) => w.clone()));
      rows += compressRow({ name: "magnitude pruned", sub: `${(actualSparsity * 100).toFixed(0)}% of weights zeroed`, params: teacherParams, bytes: fp32Bytes, mae: pruneMae, baselineMae });

      model.setWeights(originalWeights);
      originalWeights.forEach((w) => w.dispose());

      if (meta.architecture && meta.architecture.startsWith("Linear")) {
        rows += `<p class="panel-note">Already the smallest preset, skipping distillation.</p>`;
      } else {
        const student = await distillStudent(model, mean, std, currentCohort());
        const studentMae = await measureMae(student, xs, ys);
        const studentParams = student.countParams();
        rows += compressRow({ name: "distilled student", sub: `linear model taught by this one, ${(teacherParams / studentParams).toFixed(0)}x fewer params`, params: studentParams, bytes: studentParams * 4, mae: studentMae, baselineMae });
        student.dispose();
      }

      els.compressTable.innerHTML += rows;
    } catch (err) {
      els.compressTable.innerHTML += `<p class="panel-note">Compression analysis failed: ${err.message || err}</p>`;
      console.error("[fl-demo] compression analysis failed:", err);
    } finally {
      xs.dispose();
      ys.dispose();
      els.btnCompress.disabled = false;
      els.btnCompress.textContent = "Run compression analysis";
    }
  }

  // ---------- server-side pre-training / post-training ----------
  // Federated learning is the on-device half of the story. This is the other
  // half: the centralized, pooled, GPU-cluster-side training that in a real
  // pipeline produces the initial checkpoint federated rounds then fine-tune.
  //
  // The data parallelism here is real: each shard computes gradients on its
  // own minibatch via tf.variableGrads, and those gradients are averaged
  // before a single optimizer step. That is exactly the math DDP/FSDP run.
  // What is NOT real is the parallelism itself: the shards execute serially
  // in this one browser tab, so shard count changes the gradient batch
  // composition and the reported memory math, not wall-clock speed.

  function normalizeWith(rows, mean, std) {
    return rows.map((r) => r.map((v, i) => (v - mean[i]) / std[i]));
  }

  // ZeRO stage-3 memory model (Rajbhandari et al. 2020): per parameter a
  // training replica holds fp32 weights (4B), gradients (4B), and Adam's two
  // moments (8B). Stage 3 shards all three across the data-parallel group.
  function shardMemoryReport(paramCount, shards) {
    const perReplica = paramCount * 16;
    return {
      perReplica,
      perShard: perReplica / shards,
      paramsPerShard: Math.round(paramCount / shards),
    };
  }

  // One synchronous data-parallel step: gradients computed independently per
  // shard, then all-reduced (averaged) into a single update.
  async function shardedStep(model, optimizer, XS, YS, sampleCount, shards, batch) {
    const shardGrads = [];
    let lossSum = 0;
    for (let s = 0; s < shards; s++) {
      const idx = [];
      for (let b = 0; b < batch; b++) idx.push(Math.floor(Math.random() * sampleCount));
      const bx = tf.gather(XS, idx);
      const by = tf.gather(YS, idx);
      const { value, grads } = tf.variableGrads(() =>
        tf.losses.meanSquaredError(by, model.apply(bx, { training: true }))
      );
      lossSum += (await value.data())[0];
      value.dispose();
      bx.dispose();
      by.dispose();
      shardGrads.push(grads);
    }

    const averaged = {};
    Object.keys(shardGrads[0]).forEach((k) => {
      const stacked = tf.stack(shardGrads.map((g) => g[k]));
      averaged[k] = stacked.mean(0);
      stacked.dispose();
    });
    shardGrads.forEach((g) => Object.values(g).forEach((t) => t.dispose()));

    optimizer.applyGradients(averaged);
    Object.values(averaged).forEach((t) => t.dispose());
    return lossSum / shards;
  }

  // Pools raw rows from a set of simulated devices into one central dataset.
  // Deliberately the opposite of what the federated path does, which is the
  // point: this is the "data left the device" baseline.
  function poolCohortData(cohort, deviceCount, seed) {
    const clients = buildRoundClients(cohort, deviceCount, seed);
    const xs = [];
    const ys = [];
    clients.forEach((c) => {
      c.xs.forEach((r) => xs.push(r));
      c.ys.forEach((v) => ys.push(v));
    });
    return { xs, ys, deviceCount: clients.length };
  }

  async function runCentralTraining({ model, cohort, devices, shards, steps, batch, lr, seed, tag }) {
    const mean = trainer.mean;
    const std = trainer.std;
    const pooled = poolCohortData(cohort, devices, seed);

    const XS = tf.tensor2d(normalizeWith(pooled.xs, mean, std));
    const YS = tf.tensor2d(pooled.ys.map((v) => [v]));
    const VX = tf.tensor2d(normalizeWith(trainer.val.xs, mean, std));
    const VY = tf.tensor2d(trainer.val.ys.map((v) => [v]));

    const paramCount = model.countParams();
    const mem = shardMemoryReport(paramCount, shards);
    const optimizer = tf.train.adam(lr);

    termOut(
      `${tag}: pooling <span class="term-accent">${fmtInt(pooled.xs.length)}</span> samples from ` +
        `${fmtInt(pooled.deviceCount)} devices in ${cohort.label} (centralized, no DP)`
    );
    termOut(
      `${tag}: ${shards} data-parallel shards · global batch ${fmtInt(shards * batch)} (${batch}/shard) · ` +
        `${fmtInt(paramCount)} params`
    );
    termOut(
      `${tag}: ZeRO-3 shards states across the group · ${formatBytes(mem.perReplica)} per replica ` +
        `→ <span class="term-accent">${formatBytes(mem.perShard)}</span> per shard ` +
        `(~${fmtInt(mem.paramsPerShard)} params/shard)`
    );

    const before = await measureMae(model, VX, VY);
    const t0 = performance.now();
    let lastLoss = NaN;

    try {
      for (let step = 0; step < steps; step++) {
        lastLoss = await shardedStep(model, optimizer, XS, YS, pooled.xs.length, shards, batch);
        if (step % Math.max(1, Math.floor(steps / 4)) === 0 || step === steps - 1) {
          const mae = await measureMae(model, VX, VY);
          termOut(`${tag}: step ${step + 1}/${steps} · loss ${fmt(lastLoss, 5)} · val MAE ${fmt(mae, 4)}`);
          // Yield so the terminal actually paints mid-run instead of
          // freezing and dumping every line at the end.
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      const after = await measureMae(model, VX, VY);
      const secs = (performance.now() - t0) / 1000;
      return { before, after, lastLoss, secs, paramCount, mem, pooled };
    } finally {
      XS.dispose();
      YS.dispose();
      VX.dispose();
      VY.dispose();
      optimizer.dispose();
    }
  }

  async function runPretrain(args) {
    if (!trainer) { termWarn("Trainer not ready yet."); return; }
    if (running) { termWarn("Pause training first: run 'pause'."); return; }

    const flags = parseFlags(args || "");
    const cohort = flags.cohort
      ? COHORTS.find((c) => c.id === flags.cohort)
      : currentCohort();
    if (!cohort) { termWarn(`unknown cohort '${flags.cohort}', valid: ${COHORTS.map((c) => c.id).join(", ")}`); return; }

    const devices = Math.max(1, parseInt(flags.devices, 10) || 48);
    const shards = Math.max(1, Math.min(32, parseInt(flags.shards, 10) || 4));
    const steps = Math.max(1, Math.min(2000, parseInt(flags.steps, 10) || 80));
    const batch = Math.max(1, Math.min(512, parseInt(flags.batch, 10) || 32));
    const lr = parseFloat(flags.lr) || 0.02;

    const model = await trainer.cloneFactory();
    try {
      const r = await runCentralTraining({
        model, cohort, devices, shards, steps, batch, lr,
        seed: Math.floor(Math.random() * 1e9), tag: "pretrain",
      });

      // Hand the pretrained weights to the federated coordinator: the real
      // pipeline is central pretrain -> federated fine-tune on-device.
      const w = model.getWeights().map((t) => t.clone());
      trainer.model.setWeights(w);
      w.forEach((t) => t.dispose());
      trainer.history = [];
      trainer.round = 0;
      // Round is 0 because no *federated* round has run, but the weights are
      // real and trained — post-training stages must not treat this as empty.
      trainer.pretrained = true;

      trainer.pretrainedMae = r.after;
      trainer.pretrainedLoss = r.lastLoss;

      termOut(
        `pretrain: done in ${r.secs.toFixed(1)}s · val MAE ` +
          `${fmt(r.before, 4)} → <span class="term-accent">${fmt(r.after, 4)}</span>`
      );
      logLine(
        `<span class="term-time">[${timestamp()}]</span> <span class="term-accent">Global model initialized from pretrained weights</span>. ` +
          `Run 'train' to federate on-device from here.`
      );
      renderAllModelOptions();
      updateDeployStats();
      updateEvalSummary();
      renderPipeline();
    } finally {
      model.dispose();
    }
  }

  const POSTTRAIN_HELP = [
    "posttrain &lt;stage&gt; — what to do with a model after the main training run:",
    "  finetune   adapt the global model to one cohort, centrally (real training)",
    "  distill    train a small student on this model's own predictions",
    "  lora       low-rank adapter fine-tune (--rank --alpha --steps)",
    "  qlora      quantized base + fp32 adapters",
    "  quantize   int8 quantize and re-measure accuracy",
    "  prune      magnitude-prune weights and re-measure accuracy",
    "  flags: --cohort &lt;id&gt; --steps &lt;n&gt; --lr &lt;x&gt; --shards &lt;n&gt; --sparsity &lt;0-1&gt;",
    "  quantize / prune / distill save the compressed model as a deployable",
    "  checkpoint by default. --no-save measures and reverts instead.",
    "  e.g. posttrain finetune --cohort apac --steps 60",
  ].join("<br>");

  async function postTrainFinetune(flags) {
    if (!trainer || (trainer.round === 0 && !trainer.pretrained)) {
      termWarn("Nothing to fine-tune yet: run 'pretrain' or 'train' first.");
      return;
    }
    if (running) { termWarn("Pause training first: run 'pause'."); return; }

    const cohort = flags.cohort ? COHORTS.find((c) => c.id === flags.cohort) : currentCohort();
    if (!cohort) { termWarn(`unknown cohort '${flags.cohort}'`); return; }

    const r = await runCentralTraining({
      model: trainer.model,
      cohort,
      devices: Math.max(1, parseInt(flags.devices, 10) || 24),
      shards: Math.max(1, Math.min(32, parseInt(flags.shards, 10) || 2)),
      steps: Math.max(1, Math.min(2000, parseInt(flags.steps, 10) || 40)),
      batch: Math.max(1, Math.min(512, parseInt(flags.batch, 10) || 32)),
      lr: parseFloat(flags.lr) || 0.005,
      seed: Math.floor(Math.random() * 1e9),
      tag: "finetune",
    });
    const delta = ((r.after - r.before) / r.before) * 100;
    termOut(
      `finetune: val MAE ${fmt(r.before, 4)} → <span class="term-accent">${fmt(r.after, 4)}</span> ` +
        `(${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%) on ${cohort.label} in ${r.secs.toFixed(1)}s`
    );
    renderAllModelOptions();
    updateDeployStats();
    updateEvalSummary();
  }

  // Shared setup for the compression stages: they all operate on whatever
  // model the Deploy tab currently points at, and score it on that model's
  // own held-out validation set.
  async function withDeployTarget(fn) {
    const meta = getSelectedMeta(els.deployModelSelect);
    const target = await resolveModelTarget(els.deployModelSelect);
    if (!meta || !target) {
      termWarn("No model selected to post-train. Train a round, or pick a checkpoint on the Deploy tab.");
      return;
    }
    const xs = tf.tensor2d(normalizeWith(target.val.xs, target.mean, target.std));
    const ys = tf.tensor2d(target.val.ys.map((v) => [v]));
    try {
      await fn({ meta, target, xs, ys });
    } finally {
      xs.dispose();
      ys.dispose();
    }
  }

  async function postTrainQuantize(flags) {
    await withDeployTarget(async ({ meta, target, xs, ys }) => {
      const { model } = target;
      const original = model.getWeights().map((w) => w.clone());
      const base = await measureMae(model, xs, ys);
      const { quantized, fp32Bytes, int8Bytes } = quantizeWeightsInt8(model.getWeights());
      model.setWeights(quantized);
      quantized.forEach((w) => w.dispose());
      const after = await measureMae(model, xs, ys);
      // Persist the quantized artifact before restoring, if asked. Without
      // --save this stage is measure-and-revert: it reports the accuracy cost
      // and leaves the deployed model byte-for-byte unchanged.
      // Saved by default: the compressed model is the point of running this,
      // and discarding it would mean re-running to get it back. --no-save
      // keeps the old measure-and-revert behaviour.
      let saved = null;
      if (!flags || flags["no-save"] === undefined) {
        saved = await persistModelAsCheckpoint(model, {
          tag: "int8",
          dedupeKey: `int8:${meta.id}`,
          architecture: `${meta.architecture} (int8)`,
          round: meta.round,
          valMae: after,
          valLoss: meta.valLoss,
          epsilon: meta.epsilon,
          cohortLabel: meta.cohortLabel,
          mean: target.mean,
          std: target.std,
          valXs: target.val.xs,
          valYs: target.val.ys,
        });
      }
      model.setWeights(original);
      original.forEach((w) => w.dispose());
      const delta = ((after - base) / base) * 100;
      if (saved) termOut(`quantize: saved as <span class="term-accent">${saved.label}</span> (deployable)`);
      termOut(
        `quantize: ${meta.architecture} · ${formatBytes(fp32Bytes)} → ` +
          `<span class="term-accent">${formatBytes(int8Bytes)}</span> (${(fp32Bytes / int8Bytes).toFixed(1)}x) · ` +
          `MAE ${fmt(base, 4)} → ${fmt(after, 4)} (${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%)`
      );
    });
  }

  async function postTrainPrune(flags) {
    const sparsity = Math.max(0.05, Math.min(0.95, parseFloat(flags.sparsity) || 0.4));
    await withDeployTarget(async ({ meta, target, xs, ys }) => {
      const { model } = target;
      const original = model.getWeights().map((w) => w.clone());
      const base = await measureMae(model, xs, ys);
      const { pruned, actualSparsity } = pruneWeightsMagnitude(model.getWeights(), sparsity);
      model.setWeights(pruned);
      pruned.forEach((w) => w.dispose());
      const after = await measureMae(model, xs, ys);
      let savedP = null;
      if (!flags || flags["no-save"] === undefined) {
        savedP = await persistModelAsCheckpoint(model, {
          tag: `pruned ${(actualSparsity * 100).toFixed(0)}%`,
          dedupeKey: `prune:${meta.id}`,
          architecture: `${meta.architecture} (pruned)`,
          round: meta.round,
          valMae: after,
          valLoss: meta.valLoss,
          epsilon: meta.epsilon,
          cohortLabel: meta.cohortLabel,
          mean: target.mean,
          std: target.std,
          valXs: target.val.xs,
          valYs: target.val.ys,
        });
      }
      model.setWeights(original);
      original.forEach((w) => w.dispose());
      const delta = ((after - base) / base) * 100;
      if (savedP) termOut(`prune: saved as <span class="term-accent">${savedP.label}</span> (deployable)`);
      termOut(
        `prune: ${meta.architecture} · ${(actualSparsity * 100).toFixed(0)}% of weights zeroed · ` +
          `MAE ${fmt(base, 4)} → <span class="term-accent">${fmt(after, 4)}</span> ` +
          `(${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%)`
      );
    });
  }

  async function postTrainDistill(flags) {
    await withDeployTarget(async ({ meta, target, xs, ys }) => {
      const teacherParams = target.model.countParams();
      const base = await measureMae(target.model, xs, ys);
      termOut(`distill: training a student on ${meta.architecture}'s own predictions…`);
      await new Promise((r) => setTimeout(r, 0));
      const student = await distillStudent(target.model, target.mean, target.std, currentCohort());
      try {
        const after = await measureMae(student, xs, ys);
        const delta = ((after - base) / base) * 100;
        termOut(
          `distill: ${fmtInt(teacherParams)} → <span class="term-accent">${fmtInt(student.countParams())}</span> params ` +
            `(${(teacherParams / student.countParams()).toFixed(0)}x smaller) · ` +
            `MAE ${fmt(base, 4)} → ${fmt(after, 4)} (${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%)`
        );
        if (!flags || flags["no-save"] === undefined) {
          const savedS = await persistModelAsCheckpoint(student, {
            tag: "distilled",
            dedupeKey: `distill:${meta.id}`,
            architecture: `Distilled from ${meta.architecture}`,
            round: meta.round,
            valMae: after,
            valLoss: meta.valLoss,
            epsilon: meta.epsilon,
            cohortLabel: meta.cohortLabel,
            mean: target.mean,
            std: target.std,
            valXs: target.val.xs,
            valYs: target.val.ys,
          });
          termOut(`distill: saved as <span class="term-accent">${savedS.label}</span> (deployable)`);
        }
      } finally {
        student.dispose();
      }
    });
  }


  // ---------- LoRA / QLoRA adapter fine-tuning ----------
  // Low-Rank Adaptation (Hu et al. 2021): freeze the base weights W and learn a
  // low-rank update dW = (alpha/r) * A @ B. A is random, B starts at ZERO so
  // dW = 0 and the adapted model begins exactly equal to the base. Only A and B
  // receive gradients, so a fine-tune touches r*(in+out) parameters per layer
  // instead of in*out.
  //
  // QLoRA (Dettmers et al. 2023) adds one idea: quantize the frozen base first,
  // then train full-precision adapters on top of it. The base never needs to be
  // stored or updated at full precision, which is what makes fine-tuning large
  // models tractable on small hardware.
  //
  // Applies to the sequential dense presets. The transformer preset is a
  // functional graph with non-dense layers, so it is rejected rather than
  // silently adapted incorrectly.
  function buildLoraAdapters(model, rank, alpha, quantizeBase) {
    const dense = model.layers.filter((l) => l.getClassName() === "Dense");
    if (!dense.length || dense.length !== model.layers.length) return null;

    let baseBytesFp32 = 0, baseBytesQuant = 0;
    const base = dense.map((l) => {
      const [W, b] = l.getWeights();
      baseBytesFp32 += W.size * 4 + b.size * 4;
      let Wf = W.clone();
      if (quantizeBase) {
        // Same int8 affine quantization the Deploy tab measures, applied to the
        // frozen base only. Adapters stay fp32.
        const { quantized } = quantizeWeightsInt8([Wf]);
        Wf.dispose();
        Wf = quantized[0];
        baseBytesQuant += W.size + b.size * 4;
      } else {
        baseBytesQuant += W.size * 4 + b.size * 4;
      }
      return { W: Wf, b: b.clone(), act: l.activation.getClassName().toLowerCase() };
    });

    const adapters = base.map(({ W }) => {
      const [inDim, outDim] = W.shape;
      return {
        A: tf.variable(tf.randomNormal([inDim, rank], 0, 1 / Math.sqrt(inDim))),
        B: tf.variable(tf.zeros([rank, outDim])),
        scale: alpha / rank,
      };
    });
    return { base, adapters, baseBytesFp32, baseBytesQuant };
  }

  function loraForward(lora, x) {
    let h = x;
    lora.base.forEach((L, i) => {
      const { A, B, scale } = lora.adapters[i];
      const dW = A.matMul(B).mul(scale);
      const Weff = L.W.add(dW);
      h = h.matMul(Weff).add(L.b);
      if (L.act === "relu") h = h.relu();
      else if (L.act === "sigmoid") h = h.sigmoid();
    });
    return h;
  }

  function disposeLora(lora) {
    lora.adapters.forEach((a) => { a.A.dispose(); a.B.dispose(); });
    lora.base.forEach((b) => { b.W.dispose(); b.b.dispose(); });
  }

  // Folds the adapters into the weights so the result is an ordinary model:
  // deployable, benchmarkable, and with zero inference overhead. This is the
  // step that makes LoRA free at serving time.
  function mergeLoraInto(model, lora) {
    const merged = [];
    let i = 0;
    model.layers.forEach((l) => {
      if (l.getClassName() !== "Dense") return;
      const { A, B, scale } = lora.adapters[i];
      const dW = A.matMul(B).mul(scale);
      merged.push(lora.base[i].W.add(dW), lora.base[i].b.clone());
      dW.dispose();
      i++;
    });
    model.setWeights(merged);
    merged.forEach((t) => t.dispose());
  }

  async function postTrainLora(flags) {
    const qlora = flags && flags.qlora !== undefined;
    const rank = Math.max(1, Math.min(16, parseInt(flags.rank, 10) || 1));
    const steps = Math.max(1, Math.min(2000, parseInt(flags.steps, 10) || 120));
    const lr = parseFloat(flags.lr) || 0.02;
    const alpha = parseFloat(flags.alpha) || rank * 2;
    const label = qlora ? "qlora" : "lora";

    await withDeployTarget(async ({ meta, target, xs, ys }) => {
      const lora = buildLoraAdapters(target.model, rank, alpha, qlora);
      if (!lora) {
        termWarn(`${label}: only the sequential dense presets are supported; the transformer preset is a functional graph.`);
        return;
      }
      const totalParams = target.model.countParams();
      const trainable = lora.adapters.reduce((n, a) => n + a.A.size + a.B.size, 0);
      const cohort = flags.cohort ? COHORTS.find((c) => c.id === flags.cohort) : currentCohort();
      if (!cohort) { termWarn(`unknown cohort '${flags.cohort}'`); disposeLora(lora); return; }

      // Fine-tuning to another cohort must be scored on THAT cohort's held-out
      // set. Measuring against the source cohort's set makes successful
      // adaptation look like a regression, because the model is deliberately
      // moving away from it. Both are reported so the tradeoff is visible.
      const targetVal = buildCohortValidation(cohort);
      const tXs = tf.tensor2d(normalizeWith(targetVal.xs, target.mean, target.std));
      const tYs = tf.tensor2d(targetVal.ys.map((v) => [v]));
      const beforeSource = await measureMae(target.model, xs, ys);
      const before = await measureMae(target.model, tXs, tYs);
      termOut(
        `${label}: rank ${rank}, alpha ${alpha} · training <span class="term-accent">${fmtInt(trainable)}</span> of ` +
          `${fmtInt(totalParams)} params (${((100 * trainable) / totalParams).toFixed(1)}%)` +
          (qlora ? ` · base quantized to int8 (${formatBytes(lora.baseBytesFp32)} → ${formatBytes(lora.baseBytesQuant)})` : "")
      );
      await new Promise((r) => setTimeout(r, 0));

      const clients = buildRoundClients(cohort, 12, Math.floor(Math.random() * 1e9));
      const TX = tf.tensor2d(normalizeWith(clients.flatMap((c) => c.xs), target.mean, target.std));
      const TY = tf.tensor2d(clients.flatMap((c) => c.ys).map((v) => [v]));
      const opt = tf.train.adam(lr);
      try {
        for (let s = 0; s < steps; s++) {
          opt.minimize(() => tf.losses.meanSquaredError(TY, loraForward(lora, TX)));
          if (s % Math.max(1, Math.floor(steps / 3)) === 0) await new Promise((r) => setTimeout(r, 0));
        }

        const maeOn = async (X, Y) => {
          const preds = tf.tidy(() => loraForward(lora, X));
          const pv = await preds.data();
          const tv = await Y.data();
          preds.dispose();
          let s = 0;
          for (let i = 0; i < tv.length; i++) s += Math.abs(pv[i] - tv[i]);
          return s / tv.length;
        };
        const after = await maeOn(tXs, tYs);
        const afterSource = await maeOn(xs, ys);

        const delta = ((after - before) / before) * 100;
        termOut(
          `${label}: <strong>${cohort.label}</strong> MAE ${fmt(before, 4)} → ` +
            `<span class="term-accent">${fmt(after, 4)}</span> (${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%) in ${steps} steps`
        );
        // Forgetting is the cost of adaptation, so it is reported rather than hidden.
        const drift = ((afterSource - beforeSource) / beforeSource) * 100;
        termOut(
          `${label}: <span class="term-dim">source set ${fmt(beforeSource, 4)} → ${fmt(afterSource, 4)} ` +
            `(${drift >= 0 ? "+" : ""}${drift.toFixed(1)}%) · adapting to one cohort costs accuracy on the other</span>`
        );

        if (!flags || flags["no-save"] === undefined) {
          const adapted = await trainer.cloneFactory();
          mergeLoraInto(adapted, lora);
          const saved = await persistModelAsCheckpoint(adapted, {
            tag: qlora ? `qlora r${rank}` : `lora r${rank}`,
            dedupeKey: `${label}:${meta.id}:r${rank}`,
            architecture: `${meta.architecture} (${label} r${rank})`,
            round: meta.round,
            valMae: after,
            valLoss: meta.valLoss,
            epsilon: meta.epsilon,
            cohortLabel: cohort.label,
            mean: target.mean,
            std: target.std,
            valXs: targetVal.xs,
            valYs: targetVal.ys,
          });
          adapted.dispose();
          termOut(`${label}: adapters merged into the weights and saved as <span class="term-accent">${saved.label}</span> (no inference overhead)`);
        }
      } finally {
        TX.dispose(); TY.dispose(); tXs.dispose(); tYs.dispose(); opt.dispose();
        disposeLora(lora);
      }
    });
  }

  async function runPosttrain(args) {
    const trimmed = (args || "").trim();
    if (!trimmed || trimmed.startsWith("--")) { termOut(POSTTRAIN_HELP); return; }
    const spaceIdx = trimmed.indexOf(" ");
    const stage = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toLowerCase();
    const flags = parseFlags(spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1));

    if (stage === "finetune") return postTrainFinetune(flags);
    if (stage === "quantize") return postTrainQuantize(flags);
    if (stage === "prune") return postTrainPrune(flags);
    if (stage === "distill") return postTrainDistill(flags);
    if (stage === "lora") return postTrainLora(flags);
    if (stage === "qlora") return postTrainLora(Object.assign({ qlora: true }, flags));
    termWarn(`unknown post-training stage '${stage}'`);
    termOut(POSTTRAIN_HELP);
  }

  // ---------- inference tab ----------
  function updateInferenceAvailability() {
    const deployed = els.deployStatus.dataset.deployed === "1" && !!deployedTarget;
    els.inferencePanel.classList.toggle("no-model", !deployed);
    if (deployed) {
      if (!els.sensorGrid.dataset.filled) sampleInference();
    } else {
      resetInferenceReadout();
      // Re-render the map so any previously injected ad is removed: without a
      // deployed ranker there is nothing to score a sponsored slot with.
      applyMapsSearch(els.mapsSearchInput.value);
    }
  }

  // The organic-results state: no prediction, no ad, phone still fully usable.
  function resetInferenceReadout() {
    els.rulValue.textContent = "—";
    els.rulRingFg.style.strokeDashoffset = `${RING_CIRCUMFERENCE}`;
    els.rulDetail.textContent = "No model deployed, so no ad is being scored.";
    els.inferenceLatency.textContent = "Deploy a model to run a real forward pass here.";
    els.sensorGrid.innerHTML = "";
    delete els.sensorGrid.dataset.filled;
    els.btnRandomize.disabled = true;
    lastInferenceMeta = null;
    lastAuction = null;
    lastSignalRow = null;
    lastSignalY = null;
    renderAuction(null);
  }

  // ---------- Apple Maps ad-injection playground ----------
  // A small slice of the Peninsula, laid out roughly as it really is:
  // north-west (Palo Alto) to south-east (Cupertino / Santa Clara), with the
  // Bay to the north-east and the three parallel spines everyone here drives:
  // US-101 nearest the Bay, El Camino Real through every downtown, I-280 up
  // against the foothills. Coordinates are a 1000x1000 world space, not real
  // lat/lng; distances shown are illustrative.
  const MAPS_WORLD = { size: 1000, view: 260 };

  const MAPS_DISTRICTS = {
    paloAlto: { label: "Palo Alto", x: 250, y: 150 },
    mountainView: { label: "Mountain View", x: 430, y: 330 },
    sunnyvale: { label: "Sunnyvale", x: 590, y: 470 },
    santaClara: { label: "Santa Clara", x: 760, y: 560 },
    cupertino: { label: "Cupertino", x: 650, y: 690 },
  };

  // Landmarks are pure geography: drawn for orientation, never advertised on.
  const MAPS_LANDMARKS = [
    { name: "Stanford", x: 170, y: 205, r: 46 },
    { name: "Shoreline", x: 420, y: 205, r: 34 },
    { name: "Moffett Field", x: 545, y: 330, r: 30 },
    { name: "Levi's Stadium", x: 700, y: 445, r: 24 },
    { name: "Apple Park", x: 660, y: 645, r: 30 },
    { name: "Rancho San Antonio", x: 470, y: 560, r: 40 },
  ];

  // Real venues, placed in the district they're actually in. `tags` drives
  // which search terms surface them.
  const MAPS_VENUES = [
    { icon: "☕", name: "Blue Bottle Coffee", district: "paloAlto", tags: ["coffee"], dx: -22, dy: -14 },
    { icon: "☕", name: "Philz Coffee", district: "paloAlto", tags: ["coffee"], dx: 18, dy: 10 },
    { icon: "☕", name: "Verve Coffee Roasters", district: "paloAlto", tags: ["coffee"], dx: -8, dy: 26 },
    { icon: "☕", name: "Red Rock Coffee", district: "mountainView", tags: ["coffee"], dx: -18, dy: -10 },
    { icon: "☕", name: "Chromatic Coffee", district: "santaClara", tags: ["coffee"], dx: 14, dy: 16 },
    { icon: "☕", name: "Bitter+Sweet", district: "cupertino", tags: ["coffee"], dx: -14, dy: 18 },

    { icon: "🥐", name: "Backhaus", district: "mountainView", tags: ["bakery"], dx: 20, dy: -18 },
    { icon: "🥐", name: "Esther's German Bakery", district: "mountainView", tags: ["bakery"], dx: -26, dy: 20 },
    { icon: "🍞", name: "Le Boulanger", district: "sunnyvale", tags: ["bakery"], dx: 16, dy: -14 },
    { icon: "🍰", name: "Manresa Bread", district: "paloAlto", tags: ["bakery"], dx: 26, dy: -22 },

    { icon: "🥙", name: "Oren's Hummus", district: "paloAlto", tags: ["food"], dx: 8, dy: -26 },
    { icon: "🌮", name: "Tacolicious", district: "paloAlto", tags: ["food"], dx: -30, dy: 6 },
    { icon: "🍔", name: "Shake Shack", district: "paloAlto", tags: ["food"], dx: 30, dy: 18 },
    { icon: "🍔", name: "In-N-Out Burger", district: "mountainView", tags: ["food"], dx: 26, dy: 24 },
    { icon: "🥟", name: "Din Tai Fung", district: "santaClara", tags: ["food"], dx: -20, dy: -18 },
    { icon: "🍜", name: "Ramen Seas", district: "sunnyvale", tags: ["food"], dx: -22, dy: 18 },

    { icon: "💊", name: "CVS Pharmacy", district: "mountainView", tags: ["pharmacy"], dx: 10, dy: 30 },
    { icon: "💊", name: "Walgreens", district: "sunnyvale", tags: ["pharmacy"], dx: 24, dy: 26 },
    { icon: "💊", name: "Rite Aid", district: "santaClara", tags: ["pharmacy"], dx: -26, dy: 24 },

    { icon: "🛒", name: "Whole Foods Market", district: "paloAlto", tags: ["grocery"], dx: -34, dy: -24 },
    { icon: "🛒", name: "Trader Joe's", district: "mountainView", tags: ["grocery"], dx: 34, dy: -6 },
    { icon: "🛒", name: "Safeway", district: "sunnyvale", tags: ["grocery"], dx: -30, dy: -22 },
    { icon: "🥬", name: "Sprouts Farmers Market", district: "cupertino", tags: ["grocery"], dx: 22, dy: -16 },

    { icon: "🅿️", name: "Bryant St Garage", district: "paloAlto", tags: ["parking"], dx: 4, dy: 34 },
    { icon: "🅿️", name: "Civic Center Garage", district: "mountainView", tags: ["parking"], dx: -34, dy: -22 },
    { icon: "🅿️", name: "Main Street Garage", district: "cupertino", tags: ["parking"], dx: 30, dy: 22 },

    { icon: "🏋️", name: "Equinox", district: "paloAlto", tags: ["gym"], dx: -16, dy: -34 },
    { icon: "🏋️", name: "24 Hour Fitness", district: "sunnyvale", tags: ["gym"], dx: -12, dy: -32 },
    { icon: "🧘", name: "Planet Granite", district: "santaClara", tags: ["gym"], dx: 26, dy: -26 },

    { icon: "⚡", name: "Tesla Supercharger", district: "mountainView", tags: ["gas"], dx: 12, dy: -30 },
    { icon: "⛽", name: "Chevron", district: "sunnyvale", tags: ["gas"], dx: 32, dy: 6 },
    { icon: "⚡", name: "Electrify America", district: "santaClara", tags: ["gas"], dx: 8, dy: 32 },
    { icon: "⛽", name: "Shell", district: "cupertino", tags: ["gas"], dx: -30, dy: -18 },
  ];

  // Real venues, baked from OpenStreetMap at build time into
  // places/silicon-valley.json. Fetched once from the local server like any
  // other asset: the app never calls a maps API at runtime, so the
  // "nothing leaves this machine" claim in the nav badge stays true. If the
  // file is missing the hand-written list below is used unchanged.
  async function loadRealPlaces() {
    const res = await fetch("places/silicon-valley.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.places || !data.places.length) throw new Error("no places in file");

    Object.entries(data.districts || {}).forEach(([key, d]) => {
      if (MAPS_DISTRICTS[key]) {
        MAPS_DISTRICTS[key].x = d.x;
        MAPS_DISTRICTS[key].y = d.y;
        MAPS_DISTRICTS[key].label = d.label;
      }
    });

    MAPS_VENUES.length = 0;
    data.places.forEach((p) => {
      MAPS_VENUES.push({
        icon: p.icon,
        name: p.name,
        district: p.district,
        tags: [p.cat],
        x: p.x,
        y: p.y,
        cityLabel: p.cityLabel,
        lat: p.lat,
        lon: p.lon,
      });
    });
    return data;
  }

  MAPS_VENUES.forEach((v) => {
    const d = MAPS_DISTRICTS[v.district];
    v.x = d.x + v.dx;
    v.y = d.y + v.dy;
    v.cityLabel = d.label;
  });

  const AD_ADVERTISERS = ["Peet's Coffee", "Sweetgreen", "CVS Pharmacy", "Blue Bottle Coffee", "Joe & The Juice"];

  // Search-triggered ad injection: sponsored results appear in the category
  // you actually searched, same as real Maps/Search ads, not just floating
  // on the default nearby list.
  const MAPS_CATEGORIES = {
    coffee: {
      label: "Coffee & cafes",
      tag: "coffee",
      keywords: ["coffee", "cafe", "café", "espresso", "latte", "cappuccino"],
      advertisers: ["Peet's Coffee", "Blue Bottle Coffee", "Philz Coffee", "Starbucks"],
    },
    bakery: {
      label: "Bakeries",
      tag: "bakery",
      keywords: ["bakery", "bake", "pastry", "croissant", "bread", "donut", "cake"],
      advertisers: ["Panera Bread", "Le Boulanger", "Crumbl Cookies"],
    },
    food: {
      label: "Food & dining",
      tag: "food",
      keywords: ["pizza", "restaurant", "food", "lunch", "dinner", "burger", "eat", "ramen", "tacos"],
      advertisers: ["Sweetgreen", "Shake Shack", "Chipotle", "DoorDash"],
    },
    pharmacy: {
      label: "Pharmacy",
      tag: "pharmacy",
      keywords: ["pharmacy", "drugstore", "cvs", "medicine", "prescription"],
      advertisers: ["CVS Pharmacy", "Walgreens", "Rite Aid"],
    },
    grocery: {
      label: "Grocery",
      tag: "grocery",
      keywords: ["grocery", "groceries", "supermarket", "market", "produce"],
      advertisers: ["Whole Foods Market", "Trader Joe's", "Instacart"],
    },
    parking: {
      label: "Parking",
      tag: "parking",
      keywords: ["parking", "garage", "lot", "park"],
      advertisers: ["SpotHero", "ParkWhiz"],
    },
    gym: {
      label: "Fitness",
      tag: "gym",
      keywords: ["gym", "fitness", "workout", "yoga", "climbing"],
      advertisers: ["Planet Fitness", "Equinox", "24 Hour Fitness"],
    },
    gas: {
      label: "Gas & EV charging",
      tag: "gas",
      keywords: ["gas", "fuel", "station", "charging", "ev", "supercharger"],
      advertisers: ["Shell", "Chevron", "Electrify America"],
    },
  };

  // Free-text city match, so "coffee in cupertino" pans there rather than
  // defaulting to the nearest district.
  function matchMapsDistrict(query) {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    for (const [key, d] of Object.entries(MAPS_DISTRICTS)) {
      if (q.includes(d.label.toLowerCase())) return key;
    }
    return null;
  }

  // Draws the static geography once, in world coordinates. The viewBox is
  // what moves when you search; this never gets rebuilt.
  function renderMapWorld() {
    const world = document.getElementById("maps-world");
    if (!world) return;
    const S = MAPS_WORLD.size;

    const roads = [
      // US-101, closest to the Bay
      { d: "M -40 40 Q 300 250 620 430 T 1040 700", w: 15, c: "#ffffff", label: "101" },
      // El Camino Real, through every downtown
      { d: "M -40 150 Q 300 360 620 545 T 1040 810", w: 10, c: "#ffffff", label: "El Camino Real" },
      // I-280, up against the foothills
      { d: "M -40 330 Q 300 545 620 730 T 1040 1000", w: 13, c: "#ffffff", label: "280" },
      // Central Expressway
      { d: "M -40 95 Q 320 305 640 490 T 1040 755", w: 5, c: "#f4f5f7" },
      // cross streets tying the spines together
      { d: "M 250 40 L 175 330", w: 5, c: "#f4f5f7" },
      { d: "M 440 210 L 370 495", w: 5, c: "#f4f5f7" },
      { d: "M 610 350 L 540 640", w: 5, c: "#f4f5f7" },
      { d: "M 780 440 L 700 730", w: 5, c: "#f4f5f7" },
    ];

    const parts = [`<rect x="0" y="0" width="${S}" height="${S}" fill="#eef0f2"></rect>`];

    // San Francisco Bay, north-east edge
    parts.push(
      `<path d="M -40 -40 L 1040 -40 L 1040 300 Q 760 230 470 90 Q 260 -10 -40 -20 Z" fill="#cfe8f3"></path>`
    );
    // foothills / open space on the south-west edge
    parts.push(
      `<path d="M -40 620 Q 260 780 560 960 L 560 1040 L -40 1040 Z" fill="#dcecd6"></path>`
    );

    MAPS_LANDMARKS.forEach((l) => {
      parts.push(`<circle cx="${l.x}" cy="${l.y}" r="${l.r}" fill="#e2ece0"></circle>`);
    });

    roads.forEach((r) => {
      parts.push(`<path d="${r.d}" stroke="${r.c}" stroke-width="${r.w}" fill="none" stroke-linecap="round"></path>`);
    });

    // city blocks, deterministic so the map doesn't reshuffle on every render
    let seed = 991;
    const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    Object.values(MAPS_DISTRICTS).forEach((d) => {
      for (let i = 0; i < 14; i++) {
        const bx = d.x + (rand() - 0.5) * 130;
        const by = d.y + (rand() - 0.5) * 130;
        const bw = 10 + rand() * 20;
        const bh = 8 + rand() * 18;
        parts.push(`<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="#dfe2e6"></rect>`);
      }
    });

    MAPS_LANDMARKS.forEach((l) => {
      parts.push(`<text x="${l.x}" y="${l.y}" text-anchor="middle" class="map-landmark-label">${l.name}</text>`);
    });
    Object.values(MAPS_DISTRICTS).forEach((d) => {
      parts.push(`<text x="${d.x}" y="${d.y - 58}" text-anchor="middle" class="map-city-label">${d.label}</text>`);
    });

    world.innerHTML = parts.join("");
  }

  // Animates the viewBox toward a district so searching visibly moves the map.
  let mapViewRaf = null;
  let mapView = { x: MAPS_DISTRICTS.paloAlto.x, y: MAPS_DISTRICTS.paloAlto.y };
  let mapZoom = MAPS_WORLD.view;

  function panMapTo(x, y) {
    const svg = document.getElementById("maps-canvas");
    if (!svg) return;
    const half = mapZoom / 2;
    const clamp = (v) => Math.max(half, Math.min(MAPS_WORLD.size - half, v));
    const target = { x: clamp(x), y: clamp(y) };

    if (mapViewRaf) cancelAnimationFrame(mapViewRaf);
    const from = { ...mapView };
    const start = performance.now();
    const DURATION = 620;

    function step(now) {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - t, 3);
      mapView.x = from.x + (target.x - from.x) * eased;
      mapView.y = from.y + (target.y - from.y) * eased;
      svg.setAttribute("viewBox", `${(mapView.x - half).toFixed(1)} ${(mapView.y - half).toFixed(1)} ${mapZoom} ${mapZoom}`);
      if (t < 1) mapViewRaf = requestAnimationFrame(step);
      else mapViewRaf = null;
    }
    mapViewRaf = requestAnimationFrame(step);
  }

  // Illustrative walking distance from the user's current map centre.
  function distanceLabel(place) {
    const dx = place.x - mapView.x;
    const dy = place.y - mapView.y;
    const miles = Math.sqrt(dx * dx + dy * dy) / 90;
    return `${miles.toFixed(1)} mi · ${place.cityLabel}`;
  }

  let lastPredPct = 0.5;

  function matchMapsCategory(query) {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    for (const cat of Object.values(MAPS_CATEGORIES)) {
      if (cat.keywords.some((kw) => q.includes(kw) || kw.includes(q))) return cat;
    }
    return null;
  }

  function flashRow(index) {
    const row = els.mapsPlaceList.children[index];
    if (!row) return;
    row.classList.add("flash");
    if (typeof row.scrollIntoView === "function") row.scrollIntoView({ block: "nearest" });
    setTimeout(() => row.classList.remove("flash"), 900);
  }

  function flashPin(index) {
    const pin = els.mapsPins.children[index];
    if (!pin) return;
    pin.classList.add("flash");
    setTimeout(() => pin.classList.remove("flash"), 900);
  }

  let mapCalloutTimer = null;

  // A tap callout drawn directly on the map canvas (name + a little pointer
  // triangle above the pin), so "clickable on the map" has feedback on the
  // map itself, not only a flash on the list below.
  function showMapCallout(x, y, name, isAd) {
    const svg = els.mapsPins.ownerSVGElement || els.mapsPins.closest("svg");
    if (!svg) return;
    let g = svg.querySelector("#maps-callout");
    if (!g) {
      g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("id", "maps-callout");
      g.setAttribute("class", "map-callout");
      svg.appendChild(g);
    }
    // Clamp inside the *current* viewBox window, not the world, so the
    // callout never renders off the visible edge of the screen.
    const padX = 8, textW = Math.min(150, 7 * name.length + padX * 2), h = 22;
    const half = mapZoom / 2;
    const left = mapView.x - half, right = mapView.x + half;
    const bx = Math.max(left + 6, Math.min(right - textW - 6, x - textW / 2));
    const by = Math.max(mapView.y - half + 6, y - 34);
    g.innerHTML = `
      <rect x="${bx}" y="${by}" width="${textW}" height="${h}" rx="6" class="map-callout-bg${isAd ? " sponsored" : ""}"></rect>
      <text x="${bx + textW / 2}" y="${by + h / 2 + 4}" text-anchor="middle" class="map-callout-text">${name.length > 20 ? name.slice(0, 19) + "…" : name}</text>
    `;
    g.style.opacity = "1";
    if (mapCalloutTimer) clearTimeout(mapCalloutTimer);
    mapCalloutTimer = setTimeout(() => { g.style.opacity = "0"; }, 1800);
  }

  // Rows currently on screen, in list order. Pin i always corresponds to
  // row i, so the map and the sheet can cross-reference each other by index.
  let currentRows = [];

  function venuesForCategory(cat, districtKey) {
    let list = cat ? MAPS_VENUES.filter((v) => v.tags.includes(cat.tag)) : MAPS_VENUES.slice();
    if (districtKey) {
      const inDistrict = list.filter((v) => v.district === districtKey);
      if (inDistrict.length) list = inDistrict;
    }
    // Nearest first, measured from wherever the map is currently centred.
    return list
      .map((v) => ({ v, d: Math.hypot(v.x - mapView.x, v.y - mapView.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 4)
      .map((e) => e.v);
  }

  function renderMapsPlayground(predPct, advertiser, places) {
    lastPredPct = predPct;
    const list = (places && places.length ? places : venuesForCategory(null, null)).slice(0, 4);

    const rows = list.map((p) => ({
      icon: p.icon,
      name: p.name,
      sub: distanceLabel(p),
      x: p.x,
      y: p.y,
      cityLabel: p.cityLabel,
      sponsored: false,
    }));

    // An ad only exists if a ranker is deployed to score it. With no model
    // the list is purely organic, which is the honest before-state.
    const adsEnabled = !!deployedTarget;
    const rank = Math.max(0, Math.min(rows.length, Math.round((1 - predPct) * rows.length)));
    if (adsEnabled) {
      // The sponsored result is placed by the model's predicted engagement:
      // higher score inserts nearer the top.
      const anchor = list[Math.min(rank, list.length - 1)] || { x: mapView.x, y: mapView.y, cityLabel: "" };
      rows.splice(rank, 0, {
        icon: "📍",
        name: advertiser,
        sub: "Sponsored",
        x: anchor.x + 18,
        y: anchor.y - 16,
        cityLabel: anchor.cityLabel,
        sponsored: true,
        score: predPct,
      });
    }
    currentRows = rows;

    els.mapsPins.innerHTML = "";
    rows.forEach((row, i) => {
      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("class", "map-pin" + (row.sponsored ? " sponsored" : ""));
      g.style.cursor = "pointer";

      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", row.x);
      c.setAttribute("cy", row.y);
      c.setAttribute("r", row.sponsored ? 7 + predPct * 4 : 6);
      c.setAttribute("class", "map-pin-dot" + (row.sponsored ? " sponsored" : ""));
      if (row.sponsored) {
        c.style.filter = `drop-shadow(0 0 ${4 + predPct * 8}px rgba(10,132,255,${(0.3 + predPct * 0.5).toFixed(2)}))`;
      }
      g.appendChild(c);
      g.addEventListener("click", () => openPlaceCard(i));
      els.mapsPins.appendChild(g);
    });

    // The blue "you are here" dot sits at the map's current centre.
    const me = document.createElementNS(SVG_NS, "circle");
    me.setAttribute("cx", mapView.x);
    me.setAttribute("cy", mapView.y);
    me.setAttribute("r", 6);
    me.setAttribute("class", "map-user-dot");
    els.mapsPins.appendChild(me);

    els.mapsPlaceList.innerHTML = rows
      .map(
        (r, i) => `<div class="maps-place-row${r.sponsored ? " sponsored" : ""}" data-pin-index="${i}">
          <div class="maps-place-icon">${r.icon}</div>
          <div class="maps-place-info">
            <div class="maps-place-name">${r.name}</div>
            <div class="maps-place-sub">${r.sub}</div>
          </div>
          ${r.sponsored ? `<span class="maps-place-trailing"><span class="maps-place-badge">Ad</span><span class="maps-place-score">${Math.round(r.score * 100)}%</span></span>` : ""}
        </div>`
      )
      .join("");
    Array.from(els.mapsPlaceList.children).forEach((rowEl, i) => {
      rowEl.addEventListener("click", () => openPlaceCard(i));
    });

    renderInjectionExplainer(predPct, advertiser, rank, rows.length, adsEnabled);
  }

  // ---------- place card ----------
  // Tapping a pin or a row opens the detail sheet real Maps shows: name,
  // distance, drive/walk estimates, and a Directions action.
  function driveMinutes(miles) {
    return Math.max(1, Math.round((miles / 24) * 60)); // ~24 mph door-to-door in town
  }
  function walkMinutes(miles) {
    return Math.max(1, Math.round((miles / 3.1) * 60));
  }

  function openPlaceCard(index) {
    const row = currentRows[index];
    if (!row || !els.placeCard) return;

    flashPin(index);
    flashRow(index);
    panMapTo(row.x, row.y);
    showMapCallout(row.x, row.y, row.name, row.sponsored);

    const miles = Math.hypot(row.x - mapView.x, row.y - mapView.y) / 90;
    const drive = driveMinutes(miles);
    const walk = walkMinutes(miles);

    els.placeCard.innerHTML = `
      <div class="place-card-head">
        <div class="place-card-icon">${row.icon}</div>
        <div class="place-card-title">
          <div class="place-card-name">${row.name}</div>
          <div class="place-card-sub">${row.sponsored ? "Sponsored result" : row.cityLabel || "Nearby"}</div>
        </div>
        <button type="button" class="place-card-close" id="place-card-close" aria-label="Close">✕</button>
      </div>
      ${row.sponsored ? `<div class="place-card-adnote">Placed by the on-device ranker · ${Math.round(row.score * 100)}% predicted engagement</div>` : ""}
      <div class="place-card-metrics">
        <div class="place-card-metric"><span class="place-card-metric-value">${miles.toFixed(1)}</span><span class="place-card-metric-label">miles</span></div>
        <div class="place-card-metric"><span class="place-card-metric-value">${drive}</span><span class="place-card-metric-label">min drive</span></div>
        <div class="place-card-metric"><span class="place-card-metric-value">${walk}</span><span class="place-card-metric-label">min walk</span></div>
      </div>
      <div class="place-card-actions">
        <button type="button" class="place-card-btn primary" id="place-card-directions">Directions</button>
        <button type="button" class="place-card-btn" id="place-card-call">Call</button>
      </div>
      <div class="place-card-route" id="place-card-route" hidden></div>
    `;
    els.placeCard.hidden = false;
    els.placeCard.classList.add("open");

    els.placeCard.querySelector("#place-card-close").addEventListener("click", closePlaceCard);
    els.placeCard.querySelector("#place-card-directions").addEventListener("click", () => showRoute(index, drive, miles));
    els.placeCard.querySelector("#place-card-call").addEventListener("click", () => {
      const note = els.placeCard.querySelector("#place-card-route");
      note.hidden = false;
      note.textContent = "Calling is not wired up in this demo.";
    });
  }

  function closePlaceCard() {
    if (!els.placeCard) return;
    els.placeCard.classList.remove("open");
    els.placeCard.hidden = true;
    clearRoute();
  }

  function clearRoute() {
    const svg = document.getElementById("maps-canvas");
    const existing = svg && svg.querySelector("#maps-route");
    if (existing) existing.remove();
  }

  // Draws a route line from the user dot to the place, then reports an ETA.
  function showRoute(index, driveMin, miles) {
    const row = currentRows[index];
    const svg = document.getElementById("maps-canvas");
    if (!row || !svg) return;
    clearRoute();

    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("id", "maps-route");
    // A slight bow, so it reads as a route rather than a straight ruler line.
    const midX = (mapView.x + row.x) / 2 + (row.y - mapView.y) * 0.16;
    const midY = (mapView.y + row.y) / 2 - (row.x - mapView.x) * 0.16;
    g.innerHTML =
      `<path d="M ${mapView.x} ${mapView.y} Q ${midX} ${midY} ${row.x} ${row.y}" class="map-route-line"></path>` +
      `<circle cx="${row.x}" cy="${row.y}" r="4" class="map-route-end"></circle>`;
    svg.insertBefore(g, els.mapsPins);

    const note = els.placeCard.querySelector("#place-card-route");
    if (note) {
      note.hidden = false;
      const eta = new Date(Date.now() + driveMin * 60000);
      note.innerHTML =
        `<strong>${driveMin} min</strong> · ${miles.toFixed(1)} mi · arrive ` +
        `${eta.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · fastest route`;
    }
  }

  // Makes the ad-ranking decision legible step by step, using the exact same
  // values that just drove the pin/list render above, not a separate
  // explanation that could drift out of sync with what's on screen.
  function renderInjectionExplainer(predPct, advertiser, rank, listLength, adsEnabled) {
    if (!els.injectSteps) return;
    const query = els.mapsSearchInput.value.trim();
    const cat = currentMapsCategory;

    if (!adsEnabled) {
      els.injectSteps.innerHTML = `
        <div class="inject-step">
          <div class="inject-step-marker">1</div>
          <div class="inject-step-body">
            <div class="inject-step-label">Query</div>
            <div class="inject-step-value">${query ? `"${query}"` : "Browsing nearby"}</div>
            <div class="inject-step-detail">${cat ? `Matched category: ${cat.label}` : "No category match, default nearby ranking"}</div>
          </div>
        </div>
        <div class="inject-step">
          <div class="inject-step-marker">2</div>
          <div class="inject-step-body">
            <div class="inject-step-label">Ranking</div>
            <div class="inject-step-value">Organic results only</div>
            <div class="inject-step-detail">Sorted by distance from the map centre. Nothing is sponsored.</div>
          </div>
        </div>
        <p class="no-model-hint">No ranker is deployed, so there is no predicted engagement to place an ad with.
        Deploy one on the <strong>Deploy</strong> tab and this list gains a scored sponsored slot.</p>`;
      return;
    }

    const scorePct = Math.round(predPct * 100);
    const positionLabel = rank === 0 ? "top of the list" : `position ${rank + 1} of ${listLength}`;

    const steps = [
      {
        label: "Query",
        value: query ? `"${query}"` : "Browsing nearby (no query)",
        detail: cat ? `Matched category: ${cat.label}` : "No category match, default nearby ranking",
      },
      {
        label: "Candidate advertiser",
        value: advertiser,
        detail: cat ? `Drawn from the ${cat.label} advertiser pool` : "Drawn from the general advertiser pool",
      },
      {
        label: "On-device prediction",
        value: `${scorePct}% predicted engagement`,
        detail: lastInferenceMeta
          ? `${lastInferenceMeta.archLabel} · ${lastInferenceMeta.latencyMs.toFixed(2)} ms on ${lastInferenceMeta.backend === "webgl" ? "GPU (WebGL)" : lastInferenceMeta.backend.toUpperCase()} · a real forward pass through the federated model's actual weights, not a modeled Neural Engine number`
          : "Scored by the federated global model, running locally on this simulated device",
      },
      {
        label: "Placement",
        value: positionLabel,
        detail: "Higher predicted engagement inserts higher in the list. Query text and score never leave the device.",
      },
    ];

    els.injectSteps.innerHTML = steps
      .map(
        (s, i) => `<div class="inject-step active">
          <div class="inject-step-marker">${i + 1}</div>
          <div class="inject-step-body">
            <div class="inject-step-label">${s.label}</div>
            <div class="inject-step-value">${s.value}</div>
            <div class="inject-step-detail">${s.detail}</div>
          </div>
        </div>`
      )
      .join("");
  }

  let currentMapsCategory = null;

  function pickAdvertiser(category) {
    const pool = category ? category.advertisers : AD_ADVERTISERS;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function applyMapsSearch(query) {
    const cat = matchMapsCategory(query);
    const districtKey = matchMapsDistrict(query);
    currentMapsCategory = cat;
    closePlaceCard();

    const trimmed = query.trim();
    const district = districtKey ? MAPS_DISTRICTS[districtKey] : null;
    els.mapsSheetTitle.textContent = trimmed
      ? district
        ? `"${trimmed}" in ${district.label}`
        : `Results for "${trimmed}"`
      : "Nearby";

    // Move the map before picking results, so "nearest" is measured from
    // where the user is actually looking.
    if (district) panMapTo(district.x, district.y);

    const venues = venuesForCategory(cat, districtKey);
    if (!district && venues.length) {
      // No explicit city: centre on the cluster the results actually form.
      const cx = venues.reduce((a, v) => a + v.x, 0) / venues.length;
      const cy = venues.reduce((a, v) => a + v.y, 0) / venues.length;
      panMapTo(cx, cy);
    }
    // Re-run the auction against THIS category's advertiser pool. Picking the
    // shown ad separately from the auction let the two disagree: searching
    // "pharmacy" showed a pharmacy brand on the map while the auction panel
    // still displayed a stale result from the generic pool.
    refreshAdPlacement(venues).catch((err) => console.error("[fl-demo] ad placement failed:", err));
  }

  // Single source of truth for which ad is shown: the auction winner. Called
  // both when a new device is sampled and when the search category changes.
  async function refreshAdPlacement(venues) {
    const cat = currentMapsCategory;
    const list = venues || venuesForCategory(cat, null);
    const pool = cat ? cat.advertisers : AD_ADVERTISERS;

    let advertiser = null;
    let shownPct = lastPredPct;

    if (deployedTarget && lastSignalRow) {
      lastAuction = await runAdAuction(lastSignalRow, pool, lastSignalY);
      renderAuction(lastAuction);
      if (lastAuction) {
        advertiser = lastAuction.winner.name;
        shownPct = lastAuction.winner.pctr;
      }
    } else {
      lastAuction = null;
      renderAuction(null);
    }
    if (!advertiser) advertiser = pickAdvertiser(cat);
    if (lastAuction) {
      recordImpression({
        advertiser: lastAuction.winner.name,
        category: cat ? cat.label : null,
        district: null,
        engagement: lastAuction.winner.pctr,
        deviceId: lastSignalRow ? `dev-${Math.round(lastSignalRow[0] * 1e6)}` : "dev-live",
      });
    }
    renderMapsPlayground(shownPct, advertiser, list);
    renderPipeline();
  }

  function initMapsSearch() {
    els.mapsSearchInput.addEventListener("input", () => applyMapsSearch(els.mapsSearchInput.value));
    els.mapsSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") els.mapsSearchInput.blur();
    });
  }



  // ---------- training configuration ----------
  // The ZeRO memory formulas (Rajbhandari et al. 2020) applied to the selected
  // model's real parameter count. With Adam, a training replica holds weights,
  // gradients and two optimizer moments; each stage shards one more of those
  // across the data-parallel group:
  //   DDP     : every rank holds all of it
  //   ZeRO-1  : optimizer states sharded
  //   ZeRO-2  : + gradients sharded
  //   ZeRO-3  : + parameters sharded  (this is what FSDP does)
  //
  // The arithmetic is real. What this browser cannot do is actually run on N
  // GPUs, so the panel reports memory and the exact command to reproduce it,
  // and never claims to have executed a distributed job.
  function memoryBreakdown(params, strategy, worldSize, precision) {
    const N = Math.max(1, worldSize);
    const mixed = precision === "mixed";
    // Mixed precision keeps bf16 weights/grads plus an fp32 master copy.
    const weights = mixed ? 2 : 4;
    const grads = mixed ? 2 : 4;
    const optim = mixed ? 4 + 4 + 4 : 4 + 4; // master + m + v, or m + v
    const shard = { single: [1, 1, 1], ddp: [1, 1, 1], zero1: [1, 1, N], zero2: [1, N, N], zero3: [N, N, N] }[strategy] || [1, 1, 1];
    const w = (params * weights) / shard[0];
    const g = (params * grads) / shard[1];
    const o = (params * optim) / shard[2];
    return { weights: w, grads: g, optim: o, total: w + g + o, perReplicaFull: params * (weights + grads + optim) };
  }

  function currentConfigParams() {
    const meta = getSelectedMeta(els.deployModelSelect);
    if (meta && meta.paramCount) return { params: meta.paramCount, label: meta.architecture };
    if (trainer && trainer.model) return { params: trainer.model.countParams(), label: trainer.modelLabel };
    return { params: 385, label: "AdRank-Net S" };
  }

  function renderTrainingConfig() {
    if (!els.cfgReadout) return;
    const { params, label } = currentConfigParams();
    const strategy = els.cfgStrategy.value;
    const world = parseInt(els.cfgWorld.value, 10);
    const precision = els.cfgPrecision.value;
    const framework = els.cfgFramework.value;

    const m = memoryBreakdown(params, strategy, world, precision);
    const saving = m.perReplicaFull > 0 ? m.perReplicaFull / m.total : 1;

    els.cfgReadout.innerHTML = `
      <div class="cfg-row cfg-row-head"><span>Per GPU</span><span>Weights</span><span>Grads</span><span>Optimizer</span><span>Total</span></div>
      <div class="cfg-row">
        <span class="cfg-model">${escapeHtml(label)} · ${fmtInt(params)} params</span>
        <span>${formatBytes(m.weights)}</span>
        <span>${formatBytes(m.grads)}</span>
        <span>${formatBytes(m.optim)}</span>
        <span class="cfg-total">${formatBytes(m.total)}</span>
      </div>
      <p class="cfg-note">
        ${strategy === "single" || strategy === "ddp"
          ? "Every rank holds a full copy: no memory saving, communication is a gradient all-reduce per step."
          : `<strong>${saving.toFixed(1)}x smaller</strong> per GPU than DDP at world size ${world}, paid for with extra collectives to gather what was sharded.`}
        ${framework === "pytorch" ? " Runs via the PyTorch package in <code>python/</code>." : " Executes here in TensorFlow.js, single device."}
      </p>`;

    const cohort = currentCohort().id;
    els.cfgCommand.textContent =
      framework === "pytorch"
        ? (strategy === "single"
            ? `python scripts/train.py --cohort ${cohort} --rounds 15 --k ${els.k.value} --noise ${els.noise.value}`
            : `torchrun --nproc_per_node=${world} scripts/train.py \\\n  --cohort ${cohort} --rounds 15 --k ${els.k.value} \\\n  --noise ${els.noise.value} --strategy ${strategy}${precision === "mixed" ? " --bf16" : ""}`)
        : `pretrain --shards ${world} --steps 120 --cohort ${cohort}\ntrain --cohort ${cohort} --k ${els.k.value} --noise ${els.noise.value}`;
  }



  // ---------- on-device personalization ----------
  // The federated model is one model for everyone. Personalization trains a
  // tiny private adapter on this device's own history and keeps it here: it is
  // never uploaded, never clipped, never noised, and never aggregated, because
  // it never leaves. That is why it costs nothing from the privacy budget,
  // and it is the piece that makes a shared model feel individual.
  //
  // Measured honestly: the adapter is trained on a split of this device's rows
  // and scored on the rows it never saw, so the gain is generalization on this
  // device rather than memorization.
  let personalAdapter = null;

  async function personalizeForDevice() {
    if (!deployedTarget) { termWarn("Deploy a model before personalizing."); return; }
    els.btnPersonalize.disabled = true;
    const prev = els.btnPersonalize.textContent;
    els.btnPersonalize.textContent = "Personalizing…";
    try {
      const { model, mean, std } = deployedTarget;
      const cohort = currentCohort();
      const device = buildRoundClients(cohort, 1, Math.floor(Math.random() * 1e9))[0];

      // Hold out the tail of this device's own history.
      const cut = Math.floor(device.xs.length * 0.7);
      const trX = tf.tensor2d(normalizeWith(device.xs.slice(0, cut), mean, std));
      const trY = tf.tensor2d(device.ys.slice(0, cut).map((v) => [v]));
      const teX = tf.tensor2d(normalizeWith(device.xs.slice(cut), mean, std));
      const teY = tf.tensor2d(device.ys.slice(cut).map((v) => [v]));

      const globalMae = await measureMae(model, teX, teY);

      const lora = buildLoraAdapters(model, 1, 2, false);
      if (!lora) { termWarn("Personalization needs a dense preset."); return; }
      const adapterParams = lora.adapters.reduce((n, a) => n + a.A.size + a.B.size, 0);
      const opt = tf.train.adam(0.03);
      for (let s = 0; s < 200; s++) {
        opt.minimize(() => tf.losses.meanSquaredError(trY, loraForward(lora, trX)));
        if (s % 60 === 0) await new Promise((r) => setTimeout(r, 0));
      }
      const preds = tf.tidy(() => loraForward(lora, teX));
      const pv = await preds.data();
      const tv = await teY.data();
      preds.dispose();
      let personalMae = 0;
      for (let i = 0; i < tv.length; i++) personalMae += Math.abs(pv[i] - tv[i]);
      personalMae /= tv.length;

      const gain = ((globalMae - personalMae) / globalMae) * 100;
      const bytes = adapterParams * 4;
      els.personalizeStats.innerHTML = `
        <div class="pz-row"><span class="pz-label">Device</span><span class="pz-value">${escapeHtml(device.name)} · ${escapeHtml(device.device)}</span></div>
        <div class="pz-row"><span class="pz-label">Global model</span><span class="pz-value">MAE ${fmt(globalMae, 4)}</span></div>
        <div class="pz-row"><span class="pz-label">Personalized</span><span class="pz-value pz-good">MAE ${fmt(personalMae, 4)}</span></div>
        <div class="pz-row"><span class="pz-label">Improvement</span><span class="pz-value ${gain >= 0 ? "pz-good" : "pz-warn"}">${gain >= 0 ? "" : "+"}${Math.abs(gain).toFixed(1)}% ${gain >= 0 ? "better" : "worse"}</span></div>
        <div class="pz-row"><span class="pz-label">Adapter size</span><span class="pz-value">${fmtInt(adapterParams)} params · ${formatBytes(bytes)}</span></div>
        <div class="pz-row"><span class="pz-label">Privacy cost</span><span class="pz-value pz-good">ε + 0 · nothing uploaded</span></div>`;

      logLine(
        `<span class="term-time">[${timestamp()}]</span> <span class="term-accent">Personalized on-device</span> ` +
          `<span class="term-dim">${device.name} · MAE ${fmt(globalMae, 4)} → ${fmt(personalMae, 4)} · ` +
          `${fmtInt(adapterParams)}-param adapter stays local, ε unchanged</span>`
      );

      if (personalAdapter) disposeLora(personalAdapter);
      personalAdapter = lora;
      [trX, trY, teX, teY].forEach((t) => t.dispose());
      opt.dispose();
    } catch (err) {
      console.error("[fl-demo] personalization failed:", err);
      termWarn(`personalization failed: ${(err && err.message) || err}`);
    } finally {
      els.btnPersonalize.disabled = false;
      els.btnPersonalize.textContent = prev;
    }
  }

  // ---------- advertiser reporting ----------
  // Training privacy (DP + secure aggregation) protects the model. This
  // protects the other direction: what an advertiser learns about who saw and
  // engaged with their ad. Three mechanisms, applied in this order:
  //
  //   1. DELAYED  - each impression is held for a randomized interval, so a
  //                 report cannot be correlated with the moment of the tap.
  //                 Apple's real systems delay on the order of 24-48h; the
  //                 delay here is compressed to seconds so it is observable,
  //                 and that compression is stated in the UI.
  //   2. CROWD ANONYMITY - a bucket is only released once at least K DISTINCT
  //                 devices fall into it. Below that it is withheld entirely,
  //                 not rounded or noised, so a bucket can never describe a
  //                 small enough group to re-identify someone.
  //   3. AGGREGATED - only counts and averages per bucket are ever emitted.
  //                 No row corresponds to an individual impression.
  const CROWD_ANONYMITY_K = 5;
  const REPORT_DELAY_MIN_MS = 3000;
  const REPORT_DELAY_MAX_MS = 9000;

  let reportPending = [];   // held, waiting out their randomized delay
  let reportReleased = [];  // delay elapsed, eligible for aggregation
  let reportTimer = null;

  function recordImpression({ advertiser, category, district, engagement, deviceId }) {
    const delay = REPORT_DELAY_MIN_MS + Math.random() * (REPORT_DELAY_MAX_MS - REPORT_DELAY_MIN_MS);
    reportPending.push({
      advertiser,
      category: category || "nearby",
      district: district || "unknown",
      engagement,
      deviceId,
      releaseAt: performance.now() + delay,
    });
    startReportTimer();
  }

  function startReportTimer() {
    if (reportTimer) return;
    reportTimer = setInterval(() => {
      const now = performance.now();
      const ready = reportPending.filter((r) => r.releaseAt <= now);
      if (ready.length) {
        reportPending = reportPending.filter((r) => r.releaseAt > now);
        reportReleased.push(...ready);
      }
      renderReporting();
      if (!reportPending.length) { clearInterval(reportTimer); reportTimer = null; }
    }, 500);
  }

  // Distinct-device counting is what makes the threshold meaningful: 20
  // impressions from 2 devices must NOT clear a k=5 crowd-anonymity bar.
  function aggregateReports(records) {
    const buckets = new Map();
    records.forEach((r) => {
      const key = `${r.advertiser}\u0000${r.category}`;
      if (!buckets.has(key)) {
        buckets.set(key, { advertiser: r.advertiser, category: r.category, impressions: 0, devices: new Set(), engagementSum: 0 });
      }
      const b = buckets.get(key);
      b.impressions++;
      b.devices.add(r.deviceId);
      b.engagementSum += r.engagement;
    });
    return [...buckets.values()]
      .map((b) => ({
        advertiser: b.advertiser,
        category: b.category,
        impressions: b.impressions,
        deviceCount: b.devices.size,
        avgEngagement: b.engagementSum / b.impressions,
        released: b.devices.size >= CROWD_ANONYMITY_K,
      }))
      .sort((a, b) => b.impressions - a.impressions);
  }

  function renderReporting() {
    if (!els.reportTable) return;
    const buckets = aggregateReports(reportReleased);
    const released = buckets.filter((b) => b.released);
    const withheld = buckets.filter((b) => !b.released);
    const withheldImpressions = withheld.reduce((a, b) => a + b.impressions, 0);
    const total = reportPending.length + reportReleased.length;

    els.reportStat.textContent = total
      ? `${fmtInt(total)} impressions · ${fmtInt(released.length)} buckets reportable`
      : "no impressions yet";

    els.reportPipe.innerHTML = `
      <div class="report-step${reportPending.length ? " active" : ""}">
        <span class="report-step-name">1 · Delayed</span>
        <span class="report-step-value">${fmtInt(reportPending.length)}</span>
        <span class="report-step-sub">held, randomized 3–9s (compressed from 24–48h)</span>
      </div>
      <div class="report-step${withheld.length ? " active" : ""}">
        <span class="report-step-name">2 · Crowd anonymity</span>
        <span class="report-step-value">${fmtInt(withheldImpressions)}</span>
        <span class="report-step-sub">withheld: fewer than ${CROWD_ANONYMITY_K} distinct devices</span>
      </div>
      <div class="report-step${released.length ? " active" : ""}">
        <span class="report-step-name">3 · Aggregated</span>
        <span class="report-step-value">${fmtInt(released.length)}</span>
        <span class="report-step-sub">buckets released to advertisers</span>
      </div>`;

    if (!buckets.length) {
      els.reportTable.innerHTML = `<p class="panel-note">Nothing has cleared the delay yet. Sample a device or run a day of traffic.</p>`;
      els.reportNote.textContent = "";
      return;
    }

    els.reportTable.innerHTML =
      `<div class="report-row report-head-row"><span>Advertiser</span><span>Category</span><span>Impressions</span><span>Devices</span><span>Avg engagement</span></div>` +
      buckets
        .map((b) =>
          b.released
            ? `<div class="report-row">
                 <span class="report-name">${escapeHtml(b.advertiser)}</span>
                 <span>${escapeHtml(b.category)}</span>
                 <span>${fmtInt(b.impressions)}</span>
                 <span>${fmtInt(b.deviceCount)}</span>
                 <span>${(b.avgEngagement * 100).toFixed(1)}%</span>
               </div>`
            : `<div class="report-row withheld">
                 <span class="report-name">${escapeHtml(b.advertiser)} <span class="report-badge">withheld</span></span>
                 <span>${escapeHtml(b.category)}</span>
                 <span>—</span>
                 <span>${b.deviceCount} &lt; ${CROWD_ANONYMITY_K}</span>
                 <span>—</span>
               </div>`
        )
        .join("");

    els.reportNote.innerHTML = withheld.length
      ? `${withheld.length} bucket${withheld.length === 1 ? "" : "s"} withheld entirely rather than rounded or noised: ` +
        `below ${CROWD_ANONYMITY_K} distinct devices there is no aggregate that could not single someone out. ` +
        `Counts are distinct devices, not impressions, so repeat views from one device never clear the bar.`
      : `Every bucket cleared the ${CROWD_ANONYMITY_K}-device threshold. Advertisers see counts and averages only, never a row per person.`;
  }

  // Generates a realistic day of impressions by running REAL auctions in batch
  // over sampled devices, so the reporting table is populated with genuine
  // model output rather than invented numbers.
  async function runDayOfTraffic() {
    if (!deployedTarget) { termWarn("Deploy a model before simulating traffic."); return; }
    els.btnTraffic.disabled = true;
    els.btnTraffic.textContent = "Running…";
    try {
      const { model, mean, std, val } = deployedTarget;
      const cats = Object.values(MAPS_CATEGORIES);
      const IMPRESSIONS = 240;
      const rows = [];
      const meta = [];

      for (let i = 0; i < IMPRESSIONS; i++) {
        const cat = cats[Math.floor(Math.random() * cats.length)];
        const advertiser = cat.advertisers[Math.floor(Math.random() * cat.advertisers.length)];
        const deviceIdx = Math.floor(Math.random() * val.xs.length);
        const row = candidateRow(val.xs[deviceIdx], advertiser, val.xs);
        rows.push(row.map((v, j) => (v - mean[j]) / std[j]));
        meta.push({ advertiser, category: cat.label, deviceId: `dev-${deviceIdx}` });
      }

      const input = tf.tensor2d(rows);
      const predT = model.predict(input);
      const preds = await predT.data();
      input.dispose();
      predT.dispose();

      meta.forEach((m, i) => recordImpression({ ...m, engagement: Math.max(0, Math.min(1, preds[i])) }));
      logLine(
        `<span class="term-time">[${timestamp()}]</span> <span class="term-accent">${fmtInt(IMPRESSIONS)} impressions queued</span> ` +
          `<span class="term-dim">held for a randomized delay before any aggregate is released</span>`
      );
      renderReporting();
    } finally {
      els.btnTraffic.disabled = false;
      els.btnTraffic.textContent = "Run a day of traffic";
    }
  }


  // ---------- status bar ----------
  // Polls rather than being pushed from a dozen call sites: tensor count and
  // memory change continuously during training, and a single low-frequency
  // read is cheaper and more truthful than trying to notify on every mutation.
  function updateStatusBar() {
    if (!els.sbDot) return;
    const mem = tf.memory();
    els.sbTensors.textContent = `${fmtInt(mem.numTensors)} · ${(mem.numBytes / (1024 * 1024)).toFixed(1)} MB`;
    els.sbBackend.textContent = backendLabel(tf.getBackend());

    const deployed = els.deployStatus.dataset.deployed === "1" && !!deployedTarget;
    els.sbDot.className = "sb-dot" + (running ? " live" : deployed ? " warn" : "");
    els.sbStateText.textContent = running
      ? "Training"
      : deployed
      ? "Serving"
      : trainer && trainer.round > 0
      ? "Paused"
      : "Idle";

    els.sbModel.textContent = trainer ? trainer.modelLabel.replace(/^AdRank-/, "") : "—";
    els.sbRound.textContent = trainer ? String(trainer.round) : "0";
    const eps = trainer ? trainer.epsilonSpent : 0;
    els.sbEps.textContent = Number.isFinite(eps) ? fmt(eps, 1) : "∞";
  }

  function initStatusBar() {
    updateStatusBar();
    setInterval(updateStatusBar, 1000);
    const cmd = document.getElementById("sb-cmd");
    if (cmd) cmd.addEventListener("click", openPalette);
  }

  // ---------- pipeline rail ----------
  // Every stage reads live state rather than a stored step counter, so the rail
  // is always truthful even if you jump around the tabs or reload mid-way.
  function pipelineStages() {
    const trained = trainer && trainer.round > 0;
    const compressed = getCheckpointIndex().some((m) => m.dedupeKey);
    const deployed = els.deployStatus.dataset.deployed === "1" && !!deployedTarget;
    const rank = lastRankingMetrics;

    return [
      {
        id: "pretrain", name: "Pre-train", mode: "train",
        done: !!(trainer && trainer.pretrained),
        value: trainer && trainer.pretrained ? `MAE ${fmt(trainer.pretrainedMae, 3)}` : "central, optional",
      },
      {
        id: "federate", name: "Federate", mode: "train",
        done: trained || !!(trainer && trainer.federatedDiscarded),
        value: trained
          ? `${trainer.round} rounds · MAE ${fmt(trainer.history[trainer.history.length - 1].valMae, 3)}`
          : trainer && trainer.federatedDiscarded
          ? `${trainer.federatedDiscarded.rounds} rounds · discarded, DP cost > gain`
          : "on-device + DP",
      },
      {
        id: "evaluate", name: "Evaluate", mode: "eval",
        done: !!rank,
        value: rank && !Number.isNaN(rank.auc) ? `AUC ${fmt(rank.auc, 3)}` : "AUC · NDCG · ECE",
      },
      {
        id: "compress", name: "Compress", mode: "deploy",
        done: compressed,
        value: compressed ? "int8 / pruned saved" : "quantize · prune · distill",
      },
      {
        id: "deploy", name: "Deploy", mode: "deploy",
        done: deployed,
        value: deployed ? "live on devices" : "roll out a checkpoint",
      },
      {
        id: "serve", name: "Serve", mode: "inference",
        done: deployed && !!lastAuction,
        value: lastAuction ? `ad ranked · $${lastAuction.clearing.toFixed(2)} CPC` : "Maps ad auction",
      },
    ];
  }

  function renderPipeline() {
    if (!els.pipelineRail) return;
    const stages = pipelineStages();
    // The first unfinished stage is "active": what the platform expects next.
    const activeIdx = stages.findIndex((s) => !s.done);

    els.pipelineRail.innerHTML = stages
      .map((s, i) => {
        const state = s.done ? "done" : i === activeIdx ? "active" : "";
        return (
          (i ? '<span class="pipe-arrow">›</span>' : "") +
          `<button type="button" class="pipe-stage ${state}" data-mode="${s.mode}" title="${s.name}">
             <span class="pipe-dot">${s.done ? "✓" : i + 1}</span>
             <span class="pipe-body">
               <span class="pipe-name">${s.name}</span>
               <span class="pipe-value">${s.value}</span>
             </span>
           </button>`
        );
      })
      .join("");

    els.pipelineRail.querySelectorAll(".pipe-stage").forEach((el) => {
      el.addEventListener("click", () => goToMode(el.dataset.mode));
    });
  }

  function pipelineSay(text, busy) {
    if (!els.pipelineStatus) return;
    els.pipelineStatus.textContent = text;
    els.pipelineStatus.classList.toggle("busy", !!busy);
  }

  // One action that walks the whole lifecycle, doing the real work at each
  // stage by driving the same handlers the buttons use. Nothing here is
  // simulated: it trains, evaluates, compresses, deploys and serves.
  async function runFullPipeline() {
    if (running) { termWarn("Pause training before running the pipeline."); return; }
    els.btnRunPipeline.disabled = true;
    const t0 = performance.now();
    try {
      goToMode("train");
      pipelineSay("Pre-training…", true);
      await runPretrain("--steps 60 --shards 4");

      // Snapshot the pretrained weights so the federated phase can be judged
      // against them rather than assumed to be an improvement.
      const preMae = trainer.pretrainedMae;
      const preWeights = trainer.model.getWeights().map((w) => w.clone());

      pipelineSay("Federating…", true);
      roundsLimit = 8;
      await trainLoop();

      pipelineSay("Selecting best…", true);
      const fedStat = trainer.history[trainer.history.length - 1];
      const fedMae = fedStat ? fedStat.valMae : Infinity;
      if (Number.isFinite(preMae) && fedMae > preMae) {
        // DP noise cost more than the federated data added. That is a real
        // outcome at this model size, not a failure: keep the better model and
        // say so, rather than shipping a regression.
        trainer.model.setWeights(preWeights.map((w) => w.clone()));
        trainer.history = [];
        trainer.round = 0;
        trainer.pretrained = true;
        trainer.federatedDiscarded = { rounds: 8, mae: fedMae };
        logLine(
          `<span class="term-time">[${timestamp()}]</span> <span class="term-warn">Model selection: keeping the pre-trained model</span> ` +
            `<span class="term-dim">federated MAE ${fmt(fedMae, 4)} vs pre-trained ${fmt(preMae, 4)} · ` +
            `DP noise cost more than the on-device data added at K=${els.k.value}, z=${els.noise.value}</span>`
        );
      } else {
        logLine(
          `<span class="term-time">[${timestamp()}]</span> <span class="term-accent">Model selection: keeping the federated model</span> ` +
            `<span class="term-dim">MAE ${fmt(fedMae, 4)} vs pre-trained ${fmt(preMae, 4)}</span>`
        );
      }
      preWeights.forEach((w) => w.dispose());

      pipelineSay("Evaluating…", true);
      goToMode("eval");
      els.evalModelSelect.value = "__live";
      updateEvalSummary();
      await runFullEvaluation();

      pipelineSay("Compressing…", true);
      goToMode("deploy");
      renderModelOptions(els.deployModelSelect);
      els.deployModelSelect.value = "__live";
      els.deployModelSelect.dataset.userPicked = "1";
      updateDeployStats();
      await postTrainQuantize({});

      pipelineSay("Deploying…", true);
      await runDeployRollout();

      pipelineSay("Serving…", true);
      goToMode("inference");
      await sampleInference();

      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      pipelineSay(`Pipeline complete in ${secs}s`, false);
      logLine(
        `<span class="term-time">[${timestamp()}]</span> <span class="term-accent">Full pipeline complete</span> ` +
          `<span class="term-dim">pretrain → federate → evaluate → compress → deploy → serve · ${secs}s</span>`
      );
    } catch (err) {
      console.error("[fl-demo] pipeline failed:", err);
      pipelineSay(`Failed: ${(err && err.message) || err}`, false);
      termWarn(`pipeline failed: ${(err && err.message) || err}`);
    } finally {
      els.btnRunPipeline.disabled = false;
      renderPipeline();
    }
  }

  // ---------- run history ----------
  // The platform primitive this was missing: a run is only useful if you can
  // compare it to the last one. Each federated session is recorded with the
  // exact config it ran under, so a metric is never separated from the
  // hyperparameters that produced it.
  const RUNS_KEY = "fl-demo-runs-v1";
  const MAX_RUNS = 30;

  function getRuns() {
    try {
      return JSON.parse(localStorage.getItem(RUNS_KEY) || "[]");
    } catch (err) {
      console.error("[fl-demo] run history corrupted, resetting:", err);
      return [];
    }
  }

  function setRuns(list) {
    try {
      localStorage.setItem(RUNS_KEY, JSON.stringify(list.slice(0, MAX_RUNS)));
    } catch (err) {
      console.error("[fl-demo] couldn't persist run history:", err);
    }
  }

  function recordRun(outcome) {
    if (!trainer || trainer.round === 0) return;
    const last = trainer.history[trainer.history.length - 1];
    if (!last) return;
    const cohort = currentCohort();
    const run = {
      id: `run-${Date.now().toString(36)}`,
      at: Date.now(),
      outcome,
      cohortId: cohort.id,
      cohort: cohort.label,
      architecture: trainer.modelLabel,
      rounds: trainer.round,
      k: parseInt(els.k.value, 10),
      localEpochs: parseInt(els.epochs.value, 10),
      clipNorm: parseFloat(els.clip.value),
      noise: parseFloat(els.noise.value),
      dropout: parseInt(els.dropout.value, 10) || 0,
      secureAgg: !!els.secureAgg.checked,
      valMae: last.valMae,
      valLoss: last.valLoss,
      epsilon: trainer.epsilonSpent,
    };
    const runs = getRuns();
    runs.unshift(run);
    setRuns(runs);
    logLine(
      `<span class="term-time">[${timestamp()}]</span> <span class="term-accent">Run recorded</span> ` +
        `<span class="term-dim">${run.id} · ${run.rounds} rounds · MAE ${fmt(run.valMae, 4)}</span>`
    );
    return run;
  }

  // Ranking metrics arrive later (Eval is a separate action), so they're
  // attached to the most recent run rather than duplicated into a new row.
  function attachMetricsToLatestRun(rank) {
    const runs = getRuns();
    if (!runs.length) return;
    Object.assign(runs[0], {
      auc: rank.auc, ndcg: rank.ndcg, mrr: rank.mrr, ece: rank.ece,
    });
    setRuns(runs);
  }

  const RUN_COLUMNS = [
    { key: "when", label: "When", get: (r) => new Date(r.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
    { key: "cohort", label: "Cohort", get: (r) => r.cohort },
    { key: "arch", label: "Model", get: (r) => r.architecture, mono: true },
    { key: "rounds", label: "Rds", get: (r) => r.rounds, num: true },
    { key: "cfg", label: "K · ep · C · z", get: (r) => `${r.k} · ${r.localEpochs} · ${fmt(r.clipNorm, 2)} · ${fmt(r.noise, 1)}`, mono: true },
    { key: "guards", label: "Guards", get: (r) => [r.dropout ? `${r.dropout}% drop` : null, r.secureAgg ? "sec-agg" : null].filter(Boolean).join(" · ") || "—" },
    { key: "valMae", label: "MAE", get: (r) => fmt(r.valMae, 4), num: true, best: "min", val: (r) => r.valMae },
    { key: "auc", label: "AUC", get: (r) => (r.auc == null || Number.isNaN(r.auc) ? "—" : fmt(r.auc, 4)), num: true, best: "max", val: (r) => r.auc },
    { key: "ndcg", label: "NDCG", get: (r) => (r.ndcg == null || Number.isNaN(r.ndcg) ? "—" : fmt(r.ndcg, 4)), num: true, best: "max", val: (r) => r.ndcg },
    { key: "ece", label: "ECE", get: (r) => (r.ece == null || Number.isNaN(r.ece) ? "—" : fmt(r.ece, 4)), num: true, best: "min", val: (r) => r.ece },
    { key: "eps", label: "ε", get: (r) => (Number.isFinite(r.epsilon) ? fmt(r.epsilon, 1) : "∞"), num: true, best: "min", val: (r) => (Number.isFinite(r.epsilon) ? r.epsilon : Infinity) },
  ];

  function renderRunHistory() {
    const runs = getRuns();
    els.runsCount.textContent = runs.length ? `${runs.length} run${runs.length === 1 ? "" : "s"}` : "no runs yet";
    if (!runs.length) {
      els.runsTable.innerHTML = `<p class="panel-note">No runs recorded yet. Train for at least one round and the session is logged here automatically.</p>`;
      return;
    }

    // Best value per metric column, so runs are comparable at a glance.
    const bests = {};
    RUN_COLUMNS.filter((c) => c.best).forEach((c) => {
      const vals = runs.map(c.val).filter((v) => Number.isFinite(v));
      if (vals.length) bests[c.key] = c.best === "min" ? Math.min(...vals) : Math.max(...vals);
    });

    const head = `<div class="runs-row runs-head-row">${RUN_COLUMNS.map((c) => `<span>${c.label}</span>`).join("")}</div>`;
    const body = runs
      .map((r) => {
        const cells = RUN_COLUMNS.map((c) => {
          const v = c.val ? c.val(r) : null;
          const isBest = c.best && Number.isFinite(v) && v === bests[c.key] && runs.length > 1;
          return `<span class="${c.mono ? "mono " : ""}${c.num ? "num " : ""}${isBest ? "best" : ""}">${c.get(r)}</span>`;
        }).join("");
        return `<div class="runs-row">${cells}</div>`;
      })
      .join("");
    els.runsTable.innerHTML = head + body;
  }

  // ---------- ad auction ----------
  // Predicted engagement is only half an ads system. The other half is the
  // auction: candidates are ranked by eCPM (bid x pCTR), and the winner pays
  // second price, the least it could have bid and still won. A miscalibrated
  // pCTR therefore misprices every clearing price, which is why the Eval tab
  // reports calibration error alongside AUC.
  const AD_RESERVE_CPC = 0.30;
  // Feature channels an advertiser controls or that vary per creative. The
  // rest describe the user and stay fixed across candidates in one auction.
  const AD_SIDE_FEATURES = [
    "queryPoiRelevance", "categoryAffinity", "priorImpressions",
    "priorTaps", "adFatigue", "budgetPacing", "localPopularity",
  ];
  const AD_SIDE_IDX = AD_SIDE_FEATURES.map((f) => FEATURE_NAMES.indexOf(f)).filter((i) => i >= 0);

  function advertiserSeed(name) {
    let h = 2166136261;
    for (let i = 0; i < name.length; i++) {
      h ^= name.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Stable per advertiser, so the same brand always bids the same amount and
  // the auction is reproducible rather than reshuffling on every render.
  function advertiserBid(name) {
    const rng = mulberry32(advertiserSeed(name));
    return 0.4 + rng() * 2.1;
  }

  // Builds this advertiser's candidate feature vector: the user-side channels
  // are the real sampled device's signals and stay fixed across the auction,
  // while the ad-side channels are copied from a real held-out row chosen
  // deterministically per advertiser.
  //
  // Two earlier attempts were wrong. Jittering around the user's own row made
  // every candidate score within ~0.3pp, so the auction reduced to "highest
  // bid wins". Sampling uniform [0,1] was worse: these features actually range
  // ~[0.37, 1.73] with mean ~0.9, so uniform draws sat around z = -2.7,
  // far outside the training distribution, and the sigmoid saturated to 0% or
  // 100% for every candidate at once. Borrowing a real row keeps the values
  // in-distribution AND preserves the correlations between them.
  // Every feature in this dataset is generated from a single latent engagement
  // propensity t, so they are ~98% mutually correlated. That makes naive
  // candidate construction fail in a specific way: swapping ad-side features
  // in from an unrelated row yields a vector that is marginally plausible but
  // jointly impossible (half the channels saying "high intent", half saying
  // "low"). The model never saw such a row, extrapolates, and saturates every
  // candidate to 0% or 100% at once.
  //
  // So the donor is chosen to sit NEAR the user's own latent, offset by a
  // stable per-advertiser amount. The row stays coherent, stays on the
  // manifold the model was trained on, and candidates still differ.
  // Now that ad-side and user-side channels are driven by independent latents
  // in data.js, swapping the ad-side block from any real row produces a
  // genuinely valid (user, ad) pair: the user's context is held fixed and a
  // different creative is scored against it, which is exactly what an auction
  // does. This used to need latent-matching gymnastics to avoid building rows
  // the model had never seen; fixing the generative model removed the need.
  function candidateRow(baseRow, name, donorRows) {
    const rng = mulberry32(advertiserSeed(name) ^ 0x9e3779b9);
    const row = baseRow.slice();
    if (!donorRows || !donorRows.length) return row;
    const donor = donorRows[Math.floor(rng() * donorRows.length) % donorRows.length];
    AD_SIDE_IDX.forEach((idx) => {
      row[idx] = donor[idx];
    });
    return row;
  }

  // Runs a real batched forward pass over every candidate, then clears the
  // auction. Returns the winner so Maps can show the ad that actually won.
  async function runAdAuction(baseRow, advertisers, baseLabel) {
    if (!deployedTarget || !advertisers || !advertisers.length) return null;
    const { model, mean, std, val } = deployedTarget;

    const rows = advertisers.map((name) => candidateRow(baseRow, name, val && val.xs));
    const normed = rows.map((r) => r.map((v, i) => (v - mean[i]) / std[i]));
    const input = tf.tensor2d(normed);
    const predT = model.predict(input);
    const preds = await predT.data();
    input.dispose();
    predT.dispose();

    const candidates = advertisers.map((name, i) => {
      const bid = advertiserBid(name);
      const pctr = Math.max(0, Math.min(1, preds[i]));
      return { name, bid, pctr, ecpm: bid * pctr * 1000 };
    });
    candidates.sort((a, b) => b.ecpm - a.ecpm);

    const winner = candidates[0];
    const runnerUp = candidates[1];
    // Second price: the lowest CPC that would still have beaten the runner-up,
    // floored at the reserve. This is what the winner is actually charged.
    let clearing = AD_RESERVE_CPC;
    if (runnerUp && winner.pctr > 0) {
      clearing = Math.max(AD_RESERVE_CPC, runnerUp.ecpm / (winner.pctr * 1000) + 0.01);
    }
    clearing = Math.min(clearing, winner.bid); // never charge above the bid
    const reserveNotMet = winner.ecpm < AD_RESERVE_CPC * winner.pctr * 1000 || winner.pctr === 0;

    return { candidates, winner, clearing, reserveNotMet };
  }

  function renderAuction(result) {
    if (!els.auctionTable) return;
    if (!result) {
      els.auctionTable.innerHTML = `<p class="panel-note">No auction: deploy a ranker to score candidates.</p>`;
      els.auctionClearing.textContent = "—";
      return;
    }
    const { candidates, winner, clearing } = result;
    // A model that scores every candidate at ~0 makes eCPM identically zero,
    // so the ordering is arbitrary and the "winner" is meaningless. Say so
    // rather than presenting a tie-break as a ranking decision.
    const allZero = candidates.every((c) => c.pctr < 0.005);
    // Saturation counts as degenerate too: 100/100/0 means the sigmoid became a
    // step function, so eCPM ordering is decided by bid alone.
    const allExtreme = candidates.every((c) => c.pctr < 0.005 || c.pctr > 0.995);
    const degenerate = allZero || allExtreme;
    els.auctionClearing.innerHTML = degenerate
      ? `<span class="auction-warn">no valid ranking</span>`
      : `pays <strong>$${clearing.toFixed(2)}</strong> <span class="auction-dim">of $${winner.bid.toFixed(2)} bid</span>`;
    if (degenerate) {
      els.auctionTable.innerHTML =
        `<p class="auction-degenerate">${allZero
            ? "The deployed model predicts ~0% engagement for every candidate, so every eCPM is $0.00 and there is nothing to rank on."
            : "The deployed model is <strong>saturated</strong>: every prediction sits at 0% or 100%, so the sigmoid has become a step function and eCPM ordering is decided by bid alone."}
         DP noise inflates the weights, and large weights make predictions extreme. Lower the privacy noise (z), raise
         devices/round (K), train more rounds, or deploy the factory checkpoint. Watch the noise/signal readout under the
         z slider: above ~15x the noise dominates the update entirely.</p>` +
        candidates
          .map(
            (c) => `<div class="auction-row">
              <span class="auction-name">${c.name}</span>
              <span>$${c.bid.toFixed(2)}</span>
              <span>${(c.pctr * 100).toFixed(2)}%</span>
              <span>$${c.ecpm.toFixed(2)}</span>
            </div>`
          )
          .join("");
      return;
    }
    els.auctionTable.innerHTML =
      `<div class="auction-row auction-head-row">
         <span>Advertiser</span><span>Bid</span><span>pCTR</span><span>eCPM</span>
       </div>` +
      candidates
        .map(
          (c, i) => `<div class="auction-row${i === 0 ? " won" : ""}">
            <span class="auction-name">${c.name}${i === 0 ? '<span class="auction-badge">won</span>' : ""}</span>
            <span>$${c.bid.toFixed(2)}</span>
            <span>${(c.pctr * 100).toFixed(2)}%</span>
            <span>$${c.ecpm.toFixed(2)}</span>
          </div>`
        )
        .join("");
  }

  // Lets the phone be dragged around the panel. Drags start only on the
  // frame's own chrome, never on the screen, so the search field and the
  // place/pin click handlers inside keep working normally.
  // Drag to pan and wheel to zoom the map, the way a real map behaves. Pointer
  // handlers live on the SVG only, so the sheet and search box are unaffected.
  function initMapInteraction() {
    const svg = document.getElementById("maps-canvas");
    if (!svg) return;
    let dragging = false, startX = 0, startY = 0, originX = 0, originY = 0;

    const applyView = () => {
      const half = mapZoom / 2;
      svg.setAttribute("viewBox", `${(mapView.x - half).toFixed(1)} ${(mapView.y - half).toFixed(1)} ${mapZoom} ${mapZoom}`);
    };

    svg.addEventListener("pointerdown", (e) => {
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      originX = mapView.x; originY = mapView.y;
      svg.setPointerCapture(e.pointerId);
      svg.classList.add("dragging");
      e.preventDefault();
    });
    svg.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      if (mapViewRaf) { cancelAnimationFrame(mapViewRaf); mapViewRaf = null; }
      // Convert screen pixels to world units via the current zoom level.
      const scale = mapZoom / (svg.clientWidth || 260);
      const half = mapZoom / 2;
      const clamp = (v) => Math.max(half, Math.min(MAPS_WORLD.size - half, v));
      mapView.x = clamp(originX - (e.clientX - startX) * scale);
      mapView.y = clamp(originY - (e.clientY - startY) * scale);
      applyView();
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      svg.classList.remove("dragging");
      if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);

    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      mapZoom = Math.max(120, Math.min(620, mapZoom * (e.deltaY > 0 ? 1.12 : 0.89)));
      const half = mapZoom / 2;
      mapView.x = Math.max(half, Math.min(MAPS_WORLD.size - half, mapView.x));
      mapView.y = Math.max(half, Math.min(MAPS_WORLD.size - half, mapView.y));
      applyView();
    }, { passive: false });
  }

  function initIphoneDrag() {
    const frame = document.querySelector(".iphone-frame");
    const screen = frame && frame.querySelector(".iphone-screen");
    if (!frame || !screen) return;

    let dragging = false;
    let startX = 0, startY = 0, baseX = 0, baseY = 0;

    frame.addEventListener("pointerdown", (e) => {
      if (screen.contains(e.target)) return; // interacting with the UI, not moving the phone
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      frame.classList.add("dragging");
      frame.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    frame.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const x = baseX + (e.clientX - startX);
      const y = baseY + (e.clientY - startY);
      frame.style.transform = `translate(${x}px, ${y}px)`;
    });

    function end(e) {
      if (!dragging) return;
      dragging = false;
      baseX += e.clientX - startX;
      baseY += e.clientY - startY;
      frame.classList.remove("dragging");
      if (frame.hasPointerCapture(e.pointerId)) frame.releasePointerCapture(e.pointerId);
    }
    frame.addEventListener("pointerup", end);
    frame.addEventListener("pointercancel", end);

    frame.addEventListener("dblclick", (e) => {
      if (screen.contains(e.target)) return;
      baseX = 0;
      baseY = 0;
      frame.style.transform = "";
    });
  }

  async function sampleInference() {
    if (!deployedTarget) return;
    const { model, mean, std, val } = deployedTarget;
    const idx = Math.floor(Math.random() * val.xs.length);
    const rawRow = val.xs[idx];
    const trueY = val.ys[idx];
    const normRow = rawRow.map((v, i) => (v - mean[i]) / std[i]);

    const t0 = performance.now();
    const input = tf.tensor2d([normRow]);
    const predT = model.predict(input);
    const predVal = (await predT.data())[0];
    const latencyMs = performance.now() - t0;
    input.dispose();
    predT.dispose();

    const predPct = Math.max(0, Math.min(1, predVal));
    const truePct = Math.max(0, Math.min(1, trueY));
    const errPct = Math.abs(predPct - truePct) * 100;

    els.rulValue.textContent = `${Math.round(predPct * 100)}%`;
    const ringColor = predPct > 0.66 ? "#30d158" : predPct > 0.33 ? "#ff9f0a" : "#ff453a";
    els.rulRingFg.style.stroke = ringColor;
    els.rulRingFg.style.strokeDashoffset = `${RING_CIRCUMFERENCE * (1 - predPct)}`;
    els.rulDetail.innerHTML = `Predicted engagement ${Math.round(predPct * 100)}% · actual ${Math.round(truePct * 100)}% · off by ${errPct.toFixed(1)} pts`;

    els.sensorGrid.innerHTML = FEATURE_NAMES.map(
      (name, i) => `<div class="sensor-chip"><span class="sensor-chip-name">${name}</span><span class="sensor-chip-value">${rawRow[i].toFixed(3)}</span></div>`
    ).join("");
    els.sensorGrid.dataset.filled = "1";
    els.btnRandomize.disabled = false;
    els.inferenceLatency.textContent = `Inference latency: ${latencyMs.toFixed(2)} ms on ${tf.getBackend()} · device drawn from the held-out validation set (never trained on)`;

    lastInferenceMeta = { latencyMs, backend: tf.getBackend(), archLabel: deployedTarget.architecture || "AdRank-Net" };

    // Remember this device's real signal row: the auction re-scores candidates
    // against it whenever the search category changes.
    lastSignalRow = rawRow;
    lastSignalY = trueY;
    await refreshAdPlacement();
  }

  els.btnRunPipeline.addEventListener("click", () => {
    runFullPipeline().catch((err) => console.error("[fl-demo] pipeline crashed:", err));
  });
  els.btnClearRuns.addEventListener("click", () => {
    setRuns([]);
    renderRunHistory();
  });
  els.btnTraffic.addEventListener("click", () => {
    runDayOfTraffic().catch((err) => console.error("[fl-demo] traffic sim failed:", err));
  });
  els.btnPersonalize.addEventListener("click", () => {
    personalizeForDevice().catch((err) => console.error("[fl-demo] personalize crashed:", err));
  });
  els.btnRandomize.addEventListener("click", sampleInference);
  els.btnDeploy.addEventListener("click", runDeployRollout);
  els.btnBenchmark.addEventListener("click", runBenchmark);
  els.btnCompress.addEventListener("click", runCompressionAnalysis);
  // Buttons delegate to the same postTrainLora the terminal calls: one code
  // path, so the UI can never drift from what `posttrain lora` does.
  function runAdapter(qlora) {
    const flags = { rank: els.adapterRank.value, cohort: els.adapterCohort.value, steps: "150" };
    if (qlora) flags.qlora = true;
    const btn = qlora ? els.btnQlora : els.btnLora;
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Training…";
    postTrainLora(flags)
      .catch((err) => { console.error("[fl-demo] adapter run failed:", err); termWarn(`adapter run failed: ${(err && err.message) || err}`); })
      .finally(() => { btn.disabled = false; btn.textContent = prev; });
  }
  els.btnLora.addEventListener("click", () => runAdapter(false));
  els.btnQlora.addEventListener("click", () => runAdapter(true));
  [els.cfgFramework, els.cfgStrategy, els.cfgWorld, els.cfgPrecision].forEach((el) =>
    el.addEventListener("change", renderTrainingConfig)
  );

  // ---------- model selection ----------
  function showModelError(msg) {
    els.modelError.textContent = msg;
    els.modelError.hidden = !msg;
  }

  let activeModelValue = "small";

  async function loadModelSpec(key) {
    modelSpec = makePresetModelSpec(key, NUM_FEATURES, 0.05);
    showModelError("");
  }

  els.model.addEventListener("change", async () => {
    const chosen = els.model.value;
    if (chosen === "__import") {
      els.model.value = activeModelValue; // revert now; updated again if the import succeeds
      els.modelFile.click();
      return;
    }
    if (running) { els.model.value = activeModelValue; return; }
    await loadModelSpec(chosen);
    activeModelValue = chosen;
    await setupTrainer();
  });

  els.modelFile.addEventListener("change", async () => {
    if (!els.modelFile.files || els.modelFile.files.length === 0) return;
    try {
      const imported = await makeImportedModelSpec(els.modelFile.files, NUM_FEATURES, 0.05);
      modelSpec = imported;
      showModelError("");
      const prevImported = els.model.querySelector('option[value="__imported_active"]');
      if (prevImported) prevImported.remove();
      const opt = document.createElement("option");
      opt.value = "__imported_active";
      opt.textContent = imported.label;
      els.model.querySelector('option[value="__import"]').before(opt);
      els.model.value = "__imported_active";
      activeModelValue = "__imported_active";
      await setupTrainer();
    } catch (err) {
      showModelError(err.message || String(err));
      els.model.value = activeModelValue;
    } finally {
      els.modelFile.value = "";
    }
  });

  // ---------- backend warm-up ----------
  // WebGL compiles shaders the first time each op+shape combination runs, which
  // can stall for a couple of seconds. Pay that cost right after setup instead
  // of on the user's first "Start training" click, so training feels instant.
  let warmingUp = false;
  async function warmUpBackend() {
    if (!trainer || warmingUp || running) return;
    warmingUp = true;
    const prevLabel = els.start.textContent;
    const prevDisabled = els.start.disabled;
    els.start.disabled = true;
    els.start.textContent = "Preparing…";
    let dummyX, dummyY, warmModel;
    try {
      dummyX = tf.randomNormal([2, NUM_FEATURES]);
      dummyY = tf.randomNormal([2, 1]);

      const predT = trainer.model.predict(dummyX);
      await predT.data();
      predT.dispose();

      warmModel = await trainer.cloneFactory();
      await warmModel.fit(dummyX, dummyY, { epochs: 1, batchSize: 2, verbose: 0 });
    } catch (err) {
      console.error("[fl-demo] backend warm-up failed (non-fatal):", err);
    } finally {
      if (warmModel) {
        if (warmModel.optimizer && typeof warmModel.optimizer.dispose === "function") warmModel.optimizer.dispose();
        warmModel.dispose();
      }
      if (dummyX) dummyX.dispose();
      if (dummyY) dummyY.dispose();
      els.start.disabled = prevDisabled;
      els.start.textContent = prevLabel;
      warmingUp = false;
    }
  }

  // ---------- setup / reset ----------
  function currentOpts() {
    return {
      localEpochs: parseInt(els.epochs.value, 10),
      clipNorm: parseFloat(els.clip.value),
      noiseMultiplier: parseFloat(els.noise.value),
      secureAggregation: els.secureAgg.checked,
    };
  }

  let currentNodes = [];

  async function setupTrainer() {
    const opts = currentOpts();
    const cohort = currentCohort();
    const valSet = buildCohortValidation(cohort);
    if (trainer) trainer.dispose();
    // Spread rather than re-listing fields: an allowlist here silently drops
    // any option added to currentOpts() later, which is exactly how the
    // secure-aggregation toggle first appeared to do nothing.
    trainer = new FederatedTrainer(valSet, modelSpec, opts);
    await trainer.init();
    els.clientsGrid.innerHTML = "";
    els.svg.innerHTML = "";
    currentNodes = [];
    els.roundCounter.textContent = "round 0";
    updateEpsilon(0);
    updateAccuracyStats(null);
    updateCohortStatus();
    drawChart();

    clearTerminal();
    els.terminalPoll.textContent = `0 / ${fmtInt(cohort.population)} devices polling`;
    els.federationCount.textContent = `0 of ${fmtInt(cohort.population)} · round 0`;
    logLine(`<span class="term-time">[${timestamp()}]</span> Coordinator ready, model: ${modelSpec.label} <span class="term-cursor"></span>`);
    resetObservabilityPanels(cohort);

    delete els.deployStatus.dataset.deployed;
    deployedTarget = null;
    delete els.sensorGrid.dataset.filled;
    els.deployProgress.hidden = true;
    els.rolloutRows.innerHTML = "";
    els.benchTable.innerHTML = "";
    updateDeployStats();
    updateInferenceAvailability();

    els.evalScatterCanvas.getContext("2d").clearRect(0, 0, els.evalScatterCanvas.width, els.evalScatterCanvas.height);
    els.evalBucketRows.innerHTML = "";
    els.evalRmse.textContent = "—";
    els.evalBaseline.textContent = "—";
    els.btnRunEval.textContent = "Run evaluation";
    updateEvalSummary();

    els.start.disabled = false;
    // Awaited (not fire-and-forget): warmUpBackend() disables Start while it
    // runs. Firing it off unawaited meant a caller that awaits setupTrainer()
    // and then immediately clicks Start (like the terminal's 'train' command)
    // could land its click exactly in that disabled window and silently no-op
    // — disabled buttons don't dispatch click handlers. Awaiting it here means
    // by the time setupTrainer()'s promise resolves, Start is genuinely ready.
    await warmUpBackend();
    // Backend is only truly known after tf.ready(); the boot-time call can
    // read undefined and leave the strip stuck on "initializing…".
    initComputeBackend();
  }

  // The slider track's fill (progress up to the thumb) is drawn with a CSS
  // gradient keyed off --fill, since native range inputs don't expose a
  // "filled portion" pseudo-element consistently across browsers.
  function updateSliderFill(rangeEl) {
    const min = parseFloat(rangeEl.min) || 0;
    const max = parseFloat(rangeEl.max) || 100;
    const pct = ((parseFloat(rangeEl.value) - min) / (max - min)) * 100;
    rangeEl.style.setProperty("--fill", `${pct}%`);
  }
  document.addEventListener("input", (e) => {
    if (e.target.matches && e.target.matches('.control input[type="range"]')) updateSliderFill(e.target);
  });

  // Per-coordinate signal is C/sqrt(P); per-coordinate noise after averaging K
  // clients is z*C/sqrt(K). C cancels, so the ratio is z*sqrt(P/K): the clip
  // norm has no effect on it, only z, the model size and the cohort size.
  // Surfaced live because this is the tradeoff that decides whether a run
  // converges or produces a saturated model, and it is invisible otherwise.
  function updateSnrHint() {
    if (!els.snrHint) return;
    const z = parseFloat(els.noise.value);
    const k = parseInt(els.k.value, 10);
    const params = trainer && trainer.model ? trainer.model.countParams() : 385;
    if (!z) {
      els.snrHint.innerHTML = '<span class="snr-good">DP off</span> \u00b7 no noise added, no formal guarantee';
      return;
    }
    const ratio = z * Math.sqrt(params / Math.max(1, k));
    // Thresholds calibrated against measured runs rather than guessed:
    //   z=2, K=1024 -> 1.2  converged to MAE 0.024 (the shipped checkpoint)
    //   z=1, K=6    -> 8.0  trains, MAE 0.207, no saturated predictions
    //   z=3, K=6    -> 24   saturated: only 14 of 300 predictions off 0%/100%
    const cls = ratio > 15 ? "snr-bad" : ratio > 6 ? "snr-warn" : "snr-good";
    const verdict = ratio > 15 ? "noise dominates, expect a saturated model"
      : ratio > 6 ? "trains, but slowly and noisily" : "workable";
    els.snrHint.innerHTML = 'noise/signal <span class="' + cls + '">' + ratio.toFixed(1) +
      'x</span> at K=' + k + ', ' + fmtInt(params) + ' params \u00b7 ' + verdict;
  }

  function syncLabels() {
    els.valK.value = els.k.value;
    els.valEpochs.value = els.epochs.value;
    els.valClip.value = parseFloat(els.clip.value).toFixed(2);
    els.valNoise.value = parseFloat(els.noise.value).toFixed(1);
    els.valDropout.value = els.dropout.value;
    document.querySelectorAll('.control input[type="range"]').forEach(updateSliderFill);
    updateSnrHint();
  }

  // Pairs a <input type="range"> with a click-to-edit numeric field: dragging
  // the slider updates the field, and typing an exact value + Enter commits it
  // back to the slider and re-fires the same input/change events a drag would,
  // so every existing listener downstream keeps working unmodified.
  function bindEditableSlider(rangeEl, valueEl, decimals) {
    function format(v) {
      return decimals > 0 ? v.toFixed(decimals) : String(v);
    }
    function syncFromRange() {
      valueEl.value = format(parseFloat(rangeEl.value));
    }
    function commit() {
      let v = parseFloat(valueEl.value);
      if (Number.isNaN(v)) { syncFromRange(); return; }
      const min = parseFloat(rangeEl.min), max = parseFloat(rangeEl.max), step = parseFloat(rangeEl.step) || 1;
      v = Math.min(max, Math.max(min, v));
      v = Math.round((v - min) / step) * step + min;
      rangeEl.value = format(v);
      syncFromRange();
      rangeEl.dispatchEvent(new Event("input", { bubbles: true }));
      rangeEl.dispatchEvent(new Event("change", { bubbles: true }));
    }
    valueEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { commit(); valueEl.blur(); }
      if (e.key === "Escape") { syncFromRange(); valueEl.blur(); }
    });
    valueEl.addEventListener("blur", commit);
    valueEl.addEventListener("focus", () => valueEl.select());
  }

  // Fire-and-forget setupTrainer() calls (nothing here needs to await
  // completion) still need a .catch — since setupTrainer is async, a throw
  // after its first await point becomes an unhandled promise rejection
  // rather than a synchronous exception the caller could catch.
  function setupTrainerSafe(label) {
    setupTrainer().catch((err) => console.error(`[fl-demo] setupTrainer (${label}) failed:`, err));
  }

  els.cohort.addEventListener("change", () => {
    if (running) return;
    setupTrainerSafe("cohort change");
  });
  els.k.addEventListener("input", () => {
    syncLabels();
    updateCohortStatus();
  });
  els.secureAgg.addEventListener("change", () => {
    if (running) { trainer.setOpts({ secureAggregation: els.secureAgg.checked }); return; }
    setupTrainerSafe("secure aggregation toggle");
  });
  // Dropout is read fresh from the slider each round in trainLoop, so it needs
  // no trainer rebuild: just keep the editable field in sync.
  els.dropout.addEventListener("input", syncLabels);
  els.epochs.addEventListener("change", () => {
    syncLabels();
    if (!running) setupTrainerSafe("epochs change");
  });
  [els.clip, els.noise].forEach((el) =>
    el.addEventListener("input", () => {
      syncLabels();
      if (trainer) trainer.setOpts({ clipNorm: parseFloat(els.clip.value), noiseMultiplier: parseFloat(els.noise.value) });
    })
  );

  function setLive(isLive, label) {
    els.liveDot.classList.toggle("pulsing", isLive);
    els.navBadgeText.textContent = label;
  }

  function setControlsDisabled(disabled) {
    els.cohort.disabled = disabled;
    els.model.disabled = disabled;
    els.epochs.disabled = disabled;
  }

  async function trainLoop() {
    running = true;
    stopRequested = false;
    els.start.textContent = "Pause";
    setControlsDisabled(true);
    setLive(true, "Training live · nothing leaves this machine");

    const cohort = currentCohort();
    let errored = false;
    const startRound = trainer.round;
    const targetRound = roundsLimit !== null ? Math.min(MAX_ROUNDS, startRound + roundsLimit) : MAX_ROUNDS;
    roundsLimit = null; // consumed — a plain 'train'/click afterward runs unbounded again

    while (!stopRequested && trainer.round < targetRound) {
      // Captured once per iteration: runRound() increments trainer.round
      // internally, so deriving the "current" round from trainer.round after
      // that point (e.g. in the catch block) would mislabel a post-processing
      // crash in round N as "round N+1 failed."
      const attemptedRound = trainer.round + 1;
      try {
        const k = parseInt(els.k.value, 10);
        const roundSeed = sessionSeed + trainer.round * 104729 + 17;
        const sampledClients = buildRoundClients(cohort, k, roundSeed);

        // Cross-device dropout. A device that is selected still has to finish
        // local training and upload before the round's deadline; in production
        // a meaningful share never do (battery, network, app backgrounded).
        // Only survivors are aggregated, so the effective cohort per round is
        // smaller than K and the DP noise averages over fewer clients.
        const dropoutPct = parseInt(els.dropout.value, 10) || 0;
        const roundClients = sampledClients.filter(() => Math.random() * 100 >= dropoutPct);
        // Guard: FedAvg over an empty set is undefined, so keep at least one.
        if (roundClients.length === 0) roundClients.push(sampledClients[0]);
        const droppedCount = sampledClients.length - roundClients.length;
        dropoutHistory.push((droppedCount / sampledClients.length) * 100);

        currentNodes = buildNetwork(roundClients);
        logRoundStart(cohort, roundClients, attemptedRound);
        if (droppedCount > 0) {
          logLine(
            `<span class="term-time">[${timestamp()}]</span> <span class="term-warn">${droppedCount} of ` +
              `${sampledClients.length} devices dropped out</span> <span class="term-dim">(no update received)</span>`
          );
        }
        const t0 = performance.now();
        const timedPromise = trainer.runRound(roundClients).then((stat) => ({ stat, roundMs: performance.now() - t0 }));
        await animateRound(currentNodes);
        const { stat, roundMs } = await timedPromise;

        const clipNorm = parseFloat(els.clip.value);
        const noiseMultiplier = parseFloat(els.noise.value);
        logRoundResult(stat, clipNorm, noiseMultiplier * clipNorm);

        // Update in place rather than rebuilding: same nodes glide to their
        // measured radii, instead of the panel visibly rendering twice.
        updateNetwork(stat);
        els.roundCounter.textContent = `round ${stat.round}`;
        renderPipeline();
        updateEpsilon(stat.epsilonTotal);
        updateAccuracyStats(stat);
        renderClientBoxes(stat.clientStats);
        drawChart();
        updateComputeStrip(roundMs, stat.clientStats.reduce((a, c) => a + (c.samples || 0), 0), stat.localEpochs);
        roundLatencyHistory.push(roundMs);
        updateObservabilityPanels(roundClients);
        updateDeployStats();
        updateEvalSummary();
        setLive(true, `Training live · round ${stat.round}`);
        await new Promise((r) => setTimeout(r, 100));
      } catch (err) {
        console.error("[fl-demo] training round failed:", err);
        logLine(`<span class="term-time">[${timestamp()}]</span> <span class="term-warn">Round ${attemptedRound} failed: ${(err && err.message) || err}</span>`);
        errored = true;
        break;
      }
    }

    running = false;
    setControlsDisabled(false);
    // A session ends on pause, completion or error: record it either way, so
    // an aborted run is still comparable rather than silently lost.
    recordRun(errored ? "error" : trainer.round >= MAX_ROUNDS ? "complete" : "paused");
    renderPipeline();
    if (errored) {
      els.start.textContent = "Start training";
      setLive(false, "Stopped after an error · see coordinator log");
    } else if (trainer.round >= MAX_ROUNDS) {
      els.start.textContent = "Complete";
      els.start.disabled = true;
      setLive(false, "Training complete · nothing left this machine");
      logLine(`<span class="term-time">[${timestamp()}]</span> <span class="term-accent">Training complete</span>, auto-saving final checkpoint…`);
      await saveCheckpoint();
    } else {
      els.start.textContent = "Resume";
      setLive(false, "Paused · nothing leaves this machine");
      if (!stopRequested && targetRound < MAX_ROUNDS) {
        logLine(`<span class="term-time">[${timestamp()}]</span> <span class="term-accent">Reached requested round limit</span>, paused at round ${trainer.round}`);
      }
    }
  }

  els.start.addEventListener("click", () => {
    if (running) {
      stopRequested = true;
      els.start.textContent = "Resume";
    } else {
      els.start.disabled = false;
      trainLoop().catch((err) => {
        console.error("[fl-demo] trainLoop crashed:", err);
        running = false;
        setControlsDisabled(false);
        els.start.textContent = "Start training";
        setLive(false, "Stopped after an error · see console");
      });
    }
  });

  els.reset.addEventListener("click", () => {
    stopRequested = true;
    running = false;
    sessionSeed = Math.floor(Math.random() * 1e9);
    els.start.textContent = "Start training";
    els.start.disabled = false;
    setControlsDisabled(false);
    setLive(false, "Running locally · nothing leaves this machine");
    setupTrainerSafe("reset");
  });

  // ---------- command palette (⌘K) ----------
  // One keyboard entry point to every surface in the platform: tabs, terminal
  // commands, source files, cohorts and model presets. Each entry delegates to
  // the same handler the UI already uses, so there is no second code path that
  // can drift from what the buttons do.
  function buildPaletteActions() {
    const actions = [];

    [
      ["Train", "train", "Run federated rounds"],
      ["Eval", "eval", "Held-out evaluation report"],
      ["Deploy", "deploy", "Roll out a model to devices"],
      ["Inference", "inference", "On-device Maps ad ranking"],
    ].forEach(([label, mode, hint]) => {
      actions.push({ group: "Go to", label, hint, run: () => goToMode(mode) });
    });

    actions.push({
      group: "Go to",
      label: "Terminal",
      hint: "Focus the coordinator prompt (Ctrl+`)",
      run: focusTerminal,
    });

    [
      ["train", "Start / resume federated training"],
      ["pretrain", "Sharded central pre-training"],
      ["posttrain", "List post-training stages"],
      ["posttrain quantize", "int8 quantize + re-measure"],
      ["posttrain prune", "Magnitude prune + re-measure"],
      ["posttrain distill", "Train a smaller student"],
      ["posttrain lora --rank 1 --cohort apac", "LoRA adapter fine-tune to another cohort"],
      ["posttrain qlora --rank 2 --cohort apac", "Quantized base + fp32 adapters"],
      ["evaluate", "Run the full evaluation"],
      ["deploy", "Deploy the selected model"],
      ["save", "Save a checkpoint"],
      ["status", "Print round / MAE / ε"],
      ["pause", "Pause training"],
      ["reset", "Reset the trainer"],
      ["clear", "Clear the coordinator log"],
    ].forEach(([cmd, hint]) => {
      actions.push({
        group: "Run",
        label: cmd,
        hint,
        mono: true,
        run: () => {
          document.getElementById("terminal-panel").scrollIntoView({ behavior: "smooth", block: "center" });
          runTerminalCommand(cmd);
        },
      });
    });

    COHORTS.forEach((c) => {
      actions.push({
        group: "Cohort",
        label: c.label,
        hint: `${fmtInt(c.population)} devices`,
        // Drive the real select so the existing change listener rebuilds the
        // trainer. Selecting a cohort must not also start a run.
        run: () => {
          clickMode("train");
          if (running) { termWarn("Pause training before switching cohort."); return; }
          els.cohort.value = c.id;
          els.cohort.dispatchEvent(new Event("change", { bubbles: true }));
        },
      });
    });

    CODE_FILES.forEach((f) => {
      actions.push({
        group: "Open",
        label: f.isDiagram ? "Architecture" : f.id,
        hint: f.desc,
        mono: !f.isDiagram,
        run: () => {
          if (!els.codePanel.classList.contains("open")) els.codeToggle.click();
          showCodeFile(f.id);
        },
      });
    });

    return actions;
  }

  let paletteActions = [];
  let paletteFiltered = [];
  let paletteIndex = 0;

  // Subsequence match, so "pfr/trainer" finds python/federated_ranker/trainer.py.
  function paletteScore(action, query) {
    if (!query) return 0;
    const hay = `${action.label} ${action.hint} ${action.group}`.toLowerCase();
    const direct = hay.indexOf(query);
    if (direct !== -1) return 1000 - direct;
    let qi = 0;
    for (let i = 0; i < hay.length && qi < query.length; i++) {
      if (hay[i] === query[qi]) qi++;
    }
    return qi === query.length ? 1 : -1;
  }

  function renderPalette() {
    const query = els.paletteInput.value.trim().toLowerCase();
    paletteFiltered = paletteActions
      .map((a) => ({ a, s: paletteScore(a, query) }))
      .filter((e) => e.s >= 0)
      .sort((x, y) => y.s - x.s)
      .slice(0, 40)
      .map((e) => e.a);

    if (!paletteFiltered.length) {
      els.paletteResults.innerHTML = `<div class="palette-none">No matches for “${escapeHtml(query)}”</div>`;
      return;
    }
    if (paletteIndex >= paletteFiltered.length) paletteIndex = paletteFiltered.length - 1;
    if (paletteIndex < 0) paletteIndex = 0;

    let html = "";
    let lastGroup = null;
    paletteFiltered.forEach((a, i) => {
      if (a.group !== lastGroup) {
        html += `<div class="palette-group">${a.group}</div>`;
        lastGroup = a.group;
      }
      html += `<div class="palette-item${i === paletteIndex ? " active" : ""}" data-index="${i}">
        <span class="palette-label${a.mono ? " mono" : ""}">${escapeHtml(a.label)}</span>
        <span class="palette-hint">${escapeHtml(a.hint || "")}</span>
      </div>`;
    });
    els.paletteResults.innerHTML = html;

    const active = els.paletteResults.querySelector(".palette-item.active");
    if (active && typeof active.scrollIntoView === "function") active.scrollIntoView({ block: "nearest" });
    els.paletteResults.querySelectorAll(".palette-item").forEach((el) => {
      el.addEventListener("click", () => runPaletteAction(+el.dataset.index));
    });
  }

  function runPaletteAction(i) {
    const action = paletteFiltered[i];
    if (!action) return;
    closePalette();
    try {
      action.run();
    } catch (err) {
      console.error("[fl-demo] palette action failed:", err);
    }
  }

  function openPalette() {
    if (!paletteActions.length) paletteActions = buildPaletteActions();
    els.palette.hidden = false;
    els.paletteBackdrop.classList.add("open");
    els.palette.classList.add("open");
    els.paletteInput.value = "";
    paletteIndex = 0;
    renderPalette();
    els.paletteInput.focus();
  }

  function closePalette() {
    els.palette.classList.remove("open");
    els.paletteBackdrop.classList.remove("open");
    els.palette.hidden = true;
  }

  function initPalette() {
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        els.palette.hidden ? openPalette() : closePalette();
        return;
      }
      if (els.palette.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); closePalette(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); paletteIndex++; renderPalette(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); paletteIndex--; renderPalette(); }
      else if (e.key === "Enter") { e.preventDefault(); runPaletteAction(paletteIndex); }
    });
    els.paletteInput.addEventListener("input", () => { paletteIndex = 0; renderPalette(); });
    els.paletteBackdrop.addEventListener("click", closePalette);
    // Lifecycle nav in the header: same six stages as the pipeline rail, always
    // reachable from the top of the page. Delegates to goToMode so there is one
    // navigation path, not a second one that can drift.
    document.querySelectorAll(".nav-stage").forEach((b) => {
      b.addEventListener("click", () => {
        goToMode(b.dataset.mode);
        document.querySelectorAll(".nav-stage").forEach((o) => o.classList.toggle("active", o === b));
      });
    });
    const trigger = document.getElementById("nav-cmdk");
    if (trigger) trigger.addEventListener("click", openPalette);
  }

  function safeInit(fn, label) {
    try {
      fn();
    } catch (err) {
      console.error(`[fl-demo] ${label} failed to initialize:`, err);
    }
  }

  // Reveal goes first — every other step below is independent decoration or
  // training setup, and none of it should be able to take the rest of the
  // page down with it if something throws.
  safeInit(initReveal, "scroll reveal");
  safeInit(renderCohortOptions, "cohort options");
  safeInit(() => {
    els.adapterCohort.innerHTML = COHORTS.map((c) => `<option value="${c.id}">${c.label}</option>`).join("");
    els.adapterCohort.value = "apac"; // a different cohort by default: that is where adaptation shows
  }, "adapter cohort options");
  safeInit(() => {
    bindEditableSlider(els.k, els.valK, 0);
    bindEditableSlider(els.epochs, els.valEpochs, 0);
    bindEditableSlider(els.clip, els.valClip, 2);
    bindEditableSlider(els.noise, els.valNoise, 1);
    bindEditableSlider(els.dropout, els.valDropout, 0);
  }, "editable slider fields");
  safeInit(syncLabels, "control labels");
  safeInit(initComputeBackend, "compute backend readout");
  safeInit(initModeSwitch, "mode switch");
  safeInit(initTerminalExpand, "terminal expand toggle");
  safeInit(initTerminalConsole, "terminal console");
  safeInit(initTerminalDrag, "terminal drag-to-resize");
  safeInit(initCodePanel, "code viewer");
  safeInit(initPalette, "command palette");
  safeInit(renderPipeline, "pipeline rail");
  safeInit(initStatusBar, "status bar");
  safeInit(renderTrainingConfig, "training configuration");
  safeInit(renderReporting, "advertiser reporting");
  safeInit(() => {
    loadRealPlaces()
      .then((data) => {
        renderMapWorld();
        panMapTo(MAPS_DISTRICTS.paloAlto.x, MAPS_DISTRICTS.paloAlto.y);
        applyMapsSearch(els.mapsSearchInput.value);
        logLine(
          `<span class="term-time">[${timestamp()}]</span> Loaded ` +
            `<span class="term-accent">${fmtInt(data.places.length)} real places</span> ` +
            `<span class="term-dim">(OpenStreetMap, baked locally, no runtime API)</span>`
        );
      })
      .catch((err) => console.warn("[fl-demo] using built-in places:", err.message));
  }, "real places");
  safeInit(renderMapWorld, "map geography");
  safeInit(() => {
    panMapTo(MAPS_DISTRICTS.paloAlto.x, MAPS_DISTRICTS.paloAlto.y);
    renderMapsPlayground(0.5, "Featured Place");
  }, "maps playground default state");
  safeInit(initMapsSearch, "maps search");
  safeInit(initIphoneDrag, "iphone drag");
  safeInit(initMapInteraction, "map pan/zoom");
  safeInit(() => {
    loadModelSpec("small")
      .then(setupTrainer)
      .catch((err) => console.error("[fl-demo] model + trainer setup failed:", err));
  }, "model + trainer setup");
  // Optional: the demo is fully functional without it, so a missing or
  // unreadable file degrades to "train something first" rather than breaking.
  safeInit(() => {
    loadFactoryCheckpoint()
      .then(() => {
        renderAllModelOptions();
        updateDeployStats();
        updateEvalSummary();
        renderHeroProof().catch((err) => console.warn("[fl-demo] hero proof failed:", err.message));
        logLine(
          `<span class="term-time">[${timestamp()}]</span> Loaded <span class="term-accent">${factoryCheckpoint.meta.label}</span> ` +
            `<span class="term-dim">(pretrained, ready to deploy)</span>`
        );
      })
      .catch((err) => console.warn("[fl-demo] no factory checkpoint available:", err.message));
  }, "factory checkpoint");
  safeInit(() => initHeroField(document.getElementById("hero-canvas")), "hero background");
  safeInit(() => initHeroParallax(document.getElementById("hero")), "hero parallax");
  window.addEventListener("resize", () => {
    drawChart();
    if (trainer && trainer.round > 0) updateObservabilityPanels([]);
  });
})();
