/* Lineage graph: sources, datasets, models and endpoints joined by the jobs that
   move data between them, plus column-level lineage with PII tag propagation.
   Mirrors what an OpenLineage backend (Marquez) holds. No DOM, Node-testable. */
import { mname, PIPELINES, ENDPOINTS } from './engine.js?v=20261025-1';

/* Systems that produce data, or feed policy inputs into jobs. */
export const SOURCES = [
  { id: 'ios-collector', name: 'iOS collector', sub: 'app events SDK', owner: 'ingest-team', workloads: ['ads_ranking', 'search_quality'] },
  { id: 'consent-store', name: 'Consent records', sub: 'Postgres, bitemporal', owner: 'privacy-eng', workloads: ['ads_ranking', 'assistant_llm', 'search_quality'] },
  { id: 'assistant-svc', name: 'Assistant service', sub: 'conversation logs', owner: 'assistant', workloads: ['assistant_llm'] },
  { id: 'labeling-vendor', name: 'Labeling vendor', sub: 'external, under DPA', owner: 'vendor-mgmt', workloads: ['assistant_llm'] },
  { id: 'red-team', name: 'Red team', sub: 'authored eval cases', owner: 'responsible-ai', workloads: ['assistant_llm'] },
];

/* Jobs that are not in the Pipelines view: smaller batch jobs, training, release. */
const MORE_JOBS = [
  { id: 'events-ingest-eu', engine: 'Flink', mode: 'streaming', schedule: 'continuous', stages: ['tag region', 'tag consent version', 'route to eu-west', 'write Iceberg'], records_in: 21904411, dropped: { malformed: 140 }, lag_s: 2.8 },
  { id: 'clean-and-minimize-eu', engine: 'Spark', mode: 'batch', schedule: 'hourly', stages: ['read snapshot', 'drop IDFA', 'precise to geohash-5', 'write snapshot', 'emit OpenLineage'], records_in: 912044, dropped: { att_denied_idfa_cleared: 702114 }, duration: '4m 12s' },
  { id: 'features-consent-filter-eu', engine: 'Spark', mode: 'batch', schedule: 'daily 02:30', stages: ['point-in-time consent join', 'GDPR opt-in only', 'aggregate 7d features', 'write snapshot'], records_in: 3512, dropped: { gdpr_no_opt_in: 2101, minor_no_profiling: 188 }, duration: '9m 40s' },
  { id: 'session-rollup', engine: 'Spark', mode: 'batch', schedule: 'daily 01:00', stages: ['group by region and day', 'count distinct users', 'k-anonymity >= 50', 'write snapshot'], records_in: 2010442, dropped: { small_cells_suppressed: 38 }, duration: '3m 05s' },
  { id: 'assistant-ingest', engine: 'Flink', mode: 'streaming', schedule: 'continuous', stages: ['tag region', 'tag consent version', 'write Iceberg (restricted)'], records_in: 415220, dropped: {}, lag_s: 1.9 },
  { id: 'search-clicks-ingest', engine: 'Flink', mode: 'streaming', schedule: 'paused until approved', stages: ['tag region', 'write Iceberg'], records_in: 0, dropped: {}, lag_s: 0 },
  { id: 'v2-ingest', engine: 'Flink', mode: 'streaming', schedule: 'continuous', stages: ['tag region', 'tag consent version', 'write Iceberg'], records_in: 0, dropped: {}, lag_s: 0 },
  { id: 'v2-minimize', engine: 'Spark', mode: 'batch', schedule: 'hourly', stages: ['drop IDFA', 'precise to geohash-5', 'write ads view'], records_in: 0, dropped: {}, duration: '1m 10s' },
  { id: 'sft-curation', engine: 'Spark', mode: 'batch', schedule: 'weekly', stages: ['sample redacted turns', 'mix synthetic', 'license check', 'dedupe', 'write snapshot'], records_in: 48210, dropped: { license_unknown: 312, near_duplicate: 1904 }, duration: '12m 30s' },
  { id: 'vendor-delivery', engine: 'Airflow', mode: 'batch', schedule: 'on delivery', stages: ['verify DPA scope', 'pseudonymize annotator IDs', 'agreement >= 0.8', 'write snapshot'], records_in: 22000, dropped: { low_agreement: 1430 }, duration: '2m 44s' },
  { id: 'eval-authoring', engine: 'Airflow', mode: 'batch', schedule: 'on change', stages: ['review cases', 'insert canaries', 'write snapshot'], records_in: 1840, dropped: {}, duration: '0m 40s' },
  { id: 'train_adrank', engine: 'PFL + Spark', mode: 'batch', schedule: 'on release', stages: ['scoped token', 'policy gate', 'point-in-time consent join', 'federated rounds, DP', 'register model'], records_in: 6488, dropped: {}, duration: '2h 10m' },
  { id: 'train_assistant-llm', engine: 'Ray on K8s', mode: 'batch', schedule: 'on release', stages: ['scoped token', 'policy gate', 'pre-train', 'SFT', 'preference tuning', 'register model'], records_in: 415220, dropped: {}, duration: '31h 12m' },
  { id: 'eval-gate', engine: 'Ray on K8s', mode: 'batch', schedule: 'per candidate', stages: ['PII extraction probe', 'canary exposure', 'refusal suite', 'sign results'], records_in: 1840, dropped: {}, duration: '41m' },
  { id: 'deploy', engine: 'Argo CD', mode: 'release', schedule: 'on approval', stages: ['privacy and legal sign-off', 'model card attached', 'canary 5%', 'promote'], records_in: 0, dropped: {}, duration: '22m' },
];
export const JOBS = Object.fromEntries([...PIPELINES, ...MORE_JOBS].map((j) => [j.id, j]));

const WL_OF = {
  iphone_app_events_raw: ['ads_ranking', 'search_quality'], iphone_app_events_raw_eu: ['ads_ranking'],
  app_events_clean: ['ads_ranking', 'search_quality'], app_events_clean_eu: ['ads_ranking'],
  iphone_app_events_v2: ['ads_ranking'], iphone_app_events_v2_ads: ['ads_ranking'],
};
/* Display column for each dataset; redacted conversations sit with cleaned data. */
const STAGE_OF = (d) => (d.id === 'assistant_conversations_redacted' ? 'cleaned' : d.layer === 'raw' ? 'raw' : d.layer === 'cleaned' ? 'cleaned' : 'training');
const DS_ORDER = ['iphone_app_events_raw', 'iphone_app_events_raw_eu', 'iphone_app_events_v2', 'search_clicks_v3', 'assistant_conversations', 'app_events_clean', 'app_events_clean_eu', 'assistant_conversations_redacted', 'ad_features_v7', 'ad_features_v7_eu', 'iphone_app_events_v2_ads', 'session_metrics_daily', 'sft_instructions_v3', 'preference_pairs_v2', 'eval_safety_suite_v5'];

export const COLUMNS = [['source', 'Sources'], ['raw', 'Raw'], ['cleaned', 'Cleaned'], ['training', 'Features and training sets'], ['model', 'Models'], ['endpoint', 'Endpoints']];

/** Build nodes and edges from the live platform state. */
export function lineageGraph(p) {
  const nodes = [], edges = [];
  for (const s of SOURCES) nodes.push({ ...s, type: 'source', col: 'source' });
  const rank = (id) => { const i = DS_ORDER.indexOf(id); return i < 0 ? 99 : i; };
  for (const d of [...p.datasets].sort((a, b) => rank(a.id) - rank(b.id))) {
    nodes.push({ id: d.id, type: 'dataset', col: STAGE_OF(d), name: d.id, region: d.region, classification: d.classification, status: d.status, owner: d.owner, retention: d.retention_days, workloads: d.workload ? [d.workload] : WL_OF[d.id] || ['ads_ranking'] });
  }
  for (const m of p.models) nodes.push({ id: mname(m), type: 'model', col: 'model', name: mname(m), model: m.id, stage: m.stage, status: m.status, owner: m.workload === 'assistant_llm' ? 'assistant-ml' : 'ads-ml', workloads: [m.workload] });
  for (const e of ENDPOINTS) nodes.push({ id: e.id, type: 'endpoint', col: 'endpoint', name: e.id, sub: e.regions.join(', '), owner: 'ml-platform', model: e.model.split(' ')[0], workloads: [e.model.startsWith('adrank') ? 'ads_ranking' : 'assistant_llm'] });

  const has = (id) => nodes.some((n) => n.id === id);
  const add = (from, to, job, kind = 'data') => { if (has(from) && has(to)) edges.push({ from, to, job, kind }); };
  add('ios-collector', 'iphone_app_events_raw', 'events-ingest-us');
  add('ios-collector', 'iphone_app_events_raw_eu', 'events-ingest-eu');
  add('ios-collector', 'iphone_app_events_v2', 'v2-ingest');
  add('ios-collector', 'search_clicks_v3', 'search-clicks-ingest');
  add('iphone_app_events_raw', 'app_events_clean', 'clean-and-minimize');
  add('iphone_app_events_raw_eu', 'app_events_clean_eu', 'clean-and-minimize-eu');
  add('iphone_app_events_v2', 'iphone_app_events_v2_ads', 'v2-minimize');
  add('app_events_clean', 'ad_features_v7', 'features-consent-filter');
  add('app_events_clean_eu', 'ad_features_v7_eu', 'features-consent-filter-eu');
  add('app_events_clean', 'session_metrics_daily', 'session-rollup');
  add('assistant-svc', 'assistant_conversations', 'assistant-ingest');
  add('assistant_conversations', 'assistant_conversations_redacted', 'assistant-redaction');
  add('assistant_conversations_redacted', 'sft_instructions_v3', 'sft-curation');
  add('labeling-vendor', 'preference_pairs_v2', 'vendor-delivery');
  add('red-team', 'eval_safety_suite_v5', 'eval-authoring');
  // Consent is a policy input to every job that filters people (dashed in the graph).
  for (const t of ['ad_features_v7', 'ad_features_v7_eu', 'assistant_conversations_redacted']) add('consent-store', t, t.startsWith('ad_') ? (t.endsWith('_eu') ? 'features-consent-filter-eu' : 'features-consent-filter') : 'assistant-redaction', 'control');
  for (const m of p.models) {
    for (const t of m.trainedOn) add(t.table, mname(m), 'train_' + m.id);
    if (m.id === 'assistant-llm') { add('sft_instructions_v3', mname(m), 'train_assistant-llm'); add('preference_pairs_v2', mname(m), 'train_assistant-llm'); add('eval_safety_suite_v5', mname(m), 'eval-gate'); }
  }
  for (const e of ENDPOINTS) { const m = p.models.find((x) => mname(x) === e.model); if (m) add(mname(m), e.id, 'deploy'); }
  return { nodes, edges };
}

/** Everything upstream and downstream of a node (data and control edges). */
export function impact(g, id) {
  const walk = (dir) => {
    const seen = new Set(), q = [id];
    while (q.length) {
      const cur = q.shift();
      for (const e of g.edges) {
        const [a, b] = dir === 'down' ? [e.from, e.to] : [e.to, e.from];
        if (a === cur && !seen.has(b) && b !== id) { seen.add(b); q.push(b); }
      }
    }
    return seen;
  };
  return { up: walk('up'), down: walk('down') };
}

/* Column-level lineage per derived dataset: [output, inputs, transform, tag in, tag out].
   A null output means the column is dropped. */
const CLEAN = { from: 'iphone_app_events_raw', cols: [
  ['event_id', ['event_id'], 'copy', null, null],
  ['user_id', ['user_id'], 'copy', 'user_id', 'user_id'],
  [null, ['idfa'], 'drop (ATT, minimization)', 'device_id', null],
  ['geohash5', ['latitude', 'longitude'], 'geohash, precision 5', 'precise_location', 'coarse_location'],
  ['city', ['latitude', 'longitude'], 'reverse geocode', 'precise_location', 'coarse_location'],
  ['query_bucket', ['query'], 'map to place category', 'free_text', null],
  ['ts_hour', ['ts'], 'truncate to hour', null, null],
] };
const FEATURES = { from: 'app_events_clean', cols: [
  ['user_id', ['user_id'], 'copy, consented rows only', 'user_id', 'user_id'],
  ['sessions_7d', ['session_id', 'ts_hour'], 'count, 7 day window', null, null],
  ['ctr_7d', ['event_name'], 'clicks over impressions, 7 days', null, null],
  ['top_place_category', ['query_bucket'], 'mode, 7 days', null, null],
  ['att_authorized', ['consent_records.att'], 'point-in-time consent join', null, null],
  [null, ['city', 'geohash5'], 'drop (not needed for ranking)', 'coarse_location', null],
] };
export const COLUMN_LINEAGE = {
  app_events_clean: CLEAN,
  app_events_clean_eu: { ...CLEAN, from: 'iphone_app_events_raw_eu' },
  ad_features_v7: FEATURES,
  ad_features_v7_eu: { ...FEATURES, from: 'app_events_clean_eu' },
  session_metrics_daily: { from: 'app_events_clean', cols: [
    ['date', ['ts_hour'], 'truncate to day', null, null],
    ['region', ['city'], 'map city to region', 'coarse_location', null],
    ['active_users', ['user_id'], 'count distinct, cells under 50 suppressed', 'user_id', null],
    ['sessions', ['session_id'], 'count', null, null],
    ['search_success_rate', ['event_name'], 'successes over searches', null, null],
  ] },
  assistant_conversations_redacted: { from: 'assistant_conversations', cols: [
    ['conversation_id', ['conversation_id'], 'copy', null, null],
    ['user_id', ['user_id'], 'copy, opted-out users removed', 'user_id', 'user_id'],
    [null, ['email'], 'drop', 'email', null],
    ['message_redacted', ['message'], 'NER and regex redaction', 'free_text', null],
    ['redactions', ['message'], 'list of redacted entity types', null, null],
    ['intent', ['intent'], 'copy', null, null],
  ] },
  sft_instructions_v3: { from: 'assistant_conversations_redacted', cols: [
    ['instruction', ['message_redacted'], 'select and rewrite turn', null, null],
    ['response', ['message_redacted'], 'select reply, human reviewed', null, null],
    ['source', [], 'constant: redacted_user or synthetic', null, null],
    [null, ['user_id'], 'drop, examples are unlinkable', 'user_id', null],
  ] },
  iphone_app_events_v2_ads: { from: 'iphone_app_events_v2', cols: [
    ['user_id', ['user_id'], 'copy', 'user_id', 'user_id'],
    [null, ['idfa'], 'drop', 'device_id', null],
    ['geohash5', ['latitude', 'longitude'], 'geohash, precision 5', 'precise_location', 'coarse_location'],
    ['ts', ['ts'], 'copy', null, null],
  ] },
};

/* A tag may only be removed or weakened by a transform the privacy team approved. */
const APPROVED = [/^drop/, /^geohash/, /^reverse geocode/, /^map /, /redaction/, /count distinct/, /suppressed/, /^select/];
const TAG_RANK = { device_id: 4, precise_location: 4, email: 4, free_text: 4, user_id: 2, coarse_location: 1 };
export function tagCheck(id) {
  const cl = COLUMN_LINEAGE[id];
  if (!cl) return null;
  let downgraded = 0; const violations = [];
  for (const [out, , tf, tin, tout] of cl.cols) {
    if ((TAG_RANK[tin] || 0) > (TAG_RANK[tout] || 0)) {
      if (APPROVED.some((r) => r.test(tf))) downgraded++;
      else violations.push(out || tin);
    }
  }
  return { columns: cl.cols.length, downgraded, violations };
}
