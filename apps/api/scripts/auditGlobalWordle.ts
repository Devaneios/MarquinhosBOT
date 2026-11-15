import { createDb } from '@marquinhos/database/client';
import { sql } from 'drizzle-orm';
import { writeFile } from 'node:fs/promises';
import {
  auditWordlePreservation,
  wordlePreservationDigest,
} from '../src/modules/wordle/migration/wordle-preservation';

const SOURCE_TAG = 'v0.0.3';
const SOURCE_COMMIT = '44e8394be8fdb8dd11fec7c27e9476d02629470a';

function outputPath(args: string[]): string {
  const index = args.indexOf('--output');
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith('--'))
    throw new Error(
      'Usage: bun scripts/auditGlobalWordle.ts --output /protected/path/inventory.json',
    );
  return value;
}

async function main() {
  const path = outputPath(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const handle = createDb(url, 1);
  try {
    await handle.db.execute(
      sql.raw('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY'),
    );
    const report = await auditWordlePreservation(handle.db);
    await handle.db.execute(sql.raw('COMMIT'));
    const artifact = {
      artifactType: 'wordle-preservation-inventory',
      version: 1,
      source: {
        expectedTag: SOURCE_TAG,
        pinnedCommit: SOURCE_COMMIT,
        databaseTagVerified: false,
      },
      sourceDigest: wordlePreservationDigest(report),
      report,
    };
    await writeFile(path, `${JSON.stringify(artifact, null, 2)}\n`, {
      mode: 0o600,
      flag: 'wx',
    });
    console.log(
      JSON.stringify({
        artifactType: artifact.artifactType,
        expectedSourceTag: SOURCE_TAG,
        databaseTagVerified: false,
        sourceDigest: artifact.sourceDigest,
        users: report.users,
        inspectedTables: Object.keys(report.tables).length,
        rows: Object.values(report.tables).reduce(
          (sum, table) => sum + (table?.rowCount ?? 0),
          0,
        ),
        unknownAnswerDays: report.unknownAnswerDays,
        multipleGuildPlayerDates: report.multipleGuildPlayerDates,
        output: path,
      }),
    );
  } catch (error) {
    await handle.db.execute(sql.raw('ROLLBACK')).catch(() => undefined);
    throw error;
  } finally {
    await handle.close();
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'Wordle audit failed',
    );
    process.exitCode = 1;
  });
}
