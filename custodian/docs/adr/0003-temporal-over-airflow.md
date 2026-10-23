# ADR 0003: Temporal for approvals, DSRs and retention

Status: accepted

Context: access requests wait days for humans; DSRs must survive restarts, retry
per system and compensate; grants must revoke themselves at expiry.

Decision: Temporal workflows with activities per system, durable timers for
expiry and SLA escalation, idempotency keys per step.

Consequences: workflow state is durable and inspectable; retries and timeouts are
declarative. Airflow is a scheduler for DAG batches and fits retention jobs, but
not long-running human steps or sagas.
