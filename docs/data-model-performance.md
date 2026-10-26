# Data model index measurements

The reproducible script at [`packages/database/src/benchmark-integrity.sql`](../packages/database/src/benchmark-integrity.sql) builds temporary datasets, creates the six candidate indexes, analyzes each table and runs `EXPLAIN (ANALYZE, BUFFERS)` for their lookup shapes. The checked-in [`data-model-performance.txt`](data-model-performance.txt) contains the captured PostgreSQL 17.11 plans.

The 100k–200k row test tables selected the new indexes for tournament recency, pending word review, achievement lookup, AI thread ownership and research job ownership. Trace lookup used its user/creation index and sorted the small result set. These results show the indexes can serve their intended predicates; the recorded millisecond timings are one local run and are not CI thresholds.

On the same synthetic Wordle data, the current `EXISTS` form produced a nested-loop semi-join and processed 200 achievement rows. The former join multiplied those rows to 40,000 before distinct aggregation. Both returned the same grouped counts (`join_minus_exists` reported zero differences). In this run the `EXISTS` plan took about 0.4 ms and the join plan about 8.6 ms; use the script to compare plans under another PostgreSQL version or data distribution.
