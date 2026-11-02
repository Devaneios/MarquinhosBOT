CREATE TABLE "wordle_global_migration_state" (
  "id" text PRIMARY KEY,
  "source_digest" text NOT NULL,
  "completed_at" bigint NOT NULL
);
