/* Custodian console: renders engine.js state, runs live traffic, and drives the
   scripted demo acts. Plain ES modules, no build step. */
import * as E from './engine.js?v=20261022-3';

const PW_HASH = '1e7228eb5d5a198e09fefac19468f791202bc1f23c74a0356444ac9de025531b'; // sha256('custodian:' + password)
const $ = (s, r = document) => r.querySelector(s);
const h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n).toLocaleString('en-US');
const pct = (a, b) => (b ? (100 * a / b) : 0).toFixed(1) + '%';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const time = (t) => new Date(t).toLocaleTimeString('en-GB', { hour12: false });
const date = (t) => new Date(t).toISOString().slice(0, 10);
const initials = (n) => n.split(' ').map((x) => x[0]).join('');
const store = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
  del: (k) => { try { sessionStorage.removeItem(k); } catch { /* private mode */ } },
};

let P;
const S = {
  view: 'overview', role: null, token: null,
  traffic: true, series: [], last: null,
  sel: { dataset: null, request: null, model: null, serve: null, dsr: null },
  consentUser: null, flow: null,
  sim: { user: null, dataset: 'ad_features_v7', purpose: 'ads_personalization', region: 'US', principal: 'svc-ad-gateway' },
  train: { principal: 'svc-ads-trainer', dataset: 'ad_features_v7', purpose: 'model_training', result: null },
  shadow: null, scan: null, newDs: 'iphone_app_events_v2',
  lineageUser: '', audit: { filter: '', verify: null, tampered: null },
  agent: { user: null, userToken: null, agentToken: null, results: [] },
  dma: null, actsDone: new Set(), act: null,
  data: { tab: 'users', region: 'all', user: null },
};

/* ───────────────────────── boot: gate, sign-in ───────────────────────── */

async function sha(text) { return E.sha256(text); }

function showGate() { $('#gate').hidden = false; $('#signin').hidden = true; $('#app').hidden = true; $('#gate-pw').focus(); }
function showSignin() {
  $('#gate').hidden = true; $('#signin').hidden = false; $('#app').hidden = true;
  $('#who').innerHTML = Object.entries(E.ROLES).map(([k, r]) => `<button data-signin="${k}"><span class="av">${initials(r.name)}</span><span><b>${h(r.name)}</b><span>${h(r.title)} · <code>${k}</code></span></span><i>›</i></button>`).join('');
}
$('#gate-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = $('#gate-pw').value.trim().toLowerCase(); // forgiving: stray spaces, autocapitalize
  if ((await sha('custodian:' + pw)) === PW_HASH) { store.set('custodian.gate', '1'); showSignin(); }
  else { $('#gate-err').textContent = 'Incorrect password.'; const f = $('#gate-form'); f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); $('#gate-pw').select(); }
});
$('#who').addEventListener('click', (e) => { const b = e.target.closest('[data-signin]'); if (b) signIn(b.dataset.signin); });

async function signIn(role, quiet) {
  S.role = role; store.set('custodian.role', role);
  const r = E.ROLES[role];
  S.token = await E.issueToken({ sub: r.name.toLowerCase().replace(' ', '.'), name: r.name, roles: [role], aud: 'custodian-console', amr: ['pwd', 'otp'] }, 900);
  if (P) await P.ledger.append('auth.login', S.token.claims.sub, { role, client: 'custodian-console', flow: 'authorization_code+pkce' });
  if (!quiet) toast(`Signed in as ${r.name}, ${r.title.toLowerCase()}`);
  $('#gate').hidden = true; $('#signin').hidden = true; $('#app').hidden = false;
  if (!P) await boot();
  renderChrome(); render();
}

async function boot() {
  P = new E.Platform({ users: 10000 });
  await P.ledger.append('platform.start', 'system', { users: P.users.length, policy: 'ads-1.4.0' });
  for (const d of P.datasets) await P.ledger.append('catalog.registered', 'data-steward', { dataset: d.id, classification: d.classification });
  P.ledger.listeners.push(() => { if (S.view === 'audit') scheduleRender(); });
  S.consentUser = pickUser((u) => u.region === 'US-CA' && !u.gpc && u.personalizedAdsToggle && u.att === 'authorized').id;
  S.sim.user = S.consentUser;
  S.agent.user = S.consentUser;
  S.data.user = S.consentUser;
  startTraffic();
}

/* ───────────────────────── chrome ───────────────────────── */

const NAV = [
  ['Monitor', [['overview', 'Overview'], ['serving', 'Serving gateway'], ['consent', 'Consent']]],
  ['Govern', [['data', 'Data explorer'], ['catalog', 'Catalog'], ['access', 'Access requests'], ['policy', 'Policy studio'], ['lineage', 'Lineage']]],
  ['Machine learning', [['training', 'Training gate'], ['models', 'Models']]],
  ['Rights and evidence', [['dsr', 'Data subject requests'], ['audit', 'Audit ledger'], ['agent', 'Agent access']]],
  ['Reference', [['compliance', 'Compliance matrix']]],
];
const TITLES = Object.fromEntries(NAV.flatMap(([, items]) => items));

function counts() {
  return {
    catalog: P.datasets.filter((d) => d.status === 'pending').length || '',
    access: P.accessRequests.filter((r) => r.status === 'open').length || '',
    dsr: P.dsrs.filter((d) => d.status !== 'completed').length || '',
    audit: fmt(P.ledger.entries.length),
  };
}
function renderChrome() {
  const c = counts();
  $('#nav').innerHTML = NAV.map(([sec, items]) => `<h6>${sec}</h6>` + items.map(([k, t]) => `<button class="nav-item${S.view === k ? ' on' : ''}" data-go="${k}">${t}<span class="count">${c[k] ?? ''}</span></button>`).join('')).join('');
  const r = E.ROLES[S.role];
  $('#btn-role').innerHTML = `<span class="av">${initials(r.name)}</span>${h(r.name.split(' ')[0])} <small>${h(r.title)}</small>`;
  $('#bar-title').textContent = TITLES[S.view];
  $('#side-foot').innerHTML = `Policy <b>ads-1.4.0</b> live, 1.5.0 shadow<br>${fmt(P.users.length)} synthetic users<br>Token expires ${time(S.token.claims.exp * 1000)}`;
}

function go(view) { S.view = view; $('#side').classList.remove('open'); renderChrome(); render(); $('#view').scrollTop = 0; }

/* ───────────────────────── rendering ───────────────────────── */

let renderQueued = false;
function scheduleRender() { if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; render(); }); }
function render() {
  const v = $('#view');
  const st = v.scrollTop;
  v.innerHTML = VIEWS[S.view]();
  v.scrollTop = st;
  AFTER[S.view] && AFTER[S.view]();
}
const LIVE = new Set(['overview', 'serving']);
setInterval(() => {
  if (!P || $('#app').hidden) return;
  const a = document.activeElement;
  if (a && $('#view').contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
  if (LIVE.has(S.view)) render();
  renderChrome();
}, 1000);

const head = (title, sub) => `<div class="view-head"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>`;
const kpi = (v, label, sub, cls = '') => `<div class="card c3 kpi ${cls}"><b>${v}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
const pill = (cls, text) => `<span class="pill ${h(cls)}">${h(text ?? cls)}</span>`;
const bars = (rows, cls = '') => {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return `<div class="bars">${rows.map(([k, v, label]) => `<div class="bar-row"><span title="${h(k)}">${h(k)}</span><div class="track"><div class="fill ${cls}" style="width:${(100 * v / max).toFixed(1)}%"></div></div><span class="v">${label ?? fmt(v)}</span></div>`).join('')}</div>`;
};
const can = (...roles) => roles.includes(S.role);
const roleNote = (...roles) => can(...roles) ? '' : `<p class="note">Requires ${roles.map((r) => `<code>${r}</code>`).join(' or ')}. Switch account from the top right.</p>`;
const decisionBox = (d, extra = '') => `<div class="decision ${d.allow ? '' : 'deny'}"><h4>${d.allow ? 'Allow' : 'Deny'}</h4>${d.reasons.length ? `<ul>${d.reasons.map((r) => `<li><code>${h(r.code)}</code> ${h(r.msg)} <span class="cite">${h(r.cite)}</span></li>`).join('')}</ul>` : ''}<p class="meta">Bundle <code>${h(d.version)}</code> · evaluated in ${d.latency_ms.toFixed(3)} ms${extra}</p></div>`;

function pickUser(fn) { return P.users.find(fn) || P.users[0]; }
function userLabel(u) { return `${u.id} · ${u.region}`; }
function featuredUsers() {
  const picks = [
    P.users.find((u) => u.region === 'US-CA' && !u.gpc && u.personalizedAdsToggle && u.att === 'authorized'),
    P.users.find((u) => u.region === 'US-CA' && u.gpc),
    P.users.find((u) => u.eu && u.personalizedAdsToggle && u.att === 'authorized'),
    P.users.find((u) => u.eu && !u.personalizedAdsToggle),
    P.users.find((u) => u.region === 'US-TX' && u.att === 'denied'),
    P.userById.get(S.consentUser), P.userById.get(S.sim.user), P.userById.get(S.agent.user),
  ].filter(Boolean);
  return [...new Map(picks.map((u) => [u.id, u])).values()];
}
const userOptions = (sel) => featuredUsers().map((u) => `<option value="${u.id}"${u.id === sel ? ' selected' : ''}>${h(userLabel(u))}</option>`).join('');

/* ───────────────────────── views ───────────────────────── */

const VIEWS = {};
const AFTER = {};

VIEWS.overview = () => {
  const ds = P.datasets, classified = ds.filter((d) => d.status !== 'pending').length;
  const openDsr = P.dsrs.filter((d) => d.status !== 'completed');
  const lat = P.decisions.map((d) => d.decision.latency_ms).sort((a, b) => a - b);
  const p99 = lat.length ? lat[Math.floor(lat.length * 0.99)] : 0;
  const lags = P.propagationLags.slice().sort((a, b) => a - b);
  const p95 = lags.length ? lags[Math.floor(lags.length * 0.95)] : null;
  const reasons = {};
  for (const d of P.decisions) for (const r of d.decision.reasons) reasons[r.code] = (reasons[r.code] || 0) + 1;
  const byRegion = {};
  for (const u of P.users) { const c = P.cache.get(u.id); if (!c) continue; const b = byRegion[u.region] || (byRegion[u.region] = [0, 0]); b[1]++; if (c.consent.ads_personalization !== 'granted') b[0]++; }
  const s = P.serving, total = s.personalized + s.contextual;
  return head('Overview', 'One governance plane for every AI workload: identity, consent, policy, lineage, erasure and audit. Traffic below is a sampled stream through the real enforcement path.') + `
  <div class="grid">
    ${kpi(pct(classified, ds.length), 'Datasets classified', `${ds.length - classified} pending steward review`)}
    ${kpi(P.accessRequests.filter((r) => r.status === 'open').length + P.datasets.filter((d) => d.status === 'pending').length, 'Pending approvals', 'access requests and new datasets')}
    ${kpi(openDsr.length, 'Open data subject requests', openDsr.length ? `next due ${date(Math.min(...openDsr.map((d) => d.due)))}` : 'all inside the 30 day SLA')}
    ${kpi(s.violations, 'Personalized outputs without an allow', 'SLO: exactly zero', s.violations ? 'bad' : 'good')}
    ${kpi(p99.toFixed(3) + ' ms', 'Policy decision p99', 'in-process PDP, this browser. SLO < 10 ms')}
    ${kpi(p95 === null ? 'n/a' : (p95 / 1000).toFixed(2) + ' s', 'Consent propagation p95', 'outbox to Redis. SLO < 5 s')}
    ${kpi(pct(s.personalized, total), 'Served personalized', `${fmt(total)} requests this session`)}
    ${kpi(fmt(P.ledger.entries.length), 'Audit ledger entries', P.ledger.anchors.length ? `last Merkle anchor ${time(P.ledger.anchors.at(-1).at)}` : 'hash-chained, append-only')}
    <div class="card c12"><h3>Governed AI workloads</h3><div class="scroll-x"><table class="table"><thead><tr><th>Workload</th><th>Purpose checked per user</th><th>Datasets</th><th>Models</th><th>Owner</th></tr></thead><tbody>${Object.entries(E.WORKLOADS).map(([k, w]) => `<tr><td><b>${w.name}</b></td><td class="mono">${w.userPurpose}</td><td class="mono">${P.datasets.filter((d) => d.workload === k).map((d) => d.id).join('<br>')}</td><td class="mono">${P.models.filter((m) => m.workload === k).map(E.mname).join('<br>') || 'none'}</td><td>${w.owner}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card c6"><h3>Policy denials by reason <span class="right">last ${P.decisions.length} decisions</span></h3>${bars(Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 8), 'red') || '<p class="note">No denials yet.</p>'}</div>
    <div class="card c6"><h3>Opted out of personalization, by region <span class="right">serving cache</span></h3>${bars(Object.entries(byRegion).sort().map(([k, [o, n]]) => [k, o / n * 100, (o / n * 100).toFixed(0) + '%']))}</div>
    <div class="card c12"><h3>Serving mix <span class="right">last 60 s</span></h3>${seriesChart()}<div class="legend"><span><i style="background:#0071e3"></i>Personalized</span><span><i style="background:#86868b"></i>Non-personalized</span><span><i style="background:#ff3b30"></i>Fail-closed fallback</span></div></div>
    <div class="card c12"><h3>Architecture</h3><p class="note">Hosted demo runs each component in the browser. The production mapping is in the design doc.</p>${archDiagram()}</div>
  </div>`;
};

function seriesChart() {
  const pts = S.series.slice(-60), W = 600, H = 150, n = Math.max(pts.length - 1, 1);
  const max = Math.max(4, ...pts.map((p) => p.personalized + p.contextual));
  const line = (key, color) => `<polyline fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" points="${pts.map((p, i) => `${(i / n * W).toFixed(1)},${(H - 6 - (p[key] / max) * (H - 16)).toFixed(1)}`).join(' ')}"/>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="0" x2="${W}" y1="${H - 6}" y2="${H - 6}" stroke="#e5e5ea"/>${pts.length > 1 ? line('contextual', '#86868b') + line('personalized', '#0071e3') + line('fallback', '#ff3b30') : ''}</svg>`;
}

function archDiagram() {
  const box = (t, s, go) => `<button class="hop" data-go="${go}" style="text-align:left;cursor:pointer"><b>${t}</b><span>${s}</span></button>`;
  return `<div style="display:grid;gap:10px">
    <p class="note" style="margin:0">Control plane</p>
    <div class="flow">${box('Identity', 'Keycloak OIDC', 'overview')}${box('Policy', 'OPA, Rego bundles', 'policy')}${box('Consent', 'Postgres bitemporal', 'consent')}${box('Catalog', 'PII scan, approval', 'catalog')}${box('Workflows', 'Temporal', 'access')}${box('Agent access', 'RFC 8693', 'agent')}</div>
    <p class="note" style="margin:0">Data plane</p>
    <div class="flow">${box('Sources', 'iOS app, assistant', 'data')}${box('Ingestion', 'tags region, consent', 'lineage')}${box('Lakehouse', 'Iceberg, US and EU buckets', 'lineage')}${box('Training gate', 'point-in-time consent', 'training')}${box('Registry', 'MLflow, model cards', 'models')}${box('Serving gateway', 'PEP, circuit breaker', 'serving')}</div>
    <p class="note" style="margin:0">Evidence plane</p>
    <div class="flow">${box('Event bus', 'Redpanda topics', 'consent')}${box('Lineage', 'OpenLineage, Marquez', 'lineage')}${box('Audit ledger', 'hash chain, WORM anchor', 'audit')}${box('DSR saga', 'erasure, export', 'dsr')}${box('Observability', 'OTel, Prometheus', 'serving')}${box('Compliance', 'control matrix', 'compliance')}</div>
  </div>`;
}

/* ── serving ── */
VIEWS.serving = () => {
  const s = P.serving, total = s.personalized + s.contextual, last = S.series.at(-1) || { personalized: 0, contextual: 0, fallback: 0 };
  const rps = last.personalized + last.contextual, fr = rps ? last.fallback / rps : 0;
  const sel = s.log.find((r) => r.at === S.sel.serve) || s.log[0];
  return head('Serving gateway', 'The enforcement point in front of personalized models. Shown here on the ads ranking workload: every request checks consent from the cache and asks the policy service; anything other than an explicit allow is served by a non-personalized model that sees only the request, never history.') + `
  <div class="grid">
    ${kpi(fmt(rps), 'Requests per second', 'sampled stream')}
    ${kpi((fr * 100).toFixed(1) + '%', 'Fail-closed fallback rate', 'policy unavailable or circuit open', fr > 0 ? 'bad' : '')}
    ${kpi(s.violations, 'Personalized without allow', `of ${fmt(total)} served`, s.violations ? 'bad' : 'good')}
    ${kpi(P.policyUp ? (P.breaker.state === 'open' ? 'Open' : 'Closed') : 'Down', 'Policy service, circuit', P.policyUp ? `breaker ${P.breaker.state}` : 'killed by chaos', P.policyUp && P.breaker.state === 'closed' ? 'good' : 'bad')}
    <div class="card c8"><h3>Serving mix <span class="right">per second, last 60 s</span></h3>${seriesChart()}<div class="legend"><span><i style="background:#0071e3"></i>Personalized</span><span><i style="background:#86868b"></i>Non-personalized</span><span><i style="background:#ff3b30"></i>Fail-closed fallback</span></div></div>
    <div class="card c4"><h3>Chaos</h3><p class="note">Kill the policy service. The gateway must fail closed, not open.</p>
      <div class="row"><button class="btn ${P.policyUp ? 'danger' : 'primary'}" data-act="chaos" ${can('sre') ? '' : 'disabled'}>${P.policyUp ? 'Kill policy service' : 'Restore policy service'}</button>
      <button class="btn" data-act="traffic">${S.traffic ? 'Pause traffic' : 'Resume traffic'}</button></div>${roleNote('sre')}
      <dl class="kv"><dt>Breaker</dt><dd>${P.breaker.state}, ${P.breaker.failures} failures</dd><dt>Fallback total</dt><dd>${fmt(s.fallback)}</dd><dt>Contextual</dt><dd>${fmt(s.contextual)}</dd><dt>Personalized</dt><dd>${fmt(s.personalized)}</dd></dl></div>
    <div class="card c7"><h3>Request log <span class="right">click a row for its trace</span></h3><div class="scroll-x"><table class="table"><thead><tr><th>Time</th><th>User</th><th>Served</th><th>Reason</th><th>Consent offset</th><th>Policy</th></tr></thead><tbody>
      ${s.log.slice(0, 14).map((r) => `<tr class="click${sel && r.at === sel.at && r.user === sel.user ? ' sel' : ''}" data-serve="${r.at}"><td>${time(r.at)}</td><td class="mono">${r.user}</td><td>${pill(r.mode)}</td><td>${h(r.why)}</td><td class="mono">${r.consent_offset ?? 'n/a'}</td><td class="mono">${r.policy || 'none'}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="card c5"><h3>Trace ${sel ? `<span class="right mono">${sel.user}</span>` : ''}</h3>${sel ? traceView(sel) : '<p class="note">No requests yet.</p>'}</div>
  </div>`;
};
function traceView(r) {
  const max = Math.max(...r.spans.map((s) => s.ms), 1);
  return `<div class="trace">${r.spans.map((s) => `<div class="span-row${s.error ? ' err' : ''}"><span class="mono">${h(s.name)}</span><div><div class="t" style="width:${(s.ms / max * 100).toFixed(1)}%"></div></div><span class="v">${s.ms.toFixed(2)} ms</span></div>`).join('')}</div><p class="note">Served ${pill(r.mode)} because <b>${h(r.why)}</b>. Logged with consent offset ${r.consent_offset ?? 'n/a'} and policy ${r.policy || 'none'}. Span names follow OpenTelemetry conventions.</p>`;
}

/* ── consent ── */
VIEWS.consent = () => {
  const u = P.userById.get(S.consentUser) || P.users[0];
  const truth = P.consent.snapshot(u.id), cache = P.cache.get(u.id);
  const hist = P.consent.history(u.id);
  const f = S.flow;
  const hop = (k, t, s) => `<div class="hop${f && f.lit.includes(k) ? ' lit' + (f.done ? ' ok' : '') : ''}"><b>${t}</b><span>${f && f.t[k] ? s(f) : 'waiting'}</span></div>`;
  return head('Consent', 'Consent per user and purpose is recorded bitemporally in Postgres, published through a transactional outbox to the consent.events topic, and applied to the Redis cache every serving gateway reads.') + `
  <div class="grid">
    <div class="card c5"><h3>User</h3>
      <div class="fields"><label class="field">Synthetic user<select data-bind="consentUser">${userOptions(u.id)}</select></label></div>
      <dl class="kv"><dt>Region</dt><dd>${u.region} (${E.regionInfo(u.region).law})</dd><dt>ATT prompt</dt><dd>${u.att}</dd><dt>Services</dt><dd>${u.services.join(', ')}</dd></dl>
      <p class="note">Simulate the user's device. Each change is a new immutable consent row.</p>
      <div style="display:grid;gap:12px">
        <label class="row between"><span>Global Privacy Control</span><span class="switch"><input type="checkbox" data-consent="gpc" ${u.gpc ? 'checked' : ''}><span></span></span></label>
        <label class="row between"><span>Personalized ads</span><span class="switch"><input type="checkbox" data-consent="ads" ${truth.ads_personalization === 'granted' ? 'checked' : ''}><span></span></span></label>
        <label class="row between"><span>Combine data across services</span><span class="switch"><input type="checkbox" data-consent="combo" ${truth.cross_service_combination === 'granted' ? 'checked' : ''}><span></span></span></label>
      </div>
      <div class="row"><button class="btn" data-act="serve-user">Send a request for this user</button></div>
    </div>
    <div class="card c7"><h3>Purposes <span class="right">source of truth vs serving cache</span></h3>
      <table class="table"><thead><tr><th>Purpose</th><th>Postgres</th><th>Redis cache</th></tr></thead><tbody>
      ${E.PURPOSES.map((p) => `<tr><td class="mono">${p}</td><td>${pill(truth[p])}</td><td>${cache ? pill(cache.consent[p]) : pill('deny', 'purged')}${cache && cache.consent[p] !== truth[p] ? ' <span class="pill warn">propagating</span>' : ''}</td></tr>`).join('')}
      </tbody></table>
      <h3>Propagation</h3>
      <div class="flow">
        ${hop('pg', 'Postgres', (f) => '+0 ms')}
        ${hop('outbox', 'Outbox', (f) => '+' + (f.t.outbox - f.t.pg) + ' ms')}
        ${hop('bus', 'consent.events', (f) => `p${f.msg.partition} @${f.msg.offset}`)}
        ${hop('consumer', 'Consumer', (f) => '+' + (f.t.consumer - f.t.pg) + ' ms')}
        ${hop('redis', 'Redis', (f) => 'lag ' + (f.lag / 1000).toFixed(2) + ' s')}
        ${hop('gateway', 'Gateway', (f) => f.served ? f.served.mode : 'next request')}
      </div>
    </div>
    <div class="card c12"><h3>Bitemporal history <span class="right">valid time and recorded time</span></h3>
      <p class="note">Every row is kept. To answer "what did we believe on that date", query by recorded time; to answer "what was true", query by valid time.</p>
      <div class="scroll-x"><table class="table"><thead><tr><th>#</th><th>Purpose</th><th>Status</th><th>Source</th><th>Legal basis</th><th>Valid from</th><th>Recorded at</th></tr></thead><tbody>
      ${hist.slice().reverse().map((r) => `<tr><td class="mono">${r.id}</td><td class="mono">${r.purpose}</td><td>${pill(r.status)}</td><td class="mono">${r.source}</td><td>${r.legal_basis}</td><td>${date(r.valid_from)} ${time(r.valid_from)}</td><td>${date(r.recorded_at)} ${time(r.recorded_at)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="row"><button class="btn" data-act="replay">Replay as known 30 days ago</button>${S.replay ? `<span class="note" style="margin:0">As known on ${date(S.replay.t)}: ads_personalization <b>${S.replay.ads}</b>, cross_service_combination <b>${S.replay.combo}</b></span>` : ''}</div>
    </div>
  </div>`;
};

async function changeConsent(kind, on) {
  const u = P.userById.get(S.consentUser);
  if (kind === 'gpc') await P.setConsent(u.id, 'ads_personalization', on ? 'denied' : (u.personalizedAdsToggle ? 'granted' : 'denied'), 'GPC_signal', { gpc: on });
  if (kind === 'ads') await P.setConsent(u.id, 'ads_personalization', on ? 'granted' : 'denied', 'personalized_ads_toggle');
  if (kind === 'combo') await P.setConsent(u.id, 'cross_service_combination', on ? 'granted' : 'denied', 'in_app_settings');
  const t0 = Date.now();
  S.flow = { lit: ['pg'], t: { pg: t0 }, done: false };
  render();
  await sleep(180 + Math.random() * 200);         // outbox poller interval
  const msgs = P.relayOutbox();
  S.flow.t.outbox = Date.now(); S.flow.lit.push('outbox'); render();
  await sleep(120);
  S.flow.msg = msgs.at(-1); S.flow.t.bus = Date.now(); S.flow.lit.push('bus'); render();
  await sleep(350 + Math.random() * 700);         // consumer poll + batch
  S.flow.t.consumer = Date.now(); S.flow.lit.push('consumer'); render();
  let lag = 0; for (const m of msgs) lag = P.applyToCache(m);
  S.flow.lag = lag; S.flow.t.redis = Date.now(); S.flow.lit.push('redis'); render();
  await sleep(250);
  S.flow.served = await P.serve(u.id, { placement: 'maps_search', query: 'coffee near me' });
  S.flow.t.gateway = Date.now(); S.flow.lit.push('gateway'); S.flow.done = true;
  S.sel.serve = S.flow.served.at;
  render();
  toast(`Next request for ${u.id}: ${S.flow.served.mode} (${S.flow.served.why})`);
}

/* ── data explorer: example rows behind every number ── */
VIEWS.data = () => {
  const d = S.data;
  const u = P.userById.get(d.user) || P.users[0];
  const tabs = [['users', 'Users'], ['raw', 'Raw events'], ['minimized', 'Minimized view'], ['consent', 'Consent records'], ['snapshots', 'Iceberg snapshots']];
  const regions = ['all', ...new Set(P.users.map((x) => x.region))].sort();
  let body = '';
  if (d.tab === 'users') {
    const list = P.users.filter((x) => d.region === 'all' || x.region === d.region).slice(0, 40);
    body = `<div class="row"><label class="field" style="min-width:160px">Region<select data-bind="data.region">${regions.map((r) => `<option${r === d.region ? ' selected' : ''}>${r}</option>`).join('')}</select></label><span class="note" style="margin:0">Showing ${list.length} of ${fmt(P.users.filter((x) => d.region === 'all' || x.region === d.region).length)}. Click a user to see their rows in the other tabs.</span></div>
    <div class="scroll-x"><table class="table"><thead><tr><th>user_id</th><th>Region</th><th>Law</th><th>ATT</th><th>Personalized ads</th><th>GPC</th><th>Services</th><th>ads_personalization</th><th>model_training</th><th>Events</th></tr></thead><tbody>
    ${list.map((x) => { const c = P.cache.get(x.id); return `<tr class="click${x.id === u.id ? ' sel' : ''}" data-datauser="${x.id}"><td class="mono">${x.id}</td><td>${x.region}</td><td>${E.regionInfo(x.region).law}</td><td>${x.att}</td><td>${x.personalizedAdsToggle ? 'on' : 'off'}</td><td>${x.gpc ? 'sent' : ''}</td><td>${x.services.join(', ')}</td><td>${c ? pill(c.consent.ads_personalization) : ''}</td><td>${c ? pill(c.consent.model_training) : ''}</td><td>${fmt(x.events)}</td></tr>`; }).join('')}
    </tbody></table></div>`;
  }
  if (d.tab === 'raw' || d.tab === 'minimized') {
    const rows = E.sampleEvents(u, 10);
    if (d.tab === 'raw') {
      body = `<p class="note">s3://${u.eu ? 'lake-eu-west' : 'lake-us-west'}/iphone_app_events_raw${u.eu ? '_eu' : ''}, as written by the collector. Columns the scanner flags are marked.</p>
      <div class="scroll-x"><table class="table"><thead><tr><th>event_id</th><th>user_id ${pill('warn', 'user_id')}</th><th>idfa ${pill('deny', 'device_id')}</th><th>event_name</th><th>query</th><th>latitude ${pill('deny', 'precise')}</th><th>longitude ${pill('deny', 'precise')}</th><th>ad_impression_id</th><th>ts</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td class="mono">${r.event_id}</td><td class="mono">${r.user_id}</td><td class="mono">${r.idfa}</td><td class="mono">${r.event_name}</td><td>${r.query || ''}</td><td class="mono">${r.latitude}</td><td class="mono">${r.longitude}</td><td class="mono">${r.ad_impression_id || ''}</td><td class="mono">${r.ts}</td></tr>`).join('')}
      </tbody></table></div>${u.att !== 'authorized' ? '<p class="note">ATT denied: the platform returns an all-zero advertising identifier, so it cannot link this user across apps.</p>' : ''}`;
    } else {
      const m = rows.map(E.minimize);
      body = `<p class="note">The approved ads view. Latitude and longitude become a geohash of about 5 km, the IDFA is dropped, free-text queries become a category, and timestamps round to the hour. This is what the training gate is allowed to read.</p>
      <div class="scroll-x"><table class="table"><thead><tr><th>event_id</th><th>user_id</th><th>event_name</th><th>geohash5</th><th>query_category</th><th>ad_impression_id</th><th>ts</th><th>Was</th></tr></thead><tbody>
      ${m.map((r, i) => `<tr><td class="mono">${r.event_id}</td><td class="mono">${r.user_id}</td><td class="mono">${r.event_name}</td><td class="mono">${r.geohash5}</td><td>${r.query_category || ''}</td><td class="mono">${r.ad_impression_id || ''}</td><td class="mono">${r.ts}</td><td class="note mono">${rows[i].latitude}, ${rows[i].longitude}</td></tr>`).join('')}
      </tbody></table></div>`;
    }
  }
  if (d.tab === 'consent') {
    const hist = P.consent.history(u.id);
    body = `<p class="note">postgres: consent_records WHERE user_id = '${u.id}'. Rows are never updated; changes are new rows.</p><div class="scroll-x"><table class="table"><thead><tr><th>id</th><th>purpose</th><th>status</th><th>source</th><th>legal_basis</th><th>region</th><th>valid_from</th><th>valid_to</th><th>recorded_at</th></tr></thead><tbody>
    ${hist.map((r) => `<tr><td class="mono">${r.id}</td><td class="mono">${r.purpose}</td><td>${pill(r.status)}</td><td class="mono">${r.source}</td><td>${r.legal_basis}</td><td>${r.region}</td><td class="mono">${new Date(r.valid_from).toISOString().slice(0, 19)}</td><td class="mono">${r.valid_to === Infinity ? 'infinity' : new Date(r.valid_to).toISOString().slice(0, 19)}</td><td class="mono">${new Date(r.recorded_at).toISOString().slice(0, 19)}</td></tr>`).join('') || '<tr><td colspan="9">No rows: this user was erased.</td></tr>'}
    </tbody></table></div>`;
  }
  if (d.tab === 'snapshots') {
    body = `<p class="note">Each table keeps snapshots for time travel. Membership shows whether ${u.id} is readable in that snapshot.</p><div class="scroll-x"><table class="table"><thead><tr><th>Table</th><th>Bucket</th><th>Snapshot</th><th>Operation</th><th>Data files</th><th>Rows (users)</th><th>${u.id}</th></tr></thead><tbody>
    ${Object.values(P.tables).flatMap((t) => t.snapshots.map((sn, i) => `<tr><td class="mono">${i === 0 ? t.name : ''}</td><td class="mono">${i === 0 ? t.bucket : ''}</td><td class="mono">${sn.id}${sn === t.current ? ' ' + pill('blue', 'current') : ''}</td><td>${sn.op}</td><td>${sn.files}</td><td>${fmt(sn.members.size)}</td><td>${sn.members.has(u.id) ? pill('blue', 'present') : ''}</td></tr>`)).join('')}
    </tbody></table></div>`;
  }
  return head('Data explorer', 'The synthetic records behind every number: users, the raw events a collector writes, the minimized view a model may read, consent rows, and table snapshots. All generated from a fixed seed; no real person.') + `
  <div class="grid"><div class="card c12">
    <div class="row between"><div class="seg">${tabs.map(([k, t]) => `<button class="${d.tab === k ? 'on' : ''}" data-datatab="${k}">${t}</button>`).join('')}</div>
    <label class="field" style="min-width:200px">User<select data-bind="data.user">${[u, ...featuredUsers()].filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i).map((x) => `<option value="${x.id}"${x.id === u.id ? ' selected' : ''}>${h(userLabel(x))}</option>`).join('')}</select></label></div>
    ${body}
  </div></div>`;
};

/* ── catalog ── */
VIEWS.catalog = () => {
  const sel = P.dataset(S.sel.dataset);
  const exists = P.dataset(S.newDs);
  return head('Catalog', 'Every dataset feeding an AI workload, with its governance metadata. New datasets start pending and cannot be read until a steward approves them.') + `
  <div class="grid">
    <div class="card c12"><div class="scroll-x"><table class="table"><thead><tr><th>Dataset</th><th>Workload</th><th>Classification</th><th>PII</th><th>Region</th><th>Allowed purposes</th><th>Retention</th><th>Status</th></tr></thead><tbody>
      ${P.datasets.map((d) => `<tr class="click${d.id === S.sel.dataset ? ' sel' : ''}" data-dataset="${d.id}"><td class="mono">${d.id}<br><span class="note">${d.layer}</span></td><td>${d.workload ? E.WORKLOADS[d.workload].name : 'shared'}</td><td>${pill(d.classification)}</td><td><div class="tags">${d.pii.map((t) => pill('', t)).join('')}</div></td><td>${d.region}</td><td class="mono">${d.allowed_purposes.join(', ')}</td><td>${d.retention_days} d</td><td>${pill(d.status)}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="card c6"><h3>Register a dataset</h3><p class="note">Schema and samples from the iOS collector. The scanner proposes PII tags; a steward confirms them.</p>
      <div class="fields"><label class="field">Name<input data-bind="newDs" value="${h(S.newDs)}"></label><label class="field">Source<input value="ios-collector (maps)" disabled></label></div>
      <div class="scroll-x"><table class="table"><thead><tr><th>Column</th><th>Type</th><th>Sample</th><th>Scanner</th></tr></thead><tbody>
      ${E.DEMO_SCHEMA.map((c) => { const f = S.scan && S.scan.findings.filter((x) => x.column === c.name); return `<tr><td class="mono">${c.name}</td><td>${c.type}</td><td class="mono">${h(c.sample)}</td><td>${f && f.length ? f.map((x) => pill(x.tag === 'precise_location' || x.tag === 'device_id' ? 'deny' : 'warn', x.tag)).join(' ') : (S.scan ? '<span class="note">clean</span>' : '')}</td></tr>`; }).join('')}
      </tbody></table></div>
      <div class="row"><button class="btn primary" data-act="register" ${can('ml_engineer', 'data_steward') && !exists ? '' : 'disabled'}>Register and scan</button>${exists ? `<span class="note" style="margin:0">${h(S.newDs)} is registered.</span>` : ''}</div>${roleNote('ml_engineer', 'data_steward')}
    </div>
    <div class="card c6"><h3>${sel ? h(sel.id) : 'Dataset details'}</h3>${sel ? datasetDetail(sel) : '<p class="note">Select a dataset.</p>'}</div>
  </div>`;
};
function datasetDetail(d) {
  return `<dl class="kv"><dt>Owner</dt><dd>${d.owner}</dd><dt>Steward</dt><dd>${d.steward}</dd><dt>Bucket</dt><dd class="mono">s3://${d.bucket}/${d.id}</dd><dt>Legal basis</dt><dd>${d.legal_basis}</dd><dt>Sources</dt><dd>${d.sources.join(', ')}</dd><dt>Status</dt><dd>${pill(d.status)}</dd>${d.scan ? `<dt>Scanner</dt><dd>${d.scan.findings.map((f) => `${f.column}: <b>${f.tag}</b> (${f.confidence})`).join('<br>')}</dd>` : ''}${d.conditions ? `<dt>Conditions</dt><dd>${h(d.conditions)}</dd>` : ''}</dl>
  ${d.status === 'pending' ? `<div class="row"><button class="btn primary" data-act="approve-ds" ${can('data_steward') ? '' : 'disabled'}>Confirm tags and approve</button><button class="btn danger" data-act="reject-ds" ${can('data_steward') ? '' : 'disabled'}>Reject</button></div>${roleNote('data_steward')}` : ''}
  ${d.status === 'approved' && d.id === S.newDs ? `<div class="row"><button class="btn" data-act="request-access" ${can('ml_engineer') ? '' : 'disabled'}>Request access for ads personalization</button></div>${roleNote('ml_engineer')}` : ''}
  ${(() => { const t = P.tables[d.id]; return t ? `<p class="note">Iceberg snapshots: ${t.snapshots.map((s) => `<code>${s.id}</code> (${s.op})`).join(', ')}</p>` : ''; })()}`;
}

async function registerDataset() {
  const name = S.newDs.trim();
  if (!name || P.dataset(name)) return;
  S.scan = { findings: [] }; render();
  const res = E.scanPII(E.DEMO_SCHEMA);
  for (const f of res.findings) { S.scan.findings.push(f); render(); await sleep(140); }
  const ds = { id: name, layer: 'raw', owner: 'ads-ml', steward: 'Luis Ortega', classification: res.classification, pii: res.tags, region: 'US', allowed_purposes: ['analytics'], retention_days: 30, sources: ['maps'], status: 'pending', legal_basis: 'legitimate_interest', bucket: 'lake-us-west', uses_idfa: true, scan: res };
  P.datasets.push(ds);
  S.sel.dataset = name;
  await P.ledger.append('catalog.registered', S.token.claims.sub, { dataset: name, classification: res.classification, proposed_tags: res.tags });
  toast(`${name} registered as ${res.classification}, pending steward review`);
  render(); renderChrome();
}

/* ── access requests ── */
VIEWS.access = () => {
  const sel = P.accessRequests.find((r) => r.id === S.sel.request) || P.accessRequests[0];
  return head('Access requests', 'Durable approval workflows. Each step is an activity in a Temporal workflow, so a restart resumes exactly where it stopped, and expiry revokes access automatically.') + `
  <div class="grid">
    <div class="card c5"><h3>Requests</h3>${P.accessRequests.length ? `<table class="table"><tbody>${P.accessRequests.map((r) => `<tr class="click${sel && r.id === sel.id ? ' sel' : ''}" data-request="${r.id}"><td class="mono">${r.id}</td><td>${h(r.dataset)}<br><span class="note">${r.purpose}, ${r.region}, ${r.days} days</span></td><td>${pill(r.status)}</td></tr>`).join('')}</tbody></table>` : '<p class="note">No requests yet. Register a dataset in the catalog and request access.</p>'}
      <h3>Active grants</h3><table class="table"><tbody>${P.grants.map((g) => `<tr><td class="mono">${g.principal}</td><td class="mono">${g.dataset}<br><span class="note">${g.purpose}, ${g.region}</span></td><td>${g.expires > Date.now() ? 'until ' + date(g.expires) : pill('deny', 'expired')}</td></tr>`).join('')}</tbody></table>
    </div>
    <div class="card c7">${sel ? requestDetail(sel) : '<h3>Workflow</h3><p class="note">Select a request.</p>'}</div>
  </div>`;
};
function requestDetail(r) {
  const cur = r.steps.find((s) => s.state === 'pending' || s.state === 'running');
  return `<h3>${r.id} <span class="right">workflow access-request/${r.id.toLowerCase()}</span></h3>
  <dl class="kv"><dt>Requester</dt><dd>${h(r.requester)}</dd><dt>Dataset</dt><dd class="mono">${h(r.dataset)}</dd><dt>Purpose</dt><dd>${r.purpose}</dd><dt>Justification</dt><dd>${h(r.justification)}</dd></dl>
  <ol class="steps">${r.steps.map((s) => `<li class="${s.state}"><span class="dot">${s.state === 'done' ? '✓' : s.state === 'rejected' ? '×' : ''}</span><div><b>${s.name}</b>${s.detail ? `<p>${h(s.detail)}</p>` : ''}<p>${s.role === 'system' ? 'Automatic' : 'Assigned to <code>' + s.role + '</code>'}${s.by ? ', by ' + h(s.by) : ''}</p></div><span>${s.state !== 'pending' ? pill(s.state === 'done' ? 'done' : s.state) : ''}</span></li>`).join('')}</ol>
  ${cur && cur.role !== 'system' ? `<div class="row"><button class="btn primary" data-act="approve-step" ${can(cur.role) ? '' : 'disabled'}>Approve ${cur.key} review</button><button class="btn danger" data-act="reject-step" ${can(cur.role) ? '' : 'disabled'}>Reject</button></div>${roleNote(cur.role)}` : ''}
  ${r.status === 'granted' ? `<div class="row"><button class="btn" data-act="expire-grant">Simulate expiry</button></div>` : ''}
  ${r.precheck ? decisionBox(r.precheck, ' · pre-check on the raw dataset') : ''}`;
}

async function requestAccess() {
  const r = E.newAccessRequest(P, { requester: S.token.claims.sub, dataset: S.newDs, purpose: 'ads_personalization', region: 'US', days: 90, justification: 'Train the place-ad ranker on in-app engagement signals.' });
  S.sel.request = r.id;
  await P.ledger.append('access.requested', S.token.claims.sub, { request: r.id, dataset: r.dataset, purpose: r.purpose });
  go('access');
  await sleep(500);
  const ds = P.dataset(r.dataset);
  const pre = E.decide({ principal: { sub: r.requester }, purpose: r.purpose, dataset: ds, processing_region: 'US', grant: true });
  r.precheck = pre;
  const step = r.steps[0];
  step.state = 'done';
  step.detail = pre.allow ? 'Policy allows the request as asked.' : `Raw data denied (${pre.reasons.map((x) => x.code).join(', ')}). Routed to review with a minimization condition: ads access only through a view with coarse location and no IDFA.`;
  await P.ledger.append('access.precheck', 'policy-service', { request: r.id, allow: pre.allow, reasons: pre.reasons.map((x) => x.code) });
  render(); renderChrome();
}
async function advanceRequest(approve) {
  const r = P.accessRequests.find((x) => x.id === (S.sel.request || P.accessRequests[0].id));
  const cur = r.steps.find((s) => s.state === 'pending');
  if (!cur || !can(cur.role)) return;
  cur.by = E.ROLES[S.role].name;
  if (!approve) { cur.state = 'rejected'; r.status = 'rejected'; await P.ledger.append('access.rejected', S.token.claims.sub, { request: r.id, step: cur.key }); render(); return; }
  cur.state = 'done';
  cur.detail = cur.key === 'privacy' ? 'DPIA reference DPIA-2026-118. Condition: minimized view, US processing only.' : 'Restricted source reviewed. Legitimate interest assessment attached. 90 day limit.';
  await P.ledger.append('access.approved', S.token.claims.sub, { request: r.id, step: cur.key });
  const next = r.steps.find((s) => s.state === 'pending');
  if (next && next.key === 'grant') {
    const view = r.dataset + '_ads';
    if (!P.dataset(view)) P.datasets.push({ id: view, layer: 'features', owner: 'ads-ml', steward: 'Luis Ortega', classification: 'confidential', pii: ['user_id', 'coarse_location'], region: 'US', allowed_purposes: ['ads_personalization', 'model_training'], retention_days: 90, sources: ['maps'], status: 'approved', legal_basis: 'legitimate_interest', bucket: 'lake-us-west', conditions: 'Derived from ' + r.dataset + ': latitude/longitude reduced to geohash-5, IDFA dropped.' });
    const g = { id: 'g-' + (104 + P.grants.length), principal: r.requester, dataset: view, purpose: r.purpose, region: r.region, expires: Date.now() + 864e5 * r.days };
    P.grants.push(g);
    next.state = 'done'; next.detail = `Granted ${view} to ${r.requester}: purpose ${r.purpose}, region ${r.region}, expires ${date(g.expires)}.`;
    r.steps.at(-1).state = 'running'; r.steps.at(-1).detail = 'Timer scheduled for ' + date(g.expires) + '.';
    r.status = 'granted'; r.grant = g.id;
    await P.ledger.append('access.granted', 'workflow', { request: r.id, grant: g.id, dataset: view, expires: date(g.expires) });
    toast(`Access granted with conditions, expires ${date(g.expires)}`);
  }
  render(); renderChrome();
}

/* ── policy studio ── */
let regoSource = '';
fetch('policies/ads.rego').then((r) => r.text()).then((t) => { regoSource = t; if (S.view === 'policy') render(); }).catch(() => {});
function highlightRego(src) {
  return h(src).split('\n').map((l) => l.trim().startsWith('#') ? `<span class="c">${l}</span>` : l.replace(/\b(package|import|default|if|contains|some|in|not|count)\b/g, '<span class="k">$1</span>').replace(/(&quot;[^&]*&quot;)/g, '<span class="s">$1</span>')).join('\n');
}
VIEWS.policy = () => {
  const u = P.userById.get(S.sim.user) || P.users[0];
  const ds = P.dataset(S.sim.dataset);
  const cache = P.cache.get(u.id);
  const input = { principal: { sub: S.sim.principal, roles: ['service'] }, purpose: S.sim.purpose, dataset: ds, processing_region: S.sim.region, grant: S.sim.principal === 'svc-ad-gateway' ? true : P.hasGrant(S.sim.principal, ds.id, S.sim.purpose), user: cache ? P.userInput(u, cache.consent) : null };
  const live = E.decide(input, 'ads-1.4.0'), shadow = E.decide(input, 'ads-1.5.0');
  const opt = (arr, cur) => arr.map((v) => `<option${v === cur ? ' selected' : ''}>${v}</option>`).join('');
  return head('Policy studio', 'Policy as code for every workload. The policy service decides; gateways, the training gate, workflows and the lakehouse enforce. Every decision carries its reasons and bundle version.') + `
  <div class="grid">
    <div class="card c5"><h3>Decision simulator</h3>
      <div class="fields">
        <label class="field">User<select data-bind="sim.user">${userOptions(u.id)}</select></label>
        <label class="field">Principal<select data-bind="sim.principal">${opt(['svc-ad-gateway', 'svc-ads-trainer', 'svc-assistant-trainer', 'maya.chen'], S.sim.principal)}</select></label>
        <label class="field">Dataset<select data-bind="sim.dataset">${opt(P.datasets.map((d) => d.id), S.sim.dataset)}</select></label>
        <label class="field">Purpose<select data-bind="sim.purpose">${opt(E.PURPOSES, S.sim.purpose)}</select></label>
        <label class="field">Processing region<select data-bind="sim.region">${opt(['US', 'EU'], S.sim.region)}</select></label>
      </div>
      <p class="note">Live bundle</p>${decisionBox(live)}
      <p class="note">Shadow bundle</p>${decisionBox(shadow)}${live.allow !== shadow.allow ? '<p class="note"><span class="pill warn">disagree</span> Rolling out 1.5.0 would change this decision.</p>' : ''}
    </div>
    <div class="card c7"><h3>Bundles</h3>
      <table class="table"><tbody><tr><td class="mono">ads-1.4.0</td><td>${pill('live')}</td><td>${E.POLICY_BUNDLES['ads-1.4.0'].rules.length} rules, opa test: 5 passing</td></tr><tr><td class="mono">ads-1.5.0</td><td>${pill('shadow')}</td><td>${E.POLICY_BUNDLES['ads-1.5.0'].rules.length} rules, evaluated alongside live, never enforced</td></tr></tbody></table>
      <h3>Shadow mode diff</h3><p class="note">Evaluate both bundles over every user on the personalization path and show where they would disagree before rollout.</p>
      <div class="row"><button class="btn primary" data-act="shadow">Run shadow comparison</button></div>
      ${S.shadow ? `<p class="note">${fmt(S.shadow.total)} users evaluated in ${S.shadow.ms.toFixed(0)} ms. ${fmt(S.shadow.flips)} decisions would change (${pct(S.shadow.flips, S.shadow.total)}), all allow to deny.</p>${bars(Object.entries(S.shadow.by).sort((a, b) => b[1] - a[1]), 'red')}` : ''}
    </div>
    <div class="card c12"><h3>policies/ads.rego <span class="right">ads-1.4.0</span></h3><pre class="code">${highlightRego(regoSource || 'loading...')}</pre></div>
    <div class="card c12"><h3>Decision log <span class="right">topic policy.decisions</span></h3><div class="scroll-x"><table class="table"><thead><tr><th>Time</th><th>Principal</th><th>Dataset</th><th>Purpose</th><th>User</th><th>Live</th><th>Reasons</th><th>Shadow</th></tr></thead><tbody>
      ${P.decisions.slice(0, 12).map((d) => `<tr><td>${time(d.at)}</td><td class="mono">${h(d.input.principal.sub)}</td><td class="mono">${h(d.input.dataset.id)}</td><td class="mono">${h(d.input.purpose)}</td><td class="mono">${d.input.user ? d.input.user.id : ''}</td><td>${pill(d.decision.allow ? 'allow' : 'deny')}</td><td class="mono">${d.decision.reasons.map((r) => r.code).join(', ')}</td><td>${d.disagree ? pill('warn', 'differs') : ''}</td></tr>`).join('')}
    </tbody></table></div></div>
  </div>`;
};
function runShadow() {
  const t = performance.now(), ds = P.dataset('ad_features_v7');
  let flips = 0; const by = {};
  for (const u of P.users) {
    const c = P.cache.get(u.id); if (!c) continue;
    const input = { principal: { sub: 'svc-ad-gateway' }, purpose: 'ads_personalization', dataset: ds, processing_region: u.eu ? 'EU' : 'US', transfer_basis: null, grant: true, user: P.userInput(u, c.consent) };
    const a = E.decide(input, 'ads-1.4.0'), b = E.decide(input, 'ads-1.5.0');
    if (a.allow !== b.allow) { flips++; for (const r of b.reasons) if (!a.reasons.some((x) => x.code === r.code)) by[r.code] = (by[r.code] || 0) + 1; }
  }
  S.shadow = { total: P.users.length, flips, by, ms: performance.now() - t };
  render();
}

/* ── training gate ── */
VIEWS.training = () => {
  const r = S.train.result;
  const opt = (arr, cur) => arr.map((v) => `<option${v === cur ? ' selected' : ''}>${v}</option>`).join('');
  return head('Training gate', 'Training jobs get a short-lived token scoped to one dataset and one purpose, ask the policy service, then build the training set with a point-in-time join against consent as it was known at the snapshot.') + `
  <div class="grid">
    <div class="card c5"><h3>Launch a training run</h3>
      <div class="fields">
        <label class="field">Principal<select data-bind="train.principal">${opt(['svc-ads-trainer', 'svc-assistant-trainer', 'maya.chen'], S.train.principal)}</select></label>
        <label class="field">Dataset<select data-bind="train.dataset">${opt(P.datasets.map((d) => d.id), S.train.dataset)}</select></label>
        <label class="field">Purpose<select data-bind="train.purpose">${opt(E.PURPOSES, S.train.purpose)}</select></label>
      </div>
      <div class="row"><button class="btn primary" data-act="train" ${can('ml_engineer') ? '' : 'disabled'}>Run training</button></div>${roleNote('ml_engineer')}
      ${r ? `<h3>Token</h3><pre class="code" style="max-height:200px">${h(JSON.stringify(r.token.claims, null, 2))}</pre>` : ''}
    </div>
    <div class="card c7">${r ? trainResult(r) : '<h3>Result</h3><p class="note">Run a job to see the gate decision, exclusions and model card.</p>'}</div>
  </div>`;
};
function trainResult(r) {
  if (!r.ok) return `<h3>Blocked at the gate</h3>${decisionBox(r.gate.decision)}<p class="note">Nothing was read. The denial is in the decision log and the audit ledger.</p>`;
  const m = r.model, ex = Object.entries(m.excluded).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  return `<h3>${E.mname(m)} registered <span class="right">${pill('ok', m.stage)}</span></h3>${decisionBox(r.gate.decision)}
    <dl class="kv"><dt>Snapshot</dt><dd class="mono">${m.trainedOn[0].table}@${m.trainedOn[0].snapshot}</dd><dt>Eligible users</dt><dd>${fmt(m.eligible)}</dd><dt>Included</dt><dd>${fmt(m.members.size)} (${pct(m.members.size, m.eligible)})</dd><dt>AUC</dt><dd>${m.auc}</dd></dl>
    <h3>Excluded by reason</h3>${bars(ex, 'red')}
    <div class="row"><button class="btn" data-go="models">Open model card</button><button class="btn" data-go="lineage">View lineage</button></div>`;
}

/* ── models ── */
VIEWS.models = () => {
  const sel = P.models.find((m) => E.mname(m) === S.sel.model) || P.models.at(-1);
  const card = sel.card || E.modelCard({ ...sel, excluded: {}, eligible: sel.members.size }, P.dataset(sel.trainedOn[0].table), { version: 'ads-1.3.2' });
  return head('Models', 'Registry across workloads with auto-generated model cards. A model trained on data that was later erased is flagged retrain_required.') + `
  <div class="grid">
    <div class="card c5"><table class="table"><thead><tr><th>Model</th><th>Stage</th><th>Status</th><th>Score</th></tr></thead><tbody>
      ${P.models.map((m) => `<tr class="click${m === sel ? ' sel' : ''}" data-model="${E.mname(m)}"><td class="mono">${E.mname(m)}<br><span class="note">${E.WORKLOADS[m.workload].name}</span></td><td>${m.stage}</td><td>${pill(m.status)}</td><td>${m.auc}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="card c7"><h3>Model card <span class="right">${h(card.regulation)}</span></h3>
      <dl class="kv"><dt>Model</dt><dd>${card.model}</dd><dt>Workload</dt><dd>${card.workload}</dd><dt>Intended purpose</dt><dd>${h(card.intended_purpose)}</dd><dt>Out of scope</dt><dd>${card.out_of_scope.map(h).join('<br>')}</dd>
      <dt>Training data</dt><dd>${sel.trainedOn.map((t) => `<code>${t.table}@${t.snapshot}</code>`).join('<br>')}<br>${card.training_data.classification}, ${card.training_data.region}, ${card.training_data.legal_basis}</dd>
      <dt>Governance</dt><dd>Policy ${card.governance.policy_bundle}${card.governance.eligible_users ? `, ${fmt(card.governance.included_users)} of ${fmt(card.governance.eligible_users)} users included` : ''}</dd>
      ${Object.keys(card.governance.exclusions).length ? `<dt>Exclusions</dt><dd>${Object.entries(card.governance.exclusions).filter(([, v]) => v).map(([k, v]) => `${k}: ${fmt(v)}`).join('<br>')}</dd>` : ''}
      <dt>Evaluation</dt><dd>AUC ${card.evaluation.auc}, ${card.evaluation.slice_check}</dd><dt>Lineage</dt><dd class="mono">${card.lineage}</dd><dt>Status</dt><dd>${pill(sel.status)}${sel.status === 'retrain_required' ? ' An erased user was in its training data.' : ''}</dd></dl>
    </div>
  </div>`;
};

/* ── lineage ── */
VIEWS.lineage = () => {
  const hits = S.lineageUser ? P.locate(S.lineageUser) : null;
  return head('Lineage', 'OpenLineage events from every job, with exact Iceberg snapshot IDs. Ask which data trained a model, or where one user\'s data lives.') + `
  <div class="grid">
    <div class="card c12"><div class="row"><label class="field" style="min-width:220px">Find a user<select data-bind="lineageUser"><option value="">None</option>${userOptions(S.lineageUser)}</select></label></div>${lineageSvg(hits)}</div>
    ${hits ? `<div class="card c6"><h3>Locations for ${h(S.lineageUser)}</h3><table class="table"><tbody>${hits.map((x) => `<tr><td>${x.kind}</td><td class="mono">${h(x.name)}</td><td>${x.kind === 'table' ? `${x.snapshots.length} snapshot${x.snapshots.length === 1 ? '' : 's'}${x.live ? '' : ', time travel only'}` : h(x.note || '')}</td></tr>`).join('')}</tbody></table>${hits.length ? '' : '<p class="note">No location holds this user.</p>'}</div>` : ''}
    <div class="card ${hits ? 'c6' : 'c12'}"><h3>Runs</h3>${P.lineageRuns.length ? `<table class="table"><tbody>${P.lineageRuns.map((r) => `<tr><td>${time(r.at)}</td><td class="mono">${r.job}</td><td class="mono">${r.inputs.map((i) => i.dataset + '@' + i.snapshot).join(', ')}</td><td>${r.outputs.map((o) => o.model).join(', ')}</td></tr>`).join('')}</tbody></table>` : '<p class="note">Run a training job to emit a lineage event.</p>'}</div>
  </div>`;
};
function lineageSvg(hits) {
  const hitSet = new Set((hits || []).map((x) => x.name));
  const cols = [
    ['Source', [['ios-collector', 'iOS collector', 'app events'], ['assistant-svc', 'Assistant service', 'conversations']]],
    ['Raw', [['iphone_app_events_raw', 'app events raw', 'lake-us-west'], ['iphone_app_events_raw_eu', 'app events raw EU', 'lake-eu-west'], ['assistant_conversations', 'conversations raw', 'restricted'], ...(P.dataset('iphone_app_events_v2') ? [['iphone_app_events_v2', 'iphone_app_events_v2', P.dataset('iphone_app_events_v2').status]] : [])]],
    ['Cleaned', [['app_events_clean', 'app events clean', 'lake-us-west'], ['app_events_clean_eu', 'app events clean EU', 'lake-eu-west']]],
    ['Features', [['ad_features_v7', 'ad features v7', 'lake-us-west'], ['ad_features_v7_eu', 'ad features v7 EU', 'lake-eu-west'], ['session_metrics_daily', 'session metrics', 'analytics only'], ['assistant_conversations_redacted', 'conversations redacted', 'training only'], ...(P.dataset('iphone_app_events_v2_ads') ? [['iphone_app_events_v2_ads', 'v2 ads view', 'minimized']] : [])]],
    ['Models', P.models.map((m) => [E.mname(m), E.mname(m), m.status + ', ' + m.stage.toLowerCase()])],
    ['Serving', [['gateway', 'serving gateway', 'PEP']]],
  ];
  const edges = [['ios-collector', 'iphone_app_events_raw'], ['ios-collector', 'iphone_app_events_raw_eu'], ['iphone_app_events_raw', 'app_events_clean'], ['iphone_app_events_raw_eu', 'app_events_clean_eu'], ['app_events_clean', 'ad_features_v7'], ['app_events_clean_eu', 'ad_features_v7_eu'], ['app_events_clean', 'session_metrics_daily'], ['ios-collector', 'iphone_app_events_v2'], ['iphone_app_events_v2', 'iphone_app_events_v2_ads'], ['assistant-svc', 'assistant_conversations'], ['assistant_conversations', 'assistant_conversations_redacted']];
  for (const m of P.models) for (const t of m.trainedOn) edges.push([t.table, E.mname(m)]);
  const prod = P.models.filter((m) => m.stage === 'Production');
  for (const m of prod) edges.push([E.mname(m), 'gateway']);
  const W = 1100, colW = W / cols.length, nodeW = 150, nodeH = 40, pos = {};
  let maxRows = Math.max(...cols.map((c) => c[1].length));
  const H = 40 + maxRows * 64;
  let out = '';
  cols.forEach(([label, nodes], ci) => {
    const x = ci * colW + (colW - nodeW) / 2;
    out += `<text class="col-label" x="${x}" y="16">${label}</text>`;
    nodes.forEach(([id], ri) => { pos[id] = { x, y: 34 + ri * 64 }; });
  });
  const live = (id) => hitSet.has(id);
  let paths = '';
  for (const [a, b] of edges) {
    if (!pos[a] || !pos[b]) continue;
    const p = pos[a], q = pos[b], x1 = p.x + nodeW, y1 = p.y + nodeH / 2, x2 = q.x, y2 = q.y + nodeH / 2, mx = (x1 + x2) / 2;
    paths += `<path class="${live(a) && live(b) ? 'hit' : ''}" d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}"/>`;
  }
  let nodes = '';
  cols.forEach(([, ns]) => ns.forEach(([id, name, sub]) => {
    const p = pos[id], model = P.models.find((m) => E.mname(m) === id);
    const cls = hitSet.has(id) ? 'hit' : model && model.status === 'retrain_required' ? 'flag' : '';
    nodes += `<g class="node ${cls}" data-node="${id}" transform="translate(${p.x},${p.y})"><rect width="${nodeW}" height="${nodeH}" rx="10"/><text x="12" y="17">${h(name)}</text><text class="sub" x="12" y="31">${h(sub)}</text></g>`;
  }));
  return `<div class="scroll-x"><svg class="lineage" viewBox="0 0 ${W} ${H}" style="min-width:860px">${paths}${out}${nodes}</svg></div>`;
}

/* ── DSR ── */
VIEWS.dsr = () => {
  const sel = P.dsrs.find((d) => d.idem === S.sel.dsr) || P.dsrs[0];
  const target = S.dsrUser || defaultErasureUser().id;
  return head('Data subject requests', 'Erasure runs as a saga across every system lineage knows about. Steps are idempotent, retried with backoff, and end in a signed evidence pack. GDPR gives one month.') + `
  <div class="grid">
    <div class="card c5"><h3>New erasure request</h3>
      <div class="fields"><label class="field">User<select data-bind="dsrUser">${featuredUsers().concat(P.userById.get(target) ? [P.userById.get(target)] : []).filter((u, i, a) => a.findIndex((x) => x.id === u.id) === i).map((u) => `<option value="${u.id}"${u.id === target ? ' selected' : ''}>${h(userLabel(u))}</option>`).join('')}</select></label></div>
      <div class="row"><button class="btn primary" data-act="erase" ${can('privacy_reviewer', 'legal_reviewer') && !S.sagaRunning ? '' : 'disabled'}>Start erasure</button>${sel && sel.status === 'completed' ? `<button class="btn" data-act="erase-again" ${can('privacy_reviewer', 'legal_reviewer') && !S.sagaRunning ? '' : 'disabled'}>Run again (idempotency)</button>` : ''}</div>${roleNote('privacy_reviewer', 'legal_reviewer')}
      <h3>Requests</h3>${P.dsrs.length ? `<table class="table"><tbody>${P.dsrs.map((d) => `<tr class="click${d === sel ? ' sel' : ''}" data-dsr="${d.idem}"><td class="mono">${d.idem}</td><td>${d.kind}</td><td>${pill(d.status === 'completed' ? 'done' : 'running', d.status)}</td><td>${Math.ceil((d.due - Date.now()) / 864e5)} d left</td></tr>`).join('')}</tbody></table>` : '<p class="note">None yet.</p>'}
    </div>
    <div class="card c7">${sel ? `<h3>Saga ${sel.idem} <span class="right">due ${date(sel.due)}</span></h3>
      <ol class="steps">${sel.steps.map((s) => `<li class="${s.state}"><span class="dot">${s.state === 'done' ? '✓' : s.state === 'noop' ? '=' : ''}</span><div><b>${s.name}</b> <span class="note">${s.sys}</span>${s.detail ? `<p>${h(s.detail)}</p>` : ''}${s.state === 'noop' ? '<p>Already completed for this idempotency key: no work repeated.</p>' : ''}</div><span>${s.attempts > 1 ? pill('warn', s.attempts + ' attempts') : ''}</span></li>`).join('')}</ol>
      ${sel.evidence ? `<h3>Evidence pack</h3><pre class="code" style="max-height:220px">${h(JSON.stringify(sel.evidence, null, 2))}</pre><div class="row"><button class="btn" data-act="evidence">Download evidence JSON</button></div>` : ''}` : '<h3>Saga</h3><p class="note">Start a request to watch each step.</p>'}
    </div>
  </div>`;
};
function defaultErasureUser() { return P.users.find((u) => u.eu && P.models.some((m) => m.members.has(u.id))) || P.users[0]; }
async function erase(again) {
  const uid = again ? (P.dsrs.find((d) => d.idem === S.sel.dsr) || P.dsrs[0]).user : (S.dsrUser || defaultErasureUser().id);
  S.sagaRunning = true;
  S.lineageUser = '';
  const res = await E.runErasure(P, uid, {
    stepDelay: 650,
    onStep: (dsr, step, mode) => { if (mode === 'noop') step.state = 'noop'; S.sel.dsr = dsr.idem; if (S.view === 'dsr') render(); renderChrome(); },
  });
  S.sagaRunning = false;
  S.audit.filter = uid;
  S.dsrUser = null;
  toast(res.rerun ? 'Re-run was a no-op: same idempotency key, nothing repeated' : `Erasure complete for ${uid}, evidence signed`);
  render(); renderChrome();
  return res;
}

/* ── audit ── */
VIEWS.audit = () => {
  if (!can('auditor')) return head('Audit ledger') + `<div class="grid"><div class="card c12 locked"><b>Auditor access only</b>Ledger queries are restricted to the <code>auditor</code> role. Switch account from the top right.</div></div>`;
  const a = S.audit;
  const rows = a.subjectRows || P.ledger.entries.slice(-60).reverse();
  return head('Audit ledger', 'Append-only and hash-chained: each entry commits to the one before it. Merkle roots are written to object-locked storage, so a rewrite of history is provable. User IDs are keyed pseudonyms.') + `
  <div class="grid">
    ${kpi(fmt(P.ledger.entries.length), 'Entries', 'hash chained')}
    ${kpi(a.verify ? (a.verify.ok ? 'Intact' : 'Broken at #' + a.verify.brokenAt) : 'Not run', 'Chain verification', a.verify ? `${fmt(a.verify.checked)} entries checked` : '', a.verify ? (a.verify.ok ? 'good' : 'bad') : '')}
    ${kpi(P.ledger.anchors.length, 'WORM anchors', P.ledger.anchors.length ? 'root ' + P.ledger.anchors.at(-1).root.slice(0, 12) : 'none yet')}
    ${kpi(a.tampered ? '#' + a.tampered.seq : 'None', 'Tampered entry', a.tampered ? 'edited in place' : 'demo control')}
    <div class="card c12"><div class="row between"><div class="row">
      <button class="btn primary" data-act="verify">Verify chain</button>
      <button class="btn" data-act="anchor">Anchor Merkle root</button>
      ${a.tampered ? '<button class="btn" data-act="untamper">Restore entry</button>' : '<button class="btn danger" data-act="tamper">Tamper with an entry</button>'}
      </div><div class="row"><label class="field" style="min-width:220px">Evidence for user<select data-bind="audit.filter"><option value="">All entries</option>${(() => { const ids = new Set([...featuredUsers().map((u) => u.id), ...P.dsrs.map((d) => d.user)]); if (a.filter) ids.add(a.filter); return [...ids].map((id) => `<option${id === a.filter ? ' selected' : ''}>${id}</option>`).join(''); })()}</select></label></div></div>
      ${a.filter ? `<p class="note">Pseudonym ${a.pseudonym || ''}: ${fmt(rows.length)} entries.</p>` : ''}
      <div class="scroll-x"><table class="table"><thead><tr><th>#</th><th>Time</th><th>Type</th><th>Actor</th><th>Subject</th><th>Payload</th><th>Hash</th></tr></thead><tbody>
      ${rows.map((e) => `<tr class="${a.verify && !a.verify.ok && e.seq === a.verify.brokenAt ? 'bad' : ''}"><td class="mono">${e.seq}</td><td>${time(e.ts)}</td><td class="mono">${e.type}</td><td class="mono">${h(e.actor)}</td><td class="mono">${e.subject || ''}</td><td class="mono" style="max-width:360px">${h(JSON.stringify(e.payload))}</td><td class="hash">${e.hash.slice(0, 10)}<br>prev ${e.prev.slice(0, 10)}</td></tr>`).join('')}
      </tbody></table></div>
    </div>
  </div>`;
};
AFTER.audit = async () => {
  const a = S.audit;
  if (a.filter && a.loaded !== a.filter + ':' + P.ledger.entries.length) {
    a.loaded = a.filter + ':' + P.ledger.entries.length;
    a.subjectRows = (await P.ledger.forSubject(a.filter)).slice().reverse();
    a.pseudonym = await E.pseudonymize(a.filter);
    render();
  } else if (!a.filter && a.subjectRows) { a.subjectRows = null; a.loaded = null; render(); }
};

/* ── agent access ── */
VIEWS.agent = () => {
  const a = S.agent, u = P.userById.get(a.user) || P.users[0];
  const dma = S.dma;
  return head('Agent access', 'An assistant acting for a user gets a delegated token through OAuth 2.0 token exchange (RFC 8693). Every tool call carries both identities, goes through policy, and lands in the ledger.') + `
  <div class="grid">
    <div class="card c6"><h3>Delegation</h3>
      <div class="fields"><label class="field">User<select data-bind="agent.user">${userOptions(u.id)}</select></label></div>
      <div class="row"><button class="btn primary" data-act="exchange">Exchange token for the assistant</button></div>
      ${a.agentToken ? `<pre class="code" style="max-height:240px">${h(JSON.stringify(a.agentToken.claims, null, 2))}</pre>
      <div class="row"><button class="btn" data-act="agent-read">Tool: read my ad settings</button><button class="btn" data-act="agent-export">Tool: export my ad history to a partner</button></div>` : ''}
    </div>
    <div class="card c6"><h3>Tool calls</h3>${a.results.length ? a.results.map((r) => `<p class="note" style="margin-top:12px"><b>${h(r.tool)}</b> as <code>${h(r.actor)}</code> for <code>${h(r.sub)}</code></p>${decisionBox(r.decision)}${r.output ? `<pre class="code" style="max-height:140px">${h(r.output)}</pre>` : ''}`).join('') : '<p class="note">Exchange a token, then call a tool.</p>'}</div>
    <div class="card c12"><h3>Cross-service combination (DMA Art. 5(2))</h3><p class="note">An EU user granted personalized ads but not combination across services. The feature set joins maps and news data, so serving must refuse personalization.</p>
      <div class="row"><button class="btn primary" data-act="dma">Evaluate for an EU user</button></div>${dma ? `<p class="note">User <code>${dma.user}</code> (${dma.region}): ads_personalization <b>${dma.consent.ads_personalization}</b>, cross_service_combination <b>${dma.consent.cross_service_combination}</b>.</p>${decisionBox(dma.decision)}` : ''}
    </div>
  </div>`;
};
async function agentExchange() {
  const u = P.userById.get(S.agent.user);
  S.agent.userToken = await E.issueToken({ sub: u.id, scope: 'openid profile consent:read:self ads:history:read:self' }, 900);
  S.agent.agentToken = await E.exchangeToken(S.agent.userToken.claims, 'agent:assistant-7', ['consent:read:self'], Date.now());
  S.agent.results = [];
  await P.ledger.append('token.exchange', 'agent:assistant-7', { user_id: u.id, scope: 'consent:read:self', grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange' });
  render();
}
async function agentCall(kind) {
  const u = P.userById.get(S.agent.user), tok = S.agent.agentToken;
  if (!tok) return;
  const scopes = tok.claims.scope.split(' ');
  const need = kind === 'read' ? 'consent:read:self' : 'ads:history:export';
  const purpose = kind === 'read' ? 'analytics' : 'third_party_sharing';
  const ds = kind === 'read' ? { id: 'consent_records', status: 'approved', allowed_purposes: ['analytics', 'user_assist'], classification: 'confidential', region: u.eu ? 'EU' : 'US', sources: ['maps'] } : P.dataset('app_events_clean');
  const d = E.decide({ principal: { sub: tok.claims.act.sub }, purpose, dataset: ds, processing_region: u.eu ? 'EU' : 'US', grant: scopes.includes(need), user: P.userInput(u, P.consent.snapshot(u.id)) });
  if (!scopes.includes(need)) d.reasons.unshift({ rule: 'token.scope', code: 'insufficient_scope', msg: `Delegated token lacks ${need}.`, cite: 'RFC 8693, RFC 6750' });
  d.allow = d.reasons.length === 0;
  const output = d.allow ? JSON.stringify(P.consent.snapshot(u.id), null, 2) : null;
  S.agent.results.unshift({ tool: kind === 'read' ? 'read_ad_settings' : 'export_ad_history', actor: tok.claims.act.sub, sub: u.id, decision: d, output });
  await P.ledger.append('agent.tool_call', tok.claims.act.sub, { user_id: u.id, tool: kind, allow: d.allow, reasons: d.reasons.map((r) => r.code), on_behalf_of: 'pseudonymized subject' });
  render();
}
async function dmaCheck() {
  const u = P.users.find((x) => x.eu && x.att === 'authorized' && P.cache.get(x.id) && P.cache.get(x.id).consent.ads_personalization === 'granted' && P.cache.get(x.id).consent.cross_service_combination !== 'granted');
  const c = P.cache.get(u.id).consent;
  const rec = await P.evaluate({ principal: { sub: 'svc-ad-gateway' }, purpose: 'ads_personalization', dataset: P.dataset('ad_features_v7'), processing_region: 'EU', transfer_basis: 'SCC-2021', grant: true, user: P.userInput(u, c) });
  S.dma = { user: u.id, region: u.region, consent: c, decision: rec.decision };
  render();
}

/* ── compliance ── */
const MATRIX = [
  ['Lawfulness, consent', 'GDPR Art. 6(1)(a), 7', 'EU opt-in rule; bitemporal consent proves what was known when', 'consent', 'Consent history, decision log'],
  ['Purpose limitation', 'GDPR Art. 5(1)(b)', 'allowed_purposes on every dataset, checked by policy at read time', 'policy', 'policy.decisions with reasons'],
  ['Data minimization', 'GDPR Art. 5(1)(c), 25', 'Restricted data never feeds ads; approvals route to minimized views', 'access', 'Access request workflow history'],
  ['Records of processing', 'GDPR Art. 30', 'Catalog metadata plus lineage of every job', 'catalog', 'Catalog and Marquez export'],
  ['Right of access', 'GDPR Art. 15', 'Lineage lookup of every location holding a user', 'lineage', 'Location report per user'],
  ['Right to erasure', 'GDPR Art. 17', 'Saga: row deletes, snapshot expiry, cache purge, model flags', 'dsr', 'Signed evidence pack'],
  ['International transfers', 'GDPR Art. 44-46', 'Region-partitioned buckets; EU data needs a transfer basis', 'policy', 'Decision log'],
  ['Opt-out of sale or sharing', 'CCPA 1798.120, 1798.135', 'Opt-out and Global Privacy Control enforced at serving', 'serving', 'Serving log with consent offset'],
  ['Cross-service combination', 'DMA Art. 5(2)', 'Combination consent required for multi-source features', 'agent', 'Decision log'],
  ['Data governance for AI', 'EU AI Act Art. 10, 11', 'Point-in-time training sets and generated model cards', 'models', 'Model card, lineage run'],
  ['Accountability', 'GDPR Art. 5(2)', 'Hash-chained ledger with WORM Merkle anchors', 'audit', 'Chain verification report'],
];
VIEWS.compliance = () => head('Compliance matrix', 'Control, the regulation it answers, how the platform implements it, and where the evidence lives. Click a row to open the control.') + `
  <div class="grid"><div class="card c12"><div class="scroll-x"><table class="table"><thead><tr><th>Control</th><th>Regulation</th><th>Implementation</th><th>Evidence</th></tr></thead><tbody>
  ${MATRIX.map(([c, r, i, v, e]) => `<tr class="click" data-go="${v}"><td><b>${c}</b></td><td>${r}</td><td>${i}</td><td>${e}</td></tr>`).join('')}
  </tbody></table></div></div>
  <div class="card c12"><h3>At billions of users</h3><p class="note">Flink for consent streams and Spark for lakehouse jobs; Kafka partitioned by user so consent changes stay ordered per user; OPA or Cedar as sidecars with local bundle caches so decisions stay sub-millisecond; regional cells so EU data never leaves the EU control plane; Iceberg with scheduled compaction and snapshot expiry tied to the erasure SLA; differential privacy on aggregate reporting.</p></div></div>`;

/* ───────────────────────── live traffic ───────────────────────── */

function startTraffic() {
  let bucket = { personalized: 0, contextual: 0, fallback: 0 };
  setInterval(async () => {
    if (!S.traffic) return;
    for (let i = 0; i < 6; i++) {
      const u = P.users[Math.floor(Math.random() * P.users.length)];
      if (!P.userById.has(u.id)) continue;
      const fb = P.serving.fallback;
      const r = await P.serve(u.id);
      bucket[r.mode]++;
      if (P.serving.fallback > fb) bucket.fallback++;
    }
  }, 500);
  setInterval(() => { S.series.push(bucket); if (S.series.length > 120) S.series.shift(); bucket = { personalized: 0, contextual: 0, fallback: 0 }; }, 1000);
  setInterval(() => { P.ledger.anchor(); }, 30000);
}

/* ───────────────────────── events ───────────────────────── */

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-go],[data-act],[data-datatab],[data-datauser],[data-dataset],[data-request],[data-model],[data-serve],[data-dsr],[data-node]');
  if (!t || $('#app').hidden) return;
  if (t.dataset.go) return go(t.dataset.go);
  if (t.dataset.datatab) { S.data.tab = t.dataset.datatab; return render(); }
  if (t.dataset.datauser) { S.data.user = t.dataset.datauser; S.data.tab = 'raw'; return render(); }
  if (t.dataset.dataset) { S.sel.dataset = t.dataset.dataset; return render(); }
  if (t.dataset.request) { S.sel.request = t.dataset.request; return render(); }
  if (t.dataset.model) { S.sel.model = t.dataset.model; return render(); }
  if (t.dataset.serve) { S.sel.serve = +t.dataset.serve; return render(); }
  if (t.dataset.dsr) { S.sel.dsr = t.dataset.dsr; return render(); }
  if (t.dataset.node) { const m = P.models.find((x) => E.mname(x) === t.dataset.node); if (m) { S.sel.model = E.mname(m); return go('models'); } if (P.dataset(t.dataset.node)) { S.sel.dataset = t.dataset.node; return go('catalog'); } return; }
  const act = ACTIONS[t.dataset.act];
  if (act) await act(t);
});
document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.bind) {
    const path = t.dataset.bind.split('.');
    let o = S; for (const k of path.slice(0, -1)) o = o[k];
    o[path.at(-1)] = t.value;
    if (t.dataset.bind === 'consentUser') S.flow = null;
    if (t.dataset.bind === 'agent.user') { S.agent.agentToken = null; S.agent.results = []; }
    if (t.dataset.bind === 'audit.filter') { S.audit.loaded = null; }
    return render();
  }
  if (t.dataset.consent) changeConsent(t.dataset.consent, t.checked);
});
document.addEventListener('input', (e) => { if (e.target.dataset.bind === 'newDs') S.newDs = e.target.value; });

const ACTIONS = {
  chaos: async () => {
    P.policyUp = !P.policyUp;
    if (P.policyUp) P.breaker = { state: 'half-open', failures: 0, openedAt: 0 };
    await P.ledger.append(P.policyUp ? 'chaos.restored' : 'chaos.killed', S.token.claims.sub, { service: 'policy-service' });
    toast(P.policyUp ? 'Policy service restored' : 'Policy service killed. Gateway failing closed.');
    render();
  },
  traffic: () => { S.traffic = !S.traffic; render(); },
  'serve-user': async () => { const r = await P.serve(S.consentUser); S.sel.serve = r.at; toast(`${S.consentUser}: ${r.mode} (${r.why})`); render(); },
  replay: () => {
    const t = Date.now() - 864e5 * 30;
    S.replay = { t, ads: (P.consent.at(S.consentUser, 'ads_personalization', t, t) || {}).status || 'unknown', combo: (P.consent.at(S.consentUser, 'cross_service_combination', t, t) || {}).status || 'unknown' };
    render();
  },
  register: registerDataset,
  'approve-ds': async () => {
    const d = P.dataset(S.sel.dataset); d.status = 'approved';
    await P.ledger.append('catalog.approved', S.token.claims.sub, { dataset: d.id, classification: d.classification, tags: d.pii });
    toast(`${d.id} approved as ${d.classification}`); render(); renderChrome();
  },
  'reject-ds': async () => { const d = P.dataset(S.sel.dataset); d.status = 'rejected'; await P.ledger.append('catalog.rejected', S.token.claims.sub, { dataset: d.id }); render(); },
  'request-access': requestAccess,
  'approve-step': () => advanceRequest(true),
  'reject-step': () => advanceRequest(false),
  'expire-grant': async () => {
    const r = P.accessRequests.find((x) => x.id === (S.sel.request || P.accessRequests[0].id));
    const g = P.grants.find((x) => x.id === r.grant); if (g) g.expires = Date.now() - 1;
    r.steps.at(-1).state = 'done'; r.steps.at(-1).detail = 'Expired and revoked ' + date(Date.now()) + '.'; r.status = 'expired';
    await P.ledger.append('access.revoked', 'workflow', { request: r.id, grant: r.grant, reason: 'expiry' });
    toast('Grant expired and revoked automatically'); render();
  },
  shadow: runShadow,
  train: async () => {
    S.train.result = await P.train({ principal: S.train.principal, datasetId: S.train.dataset, purpose: S.train.purpose });
    if (S.train.result.ok) S.sel.model = E.mname(S.train.result.model);
    render();
  },
  erase: () => erase(false),
  'erase-again': () => erase(true),
  evidence: () => {
    const d = P.dsrs.find((x) => x.idem === S.sel.dsr) || P.dsrs[0];
    const url = URL.createObjectURL(new Blob([JSON.stringify(d.evidence, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = d.idem + '-evidence.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  verify: async () => { S.audit.verify = await P.ledger.verify(); toast(S.audit.verify.ok ? `Chain intact: ${fmt(S.audit.verify.checked)} entries` : `Tampering detected at entry #${S.audit.verify.brokenAt}`); render(); },
  anchor: async () => { const a = await P.ledger.anchor(); toast('Merkle root ' + a.root.slice(0, 12) + ' written to WORM bucket'); render(); },
  tamper: () => {
    const e = P.ledger.entries.find((x) => x.type === 'policy.decision' && x.payload.allow === false) || P.ledger.entries[Math.floor(P.ledger.entries.length / 2)];
    S.audit.tampered = { seq: e.seq, before: JSON.parse(JSON.stringify(e.payload)) };
    e.payload = { ...e.payload, allow: true, reasons: [] };
    S.audit.verify = null;
    toast(`Entry #${e.seq} rewritten: a denial now reads as an allow`); render();
  },
  untamper: () => { const e = P.ledger.entries[S.audit.tampered.seq - 1]; e.payload = S.audit.tampered.before; S.audit.tampered = null; S.audit.verify = null; render(); },
  exchange: agentExchange,
  'agent-read': () => agentCall('read'),
  'agent-export': () => agentCall('export'),
  dma: dmaCheck,
};

/* ── role menu, reset, mobile ── */
$('#btn-role').addEventListener('click', (e) => {
  e.stopPropagation();
  closePop();
  const r = $('#btn-role').getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'popover'; pop.id = 'pop';
  pop.style.top = r.bottom + 6 + 'px'; pop.style.right = Math.max(8, innerWidth - r.right) + 'px';
  pop.innerHTML = Object.entries(E.ROLES).map(([k, x]) => `<button class="${k === S.role ? 'on' : ''}" data-role="${k}"><span class="av">${initials(x.name)}</span><span>${h(x.name)}<small>${h(x.title)}</small></span></button>`).join('') + '<hr><button data-role="__out">Sign out</button><button data-role="__lock">Lock</button>';
  pop.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-role]'); if (!b) return;
    closePop();
    if (b.dataset.role === '__out') { store.del('custodian.role'); return showSignin(); }
    if (b.dataset.role === '__lock') { store.del('custodian.role'); store.del('custodian.gate'); $('#gate-pw').value = ''; return showGate(); }
    signIn(b.dataset.role);
  });
  document.body.appendChild(pop);
});
function closePop() { const p = $('#pop'); if (p) p.remove(); }
document.addEventListener('click', (e) => { if (!e.target.closest('#pop')) closePop(); });
$('#menu-btn').addEventListener('click', () => $('#side').classList.toggle('open'));
$('#btn-reset').addEventListener('click', () => location.reload());

function toast(text) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = text;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3800);
}

/* ───────────────────────── scripted demo ───────────────────────── */

let narr = null, stopAct = false;
function say(n, text) {
  if (!narr) { narr = document.createElement('div'); narr.className = 'narration'; document.body.appendChild(narr); }
  narr.innerHTML = `<span class="act-n">Act ${n}</span><span class="txt">${text}</span><button id="narr-x">${S.act ? 'Stop' : 'Close'}</button>`;
  $('#narr-x').onclick = () => { stopAct = true; narr.remove(); narr = null; };
}
async function as(role) { if (S.role !== role) await signIn(role); }
async function pause(ms) { await sleep(ms); if (stopAct) throw new Error('stopped'); }

const ACTS = [
  ['Overview', 'KPIs and the architecture.', async (n) => {
    await as('sre'); go('overview'); S.traffic = true;
    say(n, 'Live governance state. Zero personalized ads without an allow is the headline SLO.'); await pause(4500);
    $('.view').scrollTo({ top: 9999, behavior: 'smooth' });
    say(n, 'Control, data and evidence planes. Each box opens the component.'); await pause(4000);
    S.data.tab = 'raw'; go('data'); say(n, 'The data itself: a raw event carries an advertising ID and precise location.'); await pause(4500);
    S.data.tab = 'minimized'; render(); say(n, 'The minimized view a model may read: geohash, no IDFA, hourly timestamps.'); await pause(4500);
  }],
  ['Governed onboarding', 'Register iphone_app_events_v2, scan, review, grant with conditions.', async (n) => {
    await as('ml_engineer'); go('catalog'); S.newDs = 'iphone_app_events_v2';
    if (!P.dataset('iphone_app_events_v2')) { say(n, 'The ML engineer registers a new dataset. The scanner runs on schema and samples.'); render(); await pause(1500); await registerDataset(); await pause(2200); }
    await as('data_steward'); S.sel.dataset = 'iphone_app_events_v2'; go('catalog');
    say(n, 'Precise location and IDFA found, so it is restricted. The steward confirms the tags.'); await pause(2600);
    if (P.dataset('iphone_app_events_v2').status === 'pending') await ACTIONS['approve-ds']();
    await pause(1500);
    await as('ml_engineer'); say(n, 'The engineer requests access for ads personalization. The workflow pre-checks policy first.');
    if (!P.accessRequests.some((r) => r.dataset === 'iphone_app_events_v2')) await requestAccess(); else go('access');
    await pause(3200);
    await as('privacy_reviewer'); go('access'); say(n, 'Privacy review: approve with a minimization condition.'); await pause(2200); await advanceRequest(true); await pause(1800);
    await as('legal_reviewer'); go('access'); say(n, 'Restricted source, so legal reviews too. Then the grant: purpose ads, US only, 90 days.'); await pause(2200); await advanceRequest(true); await pause(3000);
  }],
  ['Purpose limitation', 'Training ads on an analytics-only dataset is denied.', async (n) => {
    await as('ml_engineer'); Object.assign(S.train, { principal: 'maya.chen', dataset: 'session_metrics_daily', purpose: 'model_training' }); go('training');
    say(n, 'session_metrics_daily is approved for analytics only. Training on it for ads should fail.'); await pause(2600);
    await ACTIONS.train(); say(n, 'Denied, with the rule, the regulation and the bundle version. Nothing was read.'); await pause(4500);
  }],
  ['Enforced training', 'Consent-filtered point-in-time snapshot, lineage, model card.', async (n) => {
    await as('ml_engineer'); Object.assign(S.train, { principal: 'svc-ads-trainer', dataset: 'ad_features_v7', purpose: 'model_training' }); go('training');
    say(n, 'The trainer service account gets a 15 minute token scoped to one dataset and purpose.'); await pause(2400);
    await ACTIONS.train(); say(n, 'Allowed. Users are excluded by reason using consent as known at the snapshot.'); await pause(4500);
    go('lineage'); say(n, 'Lineage records the exact Iceberg snapshot the model read.'); await pause(3500);
    go('models'); say(n, 'Model card generated on registration: purpose, provenance, exclusions.'); await pause(4000);
  }],
  ['Real-time consent', 'A California user turns on GPC; the next ad is contextual.', async (n) => {
    await as('sre');
    const u = P.users.find((x) => x.region === 'US-CA' && !x.gpc && x.personalizedAdsToggle && x.att === 'authorized' && P.userById.has(x.id));
    S.consentUser = u.id; S.flow = null; go('consent');
    say(n, `${u.id} in California currently gets personalized ads.`); await pause(1500);
    await ACTIONS['serve-user'](); await pause(2000);
    say(n, 'Their browser sends Global Privacy Control. Watch it move from Postgres to Redis.'); await changeConsent('gpc', true); await pause(3500);
    go('serving'); say(n, 'The trace shows the cache read, the policy denial and the contextual model.'); await pause(4500);
  }],
  ['Resilience', 'Kill the policy service; serving fails closed.', async (n) => {
    await as('sre'); go('serving'); S.traffic = true;
    say(n, 'Chaos: kill the policy service.'); await pause(2000);
    if (P.policyUp) await ACTIONS.chaos();
    say(n, 'Fallback spikes, the breaker opens, and personalized-without-allow stays at zero.'); await pause(7000);
    await ACTIONS.chaos(); say(n, 'Restored. The breaker half-opens, then closes, and personalization returns.'); await pause(5000);
  }],
  ['Right to erasure', 'EU user deletion saga with snapshot expiry and evidence.', async (n) => {
    await as('privacy_reviewer'); const u = defaultErasureUser(); S.dsrUser = u.id;
    S.lineageUser = u.id; go('lineage'); say(n, `${u.id} (${u.region}) files an erasure request. Lineage shows everywhere their data lives.`); await pause(4000);
    go('dsr'); say(n, 'The saga runs. Row deletes alone leave the user in old snapshots, so it expires them too.');
    await erase(false); await pause(2500);
    say(n, 'Run it again: same idempotency key, every step is a no-op.'); await erase(true); await pause(3000);
  }],
  ['Audit', 'Every decision for that user, verify the chain, detect tampering.', async (n) => {
    await as('auditor'); go('audit');
    say(n, 'Only the auditor can query the ledger. Filtered to the erased user by pseudonym.'); await pause(3500);
    await ACTIONS.verify(); say(n, 'Chain intact.'); await pause(2500);
    S.audit.filter = ''; S.audit.subjectRows = null; S.audit.loaded = null;
    ACTIONS.tamper(); say(n, 'Someone rewrites a denial as an allow, directly in the database.'); await pause(2500);
    await ACTIONS.verify(); say(n, 'Verification finds the exact entry. The Merkle anchor in WORM storage proves the original.'); await pause(4500);
    ACTIONS.untamper();
  }],
  ['DMA and agents', 'Cross-service combination blocked; a delegated agent allowed once, denied once.', async (n) => {
    await as('privacy_reviewer'); go('agent');
    say(n, 'An EU user who allowed ads but not combining services.'); await dmaCheck(); await pause(4000);
    say(n, 'An assistant gets a delegated token for one scope, through token exchange.'); await agentExchange(); await pause(3000);
    await agentCall('read'); say(n, 'Reading the user\'s own settings: allowed.'); await pause(2500);
    await agentCall('export'); say(n, 'Exporting history to a partner: denied for scope and purpose. Both identities are in the ledger.'); await pause(4500);
  }],
  ['Close', 'Compliance matrix and the at-scale plan.', async (n) => {
    go('compliance'); say(n, 'Every control mapped to its article and its evidence.'); await pause(5000);
  }],
];

function openActs() {
  closeActs();
  const back = document.createElement('div'); back.className = 'sheet-back'; back.id = 'sheet-back'; back.onclick = closeActs;
  const sh = document.createElement('aside'); sh.className = 'sheet'; sh.id = 'sheet';
  sh.innerHTML = `<div class="sheet-head"><h3>Demo</h3><span class="spacer"></span><button class="btn" id="run-all">Run all</button><button class="btn" id="sheet-x">Done</button></div>
    <div class="sheet-body">${ACTS.map(([t, d], i) => `<div class="act${S.actsDone.has(i) ? ' done' : ''}"><span class="n">${S.actsDone.has(i) ? '✓' : i + 1}</span><div><b>${t}</b><p>${d}</p></div><button class="btn" data-run="${i}">Run</button></div>`).join('')}
    <p class="note" style="padding:12px 8px">Acts switch accounts automatically. Reset restores the starting state.</p></div>`;
  document.body.append(back, sh);
  $('#sheet-x').onclick = closeActs;
  $('#run-all').onclick = async () => { closeActs(); for (let i = 0; i < ACTS.length; i++) { if (!(await runAct(i))) break; } };
  sh.addEventListener('click', (e) => { const b = e.target.closest('[data-run]'); if (b) { closeActs(); runAct(+b.dataset.run); } });
}
function closeActs() { ['sheet', 'sheet-back'].forEach((id) => { const x = document.getElementById(id); if (x) x.remove(); }); }
async function runAct(i) {
  if (S.act !== null) return false;
  S.act = i; stopAct = false;
  try { await ACTS[i][2](i + 1); S.actsDone.add(i); return true; }
  catch (e) { if (e.message !== 'stopped') console.error(e); return false; }
  finally { S.act = null; if (narr) { narr.querySelector('button').textContent = 'Close'; } }
}
$('#btn-demo').addEventListener('click', openActs);

/* ───────────────────────── start ───────────────────────── */

(async () => {
  if (store.get('custodian.gate') !== '1') return showGate();
  const role = store.get('custodian.role');
  if (role && E.ROLES[role]) return signIn(role, true);
  showSignin();
})();
