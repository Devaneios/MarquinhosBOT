ALTER TABLE wordle_user_config
ADD COLUMN enable_space_key INTEGER NOT NULL DEFAULT 0 CHECK (enable_space_key IN (0, 1));

ALTER TABLE wordle_user_config
ADD COLUMN enable_arrow_keys INTEGER NOT NULL DEFAULT 0 CHECK (enable_arrow_keys IN (0, 1));

CREATE TRIGGER wordle_user_config_arrow_requires_space_insert
BEFORE INSERT ON wordle_user_config
WHEN NEW.enable_arrow_keys = 1 AND NEW.enable_space_key = 0
BEGIN
  SELECT RAISE(ABORT, 'Wordle arrow keys require the space key');
END;

CREATE TRIGGER wordle_user_config_arrow_requires_space_update
BEFORE UPDATE ON wordle_user_config
WHEN NEW.enable_arrow_keys = 1 AND NEW.enable_space_key = 0
BEGIN
  SELECT RAISE(ABORT, 'Wordle arrow keys require the space key');
END;
