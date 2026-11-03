CREATE TABLE "wordle_notification_config" (
  "guild_id" text PRIMARY KEY,
  "channel_id" text,
  "collective" boolean NOT NULL DEFAULT false,
  "weekly" boolean NOT NULL DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "wordle_notifications" (
  "id" text PRIMARY KEY,
  "guild_id" text NOT NULL,
  "event_type" text NOT NULL CHECK ("event_type" IN ('page', 'goal', 'weekly')),
  "event_key" text NOT NULL,
  "payload" jsonb NOT NULL,
  "eligible_at" bigint NOT NULL,
  "status" text NOT NULL CHECK ("status" IN ('pending', 'sending', 'delivered', 'uncertain')),
  "lease_id" text,
  "lease_started_at" bigint,
  "channel_id" text,
  "message_id" text,
  "created_at" bigint NOT NULL,
  UNIQUE ("guild_id", "event_key")
);
--> statement-breakpoint
CREATE INDEX "wordle_notifications_pending_idx" ON "wordle_notifications" ("guild_id", "status", "eligible_at");
