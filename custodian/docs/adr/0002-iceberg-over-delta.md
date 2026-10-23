# ADR 0002: Apache Iceberg for the lakehouse

Status: accepted

Context: erasure must reach physical files. Row deletes create a new snapshot
while old snapshots keep referencing the old files, so time travel can still
read an erased user.

Decision: Iceberg with a REST catalog, region-partitioned buckets. The DSR saga
runs row deletes, then `expire_snapshots` and `remove_orphan_files`.

Consequences: engine neutral (Spark, Flink, Trino, DuckDB, PyIceberg), explicit
snapshot lifecycle we can tie to the erasure SLA. Delta offers similar
`VACUUM` semantics; Iceberg won on engine neutrality and the REST catalog.
