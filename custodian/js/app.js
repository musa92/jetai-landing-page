/* Custodian console: renders engine.js state, runs live traffic, and drives the
   scripted demo acts. Plain ES modules, no build step. */
import * as E from './engine.js?v=20261023-3';
import { SAMPLES, sampleKind, MASKED_TAGS, UNMASKED_ROLES, mask } from './samples.js?v=20261023-1';
import { REGULATIONS, WATCH, PATTERNS } from './regulations.js?v=20261023-1';

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
  renderChrome(); render();
}

async function boot() {
  P = new E.Platform({ users: 10000 });
  await P.ledger.append('platform.start', 'system', { users: P.users.length, policy: 'ads-1.4.0' });
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
  search: '<circle cx="9" cy="9" r="5.5"/><path d="m13 13 4 4"/>',
  bell: '<path d="M5 8a5 5 0 0 1 10 0c0 4 1.5 5.5 1.5 5.5h-13S5 12 5 8M8 16a2 2 0 0 0 4 0"/>',
};
const icon = (k) => `<svg class="ic" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

const SECTIONS = [
  ['home', 'Home', [['overview', 'Overview']]],
  ['data', 'Data', [['data', 'Explorer'], ['catalog', 'Catalog'], ['lineage', 'Lineage']]],
  ['access', 'Access', [['access', 'Requests'], ['policy', 'Policies'], ['agent', 'Agents']]],
  ['privacy', 'Privacy', [['consent', 'Consent'], ['dsr', 'Subject requests']]],
  ['models', 'Models', [['models', 'Registry'], ['training', 'Training gate']]],
  ['ops', 'Operations', [['serving', 'Serving'], ['insights', 'Insights'], ['architecture', 'Architecture']]],
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
  };
}
function renderChrome() {
  const c = counts(), cur = SECTION_OF[S.view];
  const item = ([k, t, tabs]) => `<button class="nav-item${cur === k ? ' on' : ''}" data-go="${tabs[0][0]}">${icon(k)}${t}<span class="count${c[k] === '!' ? ' alert' : ''}">${c[k] ?? ''}</span></button>`;
  $('#nav').innerHTML = SECTIONS.filter(([k]) => k !== 'settings').map(item).join('');
  $('#nav-bottom').innerHTML = item(SECTIONS.find(([k]) => k === 'settings'));
  const n = notifications().length;
  $('#btn-bell').innerHTML = icon('bell') + (n ? `<span class="badge">${n}</span>` : '');
  const r = E.ROLES[S.role];
  $('#btn-role').innerHTML = `<span class="av">${initials(r.name)}</span>${h(r.name.split(' ')[0])} <small>${h(r.title)}</small>`;
  const sec = SECTIONS.find(([k]) => k === cur);
  $('#bar-title').innerHTML = `<span class="crumb">${sec[1]}</span>${sec[2].length > 1 ? `<span class="crumb-sep">›</span><span>${TITLES[S.view]}</span>` : ''}`;
  const ck = controlChecks(), passing = ck.filter((c) => c[1]).length;
  const critical = !P.policyUp || P.breaker.state !== 'closed' || P.serving.violations > 0;
  $('#side-foot').innerHTML = `<span class="health ${critical ? 'bad' : passing === ck.length ? '' : 'warn'}"></span>${passing} of ${ck.length} controls passing<br>Policy ads-1.4.0 · ${fmt(P.users.length)} users<br>Session until ${time(S.token.claims.exp * 1000)}`;
}
function tabsBar() {
  const sec = SECTIONS.find(([k]) => k === SECTION_OF[S.view]);
  if (!sec || sec[2].length < 2) return '';
  return `<div class="tabs-wrap"><div class="seg">${sec[2].map(([v, t]) => `<button class="${S.view === v ? 'on' : ''}" data-go="${v}">${t}</button>`).join('')}</div></div>`;
}

function go(view) { S.view = view; $('#side').classList.remove('open'); renderChrome(); render(); $('#view').scrollTop = 0; }

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
}
const LIVE = new Set(['overview', 'serving', 'insights']);
setInterval(() => {
  if (!P || $('#app').hidden) return;
  const a = document.activeElement;
  if (a && $('#view').contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
  if (LIVE.has(S.view)) render();
  renderChrome();
}, 1000);

const head = (title, sub, how) => `<div class="view-head"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}${how ? `<details class="how"><summary>How it works</summary><p>${how}</p></details>` : ''}</div>`;

/* Human names for the things people see; technical IDs stay one hover or line away. */
const NAMES = {
  iphone_app_events_raw: 'iPhone app events, raw', iphone_app_events_raw_eu: 'iPhone app events, raw (EU)',
  app_events_clean: 'App events, cleaned', app_events_clean_eu: 'App events, cleaned (EU)',
  session_metrics_daily: 'Daily session metrics', ad_features_v7: 'Ad features v7', ad_features_v7_eu: 'Ad features v7 (EU)',
  assistant_conversations: 'Assistant conversations, raw', assistant_conversations_redacted: 'Assistant conversations, redacted',
  search_clicks_v3: 'Search clicks v3', iphone_app_events_v2: 'iPhone app events v2', iphone_app_events_v2_ads: 'iPhone app events v2, ads view',
  consent_records: 'Consent records',
  ads_personalization: 'Personalized ads', analytics: 'Analytics', model_training: 'Model training', cross_service_combination: 'Cross-service data use', third_party_sharing: 'Sharing with partners', user_assist: 'Assistant help',
  'dev.patel': 'Dev Patel', 'maya.chen': 'Maya Chen', 'jonas.weber': 'Jonas Weber', 'amara.okafor': 'Amara Okafor', 'luis.ortega': 'Luis Ortega', 'priya.nair': 'Priya Nair', 'henrik.lund': 'Henrik Lund',
  'svc-ads-trainer': 'Ads trainer', 'svc-assistant-trainer': 'Assistant trainer', 'svc-ad-gateway': 'Ad gateway', 'agent:assistant-7': 'Assistant agent',
  'consent-service': 'Consent service', 'dsr-service': 'Privacy requests', 'policy-service': 'Policy engine', 'data-steward': 'Data steward', workflow: 'Workflow engine', system: 'Custodian',
};
const REASONS = {
  att_denied: 'Tracking not allowed', gdpr_no_opt_in: 'No EU opt-in', dma_no_combination_consent: 'No cross-service consent', ccpa_opt_out: 'Opted out of sharing',
  gpc_signal: 'Global Privacy Control', minor_no_profiling: 'Minor or unknown age', purpose_not_permitted: 'Purpose not approved', restricted_for_ads: 'Restricted data',
  eu_transfer_blocked: 'EU data residency', no_active_grant: 'No access grant', dataset_not_approved: 'Dataset not approved', missing_input: 'Missing input, failed closed',
  gdpr_no_training_consent: 'No EU training consent', training_opt_out: 'Opted out of training', consent_unknown: 'Consent unknown', att_denied_ca: 'Tracking denied (CA)',
  insufficient_scope: 'Token scope too narrow', no_table: 'No table', deleted: 'Erased',
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
function csv(rows) { return rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'); }

const can = (...roles) => roles.includes(S.role);
const roleNote = (...roles) => can(...roles) ? '' : `<p class="note">Requires ${roles.map((r) => `<code>${r}</code>`).join(' or ')}. Switch account from the top right.</p>`;
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
  'dsr.opened': () => 'opened an erasure request',
  'dsr.step': (e) => `completed erasure step ${e.payload.step}`,
  'dsr.completed': () => 'completed an erasure, evidence signed',
  'dsr.rerun': () => 're-ran an erasure: no-op',
  'chaos.killed': () => 'killed the policy service (chaos)',
  'chaos.restored': () => 'restored the policy service',
  'token.exchange': () => 'received a delegated token',
  'agent.tool_call': (e) => `${e.payload.allow ? 'was allowed' : 'was denied'} tool ${e.payload.tool}`,
  'platform.start': () => 'started the platform',
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
  return `<svg class="ring" viewBox="0 0 56 56"><circle cx="28" cy="28" r="${r}" fill="none" stroke="#ececf0" stroke-width="6"/><circle cx="28" cy="28" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 28 28)"/><text x="28" y="32" text-anchor="middle">${Math.round(f * 100)}</text></svg>`;
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

VIEWS.architecture = () => head('Architecture', 'Three planes every AI workload plugs into. Select a box to open it.', 'In this hosted demo each component runs in the browser. Production mapping: Keycloak, OPA, Postgres with outbox, Redpanda, Redis, Temporal, Iceberg on S3, Marquez, MLflow, S3 Object Lock. See docs/DESIGN.md.') + `
  <div class="grid"><div class="card c12">${archDiagram()}</div></div>`;

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
const LAYER = { raw: 'Raw', cleaned: 'Cleaned', features: 'Features' };
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
    <div class="gallery">${list.map((d) => `<button class="ds-card" data-opends="${d.id}">
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
      <div class="row between"><button class="btn" data-opends="">‹ All datasets</button><div class="row"><button class="btn" data-go="catalog" data-sel="dataset:${d.id}">Open in catalog</button><button class="btn" data-go="lineage">Lineage</button><button class="btn" data-act="export" data-key="sample">Export sample</button></div></div>
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

/* ── catalog ── */
const catalogRows = () => P.datasets.filter((d) => match('catalog', d.id, nm(d.id), d.classification, d.owner, d.region, d.workload && E.WORKLOADS[d.workload].name, d.pii.join(' ')));
EXPORTS.catalog = () => [['dataset', 'name', 'workload', 'classification', 'pii', 'region', 'allowed_purposes', 'retention_days', 'status', 'owner'], ...catalogRows().map((d) => [d.id, nm(d.id), d.workload || 'shared', d.classification, d.pii.join(' '), d.region, d.allowed_purposes.join(' '), d.retention_days, d.status, d.owner])];
VIEWS.catalog = () => {
  const sel = P.dataset(S.sel.dataset);
  const exists = P.dataset(S.newDs);
  return head('Catalog', 'Every dataset that feeds an AI workload, who owns it, how sensitive it is, and what it may be used for.', 'Registration runs a PII scanner on schema and samples and proposes tags. Datasets start pending and cannot be read by any job until a steward approves them.') + `
  <div class="grid">
    <div class="card c12">${tools('catalog', catalogRows().length, P.datasets.length, 'Search datasets, owners, PII')}<div class="scroll-x"><table class="table"><thead><tr><th>Dataset</th><th>Workload</th><th>Classification</th><th>PII</th><th>Region</th><th>Allowed purposes</th><th>Retention</th><th>Status</th></tr></thead><tbody>
      ${catalogRows().map((d) => `<tr class="click${d.id === S.sel.dataset ? ' sel' : ''}" data-dataset="${d.id}"><td>${named(d.id)}</td><td>${d.workload ? E.WORKLOADS[d.workload].name : 'shared'}</td><td>${pill(d.classification)}</td><td><div class="tags">${d.pii.map((t) => pill('', t)).join('')}</div></td><td>${d.region}</td><td>${d.allowed_purposes.map(nm).join(', ')}</td><td>${d.retention_days} d</td><td>${pill(d.status)}</td></tr>`).join('')}
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
  const live = E.decide(input, 'ads-1.4.0'), shadow = E.decide(input, 'ads-1.5.0');
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
      <table class="table"><tbody><tr><td class="mono">ads-1.4.0</td><td>${pill('live')}</td><td>${E.POLICY_BUNDLES['ads-1.4.0'].rules.length} rules, opa test: 5 passing</td></tr><tr><td class="mono">ads-1.5.0</td><td>${pill('shadow')}</td><td>${E.POLICY_BUNDLES['ads-1.5.0'].rules.length} rules, evaluated alongside live, never enforced</td></tr></tbody></table>
      <h3>Shadow mode diff</h3><p class="note">Evaluate both bundles over every user on the personalization path and show where they would disagree before rollout.</p>
      <div class="row"><button class="btn primary" data-act="shadow">Run shadow comparison</button></div>
      ${S.shadow ? `<p class="note">${fmt(S.shadow.total)} users evaluated in ${S.shadow.ms.toFixed(0)} ms. ${fmt(S.shadow.flips)} decisions would change (${pct(S.shadow.flips, S.shadow.total)}), all allow to deny.</p>${bars(Object.entries(S.shadow.by).sort((a, b) => b[1] - a[1]).map(([k, v]) => [rsn(k), v]), 'red')}` : ''}
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
    <div class="row"><button class="btn" data-go="models">Open model card</button><button class="btn" data-go="lineage">View lineage</button></div>`;
}

/* ── models ── */
EXPORTS.models = () => [['model', 'workload', 'stage', 'status', 'score', 'trained_on'], ...P.models.map((m) => [E.mname(m), E.WORKLOADS[m.workload].name, m.stage, m.status, m.auc, m.trainedOn.map((t) => t.table + '@' + t.snapshot).join(' ')])];
VIEWS.models = () => {
  const sel = P.models.find((m) => E.mname(m) === S.sel.model) || P.models.at(-1);
  const card = sel.card || E.modelCard({ ...sel, excluded: {}, eligible: sel.members.size }, P.dataset(sel.trainedOn[0].table), { version: 'ads-1.3.2' });
  return head('Models', 'Every model, what it may be used for, and the data it learned from.', 'Model cards are generated at registration from lineage and the training gate. When an erased person was in a model\'s training data, the model is flagged for retraining.') + `
  <div class="grid">
    <div class="card c5">${tools('models', P.models.filter((m) => match('models', E.mname(m), E.WORKLOADS[m.workload].name, m.stage, m.status)).length, P.models.length, 'Search models')}<table class="table"><thead><tr><th>Model</th><th>Stage</th><th>Status</th><th>Score</th></tr></thead><tbody>
      ${P.models.filter((m) => match('models', E.mname(m), E.WORKLOADS[m.workload].name, m.stage, m.status)).map((m) => `<tr class="click${m === sel ? ' sel' : ''}" data-model="${E.mname(m)}"><td class="mono">${E.mname(m)}<br><span class="note">${E.WORKLOADS[m.workload].name}</span></td><td>${m.stage}</td><td>${pill(m.status)}</td><td>${m.auc}</td></tr>`).join('')}
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
  return head('Lineage', 'Where data comes from, where it goes, and where one person\'s data lives today.', 'Every job emits OpenLineage events with exact Iceberg snapshot IDs, so model provenance and per-person location are precise.') + `
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
  const rows = all.filter((e) => match('audit', e.type, e.actor, nm(e.actor), JSON.stringify(e.payload), e.subject)).slice(0, 80);
  return head('Audit ledger', 'A record of every decision that cannot be rewritten without detection.', 'Append-only and hash-chained: each entry commits to the one before it. Merkle roots are written to object-locked storage, so a rewrite of history is provable. People appear only as keyed pseudonyms.') + `
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
      ${a.filter ? `<p class="note">Pseudonym ${a.pseudonym || ''}: ${fmt(all.length)} entries.</p>` : ''}
      ${tools('audit', all.filter((e) => match('audit', e.type, e.actor, nm(e.actor), JSON.stringify(e.payload), e.subject)).length, all.length, 'Search type, actor, payload')}
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
  items.push({ t: 'Run the demo', kind: 'Action', act: 'demo' }, { t: 'Verify the audit chain', kind: 'Action', go: 'audit', act: 'verify' }, { t: 'Switch account', kind: 'Action', act: 'role' });
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

/* ───────────────────────── events ───────────────────────── */

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-datamode],[data-opends],[data-reg],[data-sel],[data-go],[data-act],[data-datatab],[data-datauser],[data-dataset],[data-request],[data-model],[data-serve],[data-dsr],[data-node]');
  if (!t || $('#app').hidden) return;
  if (t.dataset.datamode) { S.data.mode = t.dataset.datamode; return render(); }
  if (t.dataset.opends !== undefined) { S.data.ds = t.dataset.opends || null; if (S.data.ds && UNMASKED_ROLES.has(S.role)) P.ledger.append('data.read', S.token.claims.sub, { dataset: S.data.ds, unmasked: true, rows: 'sample' }); $('#view').scrollTop = 0; return render(); }
  if (t.dataset.reg) { S.regRegion = t.dataset.reg; return render(); }
  if (t.dataset.sel) { const [k, v] = t.dataset.sel.split(/:(.*)/s); S.sel[k] = v; }
  if (t.dataset.go) { e.preventDefault(); return go(t.dataset.go); }
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
document.addEventListener('input', (e) => {
  if (e.target.dataset.bind === 'newDs') S.newDs = e.target.value;
  if (e.target.dataset.filter) { F[e.target.dataset.filter] = e.target.value; render(); }
});

const ACTIONS = {
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
    if (b.dataset.role === '__lock') { store.del('custodian.role'); location.href = '/custodian/__logout'; return; }
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
    say(n, 'Home: what needs this role, whether every control is green, and what just happened.'); await pause(4500);
    go('architecture'); say(n, 'Control, data and evidence planes. Every AI workload plugs into the same three.'); await pause(4500);
    S.data.mode = 'datasets'; S.data.ds = 'iphone_app_events_raw'; go('data'); say(n, 'Open a dataset: raw iPhone events. Sensitive columns are masked for this role.'); await pause(4500);
    S.data.mode = 'people'; S.data.tab = 'minimized'; render(); say(n, 'Per person: the minimized view a model may read, with geohash, no IDFA and hourly timestamps.'); await pause(4500);
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
    go('lineage'); say(n, 'Lineage records the exact Iceberg snapshot the model read.'); await pause(3500);
    go('models'); say(n, 'Model card generated on registration: purpose, provenance, exclusions.'); await pause(4000);
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
    go('regulations'); say(n, 'The landscape: what is due next, each law, and the controls that answer it.'); await pause(5500);
    go('compliance'); say(n, 'Every control mapped to its article and its evidence.'); await pause(4500);
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
$('#btn-search').addEventListener('click', openPalette);
$('#btn-bell').addEventListener('click', openBell);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop(); });
document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !$('#app').hidden) { e.preventDefault(); openPalette(); } });

/* ───────────────────────── start ───────────────────────── */

(async () => {
  const role = store.get('custodian.role');
  if (role && E.ROLES[role]) return signIn(role, true);
  showSignin();
})();
