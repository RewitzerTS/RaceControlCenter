-- Historical staging marker for the verified V1 RCC cutover snapshot.
--
-- The original migration imported tenant-specific staging data and was applied
-- before this repository's migration history was reconciled. The data payload is
-- intentionally not stored here: fresh environments receive deterministic demo
-- fixtures instead, while this marker keeps the shared migration version chain
-- aligned without copying RCC records into another database.

select 1;
