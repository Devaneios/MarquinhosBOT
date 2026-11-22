ALTER TABLE "evolutive_achievements" DROP COLUMN "current_tier";
ALTER TABLE "evolutive_achievements" ADD COLUMN "current_rarity" text DEFAULT 'common' NOT NULL;
