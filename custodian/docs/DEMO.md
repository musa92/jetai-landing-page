# Live demo runbook (10 to 12 minutes)

Open https://www.turbnetic.ai/custodian/, enter the password (custodian-demo), sign in as any
role. Press **Demo** for the act list. Each act switches accounts by itself and
narrates at the bottom; **Stop** ends an act, **Reset** restores the start state.

| # | Act | What to say |
|---|---|---|
| 1 | Overview | One plane for every AI workload (ads ranking, assistant LLM, search analytics). Headline SLO: zero personalized outputs without an allow. Then the Data explorer: a raw event with IDFA and precise location next to the minimized view a model may read. |
| 2 | Governed onboarding | Scanner finds precise location and IDFA, so restricted. Pre-check denies raw use for ads; privacy and legal approve a minimized view, US only, 90 days, auto revoke. |
| 3 | Purpose limitation | Analytics-only data for ads training: denied with rule, article and bundle version. Nothing read. |
| 4 | Enforced training | Scoped 15 minute token, policy gate, point-in-time consent join, exclusions by reason, snapshot ID in lineage, model card. |
| 5 | Real-time consent | GPC on for a California user: Postgres, outbox, topic, consumer, Redis, next ad contextual. Show lag and the trace. |
| 6 | Resilience | Kill the policy service: fallback rate spikes, breaker opens, violations stay at zero. Restore: half-open, closed. |
| 7 | Right to erasure | Lineage shows every location. Saga deletes rows, expires snapshots (time travel no longer finds the user), purges cache, flags adrank v3, signs evidence. Re-run is a no-op. |
| 8 | Audit | Auditor-only. Filter by pseudonym, verify, tamper with a denial, verify again: exact entry found. |
| 9 | DMA and agents | EU user without combination consent is refused personalization. Agent token exchange: read allowed, export denied for scope and purpose. |
| 10 | Close | Compliance matrix; at-scale plan. |

Manual controls if you want to drive it: Consent view toggles, Serving view
chaos button (role `sre`), Policy studio simulator and shadow diff, Audit view
tamper and verify (role `auditor`).
