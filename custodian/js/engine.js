/* Custodian engine: every governance mechanism the console shows, as plain,
   testable code. No DOM here; app.js renders it and tests/engine.test.mjs
   exercises it in Node.

   Production mapping (see docs/DESIGN.md):
     Identity   -> Keycloak (OIDC, client credentials, RFC 8693 token exchange)
     Consent    -> Postgres bitemporal table + transactional outbox -> Kafka -> Redis
     Policy     -> OPA bundles (Rego); this file mirrors policies/ads.rego rule for rule
     Workflows  -> Temporal (access requests, DSR saga, retention)
     Lakehouse  -> Iceberg on S3/MinIO, region-partitioned buckets
     Lineage    -> OpenLineage events into Marquez
     Audit      -> append-only hash chain in Postgres, Merkle roots to WORM storage */

/* ───────────────────────── utilities ───────────────────────── */

export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const enc = new TextEncoder();
const subtle = globalThis.crypto.subtle;

export function hex(buf) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}
export async function sha256(text) {
  return hex(await subtle.digest('SHA-256', enc.encode(text)));
}
async function hmacKey(secret) {
  return subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
export async function hmac(secret, text) {
  return hex(await subtle.sign('HMAC', await hmacKey(secret), enc.encode(text)));
}
function b64url(obj) {
  const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
  const b = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s).toString('base64');
  return b.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
/* Canonical JSON (sorted keys) so hashes and signatures are reproducible. */
export function canonical(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
}

export const PURPOSES = ['ads_personalization', 'analytics', 'model_training', 'cross_service_combination'];

/* Governed AI workloads. Ads ranking is one of several; every workload runs
   through the same identity, policy, consent, lineage and audit planes. */
export const WORKLOADS = {
  ads_ranking:   { name: 'Ads ranking', model: 'adrank', userPurpose: 'ads_personalization', owner: 'ads-ml', intended: 'Rank sponsored place results for users with an allow decision for ads_personalization.' },
  assistant_llm: { name: 'Assistant LLM fine-tuning', model: 'assistant-llm', userPurpose: 'model_training', owner: 'assistant-ml', intended: 'Fine-tune the in-app assistant on redacted conversations from users who allow model training.' },
  search_quality:{ name: 'Search quality analytics', model: null, userPurpose: 'analytics', owner: 'growth-analytics', intended: 'Aggregate search success metrics. No model.' },
};
export const mname = (m) => `${m.id} v${m.version}`;
export const ROLES = {
  ml_engineer:      { name: 'Maya Chen',      title: 'ML engineer' },
  privacy_reviewer: { name: 'Jonas Weber',    title: 'Privacy reviewer' },
  legal_reviewer:   { name: 'Amara Okafor',   title: 'Legal reviewer' },
  data_steward:     { name: 'Luis Ortega',    title: 'Data steward' },
  sre:              { name: 'Priya Nair',     title: 'Site reliability' },
  auditor:          { name: 'Henrik Lund',    title: 'Auditor' },
};

/* ───────────────────────── synthetic users ───────────────────────── */

const REGIONS = [
  { code: 'US-CA', w: 0.16, eu: false, law: 'CCPA/CPRA' },
  { code: 'US-NY', w: 0.12, eu: false, law: 'US state' },
  { code: 'US-TX', w: 0.13, eu: false, law: 'US state' },
  { code: 'EU-DE', w: 0.12, eu: true,  law: 'GDPR' },
  { code: 'EU-FR', w: 0.10, eu: true,  law: 'GDPR' },
  { code: 'EU-IE', w: 0.05, eu: true,  law: 'GDPR' },
  { code: 'EU-NL', w: 0.06, eu: true,  law: 'GDPR' },
  { code: 'JP',    w: 0.14, eu: false, law: 'APPI' },
  { code: 'BR',    w: 0.12, eu: false, law: 'LGPD' },
];
export const regionInfo = (code) => REGIONS.find((r) => r.code === code);

export function generateUsers(n, seed = 7) {
  const r = mulberry32(seed);
  const users = [];
  for (let i = 0; i < n; i++) {
    let x = r(), region = REGIONS[0];
    for (const g of REGIONS) { if ((x -= g.w) <= 0) { region = g; break; } region = g; }
    const eu = region.eu;
    users.push({
      id: 'u_' + String(i + 1).padStart(6, '0'),
      region: region.code,
      eu,
      att: r() < 0.38 ? 'authorized' : 'denied',          // App Tracking Transparency prompt result
      personalizedAdsToggle: r() < (eu ? 0.41 : 0.78),       // OS-level personalized ads setting
      gpc: region.code === 'US-CA' ? r() < 0.11 : r() < 0.03, // Global Privacy Control header seen
      services: r() < 0.55 ? ['maps', 'news'] : ['maps'],
      events: 20 + Math.floor(r() * 400),
    });
  }
  return users;
}

/* ───────────────────────── bitemporal consent store ─────────────────────────
   Rows are immutable. valid_* is when the decision applies in the world,
   recorded_at is when we learned it. A late correction is a new row with an
   old valid_from and a new recorded_at, so "what did we believe on date X"
   is always answerable exactly. */

export class ConsentStore {
  constructor() { this.rows = []; this.byUser = new Map(); this.outbox = []; this.seq = 0; }

  insert(row) {
    const full = { id: ++this.seq, valid_to: Infinity, ...row };
    this.rows.push(full);
    if (!this.byUser.has(full.user_id)) this.byUser.set(full.user_id, []);
    this.byUser.get(full.user_id).push(full);
    // Transactional outbox: the change and its event commit together.
    this.outbox.push({ id: full.id, topic: 'consent.events', key: full.user_id, payload: full, published: false });
    return full;
  }

  /** Status of one purpose at validTime, as known at recordTime. */
  at(userId, purpose, validTime = Infinity, recordTime = Infinity) {
    const rows = this.byUser.get(userId) || [];
    let best = null;
    for (const row of rows) {
      if (row.purpose !== purpose) continue;
      if (row.valid_from > validTime || (row.valid_to !== Infinity && row.valid_to <= validTime)) continue;
      if (row.recorded_at > recordTime) continue;
      if (!best || row.recorded_at > best.recorded_at || (row.recorded_at === best.recorded_at && row.id > best.id)) best = row;
    }
    return best;
  }

  snapshot(userId, validTime, recordTime) {
    const out = {};
    for (const p of PURPOSES) { const row = this.at(userId, p, validTime, recordTime); out[p] = row ? row.status : 'unknown'; }
    return out;
  }

  history(userId) { return (this.byUser.get(userId) || []).slice().sort((a, b) => a.recorded_at - b.recorded_at); }

  erase(userId) {
    this.rows = this.rows.filter((r) => r.user_id !== userId);
    this.byUser.delete(userId);
  }
}

export function seedConsent(store, users, t0, seed = 11) {
  const r = mulberry32(seed);
  for (const u of users) {
    const base = { user_id: u.id, region: u.region, valid_from: t0, recorded_at: t0 };
    if (u.eu) {
      // GDPR: personalization needs an explicit opt-in (Art. 6(1)(a)).
      store.insert({ ...base, purpose: 'ads_personalization', status: u.personalizedAdsToggle ? 'granted' : 'denied', source: 'personalized_ads_toggle', legal_basis: 'consent' });
      store.insert({ ...base, purpose: 'cross_service_combination', status: r() < 0.27 ? 'granted' : 'denied', source: 'in_app_settings', legal_basis: 'consent' });
      store.insert({ ...base, purpose: 'model_training', status: u.personalizedAdsToggle ? 'granted' : 'denied', source: 'in_app_settings', legal_basis: 'consent' });
    } else {
      // US: opt-out model. GPC is a legally binding opt-out of sale/sharing in California.
      const optedOut = !u.personalizedAdsToggle || u.gpc;
      store.insert({ ...base, purpose: 'ads_personalization', status: optedOut ? 'denied' : 'granted', source: u.gpc ? 'GPC_signal' : 'personalized_ads_toggle', legal_basis: 'legitimate_interest' });
      store.insert({ ...base, purpose: 'cross_service_combination', status: optedOut ? 'denied' : 'granted', source: 'in_app_settings', legal_basis: 'legitimate_interest' });
      store.insert({ ...base, purpose: 'model_training', status: 'granted', source: 'in_app_settings', legal_basis: 'legitimate_interest' });
    }
    store.insert({ ...base, purpose: 'analytics', status: 'granted', source: 'in_app_settings', legal_basis: 'legitimate_interest' });
  }
  for (const o of store.outbox) o.published = true; // seed is pre-published
}

/* ───────────────────────── PII scanner ─────────────────────────
   Stand-in for Presidio plus custom recognizers. Runs on column names and
   sample values when a dataset is registered and only *proposes* tags. */

const RECOGNIZERS = [
  { tag: 'device_id',        test: (n, v) => /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(v) && /idfa|ad_id|advertising/i.test(n) },
  { tag: 'idfv',             test: (n, v) => /idfv|vendor/i.test(n) && /^[0-9A-F-]{36}$/i.test(v) },
  { tag: 'precise_location', test: (n, v) => /lat|lon|lng/i.test(n) && /^-?\d+\.\d{4,}$/.test(String(v)) },
  { tag: 'coarse_location',  test: (n, v) => /geohash|city|metro/i.test(n) },
  { tag: 'email',            test: (n, v) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v) },
  { tag: 'ip_address',       test: (n, v) => /^(\d{1,3}\.){3}\d{1,3}$/.test(v) },
  { tag: 'user_id',          test: (n) => /^user_id$|account/i.test(n) },
];
const SENSITIVE = new Set(['precise_location', 'device_id']);

export function scanPII(schema) {
  const findings = [];
  for (const col of schema) {
    for (const rec of RECOGNIZERS) {
      if (rec.test(col.name, String(col.sample))) findings.push({ column: col.name, tag: rec.tag, sample: col.sample, confidence: rec.tag === 'user_id' ? 0.72 : 0.97 });
    }
  }
  const tags = [...new Set(findings.map((f) => f.tag))];
  const classification = tags.some((t) => SENSITIVE.has(t)) ? 'restricted' : tags.length ? 'confidential' : 'internal';
  return { findings, tags, classification };
}

/* ───────────────────────── policy engine (PDP) ─────────────────────────
   Mirrors policies/ads.rego. Decides only; services enforce (PEP). Every
   rule is pure over the input, and the engine fails closed on missing input. */

const ADS = (p) => p === 'ads_personalization';
const R = (rule, code, msg, cite) => ({ rule, code, msg, cite });

const RULES_V14 = [
  (i) => i.dataset.status !== 'approved' && R('catalog.approved', 'dataset_not_approved', `Dataset ${i.dataset.id} is ${i.dataset.status}; pending datasets cannot be read.`, 'GDPR Art. 5(2) accountability'),
  (i) => !i.dataset.allowed_purposes.includes(i.purpose) && R('purpose.limitation', 'purpose_not_permitted', `${i.dataset.id} is approved for ${i.dataset.allowed_purposes.join(', ')}, not ${i.purpose}.`, 'GDPR Art. 5(1)(b)'),
  (i) => ADS(i.purpose) && i.dataset.classification === 'restricted' && R('ads.no_restricted', 'restricted_for_ads', 'Restricted data (precise location, raw device IDs) can never feed ads. Use the minimized view.', 'GDPR Art. 5(1)(c), Art. 9'),
  (i) => i.dataset.region === 'EU' && i.processing_region !== 'EU' && !i.transfer_basis && R('residency.eu', 'eu_transfer_blocked', `EU data cannot be processed in ${i.processing_region} without a transfer basis (SCCs or adequacy).`, 'GDPR Art. 44-46'),
  (i) => i.grant === false && R('access.grant', 'no_active_grant', `${i.principal.sub} holds no active grant for ${i.dataset.id} with purpose ${i.purpose}.`, 'Least privilege'),
  (i) => i.user && ADS(i.purpose) && i.user.eu && i.user.consent.ads_personalization !== 'granted' && R('gdpr.opt_in', 'gdpr_no_opt_in', 'EU user has not opted in to ads personalization.', 'GDPR Art. 6(1)(a), Art. 7'),
  (i) => i.user && ADS(i.purpose) && !i.user.eu && i.user.gpc && R('ccpa.gpc', 'gpc_signal', 'Global Privacy Control is an opt-out of sharing for cross-context behavioral ads.', 'CCPA 1798.120, 1798.135; Regs 7025'),
  (i) => i.user && ADS(i.purpose) && !i.user.eu && !i.user.gpc && i.user.consent.ads_personalization === 'denied' && R('ccpa.opt_out', 'ccpa_opt_out', 'User opted out of sale or sharing.', 'CCPA 1798.120'),
  (i) => i.user && ADS(i.purpose) && i.user.eu && (i.dataset.sources || []).length > 1 && i.user.consent.cross_service_combination !== 'granted' && R('dma.combination', 'dma_no_combination_consent', `Combining ${i.dataset.sources.join(' + ')} data for ads needs explicit consent.`, 'DMA Art. 5(2)'),
  (i) => i.user && i.dataset.uses_idfa && i.user.att !== 'authorized' && R('att.idfa', 'att_denied', 'Tracking authorization denied: the advertising identifier cannot be used.', 'Platform policy (ATT)'),
  (i) => i.user && i.purpose === 'model_training' && i.user.eu && i.user.consent.model_training !== 'granted' && R('gdpr.training', 'gdpr_no_training_consent', 'EU user has not consented to their data training models.', 'GDPR Art. 6(1)(a); EU AI Act Art. 10'),
  (i) => i.user && i.purpose === 'model_training' && !i.user.eu && i.user.consent.model_training === 'denied' && R('training.opt_out', 'training_opt_out', 'User opted out of model training.', 'CPRA 1798.121 (limit use)'),
];
/* v1.5 (shadow): additionally treats an unknown consent state as a denial for
   every user, not just EU users. Stricter; shadow mode shows who it would affect. */
const RULES_V15 = [
  ...RULES_V14,
  (i) => i.user && ADS(i.purpose) && !i.user.eu && i.user.consent.ads_personalization === 'unknown' && R('consent.unknown', 'consent_unknown', 'No recorded consent state; v1.5 denies by default everywhere.', 'Privacy by default, GDPR Art. 25'),
  (i) => i.user && ADS(i.purpose) && i.user.att === 'denied' && !i.user.eu && i.user.region === 'US-CA' && R('ccpa.att_alignment', 'att_denied_ca', 'v1.5 honours a denied ATT prompt as a sharing opt-out for California users.', 'CPRA Regs 7025 (intent alignment)'),
];

export const POLICY_BUNDLES = {
  'ads-1.4.0': { version: 'ads-1.4.0', rules: RULES_V14, status: 'live' },
  'ads-1.5.0': { version: 'ads-1.5.0', rules: RULES_V15, status: 'shadow' },
};

const REQUIRED = ['principal', 'purpose', 'dataset', 'processing_region'];

export function decide(input, bundleVersion = 'ads-1.4.0') {
  const t = (globalThis.performance || Date).now();
  const bundle = POLICY_BUNDLES[bundleVersion];
  const missing = REQUIRED.filter((k) => input[k] === undefined || input[k] === null);
  let reasons;
  if (missing.length) {
    reasons = [R('input.complete', 'missing_input', `Missing ${missing.join(', ')}: failing closed.`, 'Fail-closed design')];
  } else {
    reasons = bundle.rules.map((rule) => rule(input)).filter(Boolean);
  }
  return {
    allow: reasons.length === 0,
    reasons,
    version: bundle.version,
    latency_ms: (globalThis.performance || Date).now() - t,
  };
}

/* ───────────────────────── tokens (OIDC simulation) ───────────────────────── */

const TOKEN_SECRET = 'custodian-demo-signing-key';
export async function issueToken(claims, ttlSec = 300, now = Date.now()) {
  const header = { alg: 'HS256', typ: 'JWT', kid: 'demo-1' };
  const body = { iss: 'https://idp.custodian.local/realms/custodian', iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + ttlSec, ...claims };
  const unsigned = b64url(header) + '.' + b64url(body);
  return { jwt: unsigned + '.' + (await hmac(TOKEN_SECRET, unsigned)).slice(0, 43), claims: body };
}
/* RFC 8693: an agent swaps the user's token for a narrower one that names both parties. */
export async function exchangeToken(subjectClaims, actor, scopes, now) {
  return issueToken({ sub: subjectClaims.sub, act: { sub: actor }, scope: scopes.join(' '), azp: actor, purpose: 'user_assist' }, 120, now);
}

/* ───────────────────────── audit ledger ───────────────────────── */

const PSEUDO_KEY = 'custodian-pseudonym-key-rotate-quarterly';
export const pseudonymize = (userId) => hmac(PSEUDO_KEY, userId).then((h) => 'p_' + h.slice(0, 16));

export class Ledger {
  constructor() { this.entries = []; this.anchors = []; this.tail = Promise.resolve(); this.listeners = []; }

  append(type, actor, data) {
    // Serialize appends so each entry hashes over the one before it.
    this.tail = this.tail.then(async () => {
      const prev = this.entries.length ? this.entries[this.entries.length - 1].hash : '0'.repeat(64);
      const subject = data.user_id ? await pseudonymize(data.user_id) : null;
      const payload = { ...data };
      delete payload.user_id;
      const entry = { seq: this.entries.length + 1, ts: Date.now(), type, actor, subject, payload, prev };
      entry.hash = await sha256(canonical({ seq: entry.seq, ts: entry.ts, type, actor, subject, payload, prev }));
      this.entries.push(entry);
      this.listeners.forEach((f) => f(entry));
      return entry;
    });
    return this.tail;
  }

  async verify() {
    let prev = '0'.repeat(64);
    for (const e of this.entries) {
      const expect = await sha256(canonical({ seq: e.seq, ts: e.ts, type: e.type, actor: e.actor, subject: e.subject, payload: e.payload, prev: e.prev }));
      if (e.prev !== prev || e.hash !== expect) return { ok: false, brokenAt: e.seq, checked: e.seq };
      prev = e.hash;
    }
    return { ok: true, checked: this.entries.length };
  }

  async merkleRoot(upTo = this.entries.length) {
    let level = this.entries.slice(0, upTo).map((e) => e.hash);
    if (!level.length) return null;
    while (level.length > 1) {
      const next = [];
      for (let i = 0; i < level.length; i += 2) next.push(await sha256(level[i] + (level[i + 1] || level[i])));
      level = next;
    }
    return level[0];
  }

  /** Write the current root to "WORM" storage (S3 Object Lock in production). */
  async anchor() {
    await this.tail;
    const root = await this.merkleRoot();
    const a = Object.freeze({ at: Date.now(), size: this.entries.length, root, bucket: 's3://audit-anchors (object lock: compliance, 7y)' });
    this.anchors.push(a);
    return a;
  }

  async forSubject(userId) {
    const p = await pseudonymize(userId);
    return this.entries.filter((e) => e.subject === p);
  }
}

/* ───────────────────────── lakehouse (Iceberg semantics) ─────────────────────────
   A row-level delete writes a new snapshot; old snapshots still reference the
   old data files, so time travel can still read the erased user until
   expire_snapshots and orphan-file cleanup run. That gap is the point. */

export class IcebergTable {
  constructor(name, bucket, users) {
    this.name = name; this.bucket = bucket;
    this.snapshots = [];
    this.commit('append', new Set(users));
  }
  commit(op, members) {
    const id = 1000 + Math.floor(Math.random() * 8999) + this.snapshots.length * 10000;
    this.snapshots.push({ id: String(id) + String(this.snapshots.length).padStart(3, '0'), op, ts: Date.now(), members, files: Math.ceil(members.size / 250) });
    return this.current;
  }
  get current() { return this.snapshots[this.snapshots.length - 1]; }
  contains(userId, snapshotId) {
    const s = snapshotId ? this.snapshots.find((x) => x.id === snapshotId) : this.current;
    return !!s && s.members.has(userId);
  }
  /** Any retained snapshot (time travel) still holding the user? */
  reachable(userId) { return this.snapshots.some((s) => s.members.has(userId)); }
  deleteRows(userId) {
    if (!this.current.members.has(userId)) return null;
    const m = new Set(this.current.members); m.delete(userId);
    return this.commit('delete', m);
  }
  expireSnapshots() {
    const before = this.snapshots.length;
    this.snapshots = [this.current];
    return before - 1;
  }
}

/* ───────────────────────── platform state ───────────────────────── */

export function datasetsSeed() {
  return [
    { id: 'iphone_app_events_raw',  layer: 'raw',      owner: 'ingest-team',   steward: 'Luis Ortega', classification: 'restricted',   pii: ['device_id', 'precise_location', 'user_id'], region: 'US', allowed_purposes: ['analytics'], retention_days: 30, sources: ['maps'], status: 'approved', legal_basis: 'legitimate_interest', bucket: 'lake-us-west', uses_idfa: true },
    { id: 'iphone_app_events_raw_eu', layer: 'raw',    owner: 'ingest-team',   steward: 'Luis Ortega', classification: 'restricted',   pii: ['device_id', 'precise_location', 'user_id'], region: 'EU', allowed_purposes: ['analytics'], retention_days: 30, sources: ['maps'], status: 'approved', legal_basis: 'consent', bucket: 'lake-eu-west', uses_idfa: true },
    { id: 'app_events_clean',       layer: 'cleaned',  owner: 'data-platform', steward: 'Luis Ortega', classification: 'confidential', pii: ['user_id', 'coarse_location'], region: 'US', allowed_purposes: ['analytics', 'model_training', 'ads_personalization'], retention_days: 180, sources: ['maps'], status: 'approved', legal_basis: 'legitimate_interest', bucket: 'lake-us-west' },
    { id: 'app_events_clean_eu',    layer: 'cleaned',  owner: 'data-platform', steward: 'Luis Ortega', classification: 'confidential', pii: ['user_id', 'coarse_location'], region: 'EU', allowed_purposes: ['analytics', 'model_training', 'ads_personalization'], retention_days: 180, sources: ['maps'], status: 'approved', legal_basis: 'consent', bucket: 'lake-eu-west' },
    { id: 'session_metrics_daily',  layer: 'features', owner: 'growth-analytics', steward: 'Luis Ortega', classification: 'internal', pii: ['user_id'], region: 'US', allowed_purposes: ['analytics'], retention_days: 365, sources: ['maps'], status: 'approved', legal_basis: 'legitimate_interest', bucket: 'lake-us-west', workload: 'search_quality' },
    { id: 'ad_features_v7',         layer: 'features', owner: 'ads-ml',        steward: 'Luis Ortega', classification: 'confidential', pii: ['user_id'], region: 'US', allowed_purposes: ['model_training', 'ads_personalization'], retention_days: 90, sources: ['maps', 'news'], status: 'approved', legal_basis: 'legitimate_interest', bucket: 'lake-us-west', uses_idfa: true, workload: 'ads_ranking' },
    { id: 'ad_features_v7_eu',      layer: 'features', owner: 'ads-ml',        steward: 'Luis Ortega', classification: 'confidential', pii: ['user_id'], region: 'EU', allowed_purposes: ['model_training', 'ads_personalization'], retention_days: 90, sources: ['maps'], status: 'approved', legal_basis: 'consent', bucket: 'lake-eu-west', uses_idfa: true, workload: 'ads_ranking' },
    { id: 'assistant_conversations', layer: 'raw',     owner: 'assistant-ml',  steward: 'Luis Ortega', classification: 'restricted',   pii: ['user_id', 'email', 'free_text'], region: 'US', allowed_purposes: ['analytics'], retention_days: 30, sources: ['assistant'], status: 'approved', legal_basis: 'legitimate_interest', bucket: 'lake-us-west', workload: 'assistant_llm' },
    { id: 'assistant_conversations_redacted', layer: 'features', owner: 'assistant-ml', steward: 'Luis Ortega', classification: 'confidential', pii: ['user_id'], region: 'US', allowed_purposes: ['model_training'], retention_days: 180, sources: ['assistant'], status: 'approved', legal_basis: 'legitimate_interest', bucket: 'lake-us-west', workload: 'assistant_llm' },
  ];
}

export const DEMO_SCHEMA = [
  { name: 'event_id', type: 'string', sample: 'e_9f2c41' },
  { name: 'user_id', type: 'string', sample: 'u_004211' },
  { name: 'idfa', type: 'string', sample: '6D92078A-8246-4BA4-AE5B-76104861E7DC' },
  { name: 'event_name', type: 'string', sample: 'place_card_open' },
  { name: 'latitude', type: 'double', sample: '37.334606' },
  { name: 'longitude', type: 'double', sample: '-122.009102' },
  { name: 'ad_impression_id', type: 'string', sample: 'imp_77ab1' },
  { name: 'os_version', type: 'string', sample: '26.1' },
  { name: 'ts', type: 'timestamp', sample: '2026-10-21T08:14:02Z' },
];

export class Platform {
  constructor({ users = 10000, seed = 7 } = {}) {
    this.t0 = Date.now() - 1000 * 60 * 60 * 24 * 40;
    this.users = generateUsers(users, seed);
    this.userById = new Map(this.users.map((u) => [u.id, u]));
    this.consent = new ConsentStore();
    seedConsent(this.consent, this.users, this.t0);
    this.cache = new Map();                       // Redis: user -> {consent, version, at}
    for (const u of this.users) this.cache.set(u.id, { consent: this.consent.snapshot(u.id), at: this.t0, offset: 0 });
    this.ledger = new Ledger();
    this.datasets = datasetsSeed();
    this.grants = [
      { id: 'g-101', principal: 'svc-ads-trainer', dataset: 'ad_features_v7', purpose: 'model_training', region: 'US', expires: Date.now() + 864e5 * 60 },
      { id: 'g-102', principal: 'svc-ads-trainer', dataset: 'app_events_clean', purpose: 'model_training', region: 'US', expires: Date.now() + 864e5 * 60 },
      { id: 'g-104', principal: 'svc-assistant-trainer', dataset: 'assistant_conversations_redacted', purpose: 'model_training', region: 'US', expires: Date.now() + 864e5 * 60 },
      { id: 'g-103', principal: 'maya.chen', dataset: 'session_metrics_daily', purpose: 'analytics', region: 'US', expires: Date.now() + 864e5 * 14 },
    ];
    const us = this.users.filter((u) => !u.eu).map((u) => u.id), eu = this.users.filter((u) => u.eu).map((u) => u.id);
    this.tables = {
      iphone_app_events_raw: new IcebergTable('iphone_app_events_raw', 'lake-us-west', us),
      iphone_app_events_raw_eu: new IcebergTable('iphone_app_events_raw_eu', 'lake-eu-west', eu),
      app_events_clean: new IcebergTable('app_events_clean', 'lake-us-west', us),
      app_events_clean_eu: new IcebergTable('app_events_clean_eu', 'lake-eu-west', eu),
      ad_features_v7: new IcebergTable('ad_features_v7', 'lake-us-west', us),
      ad_features_v7_eu: new IcebergTable('ad_features_v7_eu', 'lake-eu-west', eu),
      assistant_conversations: new IcebergTable('assistant_conversations', 'lake-us-west', us.filter((_, k) => k % 3 === 0)),
      assistant_conversations_redacted: new IcebergTable('assistant_conversations_redacted', 'lake-us-west', us.filter((_, k) => k % 3 === 0)),
    };
    // A second append so time travel has history to show.
    for (const t of Object.values(this.tables)) t.commit('append', new Set(t.current.members));
    this.models = [
      { id: 'adrank', version: 3, stage: 'Production', trainedOn: [{ table: 'ad_features_v7', snapshot: this.tables.ad_features_v7.snapshots[0].id }, { table: 'ad_features_v7_eu', snapshot: this.tables.ad_features_v7_eu.snapshots[0].id }], members: new Set([...us.slice(0, Math.floor(us.length * 0.7)), ...eu.slice(0, Math.floor(eu.length * 0.4))]), status: 'ok', auc: 0.781, created: this.t0 + 864e5 * 20, card: null, workload: 'ads_ranking' },
      { id: 'assistant-llm', version: 1, stage: 'Production', trainedOn: [{ table: 'assistant_conversations_redacted', snapshot: this.tables.assistant_conversations_redacted.snapshots[0].id }], members: new Set(us.filter((_, k) => k % 3 === 0).slice(0, 900)), status: 'ok', auc: 0.842, created: this.t0 + 864e5 * 25, card: null, workload: 'assistant_llm' },
    ];
    this.lineageRuns = [];
    this.accessRequests = [];
    this.dsrs = [];
    this.decisions = [];        // policy.decisions topic (most recent first, capped)
    this.serving = { personalized: 0, contextual: 0, fallback: 0, violations: 0, log: [] };
    this.policyUp = true;
    this.breaker = { state: 'closed', failures: 0, openedAt: 0 };
    this.bus = [];              // consent.events topic
    this.busOffset = 0;
    this.propagationLags = [];
  }

  user(id) { return this.userById.get(id); }
  dataset(id) { return this.datasets.find((d) => d.id === id); }

  userInput(u, consent) {
    return { id: u.id, region: u.region, eu: u.eu, gpc: u.gpc, att: u.att, consent };
  }

  hasGrant(principal, datasetId, purpose, region) {
    return this.grants.some((g) => g.principal === principal && g.dataset === datasetId && g.purpose === purpose && g.expires > Date.now() && (!region || g.region === region));
  }

  /** PDP call with audit + decision log. Throws when the policy service is down. */
  async evaluate(input, { log = true, actor = input.principal && input.principal.sub } = {}) {
    if (!this.policyUp) throw new Error('policy service unavailable');
    const d = decide(input, 'ads-1.4.0');
    const shadow = decide(input, 'ads-1.5.0');
    const rec = { at: Date.now(), input, decision: d, shadow, disagree: d.allow !== shadow.allow };
    this.decisions.unshift(rec);
    if (this.decisions.length > 400) this.decisions.length = 400;
    if (log) await this.ledger.append('policy.decision', actor, { user_id: input.user && input.user.id, dataset: input.dataset && input.dataset.id, purpose: input.purpose, allow: d.allow, reasons: d.reasons.map((r) => r.code), version: d.version });
    return rec;
  }

  /* ── consent change: write + outbox in one step, then async propagation ── */
  async setConsent(userId, purpose, status, source, { gpc } = {}) {
    const now = Date.now(), u = this.user(userId);
    if (gpc !== undefined) u.gpc = gpc;
    const row = this.consent.insert({ user_id: userId, region: u.region, purpose, status, source, legal_basis: u.eu ? 'consent' : 'legitimate_interest', valid_from: now, recorded_at: now });
    await this.ledger.append('consent.change', 'consent-service', { user_id: userId, purpose, status, source, row: row.id });
    return row;
  }

  /** Outbox relay: publish unpublished rows to the bus (Kafka/Redpanda). */
  relayOutbox() {
    const out = [];
    for (const o of this.consent.outbox) {
      if (o.published) continue;
      o.published = true;
      const msg = { offset: ++this.busOffset, partition: hashPartition(o.key), key: o.key, at: Date.now(), payload: o.payload };
      this.bus.push(msg); out.push(msg);
    }
    return out;
  }

  /** Consumer: apply a bus message to the serving cache (Redis). */
  applyToCache(msg) {
    const u = this.user(msg.key);
    if (!u) return null;
    const lag = Date.now() - msg.payload.recorded_at;
    this.cache.set(u.id, { consent: this.consent.snapshot(u.id), at: Date.now(), offset: msg.offset });
    this.propagationLags.push(lag);
    if (this.propagationLags.length > 200) this.propagationLags.shift();
    return lag;
  }

  /* ── ad serving gateway (PEP) ── */
  async serve(userId, context = { placement: 'maps_search', query: 'coffee' }) {
    const u = this.user(userId);
    const t0 = (globalThis.performance || Date).now();
    const spans = [{ name: 'gateway.receive', ms: 0.3 }];
    const cached = u && this.cache.get(userId);
    spans.push({ name: 'redis.get consent', ms: 0.4 + Math.random() * 0.5 });
    let decision = null, mode = 'contextual', why = '';
    if (!u || !cached) { why = 'unknown user: contextual only'; }
    else if (this.breaker.state === 'open' && Date.now() - this.breaker.openedAt < 4000) { why = 'circuit open: failing closed'; this.serving.fallback++; }
    else {
      try {
        const rec = await this.evaluate({ principal: { sub: 'svc-ad-gateway', roles: ['service'] }, purpose: 'ads_personalization', dataset: this.dataset('ad_features_v7'), processing_region: u.eu ? 'EU' : 'US', grant: true, user: this.userInput(u, cached.consent) }, { log: false });
        decision = rec.decision;
        spans.push({ name: 'opa.decide ' + decision.version, ms: 0.6 + decision.latency_ms });
        if (this.breaker.state !== 'closed') this.breaker = { state: 'closed', failures: 0, openedAt: 0 };
        mode = decision.allow ? 'personalized' : 'contextual';
        why = decision.allow ? 'allow' : decision.reasons.map((r) => r.code).join(', ');
      } catch (e) {
        this.breaker.failures++;
        if (this.breaker.failures >= 3) this.breaker = { state: 'open', failures: this.breaker.failures, openedAt: Date.now() };
        spans.push({ name: 'opa.decide (timeout)', ms: 25, error: true });
        why = 'policy unavailable: failing closed'; this.serving.fallback++;
      }
    }
    spans.push({ name: mode === 'personalized' ? 'model.adrank-v3' : 'model.fallback-contextual-v2', ms: mode === 'personalized' ? 3.1 + Math.random() * 1.5 : 1.2 + Math.random() });
    // Invariant check: a personalized ad without an allow decision is a violation.
    if (mode === 'personalized' && !(decision && decision.allow)) this.serving.violations++;
    this.serving[mode]++;
    const rec = { at: Date.now(), user: userId, mode, why, consent_offset: cached ? cached.offset : null, policy: decision ? decision.version : null, spans, total: (globalThis.performance || Date).now() - t0 + spans.reduce((a, s) => a + s.ms, 0), context };
    this.serving.log.unshift(rec);
    if (this.serving.log.length > 300) this.serving.log.length = 300;
    return rec;
  }

  /* ── training gate: purpose check, then point-in-time consent join ── */
  async train({ principal, datasetId, purpose, asOf = Date.now() }) {
    const ds = this.dataset(datasetId);
    const token = await issueToken({ sub: principal, scope: `read:${datasetId} purpose:${purpose}`, purpose, aud: 'lakehouse' }, 900);
    const gate = await this.evaluate({ principal: { sub: principal, roles: ['service'] }, purpose, dataset: ds, processing_region: ds.region, grant: this.hasGrant(principal, datasetId, purpose) });
    if (!gate.decision.allow) return { ok: false, token, gate };
    const table = this.tables[datasetId];
    if (!table) return { ok: false, token, gate: { decision: { allow: false, reasons: [R('lakehouse.table', 'no_table', `${datasetId} has no Iceberg table to train from.`, 'Catalog')], version: gate.decision.version, latency_ms: 0 } } };
    const wl = WORKLOADS[ds.workload || 'ads_ranking'];
    const snapshot = table.current;
    const excluded = { deleted: 0 };
    const members = new Set();
    for (const id of snapshot.members) {
      const u = this.user(id);
      if (!u) { excluded.deleted++; continue; }
      const consent = this.consent.snapshot(id, asOf, asOf);   // what was true *and known* at snapshot time
      const d = decide({ principal: { sub: principal }, purpose: wl.userPurpose, dataset: { ...ds, allowed_purposes: [wl.userPurpose] }, processing_region: ds.region, grant: true, user: this.userInput(u, consent) });
      if (d.allow) members.add(id);
      else excluded[d.reasons[0].code] = (excluded[d.reasons[0].code] || 0) + 1;
    }
    const prev = this.models.filter((m) => m.id === wl.model);
    const version = prev.length ? Math.max(...prev.map((m) => m.version)) + 1 : 1;
    const model = { id: wl.model, workload: ds.workload || 'ads_ranking', version, stage: 'Staging', trainedOn: [{ table: datasetId, snapshot: snapshot.id }], members, status: 'ok', auc: +(0.781 + Math.random() * 0.012).toFixed(3), created: Date.now(), excluded, eligible: snapshot.members.size };
    model.card = modelCard(model, ds, gate.decision);
    this.models.push(model);
    this.lineageRuns.unshift({ at: Date.now(), job: `train_${wl.model}`, inputs: [{ dataset: datasetId, snapshot: snapshot.id }], outputs: [{ model: mname(model) }], facets: { purpose, policy: gate.decision.version, consent_as_of: new Date(asOf).toISOString() } });
    await this.ledger.append('model.registered', principal, { model: mname(model), snapshot: snapshot.id, dataset: datasetId, excluded });
    return { ok: true, token, gate, model };
  }

  /** "Which datasets, snapshots and models contain user X?" */
  locate(userId) {
    const hits = [];
    for (const [name, t] of Object.entries(this.tables)) {
      const live = t.contains(userId), reach = t.reachable(userId);
      if (live || reach) hits.push({ kind: 'table', name, bucket: t.bucket, live, timeTravel: reach, snapshots: t.snapshots.filter((s) => s.members.has(userId)).map((s) => s.id) });
    }
    if (this.cache.has(userId)) hits.push({ kind: 'cache', name: 'redis:consent', live: true });
    if (this.consent.byUser.has(userId)) hits.push({ kind: 'consent', name: 'postgres:consent_records', live: true, note: 'retained as proof of consent, Art. 7(1)' });
    for (const m of this.models) if (m.members.has(userId)) hits.push({ kind: 'model', name: mname(m), live: true });
    return hits;
  }
}

function hashPartition(key) { let h = 0; for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 12; }

export function modelCard(model, ds, decision) {
  const ex = model.excluded || {};
  return {
    model: mname(model),
    workload: WORKLOADS[model.workload || 'ads_ranking'].name,
    intended_purpose: WORKLOADS[model.workload || 'ads_ranking'].intended,
    out_of_scope: ['Users without an allow decision (served by the non-personalized fallback)', 'Sensitive inference (health, religion, politics)', 'Any use outside the approved purpose'],
    training_data: { dataset: ds.id, snapshot: model.trainedOn[0].snapshot, bucket: ds.bucket, classification: ds.classification, region: ds.region, legal_basis: ds.legal_basis },
    governance: { policy_bundle: decision.version, eligible_users: model.eligible, included_users: model.members.size, exclusions: ex },
    evaluation: { auc: model.auc, slice_check: 'AUC within 0.01 across regions' },
    lineage: `openlineage://custodian/train_${model.id} -> ${mname(model)}`,
    regulation: 'EU AI Act Art. 10 (data governance) and Art. 11 (technical documentation) style card.',
  };
}

/* ── DSR erasure saga ──
   Each step is idempotent and keyed; a re-run reports "already done" rather
   than repeating work. One injected transient failure shows retry with backoff. */
export const SAGA_STEPS = [
  { key: 'verify',    name: 'Verify identity',                  sys: 'idp' },
  { key: 'discover',  name: 'Discover locations via lineage',   sys: 'marquez' },
  { key: 'delete',    name: 'Iceberg row deletes',              sys: 'lakehouse' },
  { key: 'expire',    name: 'Expire snapshots, remove orphan files', sys: 'lakehouse' },
  { key: 'cache',     name: 'Purge serving cache and feature store', sys: 'redis' },
  { key: 'models',    name: 'Flag models for retraining',       sys: 'mlflow' },
  { key: 'consent',   name: 'Tombstone consent, keep proof',    sys: 'postgres' },
  { key: 'evidence',  name: 'Sign evidence pack',               sys: 'ledger' },
];

export async function runErasure(p, userId, { onStep = () => {}, failOnce = 'expire', sleep = (ms) => new Promise((r) => setTimeout(r, ms)), stepDelay = 450 } = {}) {
  const idem = 'dsr-erasure:' + (await sha256(userId)).slice(0, 12);
  let dsr = p.dsrs.find((d) => d.idem === idem);
  const rerun = !!(dsr && dsr.status === 'completed');
  if (!dsr) {
    dsr = { idem, user: userId, kind: 'erasure', opened: Date.now(), due: Date.now() + 864e5 * 30, status: 'running', steps: SAGA_STEPS.map((s) => ({ ...s, state: 'pending', attempts: 0, detail: '' })), evidence: null };
    p.dsrs.unshift(dsr);
    await p.ledger.append('dsr.opened', 'dsr-service', { user_id: userId, idem, kind: 'erasure' });
  }
  if (rerun) {
    for (const s of dsr.steps) { onStep(dsr, s, 'noop'); await sleep(stepDelay / 4); }
    await p.ledger.append('dsr.rerun', 'dsr-service', { user_id: userId, idem, result: 'no-op (idempotent)' });
    return { dsr, rerun: true };
  }
  const found = p.locate(userId);
  let failed = false;
  for (const s of dsr.steps) {
    if (s.state === 'done') continue;
    s.state = 'running'; onStep(dsr, s);
    await sleep(stepDelay);
    for (;;) {
      s.attempts++;
      if (s.key === failOnce && !failed) {
        failed = true; s.detail = 'Timeout from catalog (transient). Retrying in 400 ms.'; s.state = 'retrying'; onStep(dsr, s);
        await sleep(400); continue;
      }
      break;
    }
    if (s.key === 'verify') s.detail = 'Signed-in request, step-up verified. Due ' + new Date(dsr.due).toISOString().slice(0, 10) + ' (GDPR Art. 12(3)).';
    if (s.key === 'discover') s.detail = found.map((f) => f.name + (f.kind === 'table' ? ` (${f.snapshots.length} snapshots)` : '')).join(', ');
    if (s.key === 'delete') {
      const done = [];
      for (const [n, t] of Object.entries(p.tables)) { const snap = t.deleteRows(userId); if (snap) done.push(`${n} -> snapshot ${snap.id}`); }
      s.detail = done.join('; ') + '. Time travel to older snapshots still finds the user.';
      s.timeTravelBefore = Object.values(p.tables).some((t) => t.reachable(userId));
    }
    if (s.key === 'expire') {
      let n = 0; for (const t of Object.values(p.tables)) n += t.expireSnapshots();
      s.detail = `${n} snapshots expired, orphan files removed. Time travel now finds the user: ${Object.values(p.tables).some((t) => t.reachable(userId)) ? 'yes' : 'no'}.`;
    }
    if (s.key === 'cache') { p.cache.delete(userId); s.detail = 'redis DEL consent:' + userId + ', feature store rows tombstoned.'; }
    if (s.key === 'models') {
      const flagged = p.models.filter((m) => m.members.has(userId));
      flagged.forEach((m) => { m.status = 'retrain_required'; m.members.delete(userId); });
      s.detail = flagged.length ? flagged.map(mname).join(', ') + ' marked retrain_required' : 'No model trained on this user.';
    }
    if (s.key === 'consent') { s.detail = 'Consent rows replaced by a tombstone holding only the pseudonym and the request id.'; }
    if (s.key === 'evidence') {
      const body = { request: idem, subject: await pseudonymize(userId), completed: new Date().toISOString(), steps: dsr.steps.map((x) => ({ step: x.key, attempts: x.attempts, detail: x.detail })), remaining_locations: p.locate(userId).filter((f) => f.kind !== 'consent').map((f) => f.name) };
      dsr.evidence = { ...body, signature: 'hmac-sha256:' + (await hmac('custodian-evidence-key', canonical(body))) };
      s.detail = 'Evidence pack signed (' + dsr.evidence.signature.slice(12, 28) + '...).';
    }
    s.state = 'done'; onStep(dsr, s);
    await p.ledger.append('dsr.step', 'dsr-service', { user_id: userId, idem, step: s.key, attempts: s.attempts });
  }
  // The user leaves the population last, so lineage lookups above could still find them.
  p.consent.erase(userId);
  p.userById.delete(userId);
  dsr.status = 'completed'; dsr.closed = Date.now();
  await p.ledger.append('dsr.completed', 'dsr-service', { user_id: userId, idem });
  return { dsr, rerun: false };
}

/* ── access request workflow (Temporal-style) ── */
export function newAccessRequest(p, { requester, dataset, purpose, region, days, justification }) {
  const ds = p.dataset(dataset);
  const needLegal = ds.classification === 'restricted';
  const req = {
    id: 'AR-' + (2041 + p.accessRequests.length), requester, dataset, purpose, region, days, justification, opened: Date.now(), status: 'open',
    steps: [
      { key: 'precheck', name: 'Automatic policy pre-check', role: 'system', state: 'pending' },
      { key: 'privacy', name: 'Privacy review', role: 'privacy_reviewer', state: 'pending' },
      ...(needLegal ? [{ key: 'legal', name: 'Legal review (restricted data)', role: 'legal_reviewer', state: 'pending' }] : []),
      { key: 'grant', name: 'Grant with conditions', role: 'system', state: 'pending' },
      { key: 'expiry', name: 'Automatic revocation at expiry', role: 'system', state: 'pending' },
    ],
  };
  p.accessRequests.unshift(req);
  return req;
}

/* ───────────────────────── example rows (data explorer) ─────────────────────────
   Deterministic per user, so the same user always shows the same events. */

const CITY = {
  'US-CA': [37.3349, -122.0090, 'Cupertino'], 'US-NY': [40.7128, -74.0060, 'New York'], 'US-TX': [30.2672, -97.7431, 'Austin'],
  'EU-DE': [52.5200, 13.4050, 'Berlin'], 'EU-FR': [48.8566, 2.3522, 'Paris'], 'EU-IE': [53.3498, -6.2603, 'Dublin'],
  'EU-NL': [52.3676, 4.9041, 'Amsterdam'], 'JP': [35.6762, 139.6503, 'Tokyo'], 'BR': [-23.5505, -46.6333, 'Sao Paulo'],
};
const EVENTS = ['place_card_open', 'search_query', 'directions_start', 'ad_impression', 'ad_click', 'save_place', 'call_business', 'look_around'];
const PLACES = ['coffee', 'ramen', 'gym', 'hardware store', 'pharmacy', 'bookstore', 'ev charger', 'bakery'];

export function geohash(lat, lon, precision = 5) {
  const base = '0123456789bcdefghjkmnpqrstuvwxyz';
  let latR = [-90, 90], lonR = [-180, 180], bit = 0, ch = 0, even = true, out = '';
  while (out.length < precision) {
    const r = even ? lonR : latR, v = even ? lon : lat, mid = (r[0] + r[1]) / 2;
    if (v >= mid) { ch = (ch << 1) | 1; r[0] = mid; } else { ch <<= 1; r[1] = mid; }
    even = !even;
    if (++bit === 5) { out += base[ch]; bit = 0; ch = 0; }
  }
  return out;
}

function uuidFrom(r) {
  const hx = () => Math.floor(r() * 16).toString(16).toUpperCase();
  const s = (n) => Array.from({ length: n }, hx).join('');
  return `${s(8)}-${s(4)}-4${s(3)}-${'89AB'[Math.floor(r() * 4)]}${s(3)}-${s(12)}`;
}

export function sampleEvents(user, n = 8, now = Date.now()) {
  const r = mulberry32(parseInt(user.id.slice(2), 10) * 977 + 13);
  const [lat0, lon0, city] = CITY[user.region];
  const idfa = user.att === 'authorized' ? uuidFrom(r) : '00000000-0000-0000-0000-000000000000';
  const rows = [];
  let t = now - 1000 * 60 * 60 * 6;
  for (let i = 0; i < n; i++) {
    t += Math.floor(r() * 1000 * 60 * 40);
    const lat = lat0 + (r() - 0.5) * 0.08, lon = lon0 + (r() - 0.5) * 0.08;
    const ev = EVENTS[Math.floor(r() * EVENTS.length)];
    rows.push({
      event_id: 'e_' + Math.floor(r() * 0xffffff).toString(16).padStart(6, '0'),
      user_id: user.id, idfa, event_name: ev,
      query: ev === 'search_query' ? PLACES[Math.floor(r() * PLACES.length)] : null,
      latitude: lat.toFixed(6), longitude: lon.toFixed(6), city,
      ad_impression_id: ev.startsWith('ad_') ? 'imp_' + Math.floor(r() * 0xfffff).toString(16) : null,
      os_version: '26.' + Math.floor(r() * 2), ts: new Date(t).toISOString().slice(0, 19) + 'Z',
    });
  }
  return rows;
}

/** The approved ads view: precise location to geohash-5 (about 5 km), IDFA dropped, query bucketed. */
export function minimize(row) {
  return { event_id: row.event_id, user_id: row.user_id, event_name: row.event_name, geohash5: geohash(+row.latitude, +row.longitude, 5), query_category: row.query ? 'local_business' : null, ad_impression_id: row.ad_impression_id, ts: row.ts.slice(0, 13) + ':00Z' };
}
