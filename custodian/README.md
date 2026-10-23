# Custodian

Enterprise AI data governance platform. One control plane that makes every AI
workload's data use compliant, enforceable and auditable: consent and purpose
enforcement, ABAC policy as code, OAuth identity for people, services and
agents, approval workflows, lineage, data residency, erasure that reaches
Iceberg snapshots, and a tamper-evident audit ledger.

Three example workloads run through it: **ads ranking** (personalization, fed by
the iPhone pipeline in `/fl-demo`), **assistant LLM fine-tuning** (redacted
conversations, model_training consent) and **search quality analytics**
(analytics only). Adding a workload means registering its datasets and its
per-user purpose; the planes stay the same.

**Live:** https://www.turbnetic.ai/custodian/ (private demo, password gated)

## What is real and what is simulated

The hosted build runs every mechanism in the browser so it can be shown from a
link with nothing to start. The logic is real and tested; the infrastructure is
substituted:

| Mechanism | Hosted demo | Production design |
|---|---|---|
| Policy (ABAC, fail closed, shadow mode) | `js/engine.js` rules, mirrored in `policies/ads.rego` | OPA server or sidecar with versioned bundles |
| Bitemporal consent, outbox | In-memory immutable rows, outbox relay | Postgres, Debezium/outbox relay, Kafka, Redis |
| Workflows and DSR saga | Async steps with idempotency keys and retry | Temporal workflows and activities |
| Lakehouse and snapshot expiry | Iceberg snapshot semantics modelled per table | Iceberg on S3/MinIO, `expire_snapshots`, `remove_orphan_files` |
| Lineage | Run records with snapshot IDs | OpenLineage events into Marquez |
| Audit ledger | SHA-256 hash chain, Merkle roots, HMAC pseudonyms (WebCrypto) | Postgres append-only table, roots to S3 Object Lock |
| Identity | HS256 JWT-shaped tokens, RFC 8693 exchange shape | Keycloak OIDC, client credentials, token exchange |

The password gate is client-side and keeps the link private; it is not a
security boundary. Synthetic users only (10,000, seeded).

## Run locally

```
python3 -m http.server 8934     # from the repo root
open http://localhost:8934/custodian/
npm test                        # from custodian/: 12 engine tests
opa test policies/              # if OPA is installed
```

Change the password: `node scripts/set-password.mjs "new password"` and paste
the hash into `PW_HASH` in `js/app.js`.

## Layout

```
custodian/
  index.html, app.css     console shell (gate, sign-in, views)
  js/engine.js            governance mechanisms, no DOM, Node-testable
  js/app.js               views, live traffic, scripted demo acts
  policies/               Rego bundle and opa tests
  tests/                  node --test suite
  docs/                   DESIGN, ADRs, COMPLIANCE_MATRIX, DEMO, RUNBOOKS, AT_SCALE, INTERVIEW_NOTES
```
