# Live demo runbook (10 to 12 minutes)

Open https://www.turbnetic.ai/custodian/, enter the password (set in Netlify, never in the repo), sign in as any
role. Open Help (the ? button) › **Guided tour** for the act list. Each act switches accounts by itself and
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

## Extra screens worth opening live

- **Operations > Dashboard:** Grafana-style panels with a 1h/24h/7d/30d picker; hover for exact values. Kill the policy engine and the fallback panel spikes.
- **Risk:** register with heat map, DPIA and AI impact assessments with role sign-off, vendor register, incidents with the 72 hour clock (opened automatically by chaos or tampering), and one-click regulator reports.
- **Data > Catalog:** saved views, bulk approve, and a slide-over panel per dataset with Overview, Activity (from the ledger) and Access.
- **Account menu > Dark appearance.**

## Model governance and design review

- Models > Lifecycle: 12 governed models. Open "Assistant LLM v2 candidate": two privacy evaluations fail and sign-offs are locked. As Maya (ML engineer) click "Remove duplicates and re-run evaluation". Then sign in as Jonas, Amara and Priya: each finds the sign-off in their Home inbox. After the last one, promote to production. Every step is in the Activity tab and the audit ledger.
- "Resume screening" shows a high-risk use (EU AI Act Annex III) stopped at intake.
- Developers > Design review: what the platform team owns, how each part is done, service levels, trade-offs and next steps, each linked to the working screen.

## Create workflows (+ New, or ⌘K and type "new")

Dataset, access request, model, assessment, subject request, incident, API key. Forms validate, respect roles (the footer says who may submit), and what they create appears in the matching list, the right reviewer's Home inbox and the audit ledger. A model whose intake says it supports employment or credit decisions is classified high risk and stops at intake. API key secrets are shown once.
