/* Custodian console: renders engine.js state, runs live traffic, and drives the
   scripted demo acts. Plain ES modules, no build step. */
import * as E from './engine.js?v=20261025-1';
import { SAMPLES, sampleKind, MASKED_TAGS, UNMASKED_ROLES, mask } from './samples.js?v=20261025-1';
import { RANGES, history, tsChart, initChartHover, spark } from './charts.js?v=20261023-3';
import { REGULATIONS, WATCH, PATTERNS } from './regulations.js?v=20261023-1';
import * as L from './lineage.js?v=20261025-2';

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
  lineageUser: '', lin: { focus: null, dir: 'both', wl: 'all' }, audit: { filter: '', verify: null, tampered: null },
  agent: { user: null, userToken: null, agentToken: null, results: [] },
  dma: null, actsDone: new Set(), act: null,
  data: { tab: 'users', region: 'all', user: null },
  bulk: new Set(), range: '24h', chaosLog: [], drawer: null, open: new Set(['home']), inspector: true,
};

/* ───────────────────────── boot: gate, sign-in ───────────────────────── */

function showSignin() {
  $('#signin').hidden = false; $('#app').hidden = true;
  $('#who').innerHTML = Object.entries(E.ROLES).map(([k, r]) => `<button data-signin="${k}"><span class="av">${initials(r.name)}</span><span><b>${h(r.name)}</b><span>${h(r.title)} · <code>${k}</code></span></span><i>›</i></button>`).join('');
}
$('#who').addEventListener('click', (e) => { const b = e.target.closest('[data-signin]'); if (b) signIn(b.dataset.signin); });

async function signIn(role, quiet) {
  S.role = role; store.set('custodian.role', role);
  const r = E.ROLES[role];
  S.token = await E.issueToken({ sub: r.name.toLowerCase().replace(' ', '.'), name: r.name, roles: [role], aud: 'custodian-console', amr: ['pwd', 'otp'] }, 900);
  if (P) await P.ledger.append('auth.login', S.token.claims.sub, { role, client: 'custodian-console', flow: 'authorization_code+pkce' });
  if (!quiet) toast(`Signed in as ${r.name}, ${r.title}`);
  $('#signin').hidden = true; $('#app').hidden = false;
  if (!P) await boot();
  renderChrome(); render(); layoutInspector(); drawDrawer();
}

async function boot() {
  P = new E.Platform({ users: 10000 });
  await P.ledger.append('platform.start', 'system', { users: P.users.length, policy: 'core-1.4.0' });
  for (const d of P.datasets) await P.ledger.append('catalog.registered', 'data-steward', { dataset: d.id, classification: d.classification });
  await seedWork();
  P.ledger.listeners.push(() => { if (S.view === 'audit') scheduleRender(); });
  S.consentUser = pickUser((u) => u.region === 'US-CA' && !u.gpc && u.personalizedAdsToggle && u.att === 'authorized' && u.age_band === '18_plus').id;
  S.sim.user = S.consentUser;
  S.agent.user = S.consentUser;
  S.data.user = S.consentUser;
  startTraffic();
}

/* Open work so the console starts mid-day, not empty: a dataset waiting for its
   steward and an access request waiting for privacy review. */
async function seedWork() {
  const scan = E.scanPII([{ name: 'user_id', sample: 'u_000812' }, { name: 'query_text', sample: 'pharmacy open now' }, { name: 'result_rank', sample: '3' }, { name: 'clicked', sample: 'true' }]);
  P.datasets.push({ id: 'search_clicks_v3', layer: 'raw', owner: 'growth-analytics', steward: 'Luis Ortega', classification: scan.classification, pii: scan.tags, region: 'US', allowed_purposes: ['analytics'], retention_days: 90, sources: ['maps'], status: 'pending', legal_basis: 'legitimate_interest', bucket: 'lake-us-west', workload: 'search_quality', scan });
  await P.ledger.append('catalog.registered', 'dev.patel', { dataset: 'search_clicks_v3', classification: scan.classification, proposed_tags: scan.tags });
  const q = E.newAccessRequest(P, { requester: 'dev.patel', dataset: 'assistant_conversations_redacted', purpose: 'model_training', region: 'US', days: 30, justification: 'Evaluate a smaller assistant model on redacted conversations.' });
  q.opened = Date.now() - 864e5 * 2;
  q.precheck = E.decide({ principal: { sub: 'dev.patel' }, purpose: 'model_training', dataset: P.dataset('assistant_conversations_redacted'), processing_region: 'US', grant: true });
  q.steps[0].state = 'done'; q.steps[0].detail = 'Policy allows the request as asked. Routed to privacy review for the grant.';
  await P.ledger.append('access.requested', 'dev.patel', { request: q.id, dataset: q.dataset, purpose: q.purpose });
}

/* ───────────────────────── chrome ───────────────────────── */

const ICON = {
  home: '<path d="M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1h-3.5v-5h-5v5H4a1 1 0 0 1-1-1z"/>',
  data: '<ellipse cx="10" cy="5" rx="6" ry="2.5"/><path d="M4 5v10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V5M4 10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5"/>',
  access: '<circle cx="7" cy="10" r="3.5"/><path d="M10.5 10H17m-2.5 0v3m-2.5-3v2"/>',
  privacy: '<path d="M10 2.5 16 5v4.6c0 3.6-2.5 6.6-6 7.9-3.5-1.3-6-4.3-6-7.9V5z"/><path d="m7.5 10 1.8 1.8L12.8 8"/>',
  models: '<rect x="5" y="5" width="10" height="10" rx="2"/><path d="M8 2.5V5m4-2.5V5M8 15v2.5m4-2.5v2.5M2.5 8H5m-2.5 4H5m10-4h2.5M15 12h2.5"/>',
  ops: '<path d="M2.5 10h3l2-5 3 10 2-5h5"/>',
  trust: '<path d="M10 3v14M5 17h10M3.5 7h13M6 7l-2.5 5a2.5 2.5 0 0 0 5 0zm8 0-2.5 5a2.5 2.5 0 0 0 5 0z"/>',
  settings: '<circle cx="10" cy="10" r="2.5"/><path d="M10 2.5v2m0 11v2m7.5-7.5h-2m-11 0h-2m12.8-5.3-1.4 1.4m-7.8 7.8-1.4 1.4m10.6 0-1.4-1.4M6.1 6.1 4.7 4.7"/>',
  risk: '<path d="M10 3 2.5 16.5h15z"/><path d="M10 8.5v3.5m0 2.2v.1"/>',
  dev: '<path d="m7 6-4 4 4 4m6-8 4 4-4 4M11.5 4l-3 12"/>',
  search: '<circle cx="9" cy="9" r="5.5"/><path d="m13 13 4 4"/>',
  bell: '<path d="M5 8a5 5 0 0 1 10 0c0 4 1.5 5.5 1.5 5.5h-13S5 12 5 8M8 16a2 2 0 0 0 4 0"/>',
};
const icon = (k) => `<svg class="ic" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

const SECTIONS = [
  ['home', 'Home', [['overview', 'Overview']]],
  ['data', 'Data', [['data', 'Explorer'], ['catalog', 'Catalog'], ['pipelines', 'Pipelines'], ['lineage', 'Lineage']]],
  ['access', 'Access', [['access', 'Requests'], ['policy', 'Policies'], ['agent', 'Agents']]],
  ['privacy', 'Privacy', [['consent', 'Consent'], ['dsr', 'Subject requests']]],
  ['models', 'Models', [['lifecycle', 'Lifecycle'], ['models', 'Registry'], ['artifacts', 'Artifacts and endpoints'], ['training', 'Training gate']]],
  ['risk', 'Risk', [['risks', 'Risk register'], ['assessments', 'Assessments'], ['vendors', 'Vendors'], ['incidents', 'Incidents'], ['reports', 'Reports']]],
  ['ops', 'Operations', [['observability', 'Dashboard'], ['serving', 'Serving'], ['services', 'Services'], ['insights', 'Insights'], ['architecture', 'Architecture']]],
  ['dev', 'Developers', [['review', 'Design review'], ['api', 'REST API'], ['sdk', 'SDKs']]],
  ['trust', 'Trust', [['regulations', 'Regulations'], ['compliance', 'Controls'], ['audit', 'Audit ledger']]],
  ['settings', 'Settings', [['org', 'Organization'], ['integrations', 'Integrations'], ['apikeys', 'API keys'], ['residency', 'Data residency']]],
];
const SECTION_OF = Object.fromEntries(SECTIONS.flatMap(([k, , tabs]) => tabs.map(([v]) => [v, k])));
const TITLES = Object.fromEntries(SECTIONS.flatMap(([, , tabs]) => tabs));

function counts() {
  const mine = attention().length;
  return {
    home: mine || '',
    data: P.datasets.filter((d) => d.status === 'pending').length || '',
    access: P.accessRequests.filter((r) => r.status === 'open').length || '',
    privacy: P.dsrs.filter((d) => d.status !== 'completed').length || '',
    models: P.models.filter((m) => m.status === 'retrain_required').length || '',
    ops: !P.policyUp || P.breaker.state !== 'closed' ? '!' : '',
    risk: G.incidents.filter((x) => x.status !== 'Resolved').length ? '!' : (G.assessments.filter((a) => a.status === 'In review').length || ''),
  };
}
function renderChrome() {
  const c = counts(), cur = SECTION_OF[S.view];
  S.open.add(cur);
  const item = ([k, t, tabs]) => {
    const open = S.open.has(k) && tabs.length > 1;
    return `<div class="nav-group${open ? ' open' : ''}"><button class="nav-item${cur === k && (tabs.length === 1 || !open) ? ' on' : ''}${cur === k ? ' cur' : ''}" data-go="${tabs[0][0]}" data-sec="${k}">${tabs.length > 1 ? `<span class="chev" data-toggle="${k}">›</span>` : '<span class="chev"></span>'}${icon(k)}${t}<span class="count${c[k] === '!' ? ' alert' : ''}">${c[k] ?? ''}</span></button>${open ? tabs.map(([v, tt]) => `<button class="nav-sub${S.view === v ? ' on' : ''}" data-go="${v}">${tt}</button>`).join('') : ''}</div>`;
  };
  $('#nav').innerHTML = SECTIONS.filter(([k]) => k !== 'settings').map(item).join('');
  $('#nav-bottom').innerHTML = item(SECTIONS.find(([k]) => k === 'settings'));
  const n = notifications().length;
  $('#btn-bell').innerHTML = icon('bell') + (n ? `<span class="badge">${n}</span>` : '');
  const r = E.ROLES[S.role];
  $('#btn-role').innerHTML = `<span class="av">${initials(r.name)}</span>${h(r.name.split(' ')[0])} <small>${h(r.title)}</small>`;
  const sec = SECTIONS.find(([k]) => k === cur);
  $('#bar-title').innerHTML = sec[2].length > 1 ? `<span class="crumb">${sec[1]}</span><span class="crumb-sep">›</span><span>${TITLES[S.view]}</span>` : `<span>${sec[1]}</span>`;
  const ck = controlChecks(), passing = ck.filter((c) => c[1]).length;
  const critical = !P.policyUp || P.breaker.state !== 'closed' || P.serving.violations > 0;
  $('#side-foot').innerHTML = `<span class="health ${critical ? 'bad' : passing === ck.length ? '' : 'warn'}"></span>${passing} of ${ck.length} controls passing<br>Policy core-1.4.0 · 2 regions<br>Session until ${time(S.token.claims.exp * 1000)}`;
}
function tabsBar() {
  return '';
  const sec = SECTIONS.find(([k]) => k === SECTION_OF[S.view]);
  if (!sec || sec[2].length < 2) return '';
  return `<div class="tabs-wrap"><div class="seg">${sec[2].map(([v, t]) => `<button class="${S.view === v ? 'on' : ''}" data-go="${v}">${t}</button>`).join('')}</div></div>`;
}

function go(view) { if (SECTION_OF[view] !== SECTION_OF[S.view] && S.drawer) { S.drawer = null; drawDrawer(); } if (SECTION_OF[view] !== SECTION_OF[S.view]) S.open = new Set([SECTION_OF[view]]); S.view = view; $('#side').classList.remove('open'); renderChrome(); render(); $('#view').scrollTop = 0; }

/* ───────────────────────── rendering ───────────────────────── */

let renderQueued = false;
function scheduleRender() { if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; render(); }); }
function render() {
  const v = $('#view');
  const st = v.scrollTop;
  const a = document.activeElement, keep = a && a.dataset && a.dataset.filter, caret = keep ? a.selectionStart : 0;
  v.innerHTML = tabsBar() + VIEWS[S.view]();
  v.scrollTop = st;
  if (keep) { const el = v.querySelector(`[data-filter="${keep}"]`); if (el) { el.focus(); el.setSelectionRange(caret, caret); } }
  AFTER[S.view] && AFTER[S.view]();
  layoutInspector();
  if (S.drawer) drawDrawer();
}
const LIVE = new Set(['overview', 'serving', 'insights', 'observability', 'incidents']);
setInterval(() => {
  if (!P || $('#app').hidden) return;
  const a = document.activeElement;
  if (a && $('#view').contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
  if (LIVE.has(S.view) && !document.querySelector('.ts:hover')) render();
  renderChrome();
}, 1000);

const head = (title, sub, how) => `<div class="view-head"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}${how ? `<details class="how"><summary>How it works</summary><p>${how}</p></details>` : ''}</div>`;

/* Human names for the things people see; technical IDs stay one hover or line away. */
const NAMES = {
  iphone_app_events_raw: 'iPhone app events, raw', iphone_app_events_raw_eu: 'iPhone app events, raw (EU)',
  app_events_clean: 'App events, cleaned', app_events_clean_eu: 'App events, cleaned (EU)',
  session_metrics_daily: 'Daily session metrics', ad_features_v7: 'Ad features v7', ad_features_v7_eu: 'Ad features v7 (EU)',
  assistant_conversations: 'Assistant conversations, raw', assistant_conversations_redacted: 'Assistant conversations, redacted',
  search_clicks_v3: 'Search clicks v3', sft_instructions_v3: 'Fine-tuning instructions v3', preference_pairs_v2: 'Human preference pairs v2', eval_safety_suite_v5: 'Safety eval suite v5', iphone_app_events_v2: 'iPhone app events v2', iphone_app_events_v2_ads: 'iPhone app events v2, ads view',
  consent_records: 'Consent records',
  ads_personalization: 'Personalized ads', analytics: 'Analytics', model_training: 'Model training', cross_service_combination: 'Cross-service data use', third_party_sharing: 'Sharing with partners', user_assist: 'Assistant help',
  'dev.patel': 'Dev Patel', 'maya.chen': 'Maya Chen', 'jonas.weber': 'Jonas Weber', 'amara.okafor': 'Amara Okafor', 'luis.ortega': 'Luis Ortega', 'priya.nair': 'Priya Nair', 'henrik.lund': 'Henrik Lund',
  'svc-ads-trainer': 'Ads trainer', 'svc-assistant-trainer': 'Assistant trainer', 'svc-ad-gateway': 'Ad gateway', 'svc-assistant': 'Assistant service', 'svc-model-deployer': 'Release pipeline', 'vendor-labeler': 'Labeling vendor', 'agent:assistant-7': 'Assistant agent',
  'consent-service': 'Consent service', 'dsr-service': 'Privacy requests', 'policy-service': 'Policy engine', 'data-steward': 'Data steward', workflow: 'Workflow engine', system: 'Custodian',
};
const REASONS = {
  att_denied: 'Tracking not allowed', gdpr_no_opt_in: 'No EU opt-in', dma_no_combination_consent: 'No cross-service consent', ccpa_opt_out: 'Opted out of sharing',
  gpc_signal: 'Global Privacy Control', minor_no_profiling: 'Minor or unknown age', purpose_not_permitted: 'Purpose not approved', restricted_for_ads: 'Restricted data',
  eu_transfer_blocked: 'EU data residency', no_active_grant: 'No access grant', dataset_not_approved: 'Dataset not approved', missing_input: 'Missing input, failed closed',
  gdpr_no_training_consent: 'No EU training consent', training_opt_out: 'Opted out of training', consent_unknown: 'Consent unknown', att_denied_ca: 'Tracking denied (CA)',
  insufficient_scope: 'Token scope too narrow', unknown_principal: 'Unknown identity', unknown_endpoint: 'Unknown endpoint', not_registered_consumer: 'Not a registered consumer', region_not_served: 'Region not served', insufficient_clearance: 'Insufficient clearance', external_principal: 'External party', not_deployer: 'Not the release pipeline', eu_artifact_residency: 'EU artifact residency', no_table: 'No table', deleted: 'Erased',
};
const nm = (id) => NAMES[id] || id;
const rsn = (code) => REASONS[code] || code;
const named = (id) => `${h(nm(id))}${NAMES[id] ? `<span class="id">${h(id)}</span>` : ''}`;
const kpi = (v, label, sub, cls = '') => `<div class="card c3 kpi ${cls}"><b>${v}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
const pill = (cls, text) => `<span class="pill ${h(cls)}">${h(text ?? cls)}</span>`;
const bars = (rows, cls = '') => {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return `<div class="bars">${rows.map(([k, v, label]) => `<div class="bar-row"><span title="${h(k)}">${h(k)}</span><div class="track"><div class="fill ${cls}" style="width:${(100 * v / max).toFixed(1)}%"></div></div><span class="v">${label ?? fmt(v)}</span></div>`).join('')}</div>`;
};
const F = {};
const match = (key, ...fields) => { const q = (F[key] || '').trim().toLowerCase(); return !q || fields.some((x) => String(x ?? '').toLowerCase().includes(q)); };
const tools = (key, shown, total, ph) => `<div class="tools"><label class="search">${icon('search')}<input data-filter="${key}" value="${h(F[key] || '')}" placeholder="${h(ph)}"></label><span class="note">${shown === total ? `${fmt(total)} results` : `${fmt(shown)} of ${fmt(total)}`}</span><span class="spacer"></span><button class="btn" data-act="export" data-key="${key}">Export CSV</button></div>`;
const EXPORTS = {};
const pager = (key, pages) => pages < 2 ? '' : `<div class="pager"><button class="btn" data-page="${key}:${(S[key] || 1) - 1}" ${(S[key] || 1) <= 1 ? 'disabled' : ''}>‹ Previous</button><span class="note">Page ${S[key] || 1} of ${pages}</span><button class="btn" data-page="${key}:${(S[key] || 1) + 1}" ${(S[key] || 1) >= pages ? 'disabled' : ''}>Next ›</button></div>`;
function csv(rows) { return rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'); }

const can = (...roles) => roles.includes(S.role);
const roleNote = (...roles) => can(...roles) ? '' : `<p class="note">Only ${roles.map((r) => (E.ROLES[r] ? E.ROLES[r].title.toLowerCase() + 's' : r)).join(' or ')} can do this. You are signed in as ${E.ROLES[S.role].title.toLowerCase()}.</p>`;
const decisionBox = (d, extra = '') => `<div class="decision ${d.allow ? '' : 'deny'}"><h4>${d.allow ? 'Allowed' : 'Denied'}</h4>${d.reasons.length ? `<ul>${d.reasons.map((r) => `<li><b>${h(rsn(r.code))}.</b> ${h(r.msg)} <span class="cite">${h(r.cite)}</span></li>`).join('')}</ul>` : ''}<p class="meta">Bundle <code>${h(d.version)}</code> · evaluated in ${d.latency_ms.toFixed(3)} ms${extra}</p></div>`;

function pickUser(fn) { return P.users.find(fn) || P.users[0]; }
function userLabel(u) { return `${u.id} · ${u.region}`; }
function featuredUsers() {
  const picks = [
    P.users.find((u) => u.region === 'US-CA' && !u.gpc && u.personalizedAdsToggle && u.att === 'authorized' && u.age_band === '18_plus'),
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

/* ── home: what needs me, are controls green, what just happened ── */
function attention() {
  const out = [], r = S.role;
  if (r === 'data_steward') for (const d of P.datasets.filter((x) => x.status === 'pending')) out.push({ t: `Review ${nm(d.id)}`, m: `New dataset from ${nm(d.owner)}. Scanner proposed ${d.classification}.`, go: 'catalog', sel: ['dataset', d.id] });
  for (const q of P.accessRequests.filter((x) => x.status === 'open')) {
    const cur = q.steps.find((s) => s.state === 'pending');
    if (cur && cur.role === r) out.push({ t: `${cur.name}: ${nm(q.dataset)}`, m: `${nm(q.requester)} requests it for ${nm(q.purpose).toLowerCase()}, ${q.days} days. ${q.id}`, go: 'access', sel: ['request', q.id] });
  }
  if (r === 'privacy_reviewer' || r === 'legal_reviewer') for (const d of P.dsrs.filter((x) => x.status !== 'completed')) out.push({ t: `Erasure ${d.idem}`, m: `Due ${date(d.due)}`, go: 'dsr', sel: ['dsr', d.idem] });
  if (r === 'ml_engineer') {
    for (const m of P.models.filter((x) => x.status === 'retrain_required')) out.push({ t: `Retrain ${E.mname(m)}`, m: 'An erased user was in its training data', go: 'models', sel: ['model', E.mname(m)] });
    const ds = P.datasets.find((d) => d.id === S.newDs && d.status === 'approved') && !P.accessRequests.some((q) => q.dataset === S.newDs);
    if (ds) out.push({ t: `Request access to ${nm(S.newDs)}`, m: 'Approved by the steward, no grant yet', go: 'catalog', sel: ['dataset', S.newDs] });
  }
  for (const m of lcRecords()) if (!lcBlocked(m) && m.approvals.some((a) => a.role === r && a.status === 'pending')) out.push({ t: `Sign off ${m.name} ${m.version}`, m: `${m.approvals.find((a) => a.role === r).label}. Evaluations pass.`, go: 'lifecycle', sel: ['lc', m.model] });
  if (r === 'sre' && (!P.policyUp || P.breaker.state !== 'closed')) out.push({ t: 'Policy service degraded', m: 'Gateway is failing closed to non-personalized serving', go: 'serving' });
  if (r === 'auditor' && !(S.audit.verify && S.audit.verify.ok)) out.push({ t: 'Verify the audit chain', m: `${fmt(P.ledger.entries.length)} entries since last verification`, go: 'audit' });
  return out;
}

const ACTIVITY = {
  'auth.login': (e) => `signed in as ${e.payload.role.replace('_', ' ')}`,
  'catalog.registered': (e) => `registered ${nm(e.payload.dataset)} as ${e.payload.classification}`,
  'catalog.approved': (e) => `approved ${nm(e.payload.dataset)}`,
  'catalog.rejected': (e) => `rejected ${e.payload.dataset}`,
  'access.requested': (e) => `requested ${nm(e.payload.dataset)} for ${nm(e.payload.purpose).toLowerCase()}`,
  'access.precheck': (e) => `pre-checked ${e.payload.request}: ${e.payload.allow ? 'allowed' : 'needs review'}`,
  'access.approved': (e) => `approved the ${e.payload.step} review of ${e.payload.request}`,
  'access.rejected': (e) => `rejected ${e.payload.request}`,
  'access.granted': (e) => `granted ${nm(e.payload.dataset)} until ${e.payload.expires}`,
  'access.revoked': (e) => `revoked ${e.payload.grant} at expiry`,
  'policy.decision': (e) => `${e.payload.allow ? 'allowed' : 'denied'} ${nm(e.payload.purpose).toLowerCase()} on ${nm(e.payload.dataset)}${e.payload.reasons.length ? ' (' + e.payload.reasons.map(rsn).join(', ').toLowerCase() + ')' : ''}`,
  'consent.change': (e) => `recorded ${nm(e.payload.purpose).toLowerCase()} ${e.payload.status} (${e.payload.source.replace(/_/g, ' ')})`,
  'model.registered': (e) => `registered ${e.payload.model}`,
  'lineage.impact_notified': (e) => `sent a change notice for ${e.payload.node} to ${e.payload.owners.join(', ')}`,
  'dsr.opened': () => 'opened an erasure request',
  'dsr.step': (e) => `completed erasure step ${e.payload.step}`,
  'dsr.completed': () => 'completed an erasure, evidence signed',
  'dsr.rerun': () => 're-ran an erasure: no-op',
  'chaos.killed': () => 'killed the policy service (chaos)',
  'chaos.restored': () => 'restored the policy service',
  'token.exchange': () => 'received a delegated token',
  'agent.tool_call': (e) => `${e.payload.allow ? 'was allowed' : 'was denied'} tool ${e.payload.tool}`,
  'platform.start': () => 'started the platform',
  'report.generated': (e) => `generated the ${e.payload.report} report`,
  'assessment.signoff': (e) => `signed off ${e.payload.assessment} for ${e.payload.as}`,
  'data.read': (e) => `read sensitive columns in ${nm(e.payload.dataset)}`,
};

function upcomingDeadlines(n) {
  const today = new Date().toISOString().slice(0, 10);
  // Next deadline per law, so one law never fills the list.
  return REGULATIONS.map((r) => { const nx = r.dates.filter(([d]) => d >= today).sort()[0]; return nx && [nx[0], r.name, nx[1]]; }).filter(Boolean).sort().slice(0, n);
}
function lagP95() {
  const lags = P.propagationLags.slice().sort((a, b) => a - b);
  return lags.length ? lags[Math.floor(lags.length * 0.95)] : null;
}
function controlChecks() {
  const p95 = lagP95();
  return [
    ['Every dataset classified and approved', P.datasets.every((d) => d.status !== 'pending'), 'catalog'],
    ['No personalized output without an allow', P.serving.violations === 0, 'serving'],
    ['Policy engine healthy', P.policyUp && P.breaker.state === 'closed', 'serving'],
    ['Consent reaches serving inside 5 s', p95 === null || p95 < 5000, 'consent'],
    ['Subject requests inside SLA', P.dsrs.filter((d) => d.status !== 'completed').every((d) => d.due > Date.now()), 'dsr'],
    ['Audit chain verified this session', !!(S.audit.verify && S.audit.verify.ok), 'audit'],
  ];
}

function ring(f) {
  const r = 22, c = 2 * Math.PI * r, color = f === 1 ? '#34c759' : f >= 0.8 ? '#0071e3' : '#ff9f0a';
  return `<svg class="ring" viewBox="0 0 56 56"><circle cx="28" cy="28" r="${r}" fill="none" style="stroke:var(--fill-2)" stroke-width="6"/><circle cx="28" cy="28" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 28 28)"/><text x="28" y="32" text-anchor="middle">${Math.round(f * 100)}</text></svg>`;
}

VIEWS.overview = () => {
  const r = E.ROLES[S.role], hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const items = attention();
  const p95 = lagP95();
  const openDsr = P.dsrs.filter((d) => d.status !== 'completed');
  const s = P.serving, total = s.personalized + s.contextual;
  const checks = controlChecks();
  const recent = P.ledger.entries.filter((e) => e.type !== 'policy.decision' || e.actor !== 'svc-ad-gateway').slice(-8).reverse();
  return `<div class="hello"><h1>${greet}, ${h(r.name.split(' ')[0])}.</h1><p>${items.length ? `${items.length} item${items.length > 1 ? 's' : ''} need${items.length > 1 ? '' : 's'} you today.` : 'Nothing needs you right now.'}</p></div>
  <div class="grid">
    <div class="card c8"><h3>Needs your attention</h3>${items.length ? `<div class="inbox">${items.map((x) => `<button class="inbox-item" data-go="${x.go}"${x.sel ? ` data-sel="${x.sel[0]}:${h(x.sel[1])}"` : ''}><span><b>${h(x.t)}</b><span>${h(x.m)}</span></span><i>›</i></button>`).join('')}</div>` : `<div class="empty"><b>You're all caught up.</b>Approvals, reviews and incidents for your role appear here.</div>`}
      <h3 class="sub-h">Coming up</h3><ul class="soon">${upcomingDeadlines(3).map(([d, n, w]) => `<li data-go="regulations"><span class="d">${new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span><span><b>${h(n)}</b> ${h(w)}</span></li>`).join('')}</ul></div>
    <div class="card c4"><div class="posture">${ring(checks.filter((c) => c[1]).length / checks.length)}<div><b>${checks.filter((c) => c[1]).length} of ${checks.length} controls passing</b><span>Governance posture, live</span></div></div><ul class="checks">${checks.map(([t, ok, go]) => `<li data-go="${go}"><span class="tick ${ok ? 'ok' : 'no'}">${ok ? '✓' : '!'}</span>${t}</li>`).join('')}</ul></div>
    ${kpi(s.violations, 'Personalized without allow', 'target: exactly zero', s.violations ? 'bad' : 'good')}
    ${kpi(p95 === null ? 'Measuring' : (p95 / 1000).toFixed(1) + ' s', 'Consent propagation p95', 'target: under 5 s')}
    ${kpi(pct(s.personalized, total), 'Requests personalized', `${fmt(total)} served this session`)}
    ${kpi(openDsr.length, 'Open subject requests', openDsr.length ? `next due ${date(Math.min(...openDsr.map((d) => d.due)))}` : 'all closed inside SLA')}
    <div class="card c12"><h3>Governed AI workloads</h3><div class="scroll-x"><table class="table"><thead><tr><th>Workload</th><th>Consent checked per user</th><th>Datasets</th><th>Models</th><th>Owner</th></tr></thead><tbody>${Object.entries(E.WORKLOADS).map(([k, w]) => `<tr><td><b>${w.name}</b></td><td>${nm(w.userPurpose)}</td><td>${P.datasets.filter((d) => d.workload === k).length}</td><td class="mono">${P.models.filter((m) => m.workload === k).map(E.mname).join(', ') || 'none'}</td><td>${w.owner}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card c12"><h3>Recent activity <span class="right"><a href="#" data-go="audit">Audit ledger ›</a></span></h3><ul class="feed">${recent.map((e) => `<li><span class="when">${time(e.ts)}</span><span><b>${h(nm(e.actor))}</b> ${h((ACTIVITY[e.type] || ((x) => x.type))(e))}</span></li>`).join('')}</ul></div>
  </div>`;
};

VIEWS.insights = () => {
  const reasons = {};
  for (const d of P.decisions) for (const r of d.decision.reasons) reasons[r.code] = (reasons[r.code] || 0) + 1;
  const byRegion = {};
  for (const u of P.users) { const c = P.cache.get(u.id); if (!c) continue; const b = byRegion[u.region] || (byRegion[u.region] = [0, 0]); b[1]++; if (c.consent.ads_personalization !== 'granted') b[0]++; }
  const lat = P.decisions.map((d) => d.decision.latency_ms).sort((a, b) => a - b);
  const p99 = lat.length ? lat[Math.floor(lat.length * 0.99)] : 0;
  return head('Insights', 'Why requests are denied and where people opt out.', 'Aggregates over the policy.decisions topic and the serving consent cache. No per-user data is shown.') + `
  <div class="grid">
    ${kpi(p99.toFixed(3) + ' ms', 'Policy decision p99', 'in-process, target under 10 ms')}
    ${kpi(fmt(P.decisions.length), 'Decisions sampled', 'topic policy.decisions')}
    ${kpi(fmt(P.ledger.entries.length), 'Audit entries', 'hash chained')}
    ${kpi(P.ledger.anchors.length, 'WORM anchors', 'Merkle roots written')}
    <div class="card c6"><h3>Denials by reason <span class="right">last ${P.decisions.length} decisions</span></h3>${bars(Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => [rsn(k), v]), 'red')}</div>
    <div class="card c6"><h3>Opted out of personalization <span class="right">by region</span></h3>${bars(Object.entries(byRegion).sort().map(([k, [o, n]]) => [k, o / n * 100, (o / n * 100).toFixed(0) + '%']))}</div>
  </div>`;
};

VIEWS.architecture = () => head('Architecture', 'Three planes every AI workload plugs into. Select a box to open it.', 'In this hosted environment each component runs in the browser. Production mapping: Keycloak, OPA, Postgres with outbox, Redpanda, Redis, Temporal, Iceberg on S3, Marquez, MLflow, S3 Object Lock. See docs/DESIGN.md.') + `
  <div class="grid"><div class="card c12">${archDiagram()}</div></div>`;

function liveChart() {
  const pts = S.series.slice(-60);
  if (pts.length < 2) return '<p class="note" style="height:180px">Collecting live traffic...</p>';
  const now = Date.now(), at = (i) => now - (pts.length - 1 - i) * 1000;
  return tsChart([
    { name: 'Personalized', color: '#0071e3', points: pts.map((p, i) => [at(i), p.personalized]) },
    { name: 'Non-personalized', color: '#8e8e93', points: pts.map((p, i) => [at(i), p.contextual]) },
    { name: 'Fail-closed fallback', color: '#ff3b30', points: pts.map((p, i) => [at(i), p.fallback]) },
  ], { range: 'live', fmt: (v) => String(Math.round(v)) });
}
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
  return head('Serving', 'Personalization happens only with an explicit allow. Anything else gets a non-personalized result.', 'Every request reads consent from the Redis cache and asks the policy engine. Deny, unknown, or an unavailable policy engine all route to a model that sees only the request, never history. A circuit breaker fails closed.') + `
  <div class="grid">
    ${kpi(fmt(rps), 'Requests per second', 'sampled stream')}
    ${kpi((fr * 100).toFixed(1) + '%', 'Fail-closed fallback rate', 'policy unavailable or circuit open', fr > 0 ? 'bad' : '')}
    ${kpi(s.violations, 'Personalized without allow', `of ${fmt(total)} served`, s.violations ? 'bad' : 'good')}
    ${kpi(P.policyUp ? (P.breaker.state === 'open' ? 'Open' : 'Closed') : 'Down', 'Policy service, circuit', P.policyUp ? `breaker ${P.breaker.state}` : 'killed by chaos', P.policyUp && P.breaker.state === 'closed' ? 'good' : 'bad')}
    <div class="card c8"><h3>Serving mix <span class="right">requests per second, last 60 s</span></h3>${liveChart()}</div>
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
  return head('Consent', 'What each person has agreed to, and proof that every change reaches serving within seconds.', 'Consent is stored bitemporally in Postgres (when it applied, and when we learned it), published through a transactional outbox to the consent.events topic, and applied to the Redis cache every gateway reads.') + `
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
      ${E.PURPOSES.map((p) => `<tr><td>${named(p)}</td><td>${pill(truth[p])}</td><td>${cache ? pill(cache.consent[p]) : pill('deny', 'purged')}${cache && cache.consent[p] !== truth[p] ? ' <span class="pill warn">propagating</span>' : ''}</td></tr>`).join('')}
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
  S.flow.msg = msgs.filter((m) => m.key === u.id).at(-1) || P.bus.filter((m) => m.key === u.id).at(-1); S.flow.t.bus = Date.now(); S.flow.lit.push('bus'); render();
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
EXPORTS.users = () => [['user_id', 'region', 'att', 'personalized_ads', 'gpc', 'age_band', 'services', 'ads_personalization', 'model_training'], ...P.users.filter((x) => match('users', x.id, x.region, x.att, x.age_band)).map((x) => { const c = P.cache.get(x.id); return [x.id, x.region, x.att, x.personalizedAdsToggle, x.gpc, x.age_band, x.services.join(' '), c && c.consent.ads_personalization, c && c.consent.model_training]; })];
function peopleView() {
  const d = S.data;
  const u = P.userById.get(d.user) || P.users[0];
  const tabs = [['users', 'Users'], ['raw', 'Raw events'], ['minimized', 'Minimized view'], ['consent', 'Consent records'], ['snapshots', 'Iceberg snapshots']];
  const regions = ['all', ...new Set(P.users.map((x) => x.region))].sort();
  let body = '';
  if (d.tab === 'users') {
    const pool = P.users.filter((x) => (d.region === 'all' || x.region === d.region) && match('users', x.id, x.region, x.att, x.age_band));
    const list = pool.slice(0, 40);
    body = `<div class="row"><label class="field" style="min-width:160px">Region<select data-bind="data.region">${regions.map((r) => `<option${r === d.region ? ' selected' : ''}>${r}</option>`).join('')}</select></label><span class="note" style="margin:0">Select a person to see their rows in the other tabs.</span></div>${tools('users', pool.length, P.users.length, 'Search user ID, region, age range')}
    <div class="scroll-x"><table class="table"><thead><tr><th>user_id</th><th>Region</th><th>Law</th><th>ATT</th><th>Personalized ads</th><th>GPC</th><th>Age range</th><th>Services</th><th>ads_personalization</th><th>model_training</th><th>Events</th></tr></thead><tbody>
    ${list.map((x) => { const c = P.cache.get(x.id); return `<tr class="click${x.id === u.id ? ' sel' : ''}" data-datauser="${x.id}"><td class="mono">${x.id}</td><td>${x.region}</td><td>${E.regionInfo(x.region).law}</td><td>${x.att}</td><td>${x.personalizedAdsToggle ? 'on' : 'off'}</td><td>${x.gpc ? 'sent' : ''}</td><td>${x.age_band.replace('_', ' to ').replace('18 to plus', '18+').replace('under to 13', 'under 13')}</td><td>${x.services.join(', ')}</td><td>${c ? pill(c.consent.ads_personalization) : ''}</td><td>${c ? pill(c.consent.model_training) : ''}</td><td>${fmt(x.events)}</td></tr>`; }).join('')}
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
  return `
  <div class="grid"><div class="card c12">
    <div class="row between"><div class="seg">${tabs.map(([k, t]) => `<button class="${d.tab === k ? 'on' : ''}" data-datatab="${k}">${t}</button>`).join('')}</div>
    <label class="field" style="min-width:200px">User<select data-bind="data.user">${[u, ...featuredUsers()].filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i).map((x) => `<option value="${x.id}"${x.id === u.id ? ' selected' : ''}>${h(userLabel(x))}</option>`).join('')}</select></label></div>
    ${body}
  </div></div>`;
};

/* ── data explorer: dataset gallery and viewer, or one person's data ── */
const LAYER = { raw: 'Raw', cleaned: 'Cleaned', features: 'Features', 'post-training': 'Post-training' };
function rowEstimate(d) {
  const t = P.tables[d.id];
  if (!t) return d.layer === 'features' ? 12000 : 48000;
  return t.current.members.size * (d.layer === 'features' ? 1 : 186);
}
const compact = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n);

function datasetSample(d) {
  const k = SAMPLES[sampleKind(d.id)];
  const unmasked = UNMASKED_ROLES.has(S.role);
  const masked = k.cols.filter((c) => MASKED_TAGS.has(c.pii) && !unmasked);
  const rows = k.rows(P, d);
  return { cols: k.cols, rows, masked, view: rows.map((r) => r.map((v, i) => (MASKED_TAGS.has(k.cols[i].pii) && !unmasked ? mask(v, k.cols[i].pii) : v))) };
}

VIEWS.data = () => {
  const mode = S.data.mode || 'datasets';
  const sw = `<div class="seg">${[['datasets', 'Datasets'], ['people', 'People']].map(([k, t]) => `<button class="${mode === k ? 'on' : ''}" data-datamode="${k}">${t}</button>`).join('')}</div>`;
  const hd = head('Data explorer', 'Open any dataset to see its rows, schema and governance, or follow one person across every system.', 'Rows are generated from the 10,000 synthetic people, never real data. Columns tagged as sensitive are masked unless your role is allowed to see them (dynamic masking, enforced at read time).');
  if (mode === 'people') return hd + `<div class="tabs-wrap">${sw}</div>` + peopleView();
  const ds = S.data.ds && P.dataset(S.data.ds);
  if (ds) return hd + `<div class="tabs-wrap">${sw}</div>` + datasetViewer(ds);
  const list = P.datasets.filter((d) => match('gallery', d.id, nm(d.id), d.classification, d.workload && E.WORKLOADS[d.workload].name));
  return hd + `<div class="tabs-wrap">${sw}</div>` + `<div class="grid"><div class="card c12">${tools('gallery', list.length, P.datasets.length, 'Search datasets')}
    <div class="gallery">${list.map((d) => `<button class="ds-card${S.drawer && S.drawer.id === d.id ? ' on' : ''}" data-drawer="dataset:${d.id}" data-dblopen="${d.id}" title="Double-click to open">
      <div class="row between"><span class="ds-layer">${LAYER[d.layer] || d.layer} · ${d.region}</span>${pill(d.classification)}</div>
      <b>${h(nm(d.id))}</b><span class="id">${h(d.id)}</span>
      <p>${d.workload ? E.WORKLOADS[d.workload].name : 'Shared across workloads'}</p>
      <div class="ds-foot"><span>${compact(rowEstimate(d))} rows</span><span>${SAMPLES[sampleKind(d.id)].cols.length} columns</span><span>${d.status === 'approved' ? 'Readable' : pill('pending', 'Pending')}</span></div>
    </button>`).join('')}</div></div></div>`;
};

function datasetViewer(d) {
  const smp = datasetSample(d), t = P.tables[d.id], role = E.ROLES[S.role];
  const blocked = d.status !== 'approved';
  return `<div class="grid">
    <div class="card c12">
      <div class="row between"><button class="btn" data-opends="">‹ All datasets</button><div class="row"><button class="btn" data-go="catalog" data-sel="dataset:${d.id}">Open in catalog</button><button class="btn" data-lnode-go="${d.id}">Lineage</button><button class="btn" data-act="export" data-key="sample">Export sample</button></div></div>
      <div class="ds-head"><div><h2>${h(nm(d.id))}</h2><span class="id">${h(d.id)}</span></div><div class="tags">${pill(d.classification)}${pill('blue', d.region)}${pill(d.status)}</div></div>
      <dl class="ds-meta"><div><dt>Rows</dt><dd>${compact(rowEstimate(d))}</dd></div><div><dt>Owner</dt><dd>${h(d.owner)}</dd></div><div><dt>Steward</dt><dd>${h(d.steward)}</dd></div><div><dt>Allowed for</dt><dd>${d.allowed_purposes.map(nm).join(', ')}</dd></div><div><dt>Retention</dt><dd>${d.retention_days} days</dd></div><div><dt>Location</dt><dd class="mono">s3://${d.bucket}</dd></div>${t ? `<div><dt>Snapshot</dt><dd class="mono">${t.current.id}</dd></div>` : ''}</dl>
    </div>
    <div class="card c12">
      <h3>Sample rows <span class="right">${smp.rows.length} of ${compact(rowEstimate(d))}</span></h3>
      ${blocked ? `<div class="decision deny"><h4>Not readable yet</h4><ul><li>This dataset is pending steward approval. No job or person can read it until it is approved.</li></ul></div>` : `
      ${smp.masked.length ? `<div class="mask-note">${icon('privacy')}<span><b>${smp.masked.length} column${smp.masked.length > 1 ? 's' : ''} masked for ${h(role.title)}s:</b> ${smp.masked.map((c) => c.name).join(', ')}. Data stewards and privacy reviewers see values; every unmasked read is audited.</span></div>` : UNMASKED_ROLES.has(S.role) && smp.cols.some((c) => MASKED_TAGS.has(c.pii)) ? `<div class="mask-note open">${icon('privacy')}<span><b>Unmasked view.</b> Your role can see sensitive columns. This read is recorded in the audit ledger.</span></div>` : ''}
      <div class="scroll-x"><table class="table data-table"><thead><tr>${smp.cols.map((c) => `<th>${c.name}<span class="ctype">${c.type}${c.pii ? ` · <em class="${MASKED_TAGS.has(c.pii) ? 'hot' : ''}">${c.pii}</em>` : ''}</span></th>`).join('')}</tr></thead><tbody>
        ${smp.view.map((r) => `<tr>${r.map((v, i) => `<td class="${/message|query_text/.test(smp.cols[i].name) ? 'text' : 'mono'}${MASKED_TAGS.has(smp.cols[i].pii) && !UNMASKED_ROLES.has(S.role) ? ' masked' : ''}">${h(v === true ? 'true' : v === false ? 'false' : v)}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>`}
    </div>
  </div>`;
}
EXPORTS.gallery = () => [['dataset', 'name', 'layer', 'region', 'classification', 'workload', 'rows_estimate', 'status'], ...P.datasets.map((d) => [d.id, nm(d.id), d.layer, d.region, d.classification, d.workload || 'shared', rowEstimate(d), d.status])];
EXPORTS.sample = () => { const d = P.dataset(S.data.ds); const smp = datasetSample(d); return [smp.cols.map((c) => c.name), ...smp.view]; };

/* ── ML lifecycle: training and post-training, gated at every stage ── */
/* ── model governance records: lifecycle, evaluations, approvals, provenance ── */
const LC_STATE = { done: ['ok', 'Passed'], live: ['live', 'Live'], running: ['warn', 'In review'], blocked: ['deny', 'Blocked'], waiting: ['', 'Waiting'] };
const LC_FILTERS = { all: ['All', () => true], prod: ['Production', (m) => m.stage === 'Production'], progress: ['In progress', (m) => ['Evaluation', 'Staging', 'Review', 'Ready'].includes(m.stage)], blocked: ['Blocked', (m) => m.stages.some((x) => x.status === 'blocked')] };
const lcHealth = (m) => (m.stages.some((x) => x.status === 'blocked') ? 'deny' : m.stages.some((x) => x.status === 'running' || x.status === 'waiting') || m.stage === 'Ready' ? 'warn' : 'ok');

/* [check, kind, threshold, result, state]: state is pass, fail or scheduled. */
const EVALS = {
  'assistant-llm': [['Helpfulness win rate', 'quality', '≥ 55%', '61.3%', 'pass'], ['Refusal accuracy', 'safety', '≥ 95%', '97.4%', 'pass'], ['PII extraction rate', 'privacy', '≤ 0.01%', '0.00%', 'pass'], ['Canary exposure', 'privacy', '≤ 1 of 200', '0 of 200', 'pass'], ['Toxic output rate', 'safety', '≤ 0.5%', '0.21%', 'pass'], ['Quality gap across languages', 'fairness', '≤ 3 pts', '1.8 pts', 'pass']],
  adrank: [['AUC', 'quality', '≥ 0.770', '0.781', 'pass'], ['AUC gap across regions', 'fairness', '≤ 0.010', '0.008', 'pass'], ['Privacy budget (epsilon)', 'privacy', '≤ 4.0', '3.6', 'pass'], ['Personalized without an allow', 'privacy', '= 0', '0', 'pass'], ['Profiling of minors', 'privacy', '= 0', '0', 'pass']],
  'assistant-llm-v2': [['Helpfulness win rate', 'quality', '≥ 55%', '64.0%', 'pass'], ['Refusal accuracy', 'safety', '≥ 95%', '96.8%', 'pass'], ['PII extraction rate', 'privacy', '≤ 0.01%', '0.04%', 'fail'], ['Canary exposure', 'privacy', '≤ 1 of 200', '3 of 200', 'fail'], ['Toxic output rate', 'safety', '≤ 0.5%', '0.18%', 'pass'], ['Quality gap across languages', 'fairness', '≤ 3 pts', '2.2 pts', 'pass']],
  'search-ranker': [['NDCG@10', 'quality', '≥ 0.600', '0.612', 'pass'], ['Gap across regions', 'fairness', '≤ 0.010', '0.006', 'pass'], ['Smallest cell in training data', 'privacy', '≥ 50 users', '50', 'pass'], ['Per-user features at inference', 'privacy', '= 0', '0', 'pass']],
  'keyboard-next-word': [['Top-3 accuracy', 'quality', '≥ 40%', '41.2%', 'pass'], ['Privacy budget (epsilon)', 'privacy', '≤ 2.0', '1.9', 'pass'], ['Rare phrase memorization', 'privacy', '= 0', '0', 'pass'], ['Text leaving device', 'privacy', '= 0 bytes', '0 bytes', 'pass']],
  'speech-asr': [['Word error rate', 'quality', '≤ 5.5%', '4.8%', 'pass'], ['Gap across accents', 'fairness', '≤ 2 pts', '1.6 pts', 'pass'], ['Server audio retention', 'privacy', '= 0 days', '0 days', 'pass']],
  'spam-filter': [['Precision', 'quality', '≥ 99%', '99.2%', 'pass'], ['False positive rate', 'quality', '≤ 0.1%', '0.06%', 'pass'], ['Message content stored', 'privacy', 'reported only', 'reported only', 'pass']],
  'fraud-score': [['AUC', 'quality', '≥ 0.930', '0.947', 'pass'], ['Decline rate parity', 'fairness', '≥ 0.95', '0.98', 'pass'], ['Human review of declines', 'oversight', '100%', '100%', 'pass'], ['Card numbers in features', 'privacy', 'tokenized only', 'tokenized only', 'pass']],
  'photo-scenes': [['Top-1 accuracy', 'quality', '≥ 90%', '91.4%', 'pass'], ['Gap across skin tones', 'fairness', '≤ 2 pts', '1.1 pts', 'pass'], ['User photos in training', 'privacy', '= 0', '0', 'pass']],
  'eta-predictor': [['Mean absolute % error', 'quality', '≤ 9%', '7.8%', 'pass'], ['Unique routes in training data', 'privacy', '= 0', '0', 'pass']],
  'support-triage': [['Routing accuracy', 'quality', '≥ 90%', 'after fine-tuning', 'scheduled'], ['PII extraction rate', 'privacy', '≤ 0.01%', 'after fine-tuning', 'scheduled'], ['Customer names in outputs', 'privacy', '= 0', 'after fine-tuning', 'scheduled']],
  'resume-screener': [['Conformity assessment', 'oversight', 'required', 'not started', 'fail'], ['Human oversight design', 'oversight', 'required', 'not started', 'fail'], ['Bias audit by protected group', 'fairness', 'required', 'not started', 'fail']],
};
const APPROVERS = [['ml_engineer', 'Model owner'], ['data_steward', 'Training data provenance'], ['privacy_reviewer', 'Privacy review'], ['legal_reviewer', 'Legal review'], ['sre', 'Serving readiness']];
const PENDING = { 'assistant-llm-v2': ['privacy_reviewer', 'legal_reviewer', 'sre'], 'fraud-score': ['legal_reviewer'], 'support-triage': ['privacy_reviewer', 'legal_reviewer', 'sre', 'data_steward'], 'resume-screener': APPROVERS.map(([r]) => r) };
let LC = null;
function lcRecords() {
  if (LC && LC.p === P) return LC.list;
  const list = E.lifecycle(P).map((m) => {
    const pend = PENDING[m.model] || [];
    const base = Date.parse(m.updated);
    return { ...m, stages: m.stages.map((x) => ({ ...x })), evals: (EVALS[m.model] || []).map((x) => [...x]),
      approvals: APPROVERS.map(([role, label], i) => ({ role, label, who: E.ROLES[role].name, status: m.model === 'resume-screener' ? 'na' : m.model === 'support-triage' && role !== 'ml_engineer' && role !== 'privacy_reviewer' ? 'waiting' : pend.includes(role) ? 'pending' : 'approved', at: base - (5 - i) * 36e5 * 7 })) };
  });
  LC = { p: P, list };
  return list;
}
const lcBlocked = (m) => m.evals.some((x) => x[4] === 'fail') || m.stages.some((x) => x.status === 'blocked');
const hex = (s, n) => { let o = ''; for (let i = 0; o.length < n; i++) o += strHash(s + i).toString(16).padStart(8, '0'); return o.slice(0, n); };

VIEWS.lifecycle = () => {
  const lc = lcRecords();
  if (S.sel.lc) { S.lcModel = S.sel.lc; S.sel.lc = null; S.lcTab = 'lifecycle'; }
  const list = lc.filter(LC_FILTERS[S.lcFilter || 'all'][1]).filter((m) => match('lifecycle', m.name, m.model, m.owner, m.stage, m.risk, m.method));
  const cur = lc.find((x) => x.model === (S.lcModel || 'assistant-llm')) || lc[0];
  const tab = S.lcTab || 'lifecycle';
  const pendingMine = lc.filter((m) => m.approvals.some((a) => a.role === S.role && a.status === 'pending')).length;
  return head('Model governance', 'Every governed model and its release record: the gate at each stage, evaluations against thresholds, sign-offs by role, and signed provenance.', 'Each stage emits OpenLineage events with its inputs (dataset and snapshot), the policy bundle version that allowed it, and its output artifact. A failed gate stops the model at that stage. Release needs every sign-off, a generated model card and signed weights. High-risk uses under the EU AI Act stop at intake until a conformity assessment exists. Every action here lands in the audit ledger.') + `
  <div class="grid">
    ${kpi(lc.length, 'Governed models', `${lc.filter((m) => m.stage === 'Production').length} in production`)}
    ${kpi(lc.filter(LC_FILTERS.progress[1]).length, 'In progress', 'evaluation, staging or review')}
    ${kpi(lc.filter((m) => m.stages.some((x) => x.status === 'blocked')).length, 'Stopped at a gate', 'failed evaluation or intake', lc.some((m) => m.stages.some((x) => x.status === 'blocked')) ? 'bad' : 'good')}
    ${kpi(pendingMine, 'Waiting on you', `sign-offs for ${E.ROLES[S.role].title.toLowerCase()}`, pendingMine ? 'warn' : '')}
    <div class="card c12 lcm">
      <div class="lcm-list">
        <div class="seg">${Object.entries(LC_FILTERS).map(([k, [t, f]]) => `<button class="${(S.lcFilter || 'all') === k ? 'on' : ''}" data-lcfilter="${k}">${t} <span class="cnt">${lc.filter(f).length}</span></button>`).join('')}</div>
        <label class="search">${icon('search')}<input data-filter="lifecycle" value="${h(F.lifecycle || '')}" placeholder="Search models"></label>
        <div class="lcm-rows">${list.map((m) => `<button class="lcm-row${m === cur ? ' on' : ''}" data-lcmodel="${m.model}"><i class="dot ${lcHealth(m)}"></i><span><b>${h(m.name)}</b><small>${h(m.version)} · ${h(m.owner)}</small></span><em>${h(m.stage)}</em></button>`).join('') || '<p class="note">No models match.</p>'}</div>
      </div>
      <div class="lcm-detail">${lcDetail(cur, tab)}</div>
    </div>
  </div>`;
};

function lcDetail(m, tab) {
  const passed = m.stages.filter((x) => x.status === 'done' || x.status === 'live').length;
  const fails = m.evals.filter((x) => x[4] === 'fail').length;
  const appr = m.approvals.filter((a) => a.status === 'approved').length;
  const mine = m.approvals.find((a) => a.role === S.role && a.status === 'pending');
  const ready = m.stage === 'Ready';
  let banner = '';
  if (m.risk === 'High' && m.stages[0].status === 'blocked') banner = `<div class="lcm-banner deny"><b>Stopped at intake.</b> This use is high risk under the EU AI Act (Annex III). It needs a conformity assessment, a human oversight design and a bias audit before any data is used.<div class="row"><button class="btn" data-go="assessments">Open assessments</button></div></div>`;
  else if (fails) banner = `<div class="lcm-banner deny"><b>${fails} evaluation${fails > 1 ? 's' : ''} failed.</b> Sign-offs are locked until every check passes.${m.model === 'assistant-llm-v2' ? `<div class="row"><button class="btn primary" data-act="lc-remediate" ${can('ml_engineer') ? '' : 'disabled'}>Remove duplicates and re-run evaluation</button></div>${roleNote('ml_engineer')}` : ''}</div>`;
  else if (mine) banner = `<div class="lcm-banner warn"><b>Your sign-off is needed: ${h(mine.label.toLowerCase())}.</b> ${m.evals.some((x) => x[4] === 'scheduled') ? 'Approving the impact assessment lets fine-tuning start.' : 'Evaluations pass and provenance is signed.'}<div class="row"><button class="btn primary" data-act="lc-approve">Approve as ${h(E.ROLES[S.role].name)}</button><button class="btn" data-act="lc-changes">Request changes</button></div></div>`;
  else if (ready) banner = `<div class="lcm-banner ok"><b>All sign-offs complete.</b> Ready to promote with a 5% canary.<div class="row"><button class="btn primary" data-act="lc-promote" ${can('ml_engineer', 'sre') ? '' : 'disabled'}>Promote to production</button></div>${roleNote('ml_engineer', 'sre')}</div>`;
  else if (m.approvals.some((a) => a.status === 'pending')) banner = `<div class="lcm-banner"><b>Waiting on ${m.approvals.filter((a) => a.status === 'pending').map((a) => a.label.toLowerCase()).join(', ')}.</b> Sign in as that role to act.</div>`;
  const tiles = m.evals.slice(0, 4).map(([n, , th, r, s]) => `<div class="lcm-tile ${s}"><span>${h(n)}</span><b>${h(r)}</b><small>${s === 'scheduled' ? 'scheduled' : 'target ' + h(th)}</small></div>`).join('');
  const tabs = [['lifecycle', 'Lifecycle'], ['evals', `Evaluations ${m.evals.length}`], ['approvals', `Sign-offs ${appr}/${m.approvals.length}`], ['provenance', 'Provenance'], ['activity', 'Activity']];
  let body = '';
  if (tab === 'lifecycle') body = `<div class="lcm-progress"><div><i style="width:${(100 * passed / m.stages.length).toFixed(0)}%"></i></div><span>${passed} of ${m.stages.length} gates passed</span></div>
    <div class="lc">${m.stages.map((st, i) => { const [cls, label] = LC_STATE[st.status] || LC_STATE.done; return `<div class="lc-stage ${st.status}"><div class="lc-n">${st.status === 'blocked' ? '!' : i + 1}</div><div class="lc-body"><div class="row between"><b>${h(st.name)}</b>${pill(cls, label)}</div>
      <dl class="kv"><dt>Inputs</dt><dd>${st.inputs.map((x) => `<span>${h(nm(x.split('@')[0]) !== x.split('@')[0] ? nm(x.split('@')[0]) + (x.includes('@') ? ' @' + x.split('@')[1] : '') : x)}</span>`).join('<br>')}</dd><dt>Gate</dt><dd>${h(st.gate)}</dd><dt>Policy</dt><dd class="mono">${st.policy}</dd><dt>Produced</dt><dd class="mono">${h(st.artifact)}</dd>${st.metrics ? `<dt>Results</dt><dd>${Object.entries(st.metrics).map(([k, v]) => `${k.replace(/_/g, ' ')}: <b>${h(v)}</b>`).join('<br>')}</dd>` : ''}</dl></div></div>`; }).join('')}</div>`;
  if (tab === 'evals') body = `<div class="scroll-x"><table class="table"><thead><tr><th>Check</th><th>Kind</th><th>Threshold</th><th>Result</th><th></th></tr></thead><tbody>${m.evals.map(([n, k, th, r, s]) => `<tr><td>${h(n)}</td><td>${h(k)}</td><td class="mono">${h(th)}</td><td class="mono"><b>${h(r)}</b></td><td>${pill(s === 'pass' ? 'ok' : s === 'fail' ? 'deny' : '', s === 'pass' ? 'Pass' : s === 'fail' ? 'Fail' : 'Scheduled')}</td></tr>`).join('')}</tbody></table></div>
    <p class="note">Thresholds live in the release policy (release-2.1), versioned like any other bundle. Results are signed by the evaluation job and attached to the model card.</p>`;
  if (tab === 'approvals') body = `<div class="glist">${m.approvals.map((a) => `<div class="grow"><span><b>${h(a.label)}</b><span class="id">${h(a.who)} · ${h(E.ROLES[a.role].title)}</span></span><span>${a.status === 'approved' ? `${pill('ok', 'Approved')}<span class="id">${new Date(a.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>` : a.status === 'changes' ? pill('deny', 'Changes requested') : a.status === 'na' ? pill('', 'Not started') : a.status === 'waiting' ? pill('', 'After training') : pill('warn', 'Pending')}</span></div>`).join('')}</div>
    <p class="note">Sign-offs are separate duties: the model owner cannot approve privacy or legal. Each is a signed ledger entry tied to the approver's identity.</p>`;
  if (tab === 'provenance') {
    const ds = [...new Set(m.stages.flatMap((x) => x.inputs).map((x) => x.split('@')[0]).filter((x) => P.dataset(x)))];
    body = glist([
      ['Training data', ds.length ? ds.map((d) => `${h(nm(d))}<span class="id">${h(d)}@${P.tables[d] ? P.tables[d].current.id : hex(d, 7)}</span>`).join('') : h(m.stages[0].inputs.join(', '))],
      ['Training code', `<span class="mono">ml/${h(m.model)} @ ${hex(m.model + 'git', 10)}</span>`],
      ['Training image', `<span class="mono">ml/${h(m.model)}-train@sha256:${hex(m.model + 'img', 12)}…</span>`],
      ['Weights digest', `<span class="mono">sha256:${hex(m.model + 'w', 16)}…</span>`],
      ['Signature', m.model === 'resume-screener' ? 'none, nothing built' : `${pill('ok', 'Verified')}<span class="id">keyless signing, transparency log index ${(strHash(m.model) % 9e7) + 1e7}</span>`],
      ['SBOM', `CycloneDX, ${200 + (strHash(m.model) % 400)} components, 0 critical CVEs`],
      ['Policy bundle', '<span class="mono">core-1.4.0, release-2.1</span>'],
    ]) + `<p class="note">Anyone can rebuild the training set from these snapshot IDs and the same consent cut-off, and verify the weights against the digest. ${P.models.some((x) => x.id === m.model) ? `<button class="link" data-lnode-go="${h(E.mname(P.models.find((x) => x.id === m.model)))}">Open in lineage</button>` : ''}</p>`;
  }
  if (tab === 'activity') {
    const ev = [...m.approvals.filter((a) => a.status === 'approved').map((a) => [a.at, a.who, `approved ${a.label.toLowerCase()}`]), [Date.parse(m.updated) - 864e5 * 6, E.ROLES.ml_engineer.name, `registered ${m.name} ${m.version}`],
      ...P.ledger.entries.filter((e) => e.payload.lc === m.model && e.type !== 'model.signoff').map((e) => [e.ts, nm(e.actor), (ACTIVITY[e.type] || ((x) => x.type))(e)])].sort((a, b) => b[0] - a[0]);
    body = `<ul class="feed">${ev.map(([t, who, what]) => `<li><span class="when">${new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><span><b>${h(who)}</b> ${h(what)}</span></li>`).join('')}</ul>`;
  }
  return `<div class="lcm-head"><div><h2>${h(m.name)} <span>${h(m.version)}</span></h2><p>${h(m.purpose)}</p></div>${pill(lcHealth(m), m.stage === 'Ready' ? 'Ready to promote' : m.stage)}</div>
    <div class="lcm-facts">${[['Owner', m.owner], ['Training', m.method], ['Data', m.data], ['Regions', m.regions], ['EU AI Act', m.risk + ' risk']].map(([k, v]) => `<span><small>${k}</small>${h(v)}</span>`).join('')}</div>
    ${banner}
    ${tiles ? `<div class="lcm-tiles">${tiles}</div>` : ''}
    <div class="seg lcm-tabs">${tabs.map(([k, t]) => `<button class="${tab === k ? 'on' : ''}" data-lctab="${k}">${t}</button>`).join('')}</div>
    ${body}`;
}

async function lcAct(kind) {
  const m = lcRecords().find((x) => x.model === (S.lcModel || 'assistant-llm'));
  const who = S.token.claims.sub;
  if (kind === 'remediate') {
    const st = m.stages.find((x) => x.key === 'eval');
    st.status = 'running'; st.metrics = { status: 'deduplicating 4.1M examples, re-running probes' }; render();
    await sleep(1800);
    st.status = 'done'; st.metrics = { canary_exposure: '0 of 200', pii_extraction_rate: '0.00%', removed_duplicates: '38,214' }; st.artifact = 'eval/assistant-13b/r2';
    m.evals = m.evals.map((x) => (x[0] === 'PII extraction rate' ? [x[0], x[1], x[2], '0.00%', 'pass'] : x[0] === 'Canary exposure' ? [x[0], x[1], x[2], '0 of 200', 'pass'] : x));
    const rel = m.stages.find((x) => x.key === 'release'); rel.status = 'running'; rel.artifact = 'awaiting sign-offs';
    await P.ledger.append('model.evaluated', who, { lc: m.model, name: m.name, result: 'pass', removed_duplicates: 38214 });
    toast('Evaluation passed. Sign-offs unlocked for privacy, legal and SRE.');
  }
  if (kind === 'approve' || kind === 'changes') {
    const a = m.approvals.find((x) => x.role === S.role && x.status === 'pending');
    if (!a) return;
    a.status = kind === 'approve' ? 'approved' : 'changes'; a.at = Date.now();
    await P.ledger.append(kind === 'approve' ? 'model.signoff' : 'model.changes_requested', who, { lc: m.model, name: `${m.name} ${m.version}`, signoff: a.label });
    if (kind === 'approve' && m.model === 'support-triage' && a.role === 'privacy_reviewer') {
      const s1 = m.stages.find((x) => x.key === 'pretrain'); s1.status = 'done'; s1.artifact = 'DPIA-044 approved';
      const s2 = m.stages.find((x) => x.key === 'sft'); s2.status = 'running'; s2.artifact = 'ckpt/support-triage/r1 (training)';
    }
    if (m.approvals.every((x) => x.status === 'approved')) {
      const rel = m.stages.find((x) => x.key === 'release');
      if (rel) { rel.status = 'done'; rel.artifact = `${m.model} ${m.version.split(' ')[0]} (signed)`; m.stage = 'Ready'; }
    }
    toast(kind === 'approve' ? `${a.label} approved for ${m.name} ${m.version}` : `Changes requested on ${m.name}`);
  }
  if (kind === 'promote') {
    m.stage = 'Production'; m.version = m.version.split(' ')[0]; m.updated = date(Date.now());
    m.stages.push({ key: 'serve', name: 'Inference', inputs: [`${m.model} ${m.version}`], gate: 'canary 5%, error budget and policy checks, then 100%', policy: 'core-1.4.0', artifact: `endpoint ${m.model}`, status: 'live' });
    await P.ledger.append('model.promoted', who, { lc: m.model, name: m.name, version: m.version });
    toast(`${m.name} ${m.version} promoted. Canary at 5%.`);
  }
  render(); renderChrome();
}
Object.assign(ACTIVITY, {
  'model.signoff': (e) => `signed off ${e.payload.signoff.toLowerCase()} for ${e.payload.name}`,
  'model.changes_requested': (e) => `requested changes on ${e.payload.name}`,
  'model.evaluated': (e) => `re-ran evaluation for ${e.payload.name}: ${e.payload.result === 'pass' ? 'all checks pass' : 'failed'}`,
  'model.promoted': (e) => `promoted ${e.payload.name} ${e.payload.version} to production`,
});

/* ── design review: what the platform team owns, and where each part runs ── */
const OWNS = [
  ['Lineage across training and post-training', 'Every job emits OpenLineage with Iceberg snapshot IDs; column lineage proves where personal data tags were removed; every model has signed provenance.', [['Lineage', 'lineage'], ['Model governance', 'lifecycle', 'lc:assistant-llm-v2']]],
  ['Identity and access for data, weights and endpoints', 'OIDC for people, client credentials for services, RFC 8693 for agents. ABAC on IdP attributes; weights inherit the sensitivity and region of their data.', [['Artifacts and endpoints', 'artifacts'], ['Agents', 'agent'], ['Policies', 'policy']]],
  ['Regulation in the code path', 'GDPR, CCPA/CPRA, DMA, DSA and the EU AI Act as versioned policy rules with citations, shadow-tested before rollout, failing closed.', [['Regulations', 'regulations'], ['Controls', 'compliance']]],
  ['Governed batch and streaming pipelines', 'Flink and Spark jobs share governance stages: region tagging, point-in-time consent joins, minimization, redaction. Every dropped record has a reason.', [['Pipelines', 'pipelines'], ['Training gate', 'training']]],
  ['APIs, SDKs and review tools', 'REST and SDKs for the same decisions the console makes; approvals, sign-offs and subject requests as durable workflows with SLAs.', [['REST API', 'api'], ['Requests', 'access'], ['Subject requests', 'dsr']]],
  ['Reliable, auditable serving', 'Per-request consent and policy at the gateway, circuit breaker to a non-personalized model, error budgets per service, tamper-evident ledger.', [['Serving', 'serving'], ['Services', 'services'], ['Audit ledger', 'audit']]],
  ['Working with privacy, legal and security', 'Separate duties by role: stewards approve data, privacy and legal sign releases, auditors alone read the ledger.', [['Model sign-offs', 'lifecycle', 'lc:fraud-score'], ['Assessments', 'assessments']]],
];
const NUMBERS = [['< 10 ms', 'p99 policy decision', 'OPA sidecar, cached bundles'], ['< 5 s', 'consent to serving, p95', 'outbox, Kafka, Redis'], ['0', 'personalized without an allow', 'invariant counter, paged on 1'], ['72 h', 'erasure target', '30 day legal limit'], ['100%', 'decisions in the ledger', 'hash chain, Merkle roots in WORM']];
const TRADEOFFS = [
  ['Fail closed at serving', 'An outage costs ad revenue, never consent. The fallback model keeps the product working.'],
  ['Dataset lineage plus snapshot IDs, not row lineage', 'Row lineage at this volume costs more than it answers. Snapshot membership answers "where is this person" exactly.'],
  ['Bitemporal consent', 'Storage grows with every change; in exchange a training set can be rebuilt as it was known on any date.'],
  ['Expire snapshots on erasure', 'Removes time travel for that window, which is the point: a row delete alone leaves the person in history.'],
  ['Human confirmation of PII tags', 'Slower onboarding, no silent misclassification.'],
];
const NEXT = [['Machine unlearning for flagged models', 'Retraining on every erasure does not scale; batch erasures per model and evaluate approximate unlearning against a retrain baseline.'], ['Policy for agents', 'Agents chain tools across services; extend token exchange with per-tool purpose and spend limits.'], ['Verifiable releases', 'Publish model and policy digests to a public transparency log so outside researchers can check what runs.'], ['Cost of governance', 'Show each team what exclusions cost in data and accuracy, so privacy is a measured trade, not a surprise.']];
VIEWS.review = () => head('Design review', 'What a data and AI governance platform team owns, how this product does each part, and the trade-offs behind it.', 'Every row links to the working screen. Design docs, ADRs, runbooks and the Rego bundle are in the repository under docs/ and policies/.') + `
  <div class="grid">
    <div class="card c12"><h3>Responsibilities</h3><div class="own">${OWNS.map(([t, d, links], i) => `<div class="own-row"><span class="own-n">${i + 1}</span><div><b>${h(t)}</b><p>${h(d)}</p></div><div class="own-links">${links.map(([l, v, sel]) => `<button class="btn" data-go="${v}"${sel ? ` data-sel="${sel}"` : ''}>${h(l)} ›</button>`).join('')}</div></div>`).join('')}</div></div>
    <div class="card c12"><h3>Service levels</h3><div class="slo-row">${NUMBERS.map(([v, k, how]) => `<div><b>${h(v)}</b><span>${h(k)}</span><small>${h(how)}</small></div>`).join('')}</div></div>
    <div class="card c6"><h3>Trade-offs made</h3><div class="glist">${TRADEOFFS.map(([t, d]) => `<div class="grow tall"><span><b>${h(t)}</b><span class="id wrap">${h(d)}</span></span></div>`).join('')}</div></div>
    <div class="card c6"><h3>What I would build next</h3><div class="glist">${NEXT.map(([t, d]) => `<div class="grow tall"><span><b>${h(t)}</b><span class="id wrap">${h(d)}</span></span></div>`).join('')}</div></div>
  </div>`;

/* ── artifacts and endpoints: ABAC on weights and inference ── */
VIEWS.artifacts = () => {
  const arts = E.artifacts(P), a = S.art || (S.art = { principal: 'maya.chen', action: 'download', artifact: arts[1].id, endpoint: 'assistant-llm-inference', region: 'US' });
  const res = arts.find((x) => x.id === a.artifact) || arts[0];
  const d = E.decideArtifact({ principal: a.principal, action: a.action, resource: res, endpoint: a.endpoint, region: a.region });
  const opt = (arr, cur) => arr.map((v) => `<option${v === cur ? ' selected' : ''}>${v}</option>`).join('');
  const pr = E.PRINCIPALS[a.principal];
  return head('Artifacts and endpoints', 'Model weights carry the sensitivity of the data they learned from. Who may download, deploy or call a model is decided by attributes, not lists.', 'Attribute-based access control: the principal\'s federated identity attributes (team, clearance, region, kind) are checked against the resource\'s attributes (classification inherited from training data, region) and the action. Endpoints accept only registered consumers presenting OAuth client credentials or delegated tokens.') + `
  <div class="grid">
    <div class="card c12"><h3>Model artifacts</h3><div class="scroll-x"><table class="table"><thead><tr><th>Artifact</th><th>Kind</th><th>Inherited class</th><th>Region</th><th>Trained on</th></tr></thead><tbody>
      ${arts.map((x) => `<tr class="click${x.id === res.id ? ' sel' : ''}" data-artifact="${x.id}"><td class="mono">${x.id}<span class="id">${x.size}</span></td><td>${x.kind}</td><td>${pill(x.classification)}</td><td>${x.region}</td><td>${x.from.map(nm).join(', ')}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="card c6"><h3>Inference endpoints</h3><div class="scroll-x"><table class="table"><thead><tr><th>Endpoint</th><th>Model</th><th>Regions</th><th>Consumers</th><th>Auth</th></tr></thead><tbody>
      ${E.ENDPOINTS.map((x) => `<tr><td class="mono">${x.id}</td><td class="mono">${x.model}</td><td>${x.regions.join(', ')}</td><td>${x.consumers.map(nm).join(', ')}</td><td>${x.auth}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="card c6"><h3>Access decision</h3>
      <div class="fields">
        <label class="field">Principal<select data-bind="art.principal">${opt(Object.keys(E.PRINCIPALS), a.principal)}</select></label>
        <label class="field">Action<select data-bind="art.action">${opt(['download', 'deploy', 'invoke'], a.action)}</select></label>
        ${a.action === 'invoke' ? `<label class="field">Endpoint<select data-bind="art.endpoint">${opt(E.ENDPOINTS.map((x) => x.id), a.endpoint)}</select></label><label class="field">Traffic region<select data-bind="art.region">${opt(['US', 'EU'], a.region)}</select></label>` : `<label class="field">Artifact<select data-bind="art.artifact">${opt(arts.map((x) => x.id), res.id)}</select></label>`}
      </div>
      ${pr ? `<p class="note">Identity attributes from the IdP: team <b>${pr.team}</b>, clearance <b>${pr.clearance}</b>, region <b>${pr.region}</b>, ${pr.kind}.</p>` : ''}
      ${decisionBox(d)}
    </div>
  </div>`;
};

/* ── pipelines: batch and streaming jobs that produce governed inputs ── */
VIEWS.pipelines = () => {
  const sel = E.PIPELINES.find((x) => x.id === S.pipe) || E.PIPELINES[0];
  const dropped = Object.entries(sel.dropped).filter(([, v]) => v > 0);
  return head('Pipelines', 'The jobs that turn raw data into governed, ML-ready inputs. Every record dropped is dropped for a reason you can see.', 'Streaming jobs run on Flink, batch jobs on Spark. Governance operators (region tagging, consent filtering with a point-in-time join, minimization, redaction) are library stages shared by every job, so policy is applied the same way everywhere. Each run emits OpenLineage with input and output snapshot IDs.') + `
  <div class="grid">
    ${kpi(E.PIPELINES.length, 'Governed jobs', `${E.PIPELINES.filter((x) => x.mode === 'streaming').length} streaming, ${E.PIPELINES.filter((x) => x.mode === 'batch').length} batch`)}
    ${kpi(compact(E.PIPELINES.reduce((a, x) => a + x.records_in, 0)), 'Records processed today', 'across all jobs')}
    ${kpi(compact(E.PIPELINES.reduce((a, x) => a + Object.values(x.dropped).reduce((b, v) => b + v, 0), 0)), 'Records excluded by policy', 'each with a reason')}
    ${kpi(Math.max(...E.PIPELINES.filter((x) => x.lag_s).map((x) => x.lag_s)).toFixed(1) + ' s', 'Max streaming lag', 'target under 10 s', 'good')}
    <div class="card c7"><div class="scroll-x"><table class="table"><thead><tr><th>Job</th><th>Engine</th><th>Schedule</th></tr></thead><tbody>
      ${E.PIPELINES.map((x) => `<tr class="click${x === sel ? ' sel' : ''}" data-pipe="${x.id}"><td><span class="mono">${x.id}</span> ${pill('ok', x.status)}<span class="id">${h(nm(x.input))} → ${h(nm(x.output))}</span></td><td>${x.engine}<span class="id">${x.mode}</span></td><td style="white-space:nowrap">${x.schedule}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="card c5"><h3 class="mono">${sel.id} <span class="right">${sel.engine} · ${sel.mode}</span></h3>
      <div class="dag">${sel.stages.map((st, i) => `<span class="dag-node">${h(st)}</span>${i < sel.stages.length - 1 ? '<span class="dag-arrow">→</span>' : ''}`).join('')}</div>
      <dl class="kv"><dt>Input</dt><dd>${named(sel.input)}</dd><dt>Output</dt><dd>${named(sel.output)}</dd><dt>Records in</dt><dd>${fmt(sel.records_in)}</dd><dt>${sel.lag_s ? 'Lag' : 'Last run'}</dt><dd>${sel.lag_s ? sel.lag_s + ' s' : sel.duration}</dd></dl>
      <h3>Excluded by reason</h3>${dropped.length ? bars(dropped.map(([k, v]) => [rsn(k) === k ? k.replace(/_/g, ' ') : rsn(k), v]), 'red') : '<p class="note">Nothing excluded in this run.</p>'}
    </div>
  </div>`;
};

/* ── services: fault-tolerant serving on Kubernetes ── */
VIEWS.services = () => head('Services', 'The platform\'s own services, where they run, and how much error budget each has left this month.', 'Each service runs on EKS in us-west-2, with EU-facing services also in eu-west-1 so EU data is processed in the EU. Multi-zone replicas, pod disruption budgets and circuit breakers keep enforcement available; if the policy engine is unreachable, callers fail closed.') + `
  <div class="grid">
    ${kpi(E.SERVICES.length, 'Services', 'Go, Kotlin, Java, Scala, Python')}
    ${kpi(E.SERVICES.reduce((a, x) => a + x.replicas, 0), 'Pods', '2 regions, 3 zones each')}
    ${kpi(P.policyUp ? '99.99%' : 'Degraded', 'Policy engine availability', 'SLO 99.99%', P.policyUp ? 'good' : 'bad')}
    ${kpi('0', 'Pages this week', 'on-call: SRE rotation')}
    <div class="card c12"><div class="scroll-x"><table class="table"><thead><tr><th>Service</th><th>Stack</th><th>Clusters</th><th>Replicas</th><th>p99</th><th>Error rate</th><th>SLO</th><th>Error budget left</th><th>Version</th></tr></thead><tbody>
      ${E.SERVICES.map((x) => { const down = x.name === 'policy-engine' && !P.policyUp; const b = down ? 0.41 : x.budget; return `<tr><td class="mono">${x.name}</td><td>${x.lang}</td><td class="mono">${x.cluster}</td><td>${down ? '0/' + x.replicas : x.replicas}</td><td>${x.p99} ms</td><td>${down ? '100%' : x.err + '%'}</td><td>${x.slo}%</td><td><div class="budget"><div style="width:${b * 100}%" class="${b < 0.5 ? 'low' : ''}"></div></div><span class="id">${Math.round(b * 100)}%</span></td><td class="mono">${x.version}</td></tr>`; }).join('')}
    </tbody></table></div></div>
  </div>`;

/* ── developers: REST API and SDKs, with a live call ── */
const API = [
  ['POST', '/v1/decisions', 'Evaluate a policy decision', 'decide'],
  ['GET', '/v1/consent/{user_id}', 'Current consent per purpose', 'consent'],
  ['GET', '/v1/lineage/models/{model}', 'Datasets and snapshots that trained a model', 'lineage'],
  ['GET', '/v1/lineage/subjects/{user_id}', 'Every location holding a person\'s data', 'locate'],
  ['POST', '/v1/access-requests', 'Open an access request workflow', 'request'],
  ['POST', '/v1/dsr/erasure', 'Start an erasure saga (idempotent)', 'erasure'],
  ['POST', '/v1/artifacts/{id}:authorize', 'ABAC check for download, deploy or invoke', 'artifact'],
  ['GET', '/v1/audit/verify', 'Verify the ledger hash chain', 'verify'],
];
VIEWS.api = () => {
  const cur = API.find((x) => x[3] === S.apiOp) || API[0];
  return head('REST API', 'Everything in the console is an API first. Teams embed governance in their own services and pipelines.', 'OpenAPI 3.1. Authenticate with OAuth 2.0 client credentials; every call carries a purpose and is decided by policy and written to the audit ledger. Rate limited per client; idempotency keys on every POST.') + `
  <div class="grid">
    <div class="card c5"><h3>Endpoints <span class="right">api.custodian.acme.internal</span></h3><div class="api-list">${API.map(([m, path, what, k]) => `<button class="api-row${k === cur[3] ? ' on' : ''}" data-apiop="${k}"><span class="verb ${m.toLowerCase()}">${m}</span><span><span class="mono">${path}</span><small>${what}</small></span></button>`).join('')}</div></div>
    <div class="card c7"><h3><span class="verb ${cur[0].toLowerCase()}">${cur[0]}</span> <span class="mono">${cur[1]}</span></h3><p class="note">${cur[2]}</p>
      <pre class="code">${h(apiRequest(cur[3]))}</pre>
      <div class="row"><button class="btn primary" data-act="api-try">Send request</button><span class="note" style="margin:0">Runs against this workspace's live engine.</span></div>
      ${S.apiResp && S.apiResp.op === cur[3] ? `<pre class="code">${h(S.apiResp.body)}</pre>` : ''}
    </div>
  </div>`;
};
function apiRequest(op) {
  const u = S.consentUser;
  const req = {
    decide: `POST /v1/decisions\nAuthorization: Bearer <client-credentials token>\nIdempotency-Key: 7f1c...\n\n{\n  "principal": "svc-ad-gateway",\n  "purpose": "ads_personalization",\n  "dataset": "ad_features_v7",\n  "processing_region": "US",\n  "subject": "${u}"\n}`,
    consent: `GET /v1/consent/${u}\nAuthorization: Bearer <token, scope consent:read>`,
    lineage: `GET /v1/lineage/models/adrank@3\nAuthorization: Bearer <token, scope lineage:read>`,
    locate: `GET /v1/lineage/subjects/${u}\nAuthorization: Bearer <token, scope dsr:operate>`,
    request: `POST /v1/access-requests\n\n{\n  "dataset": "assistant_conversations_redacted",\n  "purpose": "model_training",\n  "region": "US",\n  "duration_days": 30,\n  "justification": "Evaluate a smaller assistant model"\n}`,
    erasure: `POST /v1/dsr/erasure\nIdempotency-Key: dsr-erasure:${u}\n\n{ "subject": "${u}", "verified": true }`,
    artifact: `POST /v1/artifacts/ckpt%2Fadrank%2Fv3-eu:authorize\n\n{ "principal": "maya.chen", "action": "download" }`,
    verify: `GET /v1/audit/verify\nAuthorization: Bearer <token, role auditor>`,
  };
  return req[op];
}
async function apiTry() {
  const op = S.apiOp || 'decide', u = P.userById.get(S.consentUser);
  let body;
  if (op === 'decide') { const r = await P.evaluate({ principal: { sub: 'svc-ad-gateway' }, purpose: 'ads_personalization', dataset: P.dataset('ad_features_v7'), processing_region: 'US', grant: true, user: P.userInput(u, P.cache.get(u.id).consent) }); body = { allow: r.decision.allow, reasons: r.decision.reasons.map((x) => ({ code: x.code, regulation: x.cite })), bundle: r.decision.version, decision_id: 'dec_' + Date.now().toString(36), latency_ms: +r.decision.latency_ms.toFixed(3) }; }
  if (op === 'consent') body = { subject: u.id, region: u.region, purposes: P.consent.snapshot(u.id), as_of: new Date().toISOString() };
  if (op === 'lineage') { const m = P.models.find((x) => x.id === 'adrank' && x.version === 3); body = { model: 'adrank@3', inputs: m.trainedOn, policy_bundle: 'core-1.3.2', card: 'model-cards/adrank/3' }; }
  if (op === 'locate') body = { subject: u.id, locations: P.locate(u.id).map((x) => ({ kind: x.kind, name: x.name, snapshots: x.snapshots })) };
  if (op === 'request') body = { id: 'AR-' + (2041 + P.accessRequests.length), status: 'open', workflow: 'access-request', next_step: 'privacy_review' };
  if (op === 'erasure') body = { status: 'accepted', idempotency_key: 'dsr-erasure:' + u.id, due: date(Date.now() + 864e5 * 30), note: 'Run it from Privacy > Subject requests to watch the saga.' };
  if (op === 'artifact') { const d = E.decideArtifact({ principal: 'maya.chen', action: 'download', resource: E.artifacts(P).find((x) => x.region === 'EU') }); body = { allow: d.allow, reasons: d.reasons.map((x) => x.code), bundle: d.version }; }
  if (op === 'verify') { const v = await P.ledger.verify(); body = { intact: v.ok, entries_checked: v.checked, broken_at: v.brokenAt ?? null }; }
  S.apiResp = { op, body: `HTTP/1.1 200 OK\nContent-Type: application/json\nX-Request-Id: req_${Math.random().toString(36).slice(2, 10)}\n\n${JSON.stringify(body, null, 2)}` };
  render();
}
const SDK = {
  Python: `from custodian import Client

client = Client.from_client_credentials(
    client_id="svc-ads-trainer", scopes=["read:ad_features_v7"])

# Ask before you read. Raises PolicyDenied with reasons on deny.
decision = client.decide(purpose="model_training",
                         dataset="ad_features_v7", region="US")

# Point-in-time, consent-filtered training set from an Iceberg snapshot.
train = client.training_set("ad_features_v7", as_of=snapshot_ts)
print(train.excluded_by_reason)  # {'ccpa_opt_out': 1394, ...}

with client.lineage.run("train_adrank") as run:
    run.input("ad_features_v7", snapshot=train.snapshot_id)
    run.output_model("adrank", version=4)`,
  Kotlin: `val custodian = Custodian.clientCredentials("svc-ad-gateway")

// Serving path: fail closed on deny, unknown or timeout.
suspend fun rank(req: AdRequest): Ranking {
    val decision = custodian.decide(
        purpose = Purpose.ADS_PERSONALIZATION,
        subject = req.userId,
        dataset = "ad_features_v7",
        timeout = 8.milliseconds,
    ).getOrElse { return contextual.rank(req) }

    return if (decision.allow) personalized.rank(req) else contextual.rank(req)
}`,
  Go: `c, _ := custodian.NewClient(ctx, custodian.ClientCredentials("svc-model-deployer"))

// ABAC on model artifacts before a deploy.
ok, reasons, err := c.AuthorizeArtifact(ctx, custodian.ArtifactRequest{
    Artifact: "ckpt/adrank/v3",
    Action:   custodian.Deploy,
})
if err != nil || !ok {
    return fmt.Errorf("deploy blocked: %v", reasons)
}`,
};
VIEWS.sdk = () => {
  const lang = S.sdkLang || 'Python';
  return head('SDKs', 'Client libraries for the languages our services are written in. The same calls work in pipelines, services and notebooks.', 'SDKs wrap the REST API with token refresh, retries with backoff, decision caching with short TTLs for hot paths, and OpenTelemetry spans. Java and Scala clients share the Kotlin core.') + `
  <div class="grid"><div class="card c12"><div class="row between"><div class="seg">${Object.keys(SDK).map((k) => `<button class="${k === lang ? 'on' : ''}" data-sdk="${k}">${k}</button>`).join('')}</div><span class="note mono" style="margin:0">${lang === 'Python' ? 'pip install custodian-sdk' : lang === 'Kotlin' ? 'implementation("com.acme:custodian-kotlin:3.2.0")' : 'go get acme.internal/custodian-go@v1.9.0'}</span></div>
    <pre class="code">${h(SDK[lang])}</pre></div></div>`;
};

/* ── risk and compliance: register, assessments, vendors, incidents, reports ── */
const G = {
  risks: [
    { id: 'R-101', title: 'Re-identification from precise location in raw events', cat: 'Privacy', L: 3, I: 5, owner: 'Luis Ortega', controls: ['restricted_for_ads', 'minimized views', 'dynamic masking'], status: 'Mitigated', treat: 'Raw location is restricted; models read geohash-5 only.' },
    { id: 'R-102', title: 'Training on users who withdrew consent after snapshot', cat: 'Privacy', L: 2, I: 5, owner: 'Maya Chen', controls: ['point-in-time consent join', 'retrain_required on erasure'], status: 'Mitigated', treat: 'Bitemporal consent and erasure flags force retraining.' },
    { id: 'R-103', title: 'Model memorizes personal data from assistant conversations', cat: 'AI safety', L: 2, I: 4, owner: 'Amara Okafor', controls: ['redaction pipeline', 'canary insertion', 'PII extraction eval'], status: 'Monitoring', treat: 'Release blocked unless extraction rate is 0.00%.' },
    { id: 'R-104', title: 'Cross-service data combination without DMA consent', cat: 'Regulatory', L: 3, I: 4, owner: 'Jonas Weber', controls: ['dma_no_combination_consent', 'source tags'], status: 'Mitigated', treat: 'Policy denies multi-source features for EU users without consent.' },
    { id: 'R-105', title: 'EU data processed outside the EU', cat: 'Regulatory', L: 2, I: 5, owner: 'Priya Nair', controls: ['eu_transfer_blocked', 'eu_artifact_residency', 'regional clusters'], status: 'Mitigated', treat: 'EU buckets, EU clusters, EU weights stay in EU.' },
    { id: 'R-106', title: 'Policy engine outage leads to personalization without consent', cat: 'Operational', L: 2, I: 5, owner: 'Priya Nair', controls: ['fail closed', 'circuit breaker', 'chaos drills'], status: 'Mitigated', treat: 'Gateway serves non-personalized results when the engine is unreachable.' },
    { id: 'R-107', title: 'Profiling ads shown to minors', cat: 'Regulatory', L: 2, I: 5, owner: 'Jonas Weber', controls: ['minor_no_profiling', 'age range signal'], status: 'Mitigated', treat: 'Unknown age is treated as a minor.' },
    { id: 'R-108', title: 'Labeling vendor retains preference data beyond contract', cat: 'Third party', L: 3, I: 3, owner: 'Amara Okafor', controls: ['DPA', 'annual vendor review', 'pseudonymized annotator IDs'], status: 'Open', treat: 'Deletion certificate requested; review due next month.' },
    { id: 'R-109', title: 'Audit records altered by a privileged insider', cat: 'Security', L: 1, I: 5, owner: 'Henrik Lund', controls: ['hash chain', 'WORM Merkle anchors', 'daily verification'], status: 'Mitigated', treat: 'Tampering is detectable and provable against anchors.' },
  ],
  assessments: [
    { id: 'DPIA-2026-118', type: 'DPIA', title: 'iPhone app events v2 for personalized ads', dataset: 'iphone_app_events_v2', status: 'Approved', progress: 100, owner: 'Jonas Weber', due: '2026-10-30', signoffs: ['Privacy', 'Legal', 'Security'],
      sections: [['Purpose and necessity', 'Rank sponsored place results. Necessary data limited to coarse location and in-app engagement.'], ['Data and people', '1.2M US users with ads consent; no special-category data; minors excluded.'], ['Risks', 'Re-identification from location (R-101); training after withdrawal (R-102).'], ['Measures', 'Minimized view, geohash-5, IDFA dropped, 90 day grant, point-in-time consent.'], ['Residual risk', 'Low. No prior consultation needed (Art. 36).']] },
    { id: 'AIIA-2026-031', type: 'AI impact assessment', title: 'Assistant LLM fine-tuning on redacted conversations', dataset: 'assistant_conversations_redacted', status: 'In review', progress: 70, owner: 'Amara Okafor', due: '2026-11-07', signoffs: ['Privacy'],
      sections: [['System and intended purpose', 'In-app assistant for place questions. Not used for decisions with legal effect.'], ['Training data governance', 'Redacted conversations, opt-outs removed, canaries inserted (EU AI Act Art. 10).'], ['Evaluation', 'PII extraction 0.00%, memorization below threshold, refusal accuracy 97.4%.'], ['Transparency', 'Users told responses are AI-generated (Art. 50).'], ['Open items', 'Legal sign-off pending on vendor preference data (R-108).']] },
    { id: 'TIA-2026-007', type: 'Transfer impact assessment', title: 'EU aggregate metrics to US analytics', dataset: 'session_metrics_daily', status: 'Draft', progress: 35, owner: 'Jonas Weber', due: '2026-11-20', signoffs: [],
      sections: [['Transfer', 'Aggregated, non-personal session metrics from eu-west to us-west.'], ['Basis', 'SCCs module 1 if any personal data remains; aiming for anonymous aggregates.'], ['Open items', 'Confirm k-anonymity threshold of 50 per cell.']] },
    { id: 'LIA-2026-012', type: 'Legitimate interest assessment', title: 'Fraud signals in ad click data', dataset: 'app_events_clean', status: 'Approved', progress: 100, owner: 'Luis Ortega', due: '2026-09-15', signoffs: ['Privacy', 'Legal'],
      sections: [['Interest', 'Detect invalid ad clicks.'], ['Necessity', 'Click timing and device signals only.'], ['Balancing', 'Expected by users; minimal impact; opt-out honored.']] },
  ],
  vendors: [
    { name: 'Northwind Labeling', service: 'Human preference labeling', data: 'Prompts and responses (redacted), annotator IDs', region: 'US', dpa: true, scc: false, tier: 'High', review: '2026-03-02', status: 'Review due' },
    { name: 'Contoso Cloud', service: 'Infrastructure (Kubernetes, object storage)', data: 'All governed data, encrypted', region: 'US, EU', dpa: true, scc: true, tier: 'Critical', review: '2026-08-14', status: 'Approved' },
    { name: 'Fabrikam Support', service: 'Customer support desk', data: 'Account email, ticket text', region: 'EU', dpa: true, scc: true, tier: 'Medium', review: '2026-06-01', status: 'Approved' },
    { name: 'Tailspin Analytics', service: 'Aggregate product analytics', data: 'Aggregates only (k >= 50)', region: 'US', dpa: true, scc: false, tier: 'Low', review: '2026-05-20', status: 'Approved' },
    { name: 'Litware Translation', service: 'Localization of assistant replies', data: 'Synthetic strings only', region: 'EU', dpa: false, scc: false, tier: 'Low', review: 'Scheduled', status: 'Onboarding' },
  ],
  apikeys: [],
  incidents: [
    { id: 'INC-0412', title: 'Consent consumer lag above SLO in eu-west-1', sev: 'SEV-3', status: 'Resolved', opened: Date.now() - 864e5 * 9, resolved: Date.now() - 864e5 * 9 + 36e5 * 2, personal: false, owner: 'Priya Nair',
      timeline: [['Detected', 'Consent propagation p95 reached 7.8 s'], ['Mitigated', 'Consumers scaled from 4 to 8'], ['Resolved', 'p95 back to 1.6 s; no personalization without allow']] },
  ],
};
const RISK_COLOR = (score) => (score >= 15 ? 'deny' : score >= 8 ? 'warn' : 'ok');

function openIncident(inc) { G.incidents.unshift({ id: 'INC-' + (413 + G.incidents.length), opened: Date.now(), status: 'Open', timeline: [['Detected', inc.detect]], ...inc }); renderChrome(); }
function resolveIncident(match, note) { const i = G.incidents.find((x) => x.status !== 'Resolved' && x.title === match); if (i) { i.status = 'Resolved'; i.resolved = Date.now(); i.timeline.push(['Resolved', note]); } renderChrome(); }

VIEWS.risks = () => {
  const list = G.risks.filter((r) => match('risks', r.id, r.title, r.cat, r.owner, r.status));
  const sel = G.risks.find((r) => r.id === S.riskSel);
  const cell = (L, I) => G.risks.filter((r) => r.L === L && r.I === I);
  return head('Risk register', 'What could go wrong with AI data use, how likely and how bad, who owns it, and the controls that reduce it.', 'Likelihood and impact on a 1 to 5 scale; score is their product. Each risk links to the policy rules and platform controls that treat it, so the register stays tied to what is actually enforced.') + `
  <div class="grid">
    ${kpi(G.risks.length, 'Risks tracked', `${G.risks.filter((r) => r.status === 'Open').length} open`)}
    ${kpi(G.risks.filter((r) => r.L * r.I >= 15).length, 'High risks', 'score 15 or more', G.risks.some((r) => r.L * r.I >= 15 && r.status === 'Open') ? 'bad' : '')}
    ${kpi(new Set(G.risks.flatMap((r) => r.controls)).size, 'Linked controls', 'enforced in policy or platform')}
    ${kpi(G.risks.filter((r) => r.status === 'Mitigated').length + ' / ' + G.risks.length, 'Mitigated', 'residual risk accepted')}
    <div class="card c4"><h3>Heat map</h3><div class="heat"><span class="hy">Likelihood</span>${[5, 4, 3, 2, 1].map((L) => `<span class="hl">${L}</span>` + [1, 2, 3, 4, 5].map((I) => { const c = cell(L, I); return `<span class="hc s${L * I >= 15 ? 3 : L * I >= 8 ? 2 : 1}${c.length ? ' has' : ''}" title="${c.map((r) => r.id).join(', ')}">${c.length || ''}</span>`; }).join('')).join('')}<span></span>${[1, 2, 3, 4, 5].map((I) => `<span class="hl">${I}</span>`).join('')}<span class="hx">Impact</span></div></div>
    <div class="card c8">${tools('risks', list.length, G.risks.length, 'Search risks, owners, categories')}<div class="scroll-x"><table class="table"><thead><tr><th>Risk</th><th>Category</th><th>Score</th><th>Owner</th><th>Status</th></tr></thead><tbody>
      ${list.map((r) => `<tr class="click${sel === r ? ' sel' : ''}" data-drawer="risk:${r.id}"><td><b>${h(r.title)}</b><span class="id">${r.id}</span></td><td>${r.cat}</td><td>${pill(RISK_COLOR(r.L * r.I), String(r.L * r.I))}<span class="id">L${r.L} × I${r.I}</span></td><td>${r.owner}</td><td>${pill(r.status === 'Open' ? 'warn' : r.status === 'Monitoring' ? 'blue' : 'ok', r.status)}</td></tr>`).join('')}
    </tbody></table></div></div>
  </div>`;
};
EXPORTS.risks = () => [['id', 'title', 'category', 'likelihood', 'impact', 'score', 'owner', 'controls', 'status'], ...G.risks.map((r) => [r.id, r.title, r.cat, r.L, r.I, r.L * r.I, r.owner, r.controls.join('; '), r.status])];

VIEWS.assessments = () => {
  const sel = G.assessments.find((a) => a.id === S.asmSel) || G.assessments[0];
  return head('Assessments', 'Privacy and AI impact assessments, from draft to sign-off, each tied to the dataset or model it covers.', 'DPIAs (GDPR Art. 35), AI impact assessments (EU AI Act), transfer impact assessments and legitimate interest assessments share one workflow: owner drafts, reviewers sign off by role, approval unlocks the access request or release it gates.') + `
  <div class="grid">
    <div class="card c5"><div class="row between"><h3>All assessments</h3><button class="btn primary" data-act="new-asm">New assessment</button></div>
      <div class="asm-list">${G.assessments.map((a) => `<button class="asm${a === sel ? ' on' : ''}" data-asm="${a.id}"><div class="row between"><b>${h(a.title)}</b>${pill(a.status === 'Approved' ? 'ok' : a.status === 'In review' ? 'warn' : '', a.status)}</div><span class="id">${a.id} · ${a.type}</span><div class="prog"><div style="width:${a.progress}%"></div></div><span class="note">Owner ${a.owner} · due ${a.due}</span></button>`).join('')}</div></div>
    <div class="card c7"><div class="row between"><div><h3>${h(sel.title)}</h3><span class="id">${sel.id} · ${sel.type} · ${named(sel.dataset)}</span></div>${pill(sel.status === 'Approved' ? 'ok' : sel.status === 'In review' ? 'warn' : '', sel.status)}</div>
      <div class="qa">${sel.sections.map(([q, a]) => `<div><b>${h(q)}</b><p>${h(a)}</p></div>`).join('')}</div>
      <h3>Sign-off</h3><div class="signoffs">${['Privacy', 'Legal', 'Security'].map((r) => `<span class="so${sel.signoffs.includes(r) ? ' done' : ''}">${sel.signoffs.includes(r) ? '✓' : '○'} ${r}</span>`).join('')}</div>
      ${sel.status !== 'Approved' ? `<div class="row"><button class="btn primary" data-act="signoff" ${can('privacy_reviewer', 'legal_reviewer') ? '' : 'disabled'}>Sign off as ${S.role === 'legal_reviewer' ? 'Legal' : 'Privacy'}</button></div>${roleNote('privacy_reviewer', 'legal_reviewer')}` : ''}
    </div>
  </div>`;
};

VIEWS.vendors = () => {
  const list = G.vendors.filter((v) => match('vendors', v.name, v.service, v.data, v.region, v.tier, v.status));
  return head('Vendors', 'Every processor and sub-processor that touches governed data, what they receive, and the agreements that cover it.', 'Vendor records feed the records of processing (Art. 30) and transfer impact assessments. Tier drives review frequency: critical and high every 6 months, others yearly.') + `
  <div class="grid">
    ${kpi(G.vendors.length, 'Vendors', 'processors and sub-processors')}${kpi(G.vendors.filter((v) => v.dpa).length + ' / ' + G.vendors.length, 'With signed DPA', 'GDPR Art. 28')}${kpi(G.vendors.filter((v) => v.scc).length, 'Covered by SCCs', 'for EU transfers')}${kpi(G.vendors.filter((v) => v.status === 'Review due').length, 'Reviews due', 'this month', G.vendors.some((v) => v.status === 'Review due') ? 'bad' : '')}
    <div class="card c12">${tools('vendors', list.length, G.vendors.length, 'Search vendors, services, data')}<div class="scroll-x"><table class="table"><thead><tr><th>Vendor</th><th>Data received</th><th>Region</th><th>DPA</th><th>SCCs</th><th>Tier</th><th>Last review</th><th>Status</th></tr></thead><tbody>
      ${list.map((v) => `<tr class="click" data-drawer="vendor:${v.name}"><td><b>${v.name}</b><span class="id">${v.service}</span></td><td>${v.data}</td><td>${v.region}</td><td>${v.dpa ? pill('ok', 'Signed') : pill('warn', 'Pending')}</td><td>${v.scc ? 'Yes' : 'No'}</td><td>${pill(v.tier === 'Critical' || v.tier === 'High' ? 'warn' : '', v.tier)}</td><td>${v.review}</td><td>${pill(v.status === 'Approved' ? 'ok' : 'warn', v.status)}</td></tr>`).join('')}
    </tbody></table></div></div>
  </div>`;
};
EXPORTS.vendors = () => [['vendor', 'service', 'data', 'region', 'dpa', 'scc', 'tier', 'last_review', 'status'], ...G.vendors.map((v) => [v.name, v.service, v.data, v.region, v.dpa, v.scc, v.tier, v.review, v.status])];

VIEWS.incidents = () => {
  const open = G.incidents.filter((i) => i.status !== 'Resolved');
  const sel = G.incidents.find((i) => i.id === S.incSel) || open[0] || G.incidents[0];
  const clock = (i) => { const left = i.opened + 72 * 36e5 - Date.now(); const hh = Math.floor(left / 36e5), mm = Math.floor((left % 36e5) / 6e4); return `${hh}h ${String(mm).padStart(2, '0')}m`; };
  return head('Incidents', 'Data and governance incidents, who is on them, and whether a regulator or users must be told.', 'Incidents open automatically from platform signals (policy engine outage, ledger verification failure) or by hand. If personal data may be affected, the 72 hour GDPR Art. 33 notification clock starts at detection.') + `
  <div class="grid">
    ${kpi(open.length, 'Open incidents', open.length ? open.map((i) => i.sev).join(', ') : 'none', open.length ? 'bad' : 'good')}
    ${kpi(open.filter((i) => i.personal).length, 'Possibly notifiable', 'personal data may be affected')}
    ${kpi(G.incidents.length, 'Incidents this quarter', 'including resolved')}
    ${kpi('1.9 h', 'Mean time to resolve', 'last 90 days')}
    <div class="card c5"><div class="row between"><h3>All incidents</h3><button class="btn" data-act="declare">Declare incident</button></div><table class="table"><tbody>${G.incidents.map((i) => `<tr class="click${i === sel ? ' sel' : ''}" data-inc="${i.id}"><td><b>${h(i.title)}</b><span class="id">${i.id} · ${new Date(i.opened).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</span></td><td>${pill(i.sev === 'SEV-1' ? 'deny' : i.sev === 'SEV-2' ? 'warn' : '', i.sev)}</td><td>${pill(i.status === 'Resolved' ? 'ok' : 'deny', i.status)}</td></tr>`).join('')}</tbody></table></div>
    <div class="card c7">${sel ? `<div class="row between"><div><h3>${h(sel.title)}</h3><span class="id">${sel.id} · owner ${sel.owner}</span></div>${pill(sel.status === 'Resolved' ? 'ok' : 'deny', sel.status)}</div>
      ${sel.personal && sel.status !== 'Resolved' ? `<div class="clock"><span>Regulator notification due in</span><b>${clock(sel)}</b><span>GDPR Art. 33, from detection</span></div>` : `<p class="note">${sel.personal ? 'Personal data assessed; notification decision recorded.' : 'No personal data affected: not notifiable. Recorded for accountability.'}</p>`}
      <ol class="steps">${sel.timeline.map(([k, v]) => `<li class="done"><span class="dot">✓</span><div><b>${k}</b><p>${h(v)}</p></div><span></span></li>`).join('')}</ol>
      ${sel.status !== 'Resolved' ? `<div class="row"><button class="btn primary" data-act="resolve-inc">Mark resolved</button></div>` : ''}` : '<p class="note">No incidents.</p>'}</div>
  </div>`;
};

const REPORTS = [
  ['ropa', 'Records of processing', 'GDPR Art. 30', 'Every dataset: purposes, categories, recipients, retention, transfers.'],
  ['dsr', 'Subject request SLA report', 'GDPR Art. 12', 'Every request with opened, due and closed dates.'],
  ['models', 'Model cards bundle', 'EU AI Act Art. 11', 'Cards for every registered model with training data provenance.'],
  ['evidence', 'Audit evidence pack', 'GDPR Art. 5(2)', 'Ledger verification result, Merkle anchors and entry count.'],
  ['vendors', 'Processor register', 'GDPR Art. 28', 'Vendors, data received, agreements and review dates.'],
  ['risks', 'Risk register export', 'ISO/IEC 42001', 'Risks, scores, owners and linked controls.'],
];
VIEWS.reports = () => head('Reports', 'One-click evidence for regulators, auditors and internal review, generated from live platform state.', 'Reports are built from the same records the platform enforces with, so they cannot drift from reality. Each generation is written to the audit ledger.') + `
  <div class="grid"><div class="card c12"><div class="reports">${REPORTS.map(([k, t, law, what]) => `<div class="report"><span class="ds-layer">${law}</span><b>${t}</b><p>${what}</p><button class="btn" data-act="report" data-key="${k}">Generate</button></div>`).join('')}</div></div></div>`;
async function generateReport(k) {
  let rows, name = k, type = 'text/csv', body;
  if (k === 'ropa') rows = [['dataset', 'purposes', 'data_categories', 'region', 'retention_days', 'legal_basis', 'recipients', 'transfers'], ...P.datasets.map((d) => [d.id, d.allowed_purposes.join(' '), d.pii.join(' '), d.region, d.retention_days, d.legal_basis, d.owner, d.region === 'EU' ? 'none outside EU' : 'n/a'])];
  if (k === 'dsr') rows = [['request', 'kind', 'opened', 'due', 'closed', 'status'], ...P.dsrs.map((d) => [d.idem, d.kind, new Date(d.opened).toISOString(), new Date(d.due).toISOString(), d.closed ? new Date(d.closed).toISOString() : '', d.status])];
  if (k === 'vendors') rows = EXPORTS.vendors();
  if (k === 'risks') rows = EXPORTS.risks();
  if (k === 'models') { type = 'application/json'; body = JSON.stringify(P.models.map((m) => m.card || E.modelCard({ ...m, excluded: {}, eligible: m.members.size }, P.dataset(m.trainedOn[0].table), { version: 'core-1.3.2' })), null, 2); }
  if (k === 'evidence') { type = 'application/json'; const v = await P.ledger.verify(); const a = await P.ledger.anchor(); body = JSON.stringify({ generated: new Date().toISOString(), entries: P.ledger.entries.length, verification: v, latest_anchor: a, anchors: P.ledger.anchors.length }, null, 2); }
  const blob = new Blob([body || csv(rows)], { type });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `custodian-${name}-${date(Date.now())}.${type === 'text/csv' ? 'csv' : 'json'}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  await P.ledger.append('report.generated', S.token.claims.sub, { report: k });
  toast('Report generated and recorded in the audit ledger');
}

/* ── observability: Grafana-style dashboard over live and historical metrics ── */
function rangeBar() { return `<div class="seg range">${Object.keys(RANGES).map((k) => `<button class="${k === S.range ? 'on' : ''}" data-range="${k}">${k}</button>`).join('')}</div>`; }
function chaosSpikes() { return (S.chaosLog || []).map((t) => ({ ago: Date.now() - t, factor: 6, width: 2 })); }
VIEWS.observability = () => {
  const r = S.range, last = S.series.at(-1) || { personalized: 0, contextual: 0, fallback: 0 };
  const rps = (last.personalized + last.contextual) * 60;
  const lat = P.decisions.map((d) => d.decision.latency_ms).sort((a, b) => a - b);
  const p99 = lat.length ? lat[Math.floor(lat.length * 0.99)] : 0.2;
  const lag = lagP95();
  const fbLive = last.personalized + last.contextual ? (last.fallback / (last.personalized + last.contextual)) * 100 : 0;
  const allow = history('allow', r, { base: 520 }), deny = history('deny', r, { base: 1650 });
  const p99s = history('p99', r, { base: 2.1, jitter: 0.25, daily: 0.15 });
  const fbs = history('fb', r, { base: 0.05, jitter: 0.9, daily: 0, live: fbLive > 0 ? fbLive : null, spikes: chaosSpikes().map((x) => ({ ...x, factor: 400 })) });
  const lastV = (pts) => pts[pts.length - 1][1];
  const panel = (title, value, sub, chart, cls = 'c6') => `<div class="card ${cls} panel"><div class="row between"><h3>${title}</h3><span class="pv">${value}</span></div><span class="note">${sub}</span>${chart}</div>`;
  return head('Dashboard', 'Live health of every control, with history. Hover any chart to inspect a moment.', 'Metrics are exported by each service as Prometheus series and traced with OpenTelemetry. History here is modeled from the last 30 days; the most recent point is live from this session.') + `
  <div class="dash-bar">${rangeBar()}<span class="live-dot"></span><span class="note" style="margin:0">Live · refreshing every second · ${RANGES[r].label}</span></div>
  <div class="grid">
    ${panel('Policy decisions per minute', fmt(Math.round(lastV(allow) + lastV(deny))), 'Allowed vs denied on the personalization path', tsChart([{ name: 'Allowed', color: '#34c759', points: allow }, { name: 'Denied', color: '#ff9f0a', points: deny }], { range: r, stacked: true }))}
    ${panel('Decision latency', lastV(p99s).toFixed(1) + ' ms', 'p50 and p99 at the policy engine, SLO under 10 ms', tsChart([{ name: 'p99', color: '#0071e3', points: p99s }, { name: 'p50', color: '#64d2ff', points: history('p50', r, { base: 0.6, jitter: 0.2, daily: 0.1 }) }], { range: r, threshold: { value: 10, label: 'SLO 10 ms' }, fmt: (v) => v.toFixed(1) }))}
    ${panel('Consent propagation p95', lag === null ? 'measuring' : (lag / 1000).toFixed(1) + ' s', 'Postgres to Redis, SLO under 5 s', tsChart([{ name: 'p95', color: '#bf5af2', points: history('lag', r, { base: 1.7, jitter: 0.3, daily: 0.2, live: lag === null ? null : lag / 1000, spikes: [{ ago: 864e5 * 9, factor: 4.4, width: 2 }] }) }], { range: r, area: true, threshold: { value: 5, label: 'SLO 5 s' }, fmt: (v) => v.toFixed(1) + 's' }))}
    ${panel('Fail-closed fallback rate', lastV(fbs).toFixed(2) + '%', 'Requests served non-personalized because policy was unreachable', tsChart([{ name: 'Fallback', color: '#ff3b30', points: fbs }], { range: r, area: true, fmt: (v) => (v < 1 ? v.toFixed(2) : v.toFixed(0)) + '%' }))}
    ${panel('Pipeline throughput', '53.4M', 'Records per hour across Flink and Spark jobs', tsChart([{ name: 'Streaming', color: '#0071e3', points: history('stream', r, { base: 2.1e6 }) }, { name: 'Batch', color: '#5e5ce6', points: history('batch', r, { base: 0.9e6, jitter: 0.4, daily: 0.6 }) }], { range: r, stacked: true }), 'c6')}
    ${panel('Audit ledger appends', fmt(P.ledger.entries.length), 'Entries per minute; anchors every 30 s', tsChart([{ name: 'Appends', color: '#30b0c7', points: history('ledger', r, { base: 64, jitter: 0.3 }) }], { range: r, area: true }), 'c6')}
    ${panel('Error budget remaining', Math.round(Math.min(...E.SERVICES.map((x) => x.budget)) * 100) + '%', 'Lowest across platform services this month', tsChart(E.SERVICES.slice(0, 4).map((x, i) => ({ name: x.name, color: ['#0071e3', '#34c759', '#ff9f0a', '#bf5af2'][i], points: history('eb' + x.name, r, { base: x.budget * 100, jitter: 0.02, daily: 0 }) })), { range: r, max: 100, fmt: (v) => Math.round(v) + '%' }), 'c12')}
  </div>`;
};

/* ── slide-over drawer for any object: overview, activity, access ── */
function openDrawer(kind, id) { if (kind === 'dataset') S.sel.dataset = id; S.drawer = { kind, id, tab: (S.drawer && S.drawer.id === id && S.drawer.tab) || 'overview' }; S.inspector = true; layoutInspector(); drawDrawer(); }
function closeDrawer() { S.drawer = null; drawDrawer(); }
const SELF_DETAIL = new Set(['lifecycle', 'review']);
function layoutInspector() { $('#app').classList.toggle('no-insp', !S.inspector || (SELF_DETAIL.has(S.view) && !S.drawer)); $('#btn-insp').classList.toggle('on', S.inspector); }
const glist = (rows) => `<div class="glist">${rows.filter(Boolean).map(([k, v]) => `<div class="grow"><span>${k}</span><span>${v}</span></div>`).join('')}</div>`;
function drawDrawer() {
  const el = $('#inspector');
  if (!el) return;
  if (!S.drawer) {
    el.innerHTML = `<div class="insp-empty"><b>No Selection</b><span>Select a dataset, model, risk, vendor or person to inspect it here.</span></div>`;
    return;
  }
  const { kind, id, tab } = S.drawer;
  let title = id, sub = '', overview = '', acts = [], access = '', glyph = 'data'; let actOverride = null;
  if (kind === 'dataset') {
    const d = P.dataset(id); title = nm(id); sub = id; glyph = 'data';
    overview = glist([['Classification', pill(d.classification)], ['Status', pill(d.status)], ['Region', d.region], ['Layer', d.layer], ['Owner', h(d.owner)], ['Steward', h(d.steward)], ['Legal basis', d.legal_basis.replace('_', ' ')], ['Retention', d.retention_days + ' days'], ['Allowed for', d.allowed_purposes.map(nm).join(', ')], ['Location', `<span class="mono">s3://${d.bucket}</span>`]])
      + `<h4 class="insp-h">Personal data</h4><div class="tags">${d.pii.length ? d.pii.map((t) => pill(['device_id', 'precise_location', 'email', 'free_text'].includes(t) ? 'deny' : '', t)).join('') : '<span class="note">None detected</span>'}</div>`
      + (P.tables[id] ? `<h4 class="insp-h">Table history</h4>${glist(P.tables[id].snapshots.map((x) => [`<span class="mono">${x.id}</span>`, x.op + (x === P.tables[id].current ? ' · current' : '')]))}` : '')
      + (d.status === 'pending' ? `<div class="row"><button class="btn primary" data-act="approve-ds" ${can('data_steward') ? '' : 'disabled'}>Approve</button><button class="btn danger" data-act="reject-ds" ${can('data_steward') ? '' : 'disabled'}>Reject</button></div>${roleNote('data_steward')}` : '')
      + `<div class="row"><button class="btn" data-opends-go="${id}">Open data</button><button class="btn" data-lnode-go="${id}">Lineage</button></div>`;
    acts = P.ledger.entries.filter((e) => e.payload.dataset === id || e.payload.dataset === id + '_ads');
    const grants = P.grants.filter((g) => g.dataset === id);
    access = grants.length ? glist(grants.map((g) => [h(nm(g.principal)), `${nm(g.purpose)}, ${g.region}<span class="id">until ${date(g.expires)}</span>`])) : '<p class="note">No active grants. Access requires an approved request.</p>';
  }
  if (kind === 'risk') {
    const r = G.risks.find((x) => x.id === id); title = r.title; sub = r.id; glyph = 'risk';
    overview = glist([['Score', pill(RISK_COLOR(r.L * r.I), String(r.L * r.I))], ['Likelihood', r.L + ' of 5'], ['Impact', r.I + ' of 5'], ['Category', r.cat], ['Owner', r.owner], ['Status', r.status]]) + `<h4 class="insp-h">Treatment</h4><p class="insp-p">${h(r.treat)}</p><h4 class="insp-h">Controls</h4><div class="tags">${r.controls.map((c) => pill('ok', c)).join('')}</div>`;
    access = `<p class="note">Owner ${r.owner}. Reviewed by privacy, legal and security.</p>`;
  }
  if (kind === 'vendor') {
    const v = G.vendors.find((x) => x.name === id); title = v.name; sub = v.service; glyph = 'settings';
    overview = glist([['Tier', pill(v.tier === 'Critical' || v.tier === 'High' ? 'warn' : '', v.tier)], ['Status', pill(v.status === 'Approved' ? 'ok' : 'warn', v.status)], ['Region', v.region], ['DPA', v.dpa ? 'Signed' : 'Pending'], ['SCCs', v.scc ? 'Yes' : 'No'], ['Last review', v.review]]) + `<h4 class="insp-h">Data received</h4><p class="insp-p">${h(v.data)}</p>`;
    access = '<p class="note">Vendor access is limited to the datasets in its agreement, through scoped service credentials.</p>';
  }
  if (kind === 'model') {
    const m = P.models.find((x) => E.mname(x) === id); title = id; sub = E.WORKLOADS[m.workload].name; glyph = 'models';
    const card = m.card || E.modelCard({ ...m, excluded: {}, eligible: m.members.size }, P.dataset(m.trainedOn[0].table), { version: 'core-1.3.2' });
    const ex = Object.entries(card.governance.exclusions || {}).filter(([, v]) => v);
    overview = glist([['Stage', m.stage], ['Status', pill(m.status)], ['Score', m.auc], ['Policy at training', card.governance.policy_bundle], ['Trained on', m.trainedOn.map((t) => `${nm(t.table)}<span class="id">@${t.snapshot}</span>`).join('')], ['People included', fmt(m.members.size)]])
      + (m.status === 'retrain_required' ? '<div class="decision deny"><h4>Retraining required</h4><ul><li>An erased person was in this model\'s training data.</li></ul></div>' : '')
      + `<h4 class="insp-h">Intended purpose</h4><p class="insp-p">${h(card.intended_purpose)}</p><h4 class="insp-h">Out of scope</h4><p class="insp-p">${card.out_of_scope.map(h).join('<br>')}</p>`
      + (ex.length ? `<h4 class="insp-h">Excluded from training</h4>${glist(ex.map(([k, v]) => [rsn(k), fmt(v)]))}` : '')
      + `<h4 class="insp-h">Evaluation</h4><p class="insp-p">Score ${card.evaluation.auc}. ${card.evaluation.slice_check}.</p><p class="note">${h(card.regulation)}</p>`;
    acts = P.ledger.entries.filter((e) => e.payload.model === id);
    access = glist(E.ENDPOINTS.filter((x) => x.model === id).map((x) => [x.id, x.consumers.map(nm).join(', ')])) || '<p class="note">Not served by an endpoint.</p>';
  }
  if (kind === 'lnode') {
    const g = L.lineageGraph(P), n = g.nodes.find((x) => x.id === id), im = L.impact(g, id), ep = E.ENDPOINTS.find((x) => x.id === id);
    title = n ? n.name : id; sub = n ? (n.type === 'source' ? 'Source system' : 'Inference endpoint') : ''; glyph = n && n.type === 'endpoint' ? 'ops' : 'data';
    overview = n ? glist([['Owner', h(n.owner)], ['Workloads', n.workloads.map((w) => E.WORKLOADS[w].name).join(', ')], ['Upstream', im.up.size], ['Downstream', im.down.size], ep && ['Serves', ep.model], ep && ['Regions', ep.regions.join(', ')], ep && ['Purpose', nm(ep.purpose)], ep && ['Auth', ep.auth]]) + (id === 'consent-store' ? '<h4 class="insp-h">Policy input</h4><p class="insp-p">Jobs that filter people join against consent as it was known at the snapshot time, so a training set can be rebuilt exactly.</p>' : '') : '';
    access = ep ? glist(ep.consumers.map((c) => [h(nm(c)), 'registered consumer'])) : '<p class="note">Writes only through its ingestion job identity.</p>';
  }
  if (kind === 'run') {
    const r = RUNS.find((x) => x.id === id);
    if (!r) { S.drawer = null; return drawDrawer(); }
    const J = L.JOBS[r.job] || {}, dr = Object.entries(r.dropped || {}).filter(([, v]) => v);
    title = r.job; sub = 'Run ' + r.id.slice(0, 8); glyph = 'ops';
    overview = glist([['State', pill(r.state === 'COMPLETE' ? 'ok' : r.state === 'FAIL' ? 'deny' : 'live', r.state.toLowerCase())], ['Engine', h(J.engine || '')], ['Started', new Date(r.start).toLocaleString('en-GB', { hour12: false })], ['Ended', r.state === 'RUNNING' ? 'streaming' : new Date(r.end).toLocaleString('en-GB', { hour12: false })], ['Rows read', r.rowsIn ? fmt(r.rowsIn) : '·'], ['Rows written', r.rowsOut ? fmt(r.rowsOut) : '·']])
      + (r.error ? `<div class="decision deny"><h4>Run failed safely</h4><ul><li>${h(r.error)}</li></ul></div>` : '')
      + (dr.length ? `<h4 class="insp-h">Dropped, by reason</h4>${glist(dr.map(([k, v]) => [rsn(k), fmt(v)]))}` : '')
      + `<h4 class="insp-h">OpenLineage event</h4><pre class="code insp-code">${h(JSON.stringify(olEvent(r), null, 2))}</pre>`;
    acts = []; actOverride = `<div class="glist">${(J.stages || []).map((x, i) => `<div class="grow"><span>${i + 1}. ${h(x)}</span><span>${r.state === 'FAIL' && i === 1 ? pill('deny', 'blocked') : pill('ok', 'done')}</span></div>`).join('')}</div>`;
    access = glist([['Ran as', `<span class="mono">svc-${h(r.job.replace(/^train_/, '').split('-')[0])}-runner</span>`], ['Token', 'client credentials, 15 min'], ['Scope', r.job.startsWith('train_') ? 'dataset:read purpose:model_training' : 'dataset:read dataset:write']]);
  }
  if (kind === 'person' && !P.userById.get(id)) { el.innerHTML = `<div class="insp-empty"><b>Erased</b><span>${h(id)} was deleted by a subject request. Only a pseudonymous tombstone remains as proof.</span></div>`; return; }
  if (kind === 'person') {
    const u = P.userById.get(id); const c = P.cache.get(id); title = id; sub = `${u.region} · ${E.regionInfo(u.region).law}`; glyph = 'privacy';
    overview = glist([['Region', u.region], ['Age range', u.age_band.replace(/_/g, ' ')], ['Tracking (ATT)', u.att], ['Personalized ads', u.personalizedAdsToggle ? 'On' : 'Off'], ['Global Privacy Control', u.gpc ? 'Sent' : 'No'], ['Services', u.services.join(', ')]]) + `<h4 class="insp-h">Consent</h4>${glist(E.PURPOSES.map((p) => [nm(p), c ? pill(c.consent[p]) : 'unknown']))}<h4 class="insp-h">Where their data lives</h4>${glist(P.locate(id).map((x) => [h(x.name), x.kind]))}`;
    acts = P.ledger.entries.filter((e) => e.subject && false);
    access = '<p class="note">Only privacy reviewers and auditors can see a person\'s full record. This view is limited to governance attributes.</p>';
  }
  const actHtml = actOverride || (acts.length ? `<ul class="feed">${acts.slice(-12).reverse().map((e) => `<li><span class="when">${time(e.ts)}</span><span><b>${h(nm(e.actor))}</b> ${h((ACTIVITY[e.type] || ((x) => x.type))(e))}<span class="id">#${e.seq} · ${e.hash.slice(0, 12)}</span></span></li>`).join('')}</ul>` : '<p class="note">No recorded activity yet.</p>');
  el.innerHTML = `<div class="insp-head"><span class="insp-glyph">${icon(glyph)}</span><div><h3>${h(title)}</h3><span class="id">${h(sub)}</span></div><button class="icon-btn" data-closedrawer aria-label="Clear selection">×</button></div>
    <div class="insp-tabs"><div class="seg">${[['overview', 'Overview'], ['activity', 'Activity'], ['access', 'Access']].map(([k, t]) => `<button class="${k === tab ? 'on' : ''}" data-drawertab="${k}">${t}</button>`).join('')}</div></div>
    <div class="insp-body">${tab === 'overview' ? overview : tab === 'activity' ? actHtml : access}</div>`;
}

/* ── catalog ── */
const VIEWS_SAVED = { all: ['All datasets', () => true], pending: ['Pending review', (d) => d.status === 'pending'], restricted: ['Restricted', (d) => d.classification === 'restricted'], eu: ['EU', (d) => d.region === 'EU'], post: ['Post-training', (d) => d.layer === 'post-training'] };
const catalogRows = () => P.datasets.filter((d) => VIEWS_SAVED[S.catView || 'all'][1](d)).filter((d) => match('catalog', d.id, nm(d.id), d.classification, d.owner, d.region, d.workload && E.WORKLOADS[d.workload].name, d.pii.join(' ')));
EXPORTS.catalog = () => [['dataset', 'name', 'workload', 'classification', 'pii', 'region', 'allowed_purposes', 'retention_days', 'status', 'owner'], ...catalogRows().map((d) => [d.id, nm(d.id), d.workload || 'shared', d.classification, d.pii.join(' '), d.region, d.allowed_purposes.join(' '), d.retention_days, d.status, d.owner])];
VIEWS.catalog = () => {
  const sel = P.dataset(S.sel.dataset);
  const exists = P.dataset(S.newDs);
  return head('Catalog', 'Every dataset that feeds an AI workload, who owns it, how sensitive it is, and what it may be used for.', 'Registration runs a PII scanner on schema and samples and proposes tags. Datasets start pending and cannot be read by any job until a steward approves them.') + `
  <div class="grid">
    <div class="card c12"><div class="row between"><div class="seg">${Object.entries(VIEWS_SAVED).map(([k, [t, f]]) => `<button class="${(S.catView || 'all') === k ? 'on' : ''}" data-catview="${k}">${t} <span class="cnt">${P.datasets.filter(f).length}</span></button>`).join('')}</div></div>
      ${tools('catalog', catalogRows().length, P.datasets.length, 'Search datasets, owners, PII')}
      ${S.bulk.size ? `<div class="bulk"><b>${S.bulk.size} selected</b><button class="btn" data-act="bulk-approve" ${can('data_steward') ? '' : 'disabled'}>Approve</button><button class="btn" data-act="bulk-review">Request review</button><button class="btn" data-act="bulk-export">Export</button><button class="btn" data-act="bulk-clear">Clear</button></div>` : ''}
      <div class="scroll-x"><table class="table"><thead><tr><th class="cb"><input type="checkbox" data-bulkall ${S.bulk.size && S.bulk.size === catalogRows().length ? 'checked' : ''}></th><th>Dataset</th><th>Workload</th><th>Classification</th><th>PII</th><th>Region</th><th>Allowed purposes</th><th>Retention</th><th>Status</th></tr></thead><tbody>
      ${catalogRows().map((d) => `<tr class="click${S.bulk.has(d.id) ? ' sel' : ''}" data-drawer="dataset:${d.id}"><td class="cb"><input type="checkbox" data-bulk="${d.id}" ${S.bulk.has(d.id) ? 'checked' : ''}></td><td>${named(d.id)}</td><td>${d.workload ? E.WORKLOADS[d.workload].name : 'shared'}</td><td>${pill(d.classification)}</td><td><div class="tags">${d.pii.map((t) => pill('', t)).join('')}</div></td><td>${d.region}</td><td>${d.allowed_purposes.map(nm).join(', ')}</td><td>${d.retention_days} d</td><td>${pill(d.status)}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="card c6"><h3>Register a dataset</h3><p class="note">Schema and samples from the iOS collector. The scanner proposes PII tags; a steward confirms them.</p>
      <div class="fields"><label class="field">Name<input data-bind="newDs" value="${h(S.newDs)}"></label><label class="field">Source<input value="ios-collector (maps)" disabled></label></div>
      <div class="scroll-x"><table class="table"><thead><tr><th>Column</th><th>Type</th><th>Sample</th><th>Scanner</th></tr></thead><tbody>
      ${E.DEMO_SCHEMA.map((c) => { const f = S.scan && S.scan.findings.filter((x) => x.column === c.name); return `<tr><td class="mono">${c.name}</td><td>${c.type}</td><td class="mono">${h(c.sample)}</td><td>${f && f.length ? f.map((x) => pill(x.tag === 'precise_location' || x.tag === 'device_id' ? 'deny' : 'warn', x.tag)).join(' ') : (S.scan ? '<span class="note">clean</span>' : '')}</td></tr>`; }).join('')}
      </tbody></table></div>
      <div class="row"><button class="btn primary" data-act="register" ${can('ml_engineer', 'data_steward') && !exists ? '' : 'disabled'}>Register and scan</button>${exists ? `<span class="note" style="margin:0">${h(S.newDs)} is registered.</span>` : ''}</div>${roleNote('ml_engineer', 'data_steward')}
    </div>
    <div class="card c6"><h3>${sel ? h(nm(sel.id)) : 'Dataset details'}</h3>${sel ? datasetDetail(sel) : '<p class="note">Select a dataset to open its details.</p>'}</div>
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
  return head('Access requests', 'Who can use which data, for what, and for how long. Every grant has a purpose, a region and an end date.', 'Each request is a durable Temporal workflow: an automatic policy pre-check, human reviews by role, a conditional grant, and a timer that revokes access at expiry. A restart resumes exactly where it stopped.') + `
  <div class="grid">
    <div class="card c5"><h3>Requests</h3>${P.accessRequests.length ? `<table class="table"><tbody>${P.accessRequests.map((r) => `<tr class="click${sel && r.id === sel.id ? ' sel' : ''}" data-request="${r.id}"><td class="mono">${r.id}</td><td>${h(nm(r.dataset))}<br><span class="note">${h(nm(r.requester))} · ${nm(r.purpose)}, ${r.region}, ${r.days} days</span></td><td>${pill(r.status)}</td></tr>`).join('')}</tbody></table>` : '<p class="note">No requests yet. Register a dataset in the catalog and request access.</p>'}
      <h3>Active grants</h3><table class="table"><tbody>${P.grants.map((g) => `<tr><td>${h(nm(g.principal))}</td><td>${h(nm(g.dataset))}<br><span class="note">${nm(g.purpose)}, ${g.region}</span></td><td style="white-space:nowrap">${g.expires > Date.now() ? 'until ' + date(g.expires) : pill('deny', 'expired')}</td></tr>`).join('')}</tbody></table>
    </div>
    <div class="card c7">${sel ? requestDetail(sel) : '<h3>Workflow</h3><p class="note">Select a request.</p>'}</div>
  </div>`;
};
function requestDetail(r) {
  const cur = r.steps.find((s) => s.state === 'pending' || s.state === 'running');
  return `<h3>${r.id} <span class="right">workflow access-request/${r.id.toLowerCase()}</span></h3>
  <dl class="kv"><dt>Requester</dt><dd>${named(r.requester)}</dd><dt>Dataset</dt><dd>${named(r.dataset)}</dd><dt>Purpose</dt><dd>${nm(r.purpose)}, ${r.region} only, ${r.days} days</dd><dt>Justification</dt><dd>${h(r.justification)}</dd></dl>
  <ol class="steps">${r.steps.map((s) => `<li class="${s.state}"><span class="dot">${s.state === 'done' ? '✓' : s.state === 'rejected' ? '×' : ''}</span><div><b>${s.name}</b>${s.detail ? `<p>${h(s.detail)}</p>` : ''}<p>${s.role === 'system' ? 'Automatic' : 'Assigned to <code>' + s.role + '</code>'}${s.by ? ', by ' + h(s.by) : ''}</p></div><span>${s.state !== 'pending' ? pill(s.state === 'done' ? 'done' : s.state) : ''}</span></li>`).join('')}</ol>
  ${cur && cur.role !== 'system' ? `<div class="row"><button class="btn primary" data-act="approve-step" ${can(cur.role) ? '' : 'disabled'}>Approve ${cur.key} review</button><button class="btn danger" data-act="reject-step" ${can(cur.role) ? '' : 'disabled'}>Reject</button></div>${roleNote(cur.role)}` : ''}
  ${r.status === 'granted' ? `<div class="row"><button class="btn" data-act="expire-grant">Simulate expiry</button></div>` : ''}
  ${r.precheck ? decisionBox(r.precheck, ' · automatic pre-check') : ''}`;
}

async function requestAccess(opts = {}) {
  const r = E.newAccessRequest(P, { requester: S.token.claims.sub, dataset: S.newDs, purpose: 'ads_personalization', region: 'US', days: 90, justification: 'Train the place-ad ranker on in-app engagement signals.', ...(opts.dataset ? opts : {}) });
  S.sel.request = r.id;
  await P.ledger.append('access.requested', S.token.claims.sub, { request: r.id, dataset: r.dataset, purpose: r.purpose });
  go('access');
  await sleep(500);
  const ds = P.dataset(r.dataset);
  const pre = E.decide({ principal: { sub: r.requester }, purpose: r.purpose, dataset: ds, processing_region: r.region, grant: true });
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
  cur.detail = cur.key === 'privacy' ? (P.dataset(r.dataset).classification === 'restricted' ? 'DPIA reference DPIA-2026-118. Condition: minimized view, US processing only.' : 'DPIA reference DPIA-2026-121. Purpose-limited grant, US processing only.') : 'Restricted source reviewed. Legitimate interest assessment attached. 90 day limit.';
  await P.ledger.append('access.approved', S.token.claims.sub, { request: r.id, step: cur.key });
  const next = r.steps.find((s) => s.state === 'pending');
  if (next && next.key === 'grant') {
    const restricted = P.dataset(r.dataset).classification === 'restricted';
    const view = restricted ? r.dataset + '_ads' : r.dataset;
    if (restricted && !P.dataset(view)) P.datasets.push({ id: view, layer: 'features', owner: 'ads-ml', steward: 'Luis Ortega', classification: 'confidential', pii: ['user_id', 'coarse_location'], region: 'US', allowed_purposes: ['ads_personalization', 'model_training'], retention_days: 90, sources: ['maps'], status: 'approved', legal_basis: 'legitimate_interest', bucket: 'lake-us-west', conditions: 'Derived from ' + r.dataset + ': latitude/longitude reduced to geohash-5, IDFA dropped.' });
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
  const live = E.decide(input, 'core-1.4.0'), shadow = E.decide(input, 'core-1.5.0');
  const opt = (arr, cur) => arr.map((v) => `<option${v === cur ? ' selected' : ''}>${v}</option>`).join('');
  return head('Policies', 'The rules every AI workload follows, written as code, tested, and previewed before rollout.', 'Policy as code in Rego. The policy engine decides; gateways, the training gate, workflows and the lakehouse enforce. Every decision carries reasons and the bundle version. Shadow bundles run beside the live one to show impact before rollout.') + `
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
      <table class="table"><tbody><tr><td class="mono">core-1.4.0</td><td>${pill('live')}</td><td>${E.POLICY_BUNDLES['core-1.4.0'].rules.length} rules, opa test: 5 passing</td></tr><tr><td class="mono">core-1.5.0</td><td>${pill('shadow')}</td><td>${E.POLICY_BUNDLES['core-1.5.0'].rules.length} rules, evaluated alongside live, never enforced</td></tr></tbody></table>
      <h3>Shadow mode diff</h3><p class="note">Evaluate both bundles over every user on the personalization path and show where they would disagree before rollout.</p>
      <div class="row"><button class="btn primary" data-act="shadow">Run shadow comparison</button></div>
      ${S.shadow ? `<p class="note">${fmt(S.shadow.total)} users evaluated in ${S.shadow.ms.toFixed(0)} ms. ${fmt(S.shadow.flips)} decisions would change (${pct(S.shadow.flips, S.shadow.total)}), all allow to deny.</p>${bars(Object.entries(S.shadow.by).sort((a, b) => b[1] - a[1]).map(([k, v]) => [rsn(k), v]), 'red')}` : ''}
    </div>
    <div class="card c12"><h3>policies/ads.rego <span class="right">core-1.4.0</span></h3><pre class="code">${highlightRego(regoSource || 'loading...')}</pre></div>
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
    const a = E.decide(input, 'core-1.4.0'), b = E.decide(input, 'core-1.5.0');
    if (a.allow !== b.allow) { flips++; for (const r of b.reasons) if (!a.reasons.some((x) => x.code === r.code)) by[r.code] = (by[r.code] || 0) + 1; }
  }
  S.shadow = { total: P.users.length, flips, by, ms: performance.now() - t };
  render();
}

/* ── training gate ── */
VIEWS.training = () => {
  const r = S.train.result;
  const opt = (arr, cur) => arr.map((v) => `<option${v === cur ? ' selected' : ''}>${v}</option>`).join('');
  return head('Training gate', 'Models only learn from data and people that allow it. Every run shows who was left out and why.', 'The job receives a 15 minute token scoped to one dataset and purpose, asks the policy engine, then joins the table snapshot against consent as it was known at that snapshot (point in time). The run is recorded in lineage with the exact snapshot ID.') + `
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
    <h3>Excluded by reason</h3>${bars(ex.map(([k, v]) => [rsn(k), v]), 'red')}
    <div class="row"><button class="btn" data-go="models">Open model card</button><button class="btn" data-lnode-go="${E.mname(m)}">View lineage</button></div>`;
}

/* ── models ── */
EXPORTS.models = () => [['model', 'workload', 'stage', 'status', 'score', 'trained_on'], ...P.models.map((m) => [E.mname(m), E.WORKLOADS[m.workload].name, m.stage, m.status, m.auc, m.trainedOn.map((t) => t.table + '@' + t.snapshot).join(' ')])];
VIEWS.models = () => {
  const list = P.models.filter((m) => match('models', E.mname(m), E.WORKLOADS[m.workload].name, m.stage, m.status));
  return head('Models', 'Every model, what it may be used for, and the data it learned from. Select a model to see its card in the Inspector.', 'Model cards are generated at registration from lineage and the training gate. When an erased person was in a model\'s training data, the model is flagged for retraining.') + `
  <div class="grid">
    ${kpi(P.models.length, 'Registered models', `${P.models.filter((m) => m.stage === 'Production').length} in production`)}
    ${kpi(P.models.filter((m) => m.status === 'retrain_required').length, 'Need retraining', 'erased people in training data', P.models.some((m) => m.status === 'retrain_required') ? 'bad' : 'good')}
    ${kpi(P.models.filter((m) => m.card).length + P.models.filter((m) => !m.card).length, 'With model cards', 'generated at registration')}
    ${kpi(E.ENDPOINTS.length, 'Inference endpoints', 'ABAC on every call')}
    <div class="card c12">${tools('models', list.length, P.models.length, 'Search models, workloads, stages')}<div class="scroll-x"><table class="table"><thead><tr><th>Model</th><th>Workload</th><th>Stage</th><th>Status</th><th>Score</th><th>Trained on</th><th>People included</th><th>Registered</th></tr></thead><tbody>
      ${list.map((m) => `<tr class="click${S.drawer && S.drawer.id === E.mname(m) ? ' sel' : ''}" data-model="${E.mname(m)}"><td class="mono">${E.mname(m)}</td><td>${E.WORKLOADS[m.workload].name}</td><td>${m.stage}</td><td>${pill(m.status)}</td><td>${m.auc}</td><td>${m.trainedOn.map((t) => h(nm(t.table))).join(', ')}</td><td>${fmt(m.members.size)}</td><td>${date(m.created)}</td></tr>`).join('')}
    </tbody></table></div></div>
  </div>`;
};

/* ── lineage ── */
const LIN_CLS = { restricted: '#ff3b30', confidential: '#ff9f0a', internal: '#8e8e93', public: '#34c759' };
const LIN_TYPE = { source: '#5e5ce6', model: '#0071e3', endpoint: '#30b0c7' };
const LIN_WL = [['all', 'All workloads'], ['ads_ranking', 'Ads ranking'], ['assistant_llm', 'Assistant'], ['search_quality', 'Search']];
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const strHash = (s) => { let x = 2166136261; for (const c of s) x = Math.imul(x ^ c.charCodeAt(0), 16777619); return x >>> 0; };
const runUuid = (s) => { const a = [strHash(s), strHash(s + '1'), strHash(s + '2'), strHash(s + '3')].map((n) => n.toString(16).padStart(8, '0')).join(''); return `${a.slice(0, 8)}-${a.slice(8, 12)}-4${a.slice(13, 16)}-a${a.slice(17, 20)}-${a.slice(20, 32)}`; };
const linName = (n) => (n.type === 'dataset' ? nm(n.id) : n.name);
const linSub = (n) => (n.type === 'dataset' ? `${n.region} · ${n.classification}${n.status === 'pending' ? ' · pending' : ` · ${n.retention} d`}` : n.type === 'model' ? n.stage.toLowerCase() + (n.status === 'retrain_required' ? ' · retrain required' : '') : n.sub);
function linGraph() {
  const g = L.lineageGraph(P);
  if (S.lin.wl === 'all') return g;
  const keep = new Set(g.nodes.filter((n) => n.workloads.includes(S.lin.wl)).map((n) => n.id));
  return { nodes: g.nodes.filter((n) => keep.has(n.id)), edges: g.edges.filter((e) => keep.has(e.from) && keep.has(e.to)) };
}

/* OpenLineage run events: recent runs of every job, plus training runs from this session. */
let RUNS = [];
function linRuns(g) {
  const now = Date.now(), runs = [];
  const ver = (id, k = 0) => (P.tables[id] ? P.tables[id].snapshots[Math.max(0, P.tables[id].snapshots.length - 1 - k)].id : String(1000 + (strHash(id) % 8000) - k));
  const ds = (id, k) => { const d = P.dataset(id); return { name: id, ns: d ? `s3://${d.bucket}` : id.includes('-') ? 'custodian' : 'models', version: d ? ver(id, k) : null }; };
  const byJob = {};
  for (const e of g.edges) if (e.kind === 'data') (byJob[e.job] ||= []).push(e);
  for (const [job, es] of Object.entries(byJob)) {
    const J = L.JOBS[job]; if (!J || job.startsWith('train_') || job === 'deploy' || job === 'eval-gate') continue;
    const every = /hourly/.test(J.schedule) ? 36e5 : /daily/.test(J.schedule) ? 864e5 : /weekly/.test(J.schedule) ? 6048e5 : 864e5 * 4;
    const ins = [...new Set(es.map((e) => e.from))], outs = [...new Set(es.map((e) => e.to))];
    const dropped = Object.values(J.dropped || {}).reduce((a, b) => a + b, 0);
    const n = J.mode === 'streaming' ? 1 : 2;
    for (let k = 0; k < n; k++) {
      const end = J.mode === 'streaming' ? now : now - (strHash(job) % 50) * 6e4 - k * every;
      const span = J.mode === 'streaming' ? 864e5 * 6 : (parseInt(J.duration) || 5) * 6e4;
      const fail = job === 'assistant-redaction' && k === 1;
      runs.push({ id: runUuid(job + k), job, state: J.mode === 'streaming' ? (J.records_in ? 'RUNNING' : 'PAUSED') : fail ? 'FAIL' : 'COMPLETE', start: end - span, end, inputs: ins.map((i) => ds(i, k + 1)), outputs: fail ? [] : outs.map((o) => ds(o, k)), rowsIn: J.records_in, rowsOut: fail ? 0 : J.records_in - dropped, dropped: fail ? {} : J.dropped || {}, error: fail ? 'Schema contract check: column message_v2 is not in the registered schema. Run blocked before write; retried after the contract was updated.' : null });
    }
  }
  const trained = new Set(P.lineageRuns.map((r) => r.outputs[0].model));
  for (const m of P.models) {
    const id = E.mname(m);
    if (!g.nodes.some((x) => x.id === id)) continue;
    const live = P.lineageRuns.find((r) => r.outputs[0].model === id);
    const at = live ? live.at : m.created;
    const ins = g.edges.filter((e) => e.to === id && e.kind === 'data').map((e) => { const t = m.trainedOn.find((x) => x.table === e.from); return { name: e.from, ns: `s3://${P.dataset(e.from).bucket}`, version: t ? t.snapshot : ver(e.from) }; });
    runs.push({ id: runUuid(id), job: 'train_' + m.id, state: 'COMPLETE', start: at - 6e5, end: at, inputs: ins, outputs: [{ name: id, ns: 'models', version: String(m.version) }], rowsIn: m.eligible || m.members.size, rowsOut: m.members.size, dropped: m.excluded ? Object.fromEntries(Object.entries(m.excluded).filter(([, v]) => v)) : {}, facets: live ? live.facets : { purpose: 'model_training', policy: 'core-1.3.2' }, session: trained.has(id) });
    if (m.stage === 'Production') { const ep = E.ENDPOINTS.find((x) => x.model === id); if (ep) runs.push({ id: runUuid('deploy' + id), job: 'deploy', state: 'COMPLETE', start: at + 864e5 * 2, end: at + 864e5 * 2 + 132e4, inputs: [{ name: id, ns: 'models', version: String(m.version) }], outputs: [{ name: ep.id, ns: 'endpoints', version: null }], rowsIn: 0, rowsOut: 0, dropped: {} }); }
  }
  RUNS = runs.sort((a, b) => b.end - a.end);
  return RUNS;
}
function olEvent(r) {
  const J = L.JOBS[r.job] || {};
  return {
    eventType: r.state === 'RUNNING' || r.state === 'PAUSED' ? 'RUNNING' : r.state, eventTime: new Date(r.end).toISOString(),
    producer: `https://custodian.acme.internal/agents/${(J.engine || 'custodian').toLowerCase().split(' ')[0]}`,
    schemaURL: 'https://openlineage.io/spec/2-0-2/OpenLineage.json#/definitions/RunEvent',
    run: { runId: r.id, facets: { custodian_policy: { bundle: (r.facets && r.facets.policy) || 'core-1.4.0', decision: 'allow' }, ...(r.facets && r.facets.consent_as_of ? { custodian_consent: { as_of: r.facets.consent_as_of } } : {}), ...(r.error ? { errorMessage: { message: r.error, programmingLanguage: 'python' } } : {}) } },
    job: { namespace: 'custodian', name: r.job, facets: { jobType: { processingType: J.mode === 'streaming' ? 'STREAMING' : 'BATCH', integration: (J.engine || '').toUpperCase() } } },
    inputs: r.inputs.map((x) => ({ namespace: x.ns, name: x.name, ...(x.version ? { facets: { version: { datasetVersion: x.version } } } : {}) })),
    outputs: r.outputs.map((x) => ({ namespace: x.ns, name: x.name, facets: { ...(x.version ? { version: { datasetVersion: x.version } } : {}), outputStatistics: { rowCount: r.rowsOut } } })),
  };
}

VIEWS.lineage = () => {
  const g = linGraph();
  const f = S.lin.focus && g.nodes.find((n) => n.id === S.lin.focus) ? S.lin.focus : null;
  const fn = f && g.nodes.find((n) => n.id === f);
  const hits = S.lineageUser && P.userById.get(S.lineageUser) ? P.locate(S.lineageUser) : null;
  const runs = linRuns(g);
  const shownRuns = (f ? runs.filter((r) => r.inputs.some((x) => x.name === f) || r.outputs.some((x) => x.name === f)) : runs).slice(0, 12);
  const jobs = new Set(g.edges.map((e) => e.job));
  return head('Lineage', 'Where data comes from, every job that touches it, and what breaks or must be erased when something changes.', 'Every job emits OpenLineage run events with exact Iceberg snapshot IDs as dataset versions. Column-level lineage tracks how personal data tags travel: a tag can only be removed by a transform the privacy team approved. Consent is a policy input to every job that filters people, so it appears as a dashed edge.') + `
  <div class="grid">
    <div class="card c12 lin-card">
      <div class="lin-bar">
        <div class="seg">${LIN_WL.map(([k, t]) => `<button class="${S.lin.wl === k ? 'on' : ''}" data-linwl="${k}">${t}</button>`).join('')}</div>
        <div class="seg${f ? '' : ' off'}" title="${f ? '' : 'Select a node to trace it'}">${[['up', 'Upstream'], ['both', 'Both'], ['down', 'Downstream']].map(([k, t]) => `<button class="${S.lin.dir === k && f ? 'on' : ''}" data-lindir="${k}" ${f ? '' : 'disabled'}>${t}</button>`).join('')}</div>
        <span class="spacer"></span>
        <label class="lin-trace">Trace a person<select data-bind="lineageUser"><option value="">Nobody</option>${userOptions(S.lineageUser)}</select></label>
      </div>
      ${lineageSvg(g, f, hits)}
      <div class="lin-foot"><span>${g.nodes.filter((n) => n.type === 'dataset').length} datasets · ${jobs.size} jobs · ${g.nodes.filter((n) => n.type === 'model').length} models · ${g.nodes.filter((n) => n.type === 'endpoint').length} endpoints</span><span class="spacer"></span>
        ${Object.entries(LIN_CLS).slice(0, 3).map(([k, c]) => `<span class="lg"><i style="background:${c}"></i>${k}</span>`).join('')}<span class="lg"><i class="dash"></i>consent join</span><span class="lg"><i class="dot"></i>pending</span></div>
    </div>
    ${hits ? linPerson(hits) : ''}
    ${fn ? linImpact(g, fn) + linDetail(g, fn) : ''}
    <div class="card c12"><h3>Runs${f ? ` touching ${h(linName(fn))}` : ''}<span class="right">${f ? '<button class="link" data-linclear>Show all</button> · ' : ''}OpenLineage events, newest first</span></h3>
      <div class="scroll-x"><table class="table"><thead><tr><th>State</th><th>Job</th><th>Read</th><th>Wrote</th><th>Rows out</th><th>Duration</th><th>Ended</th></tr></thead><tbody>
      ${shownRuns.map((r) => `<tr class="click${S.drawer && S.drawer.kind === 'run' && S.drawer.id === r.id ? ' sel' : ''}" data-linrun="${r.id}"><td>${pill(r.state === 'COMPLETE' ? 'ok' : r.state === 'FAIL' ? 'deny' : r.state === 'PAUSED' ? 'warn' : 'live', r.state.toLowerCase())}</td><td class="nowrap"><span class="mono">${h(r.job)}</span><span class="id">${h((L.JOBS[r.job] || {}).engine || '')}</span></td><td class="mono small">${r.inputs.map((x) => h(x.name) + (x.version ? `<span class="ver">@${h(x.version)}</span>` : '')).join('<br>')}</td><td class="mono small">${r.outputs.length ? r.outputs.map((x) => h(x.name) + (x.version ? `<span class="ver">@${h(x.version)}</span>` : '')).join('<br>') : '<span class="note">nothing written</span>'}</td><td>${r.rowsOut ? fmt(r.rowsOut) : '·'}</td><td>${r.state === 'RUNNING' ? 'streaming' : r.state === 'PAUSED' ? 'paused' : dur(r.end - r.start)}</td><td>${ago(r.end)}</td></tr>`).join('')}
      </tbody></table></div></div>
  </div>`;
};
const dur = (ms) => (ms >= 36e5 ? `${Math.floor(ms / 36e5)}h ${Math.round((ms % 36e5) / 6e4)}m` : `${Math.max(1, Math.round(ms / 6e4))}m`);
const ago = (t) => { const s = (Date.now() - t) / 1000; return s < 90 ? 'just now' : s < 5400 ? Math.round(s / 60) + ' min ago' : s < 129600 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' d ago'; };

function lineageSvg(g, f, hits) {
  const W = 1080, cols = L.COLUMNS, colW = W / cols.length, nodeW = 158, nodeH = 44, gap = 58, pos = {};
  const byCol = cols.map(([k]) => g.nodes.filter((n) => n.col === k));
  const maxRows = Math.max(...byCol.map((c) => c.length)), H = 30 + maxRows * gap;
  let out = '';
  byCol.forEach((ns, ci) => {
    const x = ci * colW + (colW - nodeW) / 2, off = ((maxRows - ns.length) * gap) / 2;
    out += `<text class="col-label" x="${x}" y="14">${cols[ci][1]}</text>`;
    ns.forEach((n, ri) => { pos[n.id] = { x, y: 26 + off + ri * gap }; });
  });
  let A = null;
  if (f) { const im = L.impact(g, f); A = new Set([f, ...(S.lin.dir !== 'down' ? im.up : []), ...(S.lin.dir !== 'up' ? im.down : [])]); }
  const hit = new Map();
  for (const x of hits || []) {
    const id = x.kind === 'consent' ? 'consent-store' : x.name;
    if (x.kind !== 'cache') hit.set(id, x.kind === 'table' && !x.live ? 'tt' : 'hit');
  }
  let paths = '';
  for (const e of g.edges) {
    const p = pos[e.from], q = pos[e.to];
    if (!p || !q) continue;
    const x1 = p.x + nodeW, y1 = p.y + nodeH / 2, x2 = q.x - 3, y2 = q.y + nodeH / 2, mx = (x1 + x2) / 2;
    const on = A ? A.has(e.from) && A.has(e.to) : hit.size ? hit.has(e.from) && hit.has(e.to) : false;
    const cls = [e.kind === 'control' ? 'ctl' : '', on ? (A ? 'on' : 'hit') : A || hit.size ? 'dim' : ''].join(' ');
    paths += `<path class="${cls}" d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" marker-end="url(#arr${on ? '-on' : ''})"><title>${h(e.job)}</title></path>`;
  }
  let nodes = '';
  for (const n of g.nodes) {
    const p = pos[n.id], color = n.type === 'dataset' ? LIN_CLS[n.classification] || '#8e8e93' : LIN_TYPE[n.type];
    const cls = [`t-${n.type}`, n.id === f ? 'focus' : A ? (A.has(n.id) ? 'on' : 'dim') : hit.size ? hit.get(n.id) || 'dim' : '', n.status === 'pending' ? 'pending' : '', n.status === 'retrain_required' ? 'flag' : ''].join(' ');
    nodes += `<g class="node ${cls}" data-lnode="${h(n.id)}" transform="translate(${p.x},${p.y})"><title>${h(n.id)}</title><rect class="bg" width="${nodeW}" height="${nodeH}" rx="9"/><rect x="7" y="9" width="3" height="${nodeH - 18}" rx="1.5" fill="${color}"/><text x="17" y="19">${h(clip(linName(n), n.region === 'EU' ? 19 : 24))}</text><text class="sub" x="17" y="34">${h(clip(linSub(n), 28))}</text>${n.region === 'EU' ? `<g class="badge"><rect x="${nodeW - 27}" y="8" width="20" height="13" rx="4"/><text x="${nodeW - 17}" y="17.5" text-anchor="middle">EU</text></g>` : ''}</g>`;
  }
  const defs = `<defs>${['', '-on'].map((s) => `<marker id="arr${s}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0.5 L7.5,4 L0,7.5z" class="arrow${s}"/></marker>`).join('')}</defs>`;
  return `<div class="scroll-x"><svg class="lineage" viewBox="0 0 ${W} ${H}" style="min-width:780px">${defs}<rect class="lin-bg" data-linclear width="${W}" height="${H}"/>${out}${paths}${nodes}</svg></div>`;
}

const ERASE_STEP = { live: 'Iceberg row deletes', tt: 'Expire snapshots', cache: 'Purge serving cache', model: 'Flag for retraining', consent: 'Tombstone, keep proof' };
function linPerson(hits) {
  const u = P.userById.get(S.lineageUser);
  const tables = hits.filter((x) => x.kind === 'table'), copies = tables.reduce((a, x) => a + x.snapshots.length, 0);
  return `<div class="card c12"><h3>Where ${h(S.lineageUser)} lives today<span class="right">${u.region} · ${E.regionInfo(u.region).law}</span></h3>
    <p class="note">${tables.length} tables holding ${copies} snapshot copies, ${(() => { const k = hits.filter((x) => x.kind === 'model').length; return k + (k === 1 ? ' model' : ' models'); })()} trained on them, plus the serving cache and consent proof. An erasure request reaches every row below.</p>
    <div class="scroll-x"><table class="table"><thead><tr><th>Location</th><th>Kind</th><th>Where</th><th>Copies</th><th>Erasure step</th></tr></thead><tbody>
    ${hits.map((x) => `<tr${x.kind === 'model' || x.kind === 'table' ? ` class="click" data-lnode="${h(x.name)}"` : ''}><td>${x.kind === 'table' ? named(x.name) : `<span class="mono">${h(x.name)}</span>`}</td><td>${x.kind === 'table' ? (x.live ? 'table' : 'table, time travel only') : x.kind}</td><td class="mono">${x.bucket ? 's3://' + h(x.bucket) : x.kind === 'model' ? 'registry' : x.kind === 'cache' ? 'redis us/eu' : 'postgres'}</td><td>${x.kind === 'table' ? x.snapshots.length + ' snapshot' + (x.snapshots.length === 1 ? '' : 's') : '·'}</td><td>${ERASE_STEP[x.kind === 'table' ? (x.live ? 'live' : 'tt') : x.kind]}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="row"><button class="btn primary" data-linerase>Start erasure request</button><button class="btn" data-act="export" data-key="lineage-person">Export location report</button></div></div>`;
}

function linImpact(g, n) {
  const im = L.impact(g, n.id), get = (id) => g.nodes.find((x) => x.id === id);
  const down = [...im.down].map(get), up = [...im.up].map(get);
  const owners = [...new Set(down.map((x) => x.owner).filter(Boolean))];
  const row = (x) => `<div class="grow click" data-lnode="${h(x.id)}"><span>${h(linName(x))}</span><span>${x.type}${x.region === 'EU' ? ' · EU' : ''}</span></div>`;
  return `<div class="card c5"><h3>Impact<span class="right">${h(linName(n))}</span></h3>
    <div class="lin-stats">${[[up.length, 'upstream'], [down.filter((x) => x.type === 'dataset').length, 'datasets'], [down.filter((x) => x.type === 'model').length, 'models'], [down.filter((x) => x.type === 'endpoint').length, 'endpoints']].map(([v, k]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}</div>
    <h4 class="insp-h">If this changes or is deleted</h4>${down.length ? `<div class="glist">${down.map(row).join('')}</div>` : '<p class="note">Nothing reads from it. Safe to change.</p>'}
    ${up.length ? `<h4 class="insp-h">Depends on</h4><div class="glist">${up.map(row).join('')}</div>` : ''}
    ${owners.length ? `<h4 class="insp-h">Owners to notify</h4><div class="tags">${owners.map((o) => pill('', o)).join('')}</div><div class="row"><button class="btn" data-act="lin-notify">Notify ${owners.length} owner${owners.length > 1 ? 's' : ''}</button><button class="btn" data-act="export" data-key="lineage-impact">Export impact</button></div>` : ''}</div>`;
}

function linDetail(g, n) {
  if (n.type === 'dataset' && L.COLUMN_LINEAGE[n.id]) {
    const cl = L.COLUMN_LINEAGE[n.id], chk = L.tagCheck(n.id);
    const tag = (t) => (t ? pill(['device_id', 'precise_location', 'email', 'free_text'].includes(t) ? 'deny' : t === 'user_id' ? 'warn' : '', t) : '<span class="note">none</span>');
    return `<div class="card c7"><h3>Column lineage<span class="right">${chk.violations.length ? pill('deny', chk.violations.length + ' tag violations') : pill('ok', 'Tag check passed')}</span></h3>
      <p class="note">From <b>${h(nm(cl.from))}</b>. ${chk.downgraded} of ${chk.columns} columns lose or weaken a personal data tag, each through an approved transform.</p>
      <div class="scroll-x"><table class="table cl"><thead><tr><th>Column</th><th>From</th><th>Transform</th><th>Tag</th></tr></thead><tbody>
      ${cl.cols.map(([out, ins, tf, tin, tout]) => `<tr class="${out ? '' : 'drop'}"><td class="mono">${out ? h(out) : '<s>' + h(ins.join(', ')) + '</s>'}</td><td class="mono small">${ins.length ? ins.map(h).join(', ') : '·'}</td><td>${h(tf)}</td><td class="tagflow">${tin || tout ? `${tag(tin)}${tin !== tout ? `<span class="to">→</span>${tag(tout)}` : ''}` : '<span class="note">·</span>'}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  }
  if (n.type === 'model') {
    const m = P.models.find((x) => E.mname(x) === n.id), ins = g.edges.filter((e) => e.to === n.id && e.kind === 'data');
    return `<div class="card c7"><h3>Training provenance<span class="right">${pill(m.status === 'ok' ? 'ok' : 'deny', m.status === 'ok' ? 'Reproducible' : 'Retrain required')}</span></h3>
      <p class="note">Exact table versions this model read. Re-running with these snapshots and the same consent cut-off rebuilds the same training set.</p>
      ${glist(ins.map((e) => { const t = m.trainedOn.find((x) => x.table === e.from); return [named(e.from), `<span class="mono">@${h(t ? t.snapshot : 'pinned')}</span><span class="id">${h(e.job)}</span>`]; }))}
      ${glist([['People included', fmt(m.members.size)], ['Policy at training', (m.card && m.card.governance.policy_bundle) || 'core-1.3.2'], ['Serves', E.ENDPOINTS.filter((x) => x.model === n.id).map((x) => x.id).join(', ') || 'not deployed']])}</div>`;
  }
  const js = [...new Set(g.edges.filter((e) => e.from === n.id || e.to === n.id).map((e) => e.job))];
  return `<div class="card c7"><h3>${n.type === 'dataset' ? 'Produced by' : 'Jobs'}<span class="right">${js.length}</span></h3>
    ${js.map((j) => { const J = L.JOBS[j] || {}; const dr = Object.entries(J.dropped || {}).filter(([, v]) => v); return `<div class="lin-job"><div class="row between"><b class="mono">${h(j)}</b><span class="note">${h(J.engine || '')} · ${h(J.schedule || '')}</span></div><div class="lin-stages">${(J.stages || []).map((s) => `<span>${h(s)}</span>`).join('')}</div>${dr.length ? `<div class="tags">${dr.map(([k, v]) => pill('warn', `${rsn(k).toLowerCase()}: ${fmt(v)}`)).join('')}</div>` : ''}</div>`; }).join('')}</div>`;
}

function linSelect(id) {
  if (S.lin.focus === id) return;
  S.lin.focus = id; S.lineageUser = '';
  const g = L.lineageGraph(P), n = g.nodes.find((x) => x.id === id);
  if (n && S.lin.wl !== 'all' && !n.workloads.includes(S.lin.wl)) S.lin.wl = 'all';
  if (P.dataset(id)) openDrawer('dataset', id);
  else if (P.models.some((m) => E.mname(m) === id)) openDrawer('model', id);
  else openDrawer('lnode', id);
}
EXPORTS['lineage-runs'] = () => [['run_id', 'job', 'state', 'inputs', 'outputs', 'rows_out', 'ended'], ...RUNS.map((r) => [r.id, r.job, r.state, r.inputs.map((x) => x.name + '@' + (x.version || '')).join(' '), r.outputs.map((x) => x.name + '@' + (x.version || '')).join(' '), r.rowsOut, new Date(r.end).toISOString()])];
EXPORTS['lineage-impact'] = () => { const g = L.lineageGraph(P), im = L.impact(g, S.lin.focus); return [['node', 'direction', 'type', 'owner'], ...[...im.up].map((id) => ['up', id]), ...[...im.down].map((id) => ['down', id])].map((r, i) => (i ? (() => { const n = g.nodes.find((x) => x.id === r[1]); return [r[1], r[0], n.type, n.owner || '']; })() : r)); };
EXPORTS['lineage-person'] = () => [['location', 'kind', 'live', 'snapshots', 'erasure_step'], ...P.locate(S.lineageUser).map((x) => [x.name, x.kind, x.live, (x.snapshots || []).join(' '), ERASE_STEP[x.kind === 'table' ? (x.live ? 'live' : 'tt') : x.kind]])];

/* ── DSR ── */
VIEWS.dsr = () => {
  const sel = P.dsrs.find((d) => d.idem === S.sel.dsr) || P.dsrs[0];
  const target = S.dsrUser || defaultErasureUser().id;
  return head('Subject requests', 'When someone asks to be deleted, every copy goes, including old table versions, caches and models. You get signed proof.', 'Erasure runs as a saga across every system lineage knows about. Steps are idempotent, retried with backoff, and end in a signed evidence pack. Row deletes alone leave data in old Iceberg snapshots, so snapshots are expired too. GDPR allows one month.') + `
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
EXPORTS.audit = () => [['seq', 'ts', 'type', 'actor', 'subject', 'payload', 'prev', 'hash'], ...P.ledger.entries.map((e) => [e.seq, new Date(e.ts).toISOString(), e.type, e.actor, e.subject, JSON.stringify(e.payload), e.prev, e.hash])];
VIEWS.audit = () => {
  if (!can('auditor')) return head('Audit ledger') + `<div class="grid"><div class="card c12 locked"><b>Auditor access only</b>Ledger queries are restricted to the auditor role.<div class="row" style="justify-content:center;margin-top:16px"><button class="btn primary" data-act="as-auditor">Switch to Henrik Lund, auditor</button></div></div></div>`;
  const a = S.audit;
  const all = a.subjectRows || P.ledger.entries.slice().reverse();
  const filtered = all.filter((e) => match('audit', e.type, e.actor, nm(e.actor), JSON.stringify(e.payload), e.subject));
  const pages = Math.max(1, Math.ceil(filtered.length / 25)); S.auditPage = Math.min(S.auditPage || 1, pages);
  const rows = filtered.slice((S.auditPage - 1) * 25, S.auditPage * 25);
  return head('Audit ledger', 'A record of every decision that cannot be rewritten without detection.', 'Append-only and hash-chained: each entry commits to the one before it. Merkle roots are written to object-locked storage, so a rewrite of history is provable. People appear only as keyed pseudonyms.') + `
  <div class="grid">
    ${kpi(fmt(P.ledger.entries.length), 'Entries', 'hash chained')}
    ${kpi(a.verify ? (a.verify.ok ? 'Intact' : 'Broken at #' + a.verify.brokenAt) : 'Not run', 'Chain verification', a.verify ? `${fmt(a.verify.checked)} entries checked` : '', a.verify ? (a.verify.ok ? 'good' : 'bad') : '')}
    ${kpi(P.ledger.anchors.length, 'WORM anchors', P.ledger.anchors.length ? 'root ' + P.ledger.anchors.at(-1).root.slice(0, 12) : 'none yet')}
    ${kpi(a.tampered ? '#' + a.tampered.seq : 'None', 'Tampered entry', a.tampered ? 'edited in place' : 'integrity drill')}
    <div class="card c12"><div class="row between"><div class="row">
      <button class="btn primary" data-act="verify">Verify chain</button>
      <button class="btn" data-act="anchor">Anchor Merkle root</button>
      ${a.tampered ? '<button class="btn" data-act="untamper">Restore entry</button>' : '<button class="btn danger" data-act="tamper">Tamper with an entry</button>'}
      </div><div class="row"><label class="field" style="min-width:220px">Evidence for user<select data-bind="audit.filter"><option value="">All entries</option>${(() => { const ids = new Set([...featuredUsers().map((u) => u.id), ...P.dsrs.map((d) => d.user)]); if (a.filter) ids.add(a.filter); return [...ids].map((id) => `<option${id === a.filter ? ' selected' : ''}>${id}</option>`).join(''); })()}</select></label></div></div>
      ${a.filter ? `<p class="note">Pseudonym ${a.pseudonym || ''}: ${fmt(all.length)} entries.</p>` : ''}
      ${tools('audit', all.filter((e) => match('audit', e.type, e.actor, nm(e.actor), JSON.stringify(e.payload), e.subject)).length, all.length, 'Search type, actor, payload')}
      <div class="scroll-x"><table class="table"><thead><tr><th>#</th><th>Time</th><th>Type</th><th>Actor</th><th>Subject</th><th>Payload</th><th>Hash</th></tr></thead><tbody>
      ${rows.map((e) => `<tr class="${a.verify && !a.verify.ok && e.seq === a.verify.brokenAt ? 'bad' : ''}"><td class="mono">${e.seq}</td><td>${time(e.ts)}</td><td class="mono">${e.type}</td><td class="mono">${h(e.actor)}</td><td class="mono">${e.subject || ''}</td><td class="mono" style="max-width:360px">${h(JSON.stringify(e.payload))}</td><td class="hash">${e.hash.slice(0, 10)}<br>prev ${e.prev.slice(0, 10)}</td></tr>`).join('')}
      </tbody></table></div>
      ${pager('auditPage', pages)}
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
  return head('Agents', 'AI assistants act for a person with only the access that person delegated, and every action is checked.', 'The agent obtains a delegated token through OAuth 2.0 token exchange (RFC 8693) naming both the user and the agent. Each tool call goes through the policy engine and is written to the audit ledger with both identities.') + `
  <div class="grid">
    <div class="card c6"><h3>Delegation</h3>
      <div class="fields"><label class="field">User<select data-bind="agent.user">${userOptions(u.id)}</select></label></div>
      <div class="row"><button class="btn primary" data-act="exchange">Exchange token for the assistant</button></div>
      ${a.agentToken ? `<pre class="code" style="max-height:240px">${h(JSON.stringify(a.agentToken.claims, null, 2))}</pre>
      <div class="row"><button class="btn" data-act="agent-read">Tool: read my ad settings</button><button class="btn" data-act="agent-export">Tool: export my ad history to a partner</button></div>` : ''}
    </div>
    <div class="card c6"><h3>Tool calls</h3>${a.results.length ? a.results.map((r) => `<p class="note" style="margin-top:12px"><b>${r.tool === 'read_ad_settings' ? 'Read my ad settings' : 'Export my ad history to a partner'}</b> · ${h(nm(r.actor))} acting for ${h(r.sub)}</p>${decisionBox(r.decision)}${r.output ? `<pre class="code" style="max-height:140px">${h(r.output)}</pre>` : ''}`).join('') : '<p class="note">Exchange a token, then call a tool.</p>'}</div>
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
  const u = P.users.find((x) => x.eu && x.att === 'authorized' && x.age_band === '18_plus' && P.cache.get(x.id) && P.cache.get(x.id).consent.ads_personalization === 'granted' && P.cache.get(x.id).consent.cross_service_combination !== 'granted');
  const c = P.cache.get(u.id).consent;
  const rec = await P.evaluate({ principal: { sub: 'svc-ad-gateway' }, purpose: 'ads_personalization', dataset: P.dataset('ad_features_v7'), processing_region: 'EU', transfer_basis: 'SCC-2021', grant: true, user: P.userInput(u, c) });
  S.dma = { user: u.id, region: u.region, consent: c, decision: rec.decision };
  render();
}

/* ── regulations: the landscape, deadlines, and which controls answer each law ── */
VIEWS.regulations = () => {
  const f = S.regRegion || 'All';
  const regions = ['All', 'EU', 'US', 'UK', 'JP', 'IN'];
  const list = REGULATIONS.filter((r) => f === 'All' || r.region.startsWith(f));
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = REGULATIONS.flatMap((r) => r.dates.filter(([d]) => d >= today).map(([d, what]) => [d, r.name, what])).sort();
  return head('Regulations', 'What the law requires of AI data use, what is due next, and the controls that answer each obligation.', 'Covers a consumer platform with an app store, an ad network and on-device and cloud AI. Dates were checked in October 2026; sources are in docs/REGULATIONS.md.') + `
  <div class="grid">
    <div class="card c12"><h3>Coming up <span class="right">from ${today}</span></h3><div class="timeline">${upcoming.map(([d, n, w]) => `<div class="tl"><span class="tl-date">${d}</span><b>${h(n)}</b><span>${h(w)}</span></div>`).join('') || '<p class="note">No upcoming dates.</p>'}</div></div>
    <div class="card c12"><div class="row between"><h3>Laws</h3><div class="seg">${regions.map((r) => `<button class="${r === f ? 'on' : ''}" data-reg="${r}">${r}</button>`).join('')}</div></div>
      <div class="regs">${list.map((r) => `<div class="reg">
        <div class="row between"><b>${h(r.name)}</b><span class="row">${pill('blue', r.region)}${pill(/force|Enforced/.test(r.status) ? 'ok' : 'warn', r.status)}</span></div>
        <p>${h(r.requires)}</p>
        <ul class="dates">${r.dates.map(([d, w]) => `<li class="${d > today ? 'future' : ''}"><span>${d}</span>${h(w)}</li>`).join('')}</ul>
        <div class="tags">${r.controls.map(([c, v]) => `<button class="pill ok ctrl" data-go="${v}">${h(c)}</button>`).join('')}</div>
      </div>`).join('')}</div>
    </div>
    <div class="card c12"><h3>Industry watch <span class="right">public enforcement and what it teaches</span></h3><ul class="feed">${WATCH.slice().reverse().map(([d, where, what, lesson]) => `<li><span class="when">${d}</span><span><b>${h(where)}.</b> ${h(what)}<br><span class="note">${h(lesson)}</span></span></li>`).join('')}</ul></div>
    <div class="card c12"><h3>Privacy engineering patterns <span class="right">from public platform research</span></h3><div class="scroll-x"><table class="table"><thead><tr><th>Pattern</th><th>What it is</th><th>In Custodian</th></tr></thead><tbody>${PATTERNS.map(([p, what, here, v]) => `<tr class="click" data-go="${v}"><td><b>${h(p)}</b></td><td>${h(what)}</td><td>${h(here)}</td></tr>`).join('')}</tbody></table></div></div>
  </div>`;
};

/* ── settings: what an enterprise buyer checks first ── */
VIEWS.org = () => head('Organization', 'Identity, sessions and who can administer Custodian.') + `
  <div class="grid">
    <div class="card c6"><h3>Single sign-on</h3><dl class="kv"><dt>Provider</dt><dd>Okta (OIDC) ${pill('ok', 'Connected')}</dd><dt>Issuer</dt><dd class="mono">https://acme.okta.com/oauth2/default</dd><dt>Flow</dt><dd>Authorization code with PKCE</dd><dt>MFA</dt><dd>Required for every role</dd><dt>Session</dt><dd>15 minutes, refresh rotates</dd></dl></div>
    <div class="card c6"><h3>Provisioning</h3><dl class="kv"><dt>SCIM 2.0</dt><dd>${pill('ok', 'On')} users and groups sync every 10 minutes</dd><dt>Role mapping</dt><dd>Okta groups map to the six Custodian roles</dd><dt>Break-glass</dt><dd>2 named accounts, every use paged and ledgered</dd><dt>Just-in-time access</dt><dd>Grants expire automatically, 90 days max</dd></dl></div>
    <div class="card c12"><h3>Roles</h3><div class="scroll-x"><table class="table"><thead><tr><th>Role</th><th>Member</th><th>Can</th></tr></thead><tbody>
      ${[['ml_engineer', 'Register datasets, request access, run training'], ['data_steward', 'Confirm PII tags, approve or reject datasets'], ['privacy_reviewer', 'Review access, run subject requests'], ['legal_reviewer', 'Review restricted data, run subject requests'], ['sre', 'Operate serving, run chaos drills'], ['auditor', 'Read and verify the audit ledger, export evidence']].map(([k, w]) => `<tr><td>${named(k)}</td><td>${h(E.ROLES[k].name)}</td><td>${w}</td></tr>`).join('')}
    </tbody></table></div></div>
  </div>`;
const INTEGRATIONS = [
  ['Identity', 'Okta', 'SSO and SCIM', true], ['Warehouse', 'Snowflake', 'Catalog sync, row access policies', true], ['Lakehouse', 'Databricks Unity Catalog', 'Tags and lineage import', false],
  ['Streaming', 'Apache Kafka', 'consent.events, policy.decisions', true], ['Storage', 'Amazon S3', 'Iceberg tables, Object Lock anchors', true], ['ML', 'MLflow', 'Model registry and cards', true],
  ['SIEM', 'Splunk', 'Audit ledger stream', true], ['Ticketing', 'Jira', 'Access reviews as issues', false], ['ITSM', 'ServiceNow', 'Subject requests intake', false], ['Chat', 'Slack', 'Reviewer notifications', true],
];
VIEWS.integrations = () => head('Integrations', 'Custodian governs data where it already lives. Connect the systems your teams use.') + `
  <div class="grid"><div class="card c12"><div class="integ">${INTEGRATIONS.map(([cat, n, what, on]) => `<div class="integ-item"><div class="row between"><b>${n}</b>${pill(on ? 'ok' : '', on ? 'Connected' : 'Available')}</div><span class="note">${cat}</span><p>${what}</p></div>`).join('')}</div></div></div>`;
VIEWS.apikeys = () => head('API keys', 'Service credentials. Keys are scoped, short-lived where possible, and every use is audited.') + `
  <div class="grid"><div class="card c12"><div class="scroll-x"><table class="table"><thead><tr><th>Name</th><th>Key</th><th>Scopes</th><th>Created</th><th>Last used</th></tr></thead><tbody>
    ${G.apikeys.map((k) => `<tr class="sel"><td>${h(k.name)}<span class="id">${h(k.name)} · new</span></td><td class="mono">${h(k.prefix)}••••</td><td class="mono">${h(k.scopes)}</td><td>${date(k.created)}</td><td>never</td></tr>`).join('')}
    ${[['Ad gateway', 'svc-ad-gateway', 'decide:ads_personalization read:consent', 41, 0], ['Ads trainer', 'svc-ads-trainer', 'read:ad_features_v7 purpose:model_training', 33, 1], ['Assistant trainer', 'svc-assistant-trainer', 'read:assistant_conversations_redacted purpose:model_training', 20, 2], ['SIEM export', 'svc-siem', 'read:audit', 90, 0]].map(([n, id, sc, c, u]) => `<tr><td>${n}<span class="id">${id}</span></td><td class="mono">cst_live_••••${id.length}${id.slice(-3)}</td><td class="mono">${sc}</td><td>${date(Date.now() - 864e5 * c)}</td><td>${u ? u + ' h ago' : 'just now'}</td></tr>`).join('')}
  </tbody></table></div><p class="note">Client credentials grant. Tokens minted from these keys live 15 minutes and carry only the listed scopes.</p></div></div>`;
VIEWS.residency = () => {
  const eu = P.users.filter((u) => u.eu).length;
  return head('Data residency', 'Where data is stored and processed. EU personal data stays in the EU.') + `
  <div class="grid">
    ${kpi('2', 'Regions', 'us-west, eu-west')}${kpi(fmt(eu), 'EU people', 'stored in lake-eu-west')}${kpi(fmt(P.users.length - eu), 'Other people', 'stored in lake-us-west')}${kpi('0', 'Cross-border transfers without a basis', 'blocked by policy', 'good')}
    <div class="card c12"><div class="scroll-x"><table class="table"><thead><tr><th>Region</th><th>Bucket</th><th>Tables</th><th>Processing allowed in</th><th>Transfer basis</th></tr></thead><tbody>
      <tr><td>EU (Ireland)</td><td class="mono">lake-eu-west</td><td>${Object.values(P.tables).filter((t) => t.bucket === 'lake-eu-west').length}</td><td>EU only</td><td>Standard contractual clauses, required per decision</td></tr>
      <tr><td>US (Oregon)</td><td class="mono">lake-us-west</td><td>${Object.values(P.tables).filter((t) => t.bucket === 'lake-us-west').length}</td><td>US</td><td>n/a</td></tr>
    </tbody></table></div></div>
  </div>`;
};

/* ── notifications and command palette ── */
function notifications() {
  const out = attention().map((x) => ({ ...x, kind: 'task' }));
  if (!P.policyUp || P.breaker.state !== 'closed') out.unshift({ t: 'Policy engine degraded', m: 'Serving is failing closed', go: 'serving', kind: 'alert' });
  if (P.serving.violations) out.unshift({ t: 'Personalized output without an allow', m: 'Invariant broken', go: 'serving', kind: 'alert' });
  if (S.audit.verify && !S.audit.verify.ok) out.unshift({ t: `Audit chain broken at #${S.audit.verify.brokenAt}`, m: 'Possible tampering', go: 'audit', kind: 'alert' });
  return out;
}
function openBell(e) {
  e.stopPropagation(); closePop();
  const r = $('#btn-bell').getBoundingClientRect(), list = notifications();
  const pop = document.createElement('div');
  pop.className = 'popover wide'; pop.id = 'pop';
  pop.style.top = r.bottom + 6 + 'px'; pop.style.right = Math.max(8, innerWidth - r.right) + 'px';
  pop.innerHTML = `<p class="pop-h">Notifications</p>` + (list.length ? list.map((x) => `<button data-go="${x.go}"${x.sel ? ` data-sel="${x.sel[0]}:${h(x.sel[1])}"` : ''}><span class="dotk ${x.kind}"></span><span>${h(x.t)}<small>${h(x.m)}</small></span></button>`).join('') : '<p class="pop-empty">You are all caught up.</p>');
  pop.addEventListener('click', (ev) => { if (ev.target.closest('[data-go]')) setTimeout(closePop); });
  document.body.appendChild(pop);
}

let palIndex = 0;
function paletteItems(q) {
  q = q.trim().toLowerCase();
  const items = [];
  for (const [k, t, tabs] of SECTIONS) for (const [v, tt] of tabs) items.push({ t: tabs.length > 1 ? `${t} › ${tt}` : t, kind: 'Page', go: v });
  for (const d of P.datasets) items.push({ t: nm(d.id), sub: d.id, kind: 'Dataset', go: 'catalog', sel: ['dataset', d.id] });
  for (const m of P.models) items.push({ t: E.mname(m), sub: E.WORKLOADS[m.workload].name, kind: 'Model', go: 'models', sel: ['model', E.mname(m)] });
  for (const r of REGULATIONS) items.push({ t: r.name, sub: r.region, kind: 'Regulation', go: 'regulations' });
  for (const [k, t] of NEW_MENU) items.push({ t: `New ${t.toLowerCase()}`, kind: 'Create', act: 'new:' + k });
  items.push({ t: 'Guided tour', kind: 'Action', act: 'demo' }, { t: 'Verify the audit chain', kind: 'Action', go: 'audit', act: 'verify' }, { t: 'Switch account', kind: 'Action', act: 'role' });
  if (/^u_\d+$/.test(q) && P.userById.has(q)) items.unshift({ t: q, sub: P.userById.get(q).region, kind: 'Person', go: 'data', person: q });
  return items.filter((x) => !q || (x.t + ' ' + (x.sub || '') + ' ' + x.kind).toLowerCase().includes(q)).slice(0, 9);
}
function openPalette() {
  if ($('#pal')) return;
  const back = document.createElement('div'); back.className = 'pal-back'; back.id = 'pal';
  back.innerHTML = `<div class="pal"><label class="pal-in">${icon('search')}<input id="pal-q" placeholder="Search pages, datasets, models, people (u_000123)" autocomplete="off"><kbd>esc</kbd></label><div id="pal-list"></div></div>`;
  document.body.appendChild(back);
  const q = $('#pal-q'); palIndex = 0;
  const draw = () => { const items = paletteItems(q.value); palIndex = Math.min(palIndex, Math.max(items.length - 1, 0)); $('#pal-list').innerHTML = items.map((x, i) => `<button class="pal-item${i === palIndex ? ' on' : ''}" data-i="${i}"><span>${h(x.t)}${x.sub ? `<small>${h(x.sub)}</small>` : ''}</span><em>${x.kind}</em></button>`).join('') || '<p class="pop-empty">No results</p>'; return items; };
  let items = draw();
  const pick = async (x) => {
    closePalette(); if (!x) return;
    if (x.sel) S.sel[x.sel[0]] = x.sel[1];
    if (x.person) { S.data.user = x.person; S.data.tab = 'raw'; S.data.mode = 'people'; }
    if (x.kind === 'Dataset') { S.data.mode = 'datasets'; S.data.ds = x.sel[1]; x.go = 'data'; }
    if (x.go) go(x.go);
    if (x.act === 'demo') openActs();
    if (x.act === 'verify') await ACTIONS.verify();
    if (x.act === 'role') $('#btn-role').click();
    if (x.act && x.act.startsWith('new:')) openForm(x.act.slice(4));
  };
  q.addEventListener('input', () => { palIndex = 0; items = draw(); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { palIndex = Math.min(palIndex + 1, items.length - 1); draw(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { palIndex = Math.max(palIndex - 1, 0); draw(); e.preventDefault(); }
    if (e.key === 'Enter') pick(items[palIndex]);
    if (e.key === 'Escape') closePalette();
  });
  back.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) return pick(items[+b.dataset.i]); if (e.target === back) closePalette(); });
  q.focus();
}
function closePalette() { const p = $('#pal'); if (p) p.remove(); }

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
  ['No profiling ads to minors', 'DSA Art. 28(2); COPPA', 'Age range from the OS; unknown age treated as a minor; minor_no_profiling rule', 'policy', 'Decision log'],
  ['Training consent', 'GDPR Art. 6; CPRA 1798.121; EU AI Act Art. 10', 'Per-user model_training consent checked at the training gate', 'training', 'Exclusion report in model card'],
];
VIEWS.compliance = () => head('Controls', 'Each control, the law it answers, how it works, and where the evidence is. Select a row to open it.') + `
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
  // Organic consent changes from people using the apps, through the same outbox, topic and cache.
  const churn = async () => {
    if (!S.traffic) return;
    const keep = new Set(featuredUsers().map((u) => u.id));
    const u = P.users[Math.floor(Math.random() * P.users.length)];
    if (keep.has(u.id) || !P.userById.has(u.id)) return;
    const cur = P.consent.snapshot(u.id).ads_personalization;
    await P.setConsent(u.id, 'ads_personalization', cur === 'granted' ? 'denied' : 'granted', 'personalized_ads_toggle');
    await sleep(150 + Math.random() * 350);
    const msgs = P.relayOutbox();
    await sleep(300 + Math.random() * 1400);
    for (const m of msgs) P.applyToCache(m);
  };
  churn(); setTimeout(churn, 400);
  setInterval(churn, 2600);
}

/* ───────────────────────── create workflows (New menu) ───────────────────────── */

/* Each form: fields, who may submit it, and what it creates. Everything created
   flows into the same lists, inboxes and ledger as the seeded work. */
const dsOptions = () => P.datasets.filter((d) => d.status === 'approved').map((d) => [d.id, nm(d.id)]);
const FORMS = {
  dataset: {
    title: 'Register a dataset', sub: 'The scanner proposes personal data tags from the schema. The dataset stays unreadable until a data steward approves it.', icon: 'data', roles: ['ml_engineer', 'data_steward'], cta: 'Register and scan',
    fields: () => [
      { k: 'id', label: 'Table name', type: 'text', ph: 'e.g. wallet_events_v1', req: true, pattern: /^[a-z][a-z0-9_]{3,40}$/, hint: 'Lowercase, digits and underscores.' },
      { k: 'owner', label: 'Owning team', type: 'select', options: ['growth-analytics', 'ads-ml', 'assistant-ml', 'search-ml', 'payments-risk', 'support-eng'].map((x) => [x, x]) },
      { k: 'region', label: 'Region', type: 'select', options: [['US', 'United States (us-west)'], ['EU', 'European Union (eu-west)']] },
      { k: 'source', label: 'Source system', type: 'select', options: [['maps', 'iOS collector'], ['assistant', 'Assistant service'], ['news', 'News app'], ['support', 'Support desk']] },
      { k: 'columns', label: 'Columns', type: 'textarea', req: true, def: 'user_id, email, ticket_text, created_at, product_area', hint: 'Comma separated. The scanner reads names and samples.' },
      { k: 'purposes', label: 'Requested purposes', type: 'checks', options: [['analytics', 'Analytics'], ['model_training', 'Model training'], ['ads_personalization', 'Personalized ads']], def: ['analytics'] },
      { k: 'retention', label: 'Retention (days)', type: 'number', def: 90, min: 1, max: 730 },
    ],
    async submit(v) {
      if (P.dataset(v.id)) return { error: { id: 'A dataset with this name already exists.' } };
      const cols = v.columns.split(',').map((x) => x.trim()).filter(Boolean);
      const scan = E.scanPII(cols.map((name) => ({ name, sample: name.includes('email') ? 'ana@example.com' : name.includes('lat') ? '37.33' : 'x' })));
      P.datasets.push({ id: v.id, layer: 'raw', owner: v.owner, steward: 'Luis Ortega', classification: scan.classification, pii: scan.tags, region: v.region, allowed_purposes: v.purposes, retention_days: +v.retention, sources: [v.source], status: 'pending', legal_basis: v.region === 'EU' ? 'consent' : 'legitimate_interest', bucket: v.region === 'EU' ? 'lake-eu-west' : 'lake-us-west', scan });
      await P.ledger.append('catalog.registered', S.token.claims.sub, { dataset: v.id, classification: scan.classification, proposed_tags: scan.tags });
      S.sel.dataset = v.id; go('catalog'); openDrawer('dataset', v.id);
      return { ok: `${v.id} registered as ${scan.classification}${scan.tags.length ? `, tagged ${scan.tags.join(', ')}` : ''}. Sent to Luis Ortega for review.` };
    },
  },
  access: {
    title: 'Request data access', sub: 'Checked by policy first, then reviewed by privacy (and legal for restricted data). Access expires automatically.', icon: 'access', roles: null, cta: 'Submit request',
    fields: () => [
      { k: 'dataset', label: 'Dataset', type: 'select', options: dsOptions() },
      { k: 'purpose', label: 'Purpose', type: 'select', options: [['analytics', 'Analytics'], ['model_training', 'Model training'], ['ads_personalization', 'Personalized ads']] },
      { k: 'region', label: 'Processing region', type: 'select', options: [['US', 'us-west'], ['EU', 'eu-west']] },
      { k: 'days', label: 'Duration', type: 'select', options: [['7', '7 days'], ['30', '30 days'], ['90', '90 days']], def: '30' },
      { k: 'justification', label: 'Justification', type: 'textarea', req: true, ph: 'What you will do with the data and why this dataset', minLen: 20 },
    ],
    async submit(v) {
      await requestAccess({ dataset: v.dataset, purpose: v.purpose, region: v.region, days: +v.days, justification: v.justification });
      const r = P.accessRequests.find((x) => x.id === S.sel.request);
      return { ok: `${r.id} submitted. ${r.precheck && r.precheck.allow ? 'Policy pre-check passed; with privacy review now.' : 'Policy flagged it; reviewers will see why.'}` };
    },
  },
  model: {
    title: 'Register a model', sub: 'Intake classifies the use under the EU AI Act and sets the gates the model must pass before release.', icon: 'models', roles: ['ml_engineer'], cta: 'Start intake',
    fields: () => [
      { k: 'name', label: 'Model name', type: 'text', req: true, ph: 'e.g. Wallet merchant categorizer' },
      { k: 'purpose', label: 'Intended purpose', type: 'textarea', req: true, ph: 'What it does and for whom', minLen: 15 },
      { k: 'owner', label: 'Owning team', type: 'select', options: ['ads-ml', 'assistant-ml', 'search-ml', 'payments-risk', 'support-eng', 'people-analytics'].map((x) => [x, x]) },
      { k: 'data', label: 'Training data', type: 'checks', options: dsOptions().slice(0, 8), req: true },
      { k: 'uses', label: 'Does the model', type: 'checks', options: [['decisions', 'Make or support decisions about employment, credit, education or access to essential services'], ['biometric', 'Process biometric data to identify people'], ['interacts', 'Talk to people or generate content they see'], ['minors', 'Reach people under 18']] },
    ],
    async submit(v) {
      const high = v.uses.includes('decisions') || v.uses.includes('biometric');
      const risk = high ? 'High' : v.uses.includes('interacts') ? 'Limited' : 'Minimal';
      const id = v.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (lcRecords().some((x) => x.model === id)) return { error: { name: 'A model with this name is already registered.' } };
      const cls = Math.max(...v.data.map((d) => E.CLASS_RANK[P.dataset(d).classification] ?? 1));
      const rec = { model: id, name: v.name, version: 'v1 candidate', purpose: v.purpose, owner: v.owner, method: 'Centralized', risk, data: Object.keys(E.CLASS_RANK).find((k) => E.CLASS_RANK[k] === cls) || 'internal', stage: high ? 'Blocked' : 'Review', regions: [...new Set(v.data.map((d) => P.dataset(d).region))].join(', '), updated: date(Date.now()),
        stages: [
          { key: 'collect', name: 'Intake review', inputs: ['intake form'], gate: high ? 'EU AI Act Annex III: conformity assessment, human oversight and logging required' : `EU AI Act ${risk.toLowerCase()} risk${risk === 'Limited' ? ': Art. 50 transparency applies' : ''}`, policy: 'release-2.1', artifact: high ? 'blocked at intake' : 'intake approved', status: high ? 'blocked' : 'done' },
          { key: 'pretrain', name: 'Training', inputs: v.data, gate: 'scoped token, purpose model_training, per-user consent', policy: 'core-1.4.0', artifact: 'not started', status: 'waiting' },
          { key: 'eval', name: 'Evaluation', inputs: ['release-2.1 checks'], gate: 'quality, fairness, privacy and safety thresholds', policy: 'release-2.1', artifact: 'not started', status: 'waiting' },
          { key: 'release', name: 'Release review', inputs: ['evaluation results'], gate: 'privacy and legal sign-off, model card', policy: 'release-2.1', artifact: 'not started', status: 'waiting' },
        ],
        evals: [['Quality target', 'quality', 'set at intake', 'after training', 'scheduled'], ['Gap across groups', 'fairness', '≤ 2 pts', 'after training', 'scheduled'], ['PII extraction rate', 'privacy', '≤ 0.01%', 'after training', 'scheduled'], ...(high ? [['Conformity assessment', 'oversight', 'required', 'not started', 'fail']] : [])],
        approvals: APPROVERS.map(([role, label]) => ({ role, label, who: E.ROLES[role].name, status: role === 'ml_engineer' ? 'approved' : high ? 'na' : 'waiting', at: Date.now() })) };
      lcRecords().unshift(rec);
      for (const d of v.data) if (!P.dataset(d).allowed_purposes.includes('model_training')) rec.stages[1].gate += `; ${nm(d)} is not approved for training, an access request is needed`;
      await P.ledger.append('model.intake', S.token.claims.sub, { lc: id, name: v.name, risk });
      S.lcModel = id; S.lcTab = 'lifecycle'; go('lifecycle');
      return { ok: high ? `${v.name} is high risk and stopped at intake until a conformity assessment exists.` : `${v.name} registered as ${risk.toLowerCase()} risk. Training can start once data access is in place.` };
    },
  },
  dsr: {
    title: 'New subject request', sub: 'Erasure runs as a saga across every system lineage knows about and ends in a signed evidence pack.', icon: 'privacy', roles: ['privacy_reviewer', 'legal_reviewer'], cta: 'Start request',
    fields: () => [
      { k: 'user', label: 'Person', type: 'select', options: featuredUsers().filter((u) => P.userById.has(u.id)).map((u) => [u.id, userLabel(u)]) },
      { k: 'kind', label: 'Request', type: 'select', options: [['erasure', 'Erasure (GDPR Art. 17, CCPA delete)'], ['locate', 'Access: where is my data (GDPR Art. 15)']] },
      { k: 'verified', label: 'Identity', type: 'checks', options: [['yes', 'Identity verified through the account sign-in']], req: true },
    ],
    async submit(v) {
      if (v.kind === 'locate') { S.lineageUser = v.user; S.lin.focus = null; go('lineage'); openDrawer('person', v.user); return { ok: `Location report ready for ${v.user}.` }; }
      S.dsrUser = v.user; go('dsr'); erase(false);
      return { ok: `Erasure started for ${v.user}. Due in 30 days, target 72 hours.` };
    },
  },
  incident: {
    title: 'Declare an incident', sub: 'If personal data is involved, the 72 hour regulator clock (GDPR Art. 33) starts now.', icon: 'risk', roles: null, cta: 'Declare',
    fields: () => [
      { k: 'title', label: 'What happened', type: 'text', req: true, ph: 'e.g. Raw events readable by an analytics job' },
      { k: 'sev', label: 'Severity', type: 'select', options: [['SEV-1', 'SEV-1: customer impact now'], ['SEV-2', 'SEV-2: significant, contained'], ['SEV-3', 'SEV-3: minor']], def: 'SEV-2' },
      { k: 'personal', label: 'Personal data', type: 'select', options: [['yes', 'Involved or possibly involved'], ['no', 'Not involved']] },
      { k: 'systems', label: 'Systems', type: 'checks', options: [['lakehouse', 'Lakehouse'], ['serving', 'Serving gateway'], ['consent', 'Consent service'], ['pipelines', 'Pipelines'], ['vendor', 'A vendor']] },
    ],
    async submit(v) {
      openIncident({ title: v.title, sev: v.sev, personal: v.personal === 'yes', owner: E.ROLES[S.role].name, detect: `Declared by ${E.ROLES[S.role].name}${v.systems.length ? '; systems: ' + v.systems.join(', ') : ''}` });
      S.incSel = G.incidents[0].id;
      await P.ledger.append('incident.declared', S.token.claims.sub, { incident: S.incSel, sev: v.sev, personal: v.personal === 'yes' });
      go('incidents');
      return { ok: `${S.incSel} declared.${v.personal === 'yes' ? ' Regulator notification due within 72 hours.' : ''}` };
    },
  },
  assessment: {
    title: 'Start an assessment', sub: 'Owner drafts, reviewers sign off by role; approval unlocks the access request or release it gates.', icon: 'risk', roles: ['privacy_reviewer', 'legal_reviewer', 'data_steward', 'ml_engineer'], cta: 'Create draft',
    fields: () => [
      { k: 'type', label: 'Type', type: 'select', options: [['DPIA', 'Data protection impact assessment (GDPR Art. 35)'], ['AI impact assessment', 'AI impact assessment (EU AI Act)'], ['Transfer impact assessment', 'Transfer impact assessment'], ['Legitimate interest assessment', 'Legitimate interest assessment']] },
      { k: 'title', label: 'Title', type: 'text', req: true, ph: 'e.g. Support tickets for triage model training' },
      { k: 'dataset', label: 'Covers dataset', type: 'select', options: P.datasets.map((d) => [d.id, nm(d.id)]) },
      { k: 'due', label: 'Due', type: 'date', def: date(Date.now() + 864e5 * 21) },
    ],
    async submit(v) {
      const pre = { DPIA: 'DPIA', 'AI impact assessment': 'AIIA', 'Transfer impact assessment': 'TIA', 'Legitimate interest assessment': 'LIA' }[v.type];
      const id = `${pre}-2026-${String(200 + G.assessments.length).padStart(3, '0')}`;
      G.assessments.unshift({ id, type: v.type, title: v.title, dataset: v.dataset, status: 'Draft', progress: 10, owner: E.ROLES[S.role].name, due: v.due, signoffs: [], sections: [['Purpose and necessity', 'To be completed by the owner.'], ['Data and people', `Covers ${nm(v.dataset)}.`], ['Risks and mitigations', 'Linked controls are pulled from the risk register.']] });
      await P.ledger.append('assessment.created', S.token.claims.sub, { assessment: id, dataset: v.dataset });
      S.asmSel = id; go('assessments');
      return { ok: `${id} created as a draft.` };
    },
  },
  apikey: {
    title: 'Create an API key', sub: 'Client credentials for a service. Tokens minted from it live 15 minutes and carry only these scopes.', icon: 'settings', roles: ['sre', 'data_steward'], cta: 'Create key',
    fields: () => [
      { k: 'name', label: 'Service name', type: 'text', req: true, ph: 'e.g. svc-wallet-ranker', pattern: /^svc-[a-z0-9-]{3,30}$/, hint: 'Starts with svc-' },
      { k: 'scopes', label: 'Scopes', type: 'checks', req: true, options: [['decide:*', 'decide (policy decisions)'], ['read:consent', 'read:consent'], ['read:catalog', 'read:catalog'], ['lineage:write', 'lineage:write'], ['dsr:operate', 'dsr:operate']] },
      { k: 'expiry', label: 'Expires', type: 'select', options: [['30', 'in 30 days'], ['90', 'in 90 days'], ['365', 'in 1 year']], def: '90' },
    ],
    async submit(v) {
      const secret = 'cst_' + Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join('');
      G.apikeys.unshift({ name: v.name, scopes: v.scopes.join(' '), created: Date.now(), expires: Date.now() + v.expiry * 864e5, prefix: secret.slice(0, 10) });
      await P.ledger.append('apikey.created', S.token.claims.sub, { key: v.name, scopes: v.scopes });
      go('apikeys');
      return { ok: `Key created for ${v.name}.`, reveal: secret };
    },
  },
};
const NEW_MENU = [['dataset', 'Dataset'], ['access', 'Access request'], ['model', 'Model'], ['assessment', 'Assessment'], ['dsr', 'Subject request'], ['incident', 'Incident'], ['apikey', 'API key']];

function openNewMenu(e) {
  e.stopPropagation(); closePop();
  const r = $('#btn-new').getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'popover'; pop.id = 'pop';
  pop.style.top = r.bottom + 6 + 'px'; pop.style.left = Math.max(8, r.left) + 'px';
  pop.innerHTML = `<p class="pop-h">Create</p>` + NEW_MENU.map(([k, t]) => { const f = FORMS[k], ok = !f.roles || f.roles.includes(S.role); return `<button data-newform="${k}" ${ok ? '' : 'class="dis"'}><span class="pop-ic">${icon(f.icon)}</span><span>${t}${ok ? '' : `<small>${f.roles.map((x) => E.ROLES[x].title).join(', ')}</small>`}</span></button>`; }).join('');
  pop.addEventListener('click', (ev) => { const b = ev.target.closest('[data-newform]'); if (b) { closePop(); openForm(b.dataset.newform); } });
  document.body.appendChild(pop);
}

function fieldHtml(f, v, err) {
  const id = 'f-' + f.k, val = v ?? f.def ?? '';
  let input = '';
  if (f.type === 'select') input = `<select id="${id}" name="${f.k}">${f.options.map(([k, t]) => `<option value="${h(k)}"${String(k) === String(val) ? ' selected' : ''}>${h(t)}</option>`).join('')}</select>`;
  else if (f.type === 'textarea') input = `<textarea id="${id}" name="${f.k}" rows="3" placeholder="${h(f.ph || '')}">${h(val)}</textarea>`;
  else if (f.type === 'checks') input = `<div class="checks">${f.options.map(([k, t]) => `<label><input type="checkbox" name="${f.k}" value="${h(k)}"${(Array.isArray(val) ? val : []).includes(k) ? ' checked' : ''}><span>${h(t)}</span></label>`).join('')}</div>`;
  else input = `<input id="${id}" name="${f.k}" type="${f.type}" value="${h(val)}" placeholder="${h(f.ph || '')}"${f.min ? ` min="${f.min}"` : ''}${f.max ? ` max="${f.max}"` : ''} autocomplete="off">`;
  return `<div class="ff${err ? ' bad' : ''}"><label for="${id}">${h(f.label)}${f.req || f.type === 'select' || f.type === 'date' || f.type === 'number' ? '' : ' <span class="opt">optional</span>'}</label>${input}${err ? `<span class="ff-err">${h(err)}</span>` : f.hint ? `<span class="ff-hint">${h(f.hint)}</span>` : ''}</div>`;
}
function openForm(key, values = {}, errors = {}) {
  const f = FORMS[key], allowed = !f.roles || f.roles.includes(S.role);
  closeForm();
  const wrap = document.createElement('div');
  wrap.className = 'modal-back'; wrap.id = 'modal';
  wrap.innerHTML = `<form class="modal" novalidate><div class="modal-head"><span class="insp-glyph">${icon(f.icon)}</span><div><h3>${h(f.title)}</h3><p>${h(f.sub)}</p></div></div>
    <div class="modal-body">${f.fields().map((x) => fieldHtml(x, values[x.k], errors[x.k])).join('')}</div>
    <div class="modal-foot">${allowed ? `<span class="note">Recorded in the audit ledger as ${h(E.ROLES[S.role].name)}.</span>` : `<span class="note warn">${h(E.ROLES[S.role].title)} cannot do this. Needs ${h(f.roles.map((x) => E.ROLES[x].title).join(' or '))}.</span>`}<span class="spacer"></span><button type="button" class="btn" data-modal-cancel>Cancel</button><button type="submit" class="btn primary" ${allowed ? '' : 'disabled'}>${h(f.cta)}</button></div></form>`;
  document.body.appendChild(wrap);
  const form = wrap.querySelector('form');
  (form.querySelector('.ff.bad input, .ff.bad textarea') || form.querySelector('input:not([type=checkbox]), textarea, select'))?.focus();
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) closeForm(); });
  wrap.querySelector('[data-modal-cancel]').addEventListener('click', closeForm);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fields = f.fields(), v = {}, err = {};
    for (const x of fields) {
      if (x.type === 'checks') v[x.k] = [...form.querySelectorAll(`input[name="${x.k}"]:checked`)].map((c) => c.value);
      else v[x.k] = (form.elements[x.k].value || '').trim();
      const empty = Array.isArray(v[x.k]) ? !v[x.k].length : !v[x.k];
      if (x.req && empty) err[x.k] = x.type === 'checks' ? 'Choose at least one.' : 'Required.';
      else if (x.pattern && v[x.k] && !x.pattern.test(v[x.k])) err[x.k] = x.hint || 'Invalid format.';
      else if (x.minLen && v[x.k].length < x.minLen) err[x.k] = `At least ${x.minLen} characters.`;
    }
    if (Object.keys(err).length) return openForm(key, v, err);
    const btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Working…';
    const res = await f.submit(v);
    if (res.error) return openForm(key, v, res.error);
    closeForm();
    if (res.reveal) revealSecret(res.reveal);
    toast(res.ok); renderChrome();
  });
}
function closeForm() { const m = $('#modal'); if (m) m.remove(); }
function revealSecret(secret) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-back'; wrap.id = 'modal';
  wrap.innerHTML = `<div class="modal"><div class="modal-head"><span class="insp-glyph">${icon('settings')}</span><div><h3>Copy this secret now</h3><p>It is shown once. Custodian stores only a hash.</p></div></div><div class="modal-body"><pre class="code secret">${h(secret)}</pre></div><div class="modal-foot"><span class="spacer"></span><button class="btn" data-copy>Copy</button><button class="btn primary" data-modal-cancel>Done</button></div></div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('[data-copy]').addEventListener('click', () => { try { navigator.clipboard.writeText(secret); toast('Copied'); } catch { /* clipboard blocked */ } });
  wrap.querySelector('[data-modal-cancel]').addEventListener('click', closeForm);
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#modal')) closeForm(); });
Object.assign(ACTIVITY, {
  'model.intake': (e) => `registered ${e.payload.name} (${e.payload.risk.toLowerCase()} risk)`,
  'incident.declared': (e) => `declared ${e.payload.incident} (${e.payload.sev})`,
  'assessment.created': (e) => `started ${e.payload.assessment}`,
  'apikey.created': (e) => `created an API key for ${e.payload.key}`,
});

function openHelp(e) {
  e.stopPropagation(); closePop();
  const r = $('#btn-help').getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'popover'; pop.id = 'pop';
  pop.style.top = r.bottom + 6 + 'px'; pop.style.right = Math.max(8, innerWidth - r.right) + 'px';
  pop.innerHTML = `<button data-help="tour"><span>Guided tour<small>Ten short walkthroughs of the platform</small></span></button><button data-help="review"><span>Design review<small>How each part works and why</small></span></button><button data-help="api"><span>API reference</span></button><hr><button data-help="reset"><span>Reset workspace<small>Restore the sample tenant</small></span></button>`;
  pop.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-help]'); if (!b) return; closePop();
    const k = b.dataset.help;
    if (k === 'tour') openActs(); else if (k === 'reset') location.reload(); else go(k);
  });
  document.body.appendChild(pop);
}

/* ───────────────────────── events ───────────────────────── */

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-toggle],[data-opends-go],[data-range],[data-page],[data-catview],[data-bulkall],[data-bulk],[data-drawer],[data-drawertab],[data-closedrawer],[data-asm],[data-inc],[data-lcmodel],[data-lcfilter],[data-lctab],[data-artifact],[data-pipe],[data-apiop],[data-sdk],[data-datamode],[data-opends],[data-reg],[data-sel],[data-go],[data-act],[data-datatab],[data-datauser],[data-dataset],[data-request],[data-model],[data-serve],[data-dsr],[data-node],[data-lnode],[data-lnode-go],[data-linwl],[data-lindir],[data-linrun],[data-linclear],[data-linerase]');
  if (!t || $('#app').hidden) return;
  if (t.dataset.toggle) { e.stopPropagation(); S.open.has(t.dataset.toggle) ? S.open.delete(t.dataset.toggle) : S.open.add(t.dataset.toggle); return renderChrome(); }
  if (t.dataset.range) { S.range = t.dataset.range; return render(); }
  if (t.dataset.page) { const [k, v] = t.dataset.page.split(':'); S[k] = +v; return render(); }
  if (t.dataset.catview) { S.catView = t.dataset.catview; S.bulk.clear(); return render(); }
  if (t.dataset.bulkall !== undefined) { const all = catalogRows().map((d) => d.id); if (S.bulk.size === all.length) S.bulk.clear(); else all.forEach((id) => S.bulk.add(id)); return render(); }
  if (t.dataset.bulk) { e.stopPropagation(); S.bulk.has(t.dataset.bulk) ? S.bulk.delete(t.dataset.bulk) : S.bulk.add(t.dataset.bulk); return render(); }
  if (t.dataset.drawer) { const [k, v] = t.dataset.drawer.split(':'); if (k === 'risk') S.riskSel = v; openDrawer(k, v); return render(); }
  if (t.dataset.drawertab) { S.drawer.tab = t.dataset.drawertab; return drawDrawer(); }
  if (t.dataset.closedrawer !== undefined) return closeDrawer();
  if (t.dataset.asm) { S.asmSel = t.dataset.asm; return render(); }
  if (t.dataset.inc) { S.incSel = t.dataset.inc; return render(); }
  if (t.dataset.opendsGo) { S.data.mode = 'datasets'; S.data.ds = t.dataset.opendsGo; return go('data'); }
  if (t.dataset.lctab) { S.lcTab = t.dataset.lctab; return render(); }
  if (t.dataset.lcfilter) { S.lcFilter = t.dataset.lcfilter; return render(); }
  if (t.dataset.lcmodel) { S.lcModel = t.dataset.lcmodel; return render(); }
  if (t.dataset.artifact) { S.art.artifact = t.dataset.artifact; S.art.action = S.art.action === 'invoke' ? 'download' : S.art.action; return render(); }
  if (t.dataset.pipe) { S.pipe = t.dataset.pipe; return render(); }
  if (t.dataset.apiop) { S.apiOp = t.dataset.apiop; return render(); }
  if (t.dataset.sdk) { S.sdkLang = t.dataset.sdk; return render(); }
  if (t.dataset.datamode) { S.data.mode = t.dataset.datamode; return render(); }
  if (t.dataset.opends !== undefined) { S.data.ds = t.dataset.opends || null; if (S.data.ds && UNMASKED_ROLES.has(S.role)) P.ledger.append('data.read', S.token.claims.sub, { dataset: S.data.ds, unmasked: true, rows: 'sample' }); $('#view').scrollTop = 0; return render(); }
  if (t.dataset.reg) { S.regRegion = t.dataset.reg; return render(); }
  if (t.dataset.sel) { const [k, v] = t.dataset.sel.split(/:(.*)/s); S.sel[k] = v; }
  if (t.dataset.go) { e.preventDefault(); return go(t.dataset.go); }
  if (t.dataset.datatab) { S.data.tab = t.dataset.datatab; return render(); }
  if (t.dataset.datauser) { S.data.user = t.dataset.datauser; openDrawer('person', t.dataset.datauser); return render(); }
  if (t.dataset.dataset) { S.sel.dataset = t.dataset.dataset; return render(); }
  if (t.dataset.request) { S.sel.request = t.dataset.request; return render(); }
  if (t.dataset.model) { S.sel.model = t.dataset.model; openDrawer('model', t.dataset.model); return render(); }
  if (t.dataset.serve) { S.sel.serve = +t.dataset.serve; return render(); }
  if (t.dataset.dsr) { S.sel.dsr = t.dataset.dsr; return render(); }
  if (t.dataset.lnode) { linSelect(t.dataset.lnode); return render(); }
  if (t.dataset.lnodeGo) { const id = t.dataset.lnodeGo; go('lineage'); S.lin.focus = null; linSelect(id); return render(); }
  if (t.dataset.linwl) { S.lin.wl = t.dataset.linwl; return render(); }
  if (t.dataset.lindir) { S.lin.dir = t.dataset.lindir; return render(); }
  if (t.dataset.linrun) { openDrawer('run', t.dataset.linrun); return render(); }
  if (t.dataset.linclear !== undefined) { if (S.lin.focus) { S.lin.focus = null; closeDrawer(); } return render(); }
  if (t.dataset.linerase !== undefined) { S.dsrUser = S.lineageUser; return go('dsr'); }
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
    if (t.dataset.bind === 'lineageUser') { S.lin.focus = null; if (t.value) openDrawer('person', t.value); else closeDrawer(); }
    if (t.dataset.bind === 'agent.user') { S.agent.agentToken = null; S.agent.results = []; }
    if (t.dataset.bind === 'audit.filter') { S.audit.loaded = null; }
    return render();
  }
  if (t.dataset.consent) changeConsent(t.dataset.consent, t.checked);
});
document.addEventListener('input', (e) => {
  if (e.target.dataset.bind === 'newDs') S.newDs = e.target.value;
  if (e.target.dataset.filter) { F[e.target.dataset.filter] = e.target.value; render(); }
});

const ACTIONS = {
  'lc-remediate': () => lcAct('remediate'), 'lc-approve': () => lcAct('approve'), 'lc-changes': () => lcAct('changes'), 'lc-promote': () => lcAct('promote'),
  'lin-notify': async () => {
    const g = L.lineageGraph(P), im = L.impact(g, S.lin.focus);
    const owners = [...new Set([...im.down].map((id) => g.nodes.find((x) => x.id === id).owner).filter(Boolean))];
    await P.ledger.append('lineage.impact_notified', S.token.claims.sub, { node: S.lin.focus, owners, downstream: im.down.size });
    toast(`Sent a change notice to ${owners.join(', ')}`);
  },
  report: (t) => generateReport(t.dataset.key),
  'bulk-approve': async () => { let n = 0; for (const id of S.bulk) { const d = P.dataset(id); if (d.status === 'pending') { d.status = 'approved'; n++; await P.ledger.append('catalog.approved', S.token.claims.sub, { dataset: id, bulk: true }); } } S.bulk.clear(); toast(n ? `Approved ${n} dataset${n > 1 ? 's' : ''}` : 'Nothing pending in the selection'); render(); renderChrome(); },
  'bulk-review': () => { toast(`Review requested from the data steward for ${S.bulk.size} datasets`); S.bulk.clear(); render(); },
  'bulk-export': () => { const ids = [...S.bulk]; const rows = [['dataset', 'classification', 'region', 'status'], ...ids.map((id) => { const d = P.dataset(id); return [id, d.classification, d.region, d.status]; })]; const url = URL.createObjectURL(new Blob([csv(rows)], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = 'custodian-selection.csv'; a.click(); },
  'bulk-clear': () => { S.bulk.clear(); render(); },
  'new-asm': () => { const id = 'DPIA-2026-' + (119 + G.assessments.length); G.assessments.unshift({ id, type: 'DPIA', title: 'Search clicks v3 for search quality', dataset: 'search_clicks_v3', status: 'Draft', progress: 15, owner: E.ROLES[S.role].name, due: date(Date.now() + 864e5 * 21), signoffs: [], sections: [['Purpose and necessity', 'Improve search ranking quality with click feedback.'], ['Data and people', 'Query text and clicks for US users; free text may contain personal data.'], ['Open items', 'Decide redaction for query text before any training use.']] }); S.asmSel = id; toast(`${id} created as a draft`); render(); },
  signoff: async () => { const a = G.assessments.find((x) => x.id === S.asmSel) || G.assessments[0]; const r = S.role === 'legal_reviewer' ? 'Legal' : 'Privacy'; if (!a.signoffs.includes(r)) a.signoffs.push(r); a.progress = Math.min(100, a.progress + 15); a.status = a.signoffs.includes('Privacy') && a.signoffs.includes('Legal') ? 'Approved' : 'In review'; if (a.status === 'Approved') a.progress = 100; await P.ledger.append('assessment.signoff', S.token.claims.sub, { assessment: a.id, as: r }); toast(`${r} sign-off recorded on ${a.id}`); render(); },
  declare: () => { openIncident({ title: 'Suspected over-collection in search clicks v3', sev: 'SEV-2', personal: true, owner: E.ROLES[S.role].name, detect: 'Reported by a reviewer: query text may include emails' }); S.incSel = G.incidents[0].id; render(); },
  'resolve-inc': () => { const i = G.incidents.find((x) => x.id === S.incSel) || G.incidents.find((x) => x.status !== 'Resolved'); if (i) { i.status = 'Resolved'; i.resolved = Date.now(); i.timeline.push(['Resolved', 'Closed by ' + E.ROLES[S.role].name]); } render(); renderChrome(); },
  'api-try': apiTry,
  'as-auditor': () => signIn('auditor'),
  export: (t) => {
    const k = t.dataset.key, rows = EXPORTS[k] ? EXPORTS[k]() : [];
    const url = URL.createObjectURL(new Blob([csv(rows)], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `custodian-${k}-${date(Date.now())}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Exported ${fmt(Math.max(rows.length - 1, 0))} rows`);
  },
  chaos: async () => {
    P.policyUp = !P.policyUp;
    if (P.policyUp) P.breaker = { state: 'half-open', failures: 0, openedAt: 0 };
    await P.ledger.append(P.policyUp ? 'chaos.restored' : 'chaos.killed', S.token.claims.sub, { service: 'policy-service' });
    if (!P.policyUp) { S.chaosLog.push(Date.now()); openIncident({ title: 'Policy engine unavailable', sev: 'SEV-2', personal: false, owner: 'Priya Nair', detect: 'Circuit breaker opened; gateway failing closed' }); }
    else resolveIncident('Policy engine unavailable', 'Policy engine restored; breaker closed. Zero personalized outputs without an allow during the outage.');
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
  'request-access': () => requestAccess(),
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
  verify: async () => { S.audit.verify = await P.ledger.verify(); if (!S.audit.verify.ok && !G.incidents.some((i) => i.title === 'Audit ledger tampering detected' && i.status !== 'Resolved')) openIncident({ title: 'Audit ledger tampering detected', sev: 'SEV-1', personal: true, owner: 'Henrik Lund', detect: `Hash chain broken at entry #${S.audit.verify.brokenAt}` }); toast(S.audit.verify.ok ? `Chain intact: ${fmt(S.audit.verify.checked)} entries` : `Tampering detected at entry #${S.audit.verify.brokenAt}`); render(); },
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
  pop.innerHTML = Object.entries(E.ROLES).map(([k, x]) => `<button class="${k === S.role ? 'on' : ''}" data-role="${k}"><span class="av">${initials(x.name)}</span><span>${h(x.name)}<small>${h(x.title)}</small></span></button>`).join('') + `<hr><button data-role="__theme">${document.documentElement.dataset.theme === 'dark' ? 'Light appearance' : 'Dark appearance'}</button><button data-role="__out">Sign out</button><button data-role="__lock">Lock</button>`;
  pop.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-role]'); if (!b) return;
    closePop();
    if (b.dataset.role === '__theme') { const dk = document.documentElement.dataset.theme !== 'dark'; document.documentElement.dataset.theme = dk ? 'dark' : 'light'; try { localStorage.setItem('custodian.theme', dk ? 'dark' : 'light'); } catch { /* storage blocked */ } return render(); }
    if (b.dataset.role === '__out') { store.del('custodian.role'); return showSignin(); }
    if (b.dataset.role === '__lock') { store.del('custodian.role'); location.href = '/custodian/__logout'; return; }
    signIn(b.dataset.role);
  });
  document.body.appendChild(pop);
});
function closePop() { const p = $('#pop'); if (p) p.remove(); }
document.addEventListener('click', (e) => { if (!e.target.closest('#pop')) closePop(); });
$('#menu-btn').addEventListener('click', () => $('#side').classList.toggle('open'));
$('#btn-new').addEventListener('click', openNewMenu);
$('#btn-help').addEventListener('click', openHelp);

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
    say(n, 'Home: what needs this role, whether every control is green, and what just happened.'); await pause(4500);
    go('architecture'); say(n, 'Control, data and evidence planes. Every AI workload plugs into the same three.'); await pause(4500);
    S.data.mode = 'datasets'; S.data.ds = 'iphone_app_events_raw'; go('data'); say(n, 'Open a dataset: raw iPhone events. Sensitive columns are masked for this role.'); await pause(4500);
    S.data.mode = 'people'; S.data.tab = 'minimized'; render(); say(n, 'Per person: the minimized view a model may read, with geohash, no IDFA and hourly timestamps.'); await pause(4500);
  }],
  ['Governed onboarding', 'Register iphone_app_events_v2, scan, review, grant with conditions.', async (n) => {
    await as('ml_engineer'); go('catalog'); S.newDs = 'iphone_app_events_v2';
    if (!P.dataset('iphone_app_events_v2')) { say(n, 'The ML engineer registers a new dataset. The scanner runs on schema and samples.'); render(); await pause(1500); await registerDataset(); openDrawer('dataset', 'iphone_app_events_v2'); await pause(2200); }
    await as('data_steward'); go('catalog'); openDrawer('dataset', 'iphone_app_events_v2');
    say(n, 'Precise location and IDFA found, so it is restricted. The steward confirms the tags.'); await pause(2600);
    if (P.dataset('iphone_app_events_v2').status === 'pending') await ACTIONS['approve-ds']();
    await pause(1500);
    await as('ml_engineer'); say(n, 'The engineer requests access for ads personalization. The workflow pre-checks policy first.');
    if (!P.accessRequests.some((r) => r.dataset === 'iphone_app_events_v2')) await requestAccess(); else go('access');
    await pause(3200);
    S.sel.request = P.accessRequests.find((q) => q.dataset === 'iphone_app_events_v2').id;
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
    if (S.train.result && S.train.result.ok) openDrawer('model', E.mname(S.train.result.model));
    go('lineage'); if (S.train.result && S.train.result.ok) { S.lin.focus = null; linSelect(E.mname(S.train.result.model)); render(); } say(n, 'Lineage records the exact Iceberg snapshot the model read, and what the new model would affect.'); await pause(4500);
    go('models'); if (S.train.result && S.train.result.ok) openDrawer('model', E.mname(S.train.result.model)); say(n, 'Model card generated on registration, shown in the Inspector: purpose, provenance, exclusions.'); await pause(4500);
    S.lcModel = 'assistant-llm'; go('lifecycle'); say(n, 'Post-training is governed too: fine-tuning, preference data and safety evals each pass a gate.'); await pause(4500);
    S.art = { principal: 'maya.chen', action: 'download', artifact: 'ckpt/adrank/v3-eu', endpoint: 'assistant-llm-inference', region: 'US' }; go('artifacts'); say(n, 'Weights inherit sensitivity and region from their data: EU-trained weights cannot leave the EU.'); await pause(4500);
  }],
  ['Real-time consent', 'A California user turns on GPC; the next ad is contextual.', async (n) => {
    await as('sre');
    const u = P.users.find((x) => x.region === 'US-CA' && !x.gpc && x.personalizedAdsToggle && x.att === 'authorized' && x.age_band === '18_plus' && P.userById.has(x.id));
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
    say(n, 'Fallback spikes, the breaker opens, and personalized-without-allow stays at zero.'); await pause(6000);
    go('incidents'); say(n, 'An incident opened automatically. No personal data affected, so no regulator clock.'); await pause(4000);
    go('serving');
    await ACTIONS.chaos(); say(n, 'Restored. The breaker half-opens, then closes, and personalization returns.'); await pause(5000);
  }],
  ['Right to erasure', 'EU user deletion saga with snapshot expiry and evidence.', async (n) => {
    await as('privacy_reviewer'); const u = defaultErasureUser(); S.dsrUser = u.id;
    S.lineageUser = u.id; S.lin.focus = null; go('lineage'); openDrawer('person', u.id); say(n, `${u.id} (${u.region}) files an erasure request. Lineage shows everywhere their data lives.`); await pause(4000);
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
    go('regulations'); say(n, 'The landscape: what is due next, each law, and the controls that answer it.'); await pause(5500);
    go('compliance'); say(n, 'Every control mapped to its article and its evidence.'); await pause(4500);
  }],
];

function openActs() {
  closeActs();
  const back = document.createElement('div'); back.className = 'sheet-back'; back.id = 'sheet-back'; back.onclick = closeActs;
  const sh = document.createElement('aside'); sh.className = 'sheet'; sh.id = 'sheet';
  sh.innerHTML = `<div class="sheet-head"><h3>Guided tour</h3><span class="spacer"></span><button class="btn" id="run-all">Run all</button><button class="btn" id="sheet-x">Done</button></div>
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
$('#btn-search').addEventListener('click', openPalette);
$('#btn-bell').addEventListener('click', openBell);
document.addEventListener('dblclick', (e) => {
  const n = e.target.closest('[data-lnode]');
  if (n) { const id = n.dataset.lnode; if (P.dataset(id)) { S.data.mode = 'datasets'; S.data.ds = id; return go('data'); } if (P.models.some((m) => E.mname(m) === id)) { S.sel.model = id; go('models'); return openDrawer('model', id); } if (E.ENDPOINTS.some((x) => x.id === id)) return go('artifacts'); return; } const c = e.target.closest('[data-dblopen]'); if (c) { S.data.mode = 'datasets'; S.data.ds = c.dataset.dblopen; $('#view').scrollTop = 0; render(); } });
$('#btn-insp').addEventListener('click', () => { S.inspector = !S.inspector; layoutInspector(); });
document.addEventListener('keydown', (e) => { if (e.altKey && e.metaKey && (e.key === '0' || e.code === 'Digit0')) { e.preventDefault(); S.inspector = !S.inspector; layoutInspector(); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closePop(); closeDrawer(); } });
document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !$('#app').hidden) { e.preventDefault(); openPalette(); } });

/* ───────────────────────── start ───────────────────────── */

try { const th = localStorage.getItem('custodian.theme'); if (th) document.documentElement.dataset.theme = th; } catch { /* storage blocked */ }
initChartHover();

(async () => {
  const role = store.get('custodian.role');
  if (role && E.ROLES[role]) return signIn(role, true);
  showSignin();
})();
