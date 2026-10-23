# What changes at billions of users

- **Streams:** Flink for consent and decision streams, Spark for lakehouse batch. Kafka partitioned by user ID so changes stay ordered per user; partition count sized for peak consent churn.
- **Policy:** OPA or Cedar as sidecars next to every gateway and job with local bundle caches; decision logs sampled for analytics but 100 percent for denials and enforcement-relevant paths.
- **Consent reads:** regional Redis clusters, read-through with a short TTL plus push invalidation; unknown state still denies.
- **Lakehouse:** Iceberg at petabyte scale with merge-on-read deletes, compaction, and snapshot expiry scheduled inside the erasure SLA. Partition by region and day so erasure touches few files.
- **Regional cells:** EU control and data planes run in EU regions; cross-region traffic carries aggregates only.
- **Ledger:** sharded hash chains per partition, each anchored; a Merkle tree over shard roots.
- **Reporting:** differential privacy for aggregate ad reporting so outputs do not reveal individuals.
- **Erasure:** batch DSRs per partition per day instead of one saga per table per user.
