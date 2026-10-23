# ADR 0004: Dataset-level lineage with snapshot IDs

Status: accepted

Context: we must answer "which data trained model v3" and "where is user X".

Decision: OpenLineage at dataset level, enriched with exact Iceberg snapshot
IDs per run. User location is answered by partition and snapshot membership,
not by tracing every row.

Consequences: cheap and precise enough for erasure and model provenance.
Row-level lineage would cost orders of magnitude more storage and compute for a
question we can answer from table membership.
