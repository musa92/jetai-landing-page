import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Platform, decide, scanPII, DEMO_SCHEMA, runErasure, ConsentStore, Ledger } from '../js/engine.js';
import { lineageGraph, impact, tagCheck, COLUMN_LINEAGE } from '../js/lineage.js';

const P = () => new Platform({ users: 1500 });
const fast = { sleep: () => Promise.resolve(), stepDelay: 0 };

test('bitemporal consent replays what was known at a past record time', () => {
  const c = new ConsentStore();
  c.insert({ user_id: 'u1', purpose: 'ads_personalization', status: 'granted', valid_from: 100, recorded_at: 100 });
  // Late correction: on day 300 we learn the user had withdrawn on day 200.
  c.insert({ user_id: 'u1', purpose: 'ads_personalization', status: 'denied', valid_from: 200, recorded_at: 300 });
  assert.equal(c.at('u1', 'ads_personalization', 250, 250).status, 'granted'); // what we believed then
  assert.equal(c.at('u1', 'ads_personalization', 250, 400).status, 'denied');  // what was actually true
  assert.equal(c.at('u1', 'ads_personalization', 150, 400).status, 'granted');
});

test('policy fails closed on missing input', () => {
  const d = decide({ purpose: 'ads_personalization' });
  assert.equal(d.allow, false);
  assert.equal(d.reasons[0].code, 'missing_input');
});

test('purpose limitation denies analytics-only data for ads training', () => {
  const p = P();
  const ds = p.dataset('session_metrics_daily');
  const d = decide({ principal: { sub: 'maya.chen' }, purpose: 'model_training', dataset: ds, processing_region: 'US', grant: false });
  assert.equal(d.allow, false);
  assert.ok(d.reasons.some((r) => r.code === 'purpose_not_permitted'));
});

test('EU users need opt-in, GPC users are excluded, EU data stays in EU', () => {
  const p = P();
  const ds = p.dataset('ad_features_v7');
  const base = { principal: { sub: 'svc' }, purpose: 'ads_personalization', dataset: ds, processing_region: 'US', grant: true };
  const eu = { id: 'x', eu: true, region: 'EU-DE', gpc: false, att: 'authorized', consent: { ads_personalization: 'denied' } };
  assert.ok(decide({ ...base, user: eu }).reasons.some((r) => r.code === 'gdpr_no_opt_in'));
  const ca = { id: 'y', eu: false, region: 'US-CA', age_band: '18_plus', gpc: true, att: 'authorized', consent: { ads_personalization: 'granted' } };
  assert.ok(decide({ ...base, user: ca }).reasons.some((r) => r.code === 'gpc_signal'));
  const euds = { ...p.dataset('ad_features_v7_eu') };
  assert.ok(decide({ ...base, dataset: euds, processing_region: 'US' }).reasons.some((r) => r.code === 'eu_transfer_blocked'));
  assert.equal(decide({ ...base, dataset: euds, processing_region: 'EU' }).allow, true);
});

test('DMA: combining services needs explicit consent for EU users', () => {
  const p = P();
  const ds = p.dataset('ad_features_v7');
  const eu = { id: 'x', eu: true, region: 'EU-FR', gpc: false, att: 'authorized', consent: { ads_personalization: 'granted', cross_service_combination: 'denied' } };
  const d = decide({ principal: { sub: 'svc' }, purpose: 'ads_personalization', dataset: ds, processing_region: 'EU', transfer_basis: null, grant: true, user: eu });
  assert.ok(d.reasons.some((r) => r.code === 'dma_no_combination_consent'));
});

test('PII scanner flags precise location and IDFA as restricted', () => {
  const s = scanPII(DEMO_SCHEMA);
  assert.ok(s.tags.includes('precise_location'));
  assert.ok(s.tags.includes('device_id'));
  assert.equal(s.classification, 'restricted');
});

test('ledger detects tampering', async () => {
  const l = new Ledger();
  for (let i = 0; i < 20; i++) await l.append('t', 'a', { i, user_id: 'u' + i });
  assert.equal((await l.verify()).ok, true);
  l.entries[7].payload.i = 999;
  const v = await l.verify();
  assert.equal(v.ok, false);
  assert.equal(v.brokenAt, 8);
});

test('serving never personalizes without an allow, and fails closed when policy is down', async () => {
  const p = P();
  for (const u of p.users.slice(0, 300)) await p.serve(u.id);
  p.policyUp = false;
  for (const u of p.users.slice(0, 50)) {
    const r = await p.serve(u.id);
    assert.equal(r.mode, 'contextual');
  }
  assert.equal(p.serving.violations, 0);
  assert.ok(p.serving.personalized > 0);
});

test('training gate excludes users by reason and records the snapshot', async () => {
  const p = P();
  const r = await p.train({ principal: 'svc-ads-trainer', datasetId: 'ad_features_v7', purpose: 'model_training' });
  assert.equal(r.ok, true);
  assert.ok(r.model.excluded.ccpa_opt_out + r.model.excluded.gpc_signal + r.model.excluded.att_denied > 0);
  assert.equal(r.model.trainedOn[0].snapshot, p.tables.ad_features_v7.current.id);
  const denied = await p.train({ principal: 'maya.chen', datasetId: 'session_metrics_daily', purpose: 'model_training' });
  assert.equal(denied.ok, false);
});

test('erasure removes the user from time travel, flags models, and is idempotent', async () => {
  const p = P();
  const eu = p.users.find((u) => u.eu && p.models[0].members.has(u.id));
  assert.ok(p.locate(eu.id).some((h) => h.kind === 'model'));
  const { dsr } = await runErasure(p, eu.id, fast);
  assert.equal(dsr.status, 'completed');
  assert.ok(!Object.values(p.tables).some((t) => t.reachable(eu.id)));
  assert.equal(p.models[0].status, 'retrain_required');
  assert.ok(dsr.evidence.signature.startsWith('hmac-sha256:'));
  const again = await runErasure(p, eu.id, fast);
  assert.equal(again.rerun, true);
  assert.equal(p.dsrs.length, 1);
});

test('consent change propagates through outbox, bus and cache', async () => {
  const p = P();
  const ca = p.users.find((u) => u.region === 'US-CA' && !u.gpc && u.personalizedAdsToggle && u.att === 'authorized' && u.age_band === '18_plus');
  assert.equal((await p.serve(ca.id)).mode, 'personalized');
  await p.setConsent(ca.id, 'ads_personalization', 'denied', 'GPC_signal', { gpc: true });
  const msgs = p.relayOutbox();
  assert.equal(msgs.length, 1);
  p.applyToCache(msgs[0]);
  assert.equal((await p.serve(ca.id)).mode, 'contextual');
});

test('open-ended consent rows resolve at "now" (Infinity)', () => {
  const p = P();
  const granted = p.users.filter((u) => p.consent.snapshot(u.id).ads_personalization === 'granted').length;
  assert.ok(granted > p.users.length * 0.2 && granted < p.users.length * 0.9);
});

test('a second workload (assistant LLM) trains through the same gate with its own consent purpose', async () => {
  const p = P();
  const r = await p.train({ principal: 'svc-assistant-trainer', datasetId: 'assistant_conversations_redacted', purpose: 'model_training' });
  assert.equal(r.ok, true);
  assert.equal(r.model.id, 'assistant-llm');
  assert.equal(r.model.version, 2);
  const raw = await p.train({ principal: 'svc-assistant-trainer', datasetId: 'assistant_conversations', purpose: 'model_training' });
  assert.equal(raw.ok, false);
});

test('minors and unknown ages never get profiling-based ads', () => {
  const p = P();
  const ds = p.dataset('ad_features_v7');
  for (const age_band of ['under_13', '13_17', 'unknown']) {
    const u = { id: 'm', eu: false, region: 'US-TX', gpc: false, att: 'authorized', age_band, consent: { ads_personalization: 'granted' } };
    const d = decide({ principal: { sub: 'svc' }, purpose: 'ads_personalization', dataset: ds, processing_region: 'US', grant: true, user: u });
    assert.ok(d.reasons.some((r) => r.code === 'minor_no_profiling'), age_band);
  }
});

test('artifacts inherit classification and ABAC guards weights and endpoints', async () => {
  const { artifacts, decideArtifact } = await import('../js/engine.js');
  const p = P();
  const a = artifacts(p);
  const eu = a.find((x) => x.region === 'EU');
  assert.equal(decideArtifact({ principal: 'maya.chen', action: 'download', resource: eu }).reasons.some((r) => r.code === 'eu_artifact_residency'), true);
  assert.equal(decideArtifact({ principal: 'vendor-labeler', action: 'download', resource: a[1] }).allow, false);
  assert.equal(decideArtifact({ principal: 'maya.chen', action: 'deploy', resource: a[2] }).reasons.some((r) => r.code === 'not_deployer'), true);
  assert.equal(decideArtifact({ principal: 'svc-model-deployer', action: 'deploy', resource: a[2] }).allow, true);
  assert.equal(decideArtifact({ principal: 'svc-ad-gateway', action: 'invoke', endpoint: 'assistant-llm-inference', region: 'US' }).allow, false);
  assert.equal(decideArtifact({ principal: 'svc-assistant', action: 'invoke', endpoint: 'assistant-llm-inference', region: 'US' }).allow, true);
});

test('lineage: impact of a cleaned table reaches its models and endpoints', () => {
  const p = new Platform({ users: 500 });
  const g = lineageGraph(p);
  const im = impact(g, 'app_events_clean');
  assert.ok(im.up.has('iphone_app_events_raw') && im.up.has('ios-collector'));
  assert.ok(im.down.has('ad_features_v7') && im.down.has('adrank v3') && im.down.has('adrank-serving'));
  assert.ok(!im.down.has('ad_features_v7_eu'), 'EU branch is separate');
});

test('lineage: every downgraded PII tag goes through an approved transform', () => {
  for (const id of Object.keys(COLUMN_LINEAGE)) assert.deepEqual(tagCheck(id).violations, [], id);
});
