import type { Db } from '@marquinhos/database/client';
import type { LegacyImportOutcome } from '@marquinhos/database/etl';

export const STARTUP_RUN_MIGRATIONS = Symbol('STARTUP_RUN_MIGRATIONS');
export const STARTUP_IMPORT_SQLITE = Symbol('STARTUP_IMPORT_SQLITE');
export const STARTUP_START_MAINTENANCE = Symbol('STARTUP_START_MAINTENANCE');
export const STARTUP_ASSERT_WORDLE_READY = Symbol(
  'STARTUP_ASSERT_WORDLE_READY',
);

export type StartupRunMigrations = (database: Db) => Promise<void>;
export type StartupImportSqlite = (
  sqlitePath: string,
  database: Db,
) => Promise<LegacyImportOutcome>;
export type StartupStartMaintenance = (database: Db) => () => void;
export type StartupAssertWordleReady = (database: Db) => Promise<void>;
