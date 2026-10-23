# Runbooks

## DSR stuck
1. Find the workflow by idempotency key (`dsr-erasure:<hash>`); check the failing activity.
2. Transient (timeouts, throttling): Temporal retries with backoff; confirm attempts rising.
3. Permanent (schema change, missing table): fix, then reset the workflow to the failed activity. Steps are idempotent; earlier ones no-op.
4. If day 21 of 30 passes, the SLA timer escalates to the privacy lead; record the reason in the evidence pack.

## Consent lag spike
1. Check outbox backlog (unpublished rows) vs consumer lag on `consent.events`.
2. Outbox backlog: relay down or DB contention. Consumer lag: scale consumers (partition count is the ceiling).
3. While lag exceeds the SLO, the gateway keeps serving from cache; the policy still fails closed on unknown state.

## Policy service down
1. Expected behavior: breaker opens after 3 failures, gateway serves contextual, fallback rate alert fires, violations stay 0.
2. Check bundle download and OPA health; sidecars keep the last good bundle.
3. Restore; breaker half-opens and closes on the first success.

## Ledger verification failure
1. Do not repair in place. Freeze writes to the affected range.
2. Compare the recomputed Merkle root with the Object Lock anchors to bound the tampered window.
3. Open a security incident; restore the range from the anchored replica; rotate DB credentials.
