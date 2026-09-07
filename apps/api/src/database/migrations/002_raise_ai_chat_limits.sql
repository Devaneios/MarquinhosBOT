-- Migration: 002_raise_ai_chat_limits
-- Description: Raises the ai_chat rate limits on databases seeded with the
-- original defaults. seedDefaults uses INSERT OR IGNORE, so bumping the
-- constants in code never reaches a database that was already seeded.
-- Each statement is guarded on the old value so operator-tuned limits survive.

UPDATE ai_chat_config SET value = 100  WHERE key = 'user_daily_limit'   AND value = 10;
UPDATE ai_chat_config SET value = 2000 WHERE key = 'global_daily_limit' AND value = 200;
UPDATE ai_chat_config SET value = 50   WHERE key = 'agent_daily_limit'  AND value = 5;
