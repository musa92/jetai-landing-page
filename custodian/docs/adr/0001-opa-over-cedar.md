# ADR 0001: OPA (Rego) for the policy decision point

Status: accepted

Context: decisions need ABAC over principal, purpose, dataset tags, consent and
region, p99 under 10 ms, versioned bundles, unit tests, and a shadow mode.

Decision: Open Policy Agent with Rego bundles in `policies/`, tested with `opa test`.

Consequences: mature sidecar and bundle distribution, decision logs out of the
box, broad tooling. Rego has a learning curve, and it can express things that
are hard to analyze. Cedar offers formal analysis and simpler semantics; we
would reconsider it if we needed provable policy properties more than ecosystem.
