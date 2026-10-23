# Compliance matrix

| Control | Regulation | Implementation | Evidence |
|---|---|---|---|
| Lawful basis, consent | GDPR Art. 6(1)(a), 7 | EU opt-in rule `gdpr.opt_in`; bitemporal consent proves state at any time | Consent history; decision log |
| Purpose limitation | GDPR Art. 5(1)(b) | `allowed_purposes` per dataset; purpose in every token and decision | `policy.decisions` with reasons and bundle version |
| Data minimization | GDPR Art. 5(1)(c), Art. 25 | Restricted data never feeds ads; approvals route to minimized views | Access request workflow history |
| Records of processing | GDPR Art. 30 | Catalog metadata plus OpenLineage for every job | Catalog export; Marquez graph |
| Right of access | GDPR Art. 15 | Lineage lookup of every location holding a user | Per-user location report |
| Right to erasure | GDPR Art. 17 | Saga: row deletes, snapshot expiry, orphan files, cache purge, model flags | Signed evidence pack |
| International transfers | GDPR Art. 44-46 | Region buckets; `residency.eu` denies processing outside EU without a basis | Decision log |
| Accountability | GDPR Art. 5(2) | Hash-chained ledger, Merkle roots to Object Lock | Verification report, anchors |
| Opt-out of sale or sharing | CCPA 1798.120, 1798.135; CPRA Regs 7025 (GPC) | Opt-out and GPC enforced at serving and training | Serving log with consent offset |
| Cross-service combination | DMA Art. 5(2) | `dma.combination` requires explicit consent for multi-source features | Decision log |
| Data governance for high-risk AI | EU AI Act Art. 10, 11 | Point-in-time training sets, exclusion reports, generated model cards | Model card; lineage run |
