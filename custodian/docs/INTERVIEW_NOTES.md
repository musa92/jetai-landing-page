# Interview notes

For each component: what it does, the main tradeoff, which requirement it covers.

**Identity (Keycloak, OIDC)**
- Humans sign in with roles; services use client credentials; agents use RFC 8693 token exchange that names both user and agent.
- Tradeoff: short-lived scoped tokens mean more token traffic, but a leaked token is narrow and brief.
- Covers: OAuth and federated identity, least privilege.

**Consent service (bitemporal Postgres, outbox)**
- Immutable rows with valid time and recorded time; outbox publishes each change in the same transaction.
- Tradeoff: storage grows with every change, in exchange for exact replay of what was known when.
- Covers: consent and purpose enforcement, GDPR Art. 7 proof.

**Catalog and PII scanner**
- Every dataset has governance metadata; scanner proposes tags, steward confirms; pending datasets are unreadable.
- Tradeoff: human confirmation slows onboarding but avoids silent misclassification.
- Covers: classification, records of processing.

**Policy service (OPA)**
- PDP decides with reasons and version; PEPs in gateway, training gate and workflows enforce. Fails closed. Shadow bundles show disagreement before rollout.
- Tradeoff: a network hop per decision; mitigated with sidecars and bundle caches.
- Covers: ABAC, policy as code, GDPR/CCPA/DMA rules.

**Workflows (Temporal)**
- Access requests with human steps and auto revoke; DSR saga with idempotency, retries, compensation, SLA timer.
- Tradeoff: another stateful system to run, for durability you would otherwise hand-build.
- Covers: approval and compliance review workflows, deletion propagation.

**Lakehouse (Iceberg) and residency**
- Region buckets; erasure must expire snapshots and orphan files or time travel still returns the user.
- Tradeoff: expiring snapshots removes rollback history; schedule it inside the SLA.
- Covers: data residency, deletion propagation.

**Lineage (OpenLineage, Marquez)**
- Every job emits inputs and outputs with snapshot IDs; answers model provenance and user location.
- Tradeoff: dataset level plus snapshot IDs instead of row level.
- Covers: data lineage, AI Act provenance.

**Training gate and model cards**
- Scoped token, policy check, point-in-time consent join, exclusion report, generated card, `retrain_required` on erasure.
- Tradeoff: excluding users shrinks training data; report it so model owners see the cost.
- Covers: AI data use compliance, EU AI Act Art. 10 and 11.

**Ad gateway**
- Cache read, policy call, contextual fallback, circuit breaker, invariant counter for personalized-without-allow.
- Tradeoff: failing closed costs revenue during an outage; failing open costs trust and fines.
- Covers: enforcement at serving, fault tolerance.

**Audit ledger**
- Hash chain, Merkle roots to Object Lock, keyed pseudonyms, auditor-only queries, evidence export.
- Tradeoff: pseudonyms make erasure compatible with retention of proof, but key rotation needs planning.
- Covers: tamper-evident audit logs.

**What I would say about the hosted demo**
- It runs the real decision logic, the real hash chain and the real saga in the browser so it can be shown from a link; the infrastructure mapping is one-to-one with this doc, and `policies/ads.rego` is the bundle the engine mirrors.
