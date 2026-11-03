CREATE TABLE "wordle_personal_rewards" (
  "user_id" text NOT NULL,
  "reward_id" text NOT NULL,
  "granted_at" bigint NOT NULL,
  PRIMARY KEY ("user_id", "reward_id")
);
--> statement-breakpoint
CREATE TABLE "wordle_equipped_rewards" (
  "user_id" text NOT NULL,
  "kind" text NOT NULL CHECK ("kind" IN ('title', 'frame')),
  "reward_id" text NOT NULL,
  PRIMARY KEY ("user_id", "kind"),
  FOREIGN KEY ("user_id", "reward_id") REFERENCES "wordle_personal_rewards" ("user_id", "reward_id") ON DELETE CASCADE
);
