CREATE TABLE "legacy_sqlite_import" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"imported_at" bigint NOT NULL,
	"snapshot_path" text NOT NULL,
	CONSTRAINT "legacy_sqlite_import_single_row" CHECK ("legacy_sqlite_import"."id" = 1)
);
