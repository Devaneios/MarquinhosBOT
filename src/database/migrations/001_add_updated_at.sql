-- Migration: 001_add_updated_at
-- Description: Adds updated_at columns and auto-update triggers to relevant entities

-- users
ALTER TABLE users ADD COLUMN updated_at INTEGER DEFAULT (cast(strftime('%s','now') as int));
CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = cast(strftime('%s','now') as int) WHERE id = NEW.id;
END;

-- user_levels
ALTER TABLE user_levels ADD COLUMN updated_at INTEGER DEFAULT (cast(strftime('%s','now') as int));
CREATE TRIGGER IF NOT EXISTS trg_user_levels_updated_at
AFTER UPDATE ON user_levels
FOR EACH ROW
BEGIN
  UPDATE user_levels SET updated_at = cast(strftime('%s','now') as int) WHERE user_id = NEW.user_id AND guild_id = NEW.guild_id;
END;

-- user_stats
ALTER TABLE user_stats ADD COLUMN updated_at INTEGER DEFAULT (cast(strftime('%s','now') as int));
CREATE TRIGGER IF NOT EXISTS trg_user_stats_updated_at
AFTER UPDATE ON user_stats
FOR EACH ROW
BEGIN
  UPDATE user_stats SET updated_at = cast(strftime('%s','now') as int) WHERE user_id = NEW.user_id AND guild_id = NEW.guild_id;
END;

-- user_achievements (usually only inserted, but good to have)
ALTER TABLE user_achievements ADD COLUMN updated_at INTEGER DEFAULT (cast(strftime('%s','now') as int));
CREATE TRIGGER IF NOT EXISTS trg_user_ach_updated_at
AFTER UPDATE ON user_achievements
FOR EACH ROW
BEGIN
  UPDATE user_achievements SET updated_at = cast(strftime('%s','now') as int) WHERE user_id = NEW.user_id AND guild_id = NEW.guild_id AND achievement_id = NEW.achievement_id;
END;
