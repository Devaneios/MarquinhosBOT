import { readFile } from 'node:fs/promises';
import { wordlePreservationDigest, type WordlePreservationReport } from '../src/modules/wordle/migration/wordle-preservation';
import { createDb } from '@marquinhos/database/client';
import { prepareGlobalWordleCutover } from '../src/modules/wordle/migration/global-cutover';

interface InventoryArtifact {
  artifactType: 'wordle-preservation-inventory';
  version: 1;
  source: { expectedTag: string; pinnedCommit: string; databaseTagVerified: false };
  sourceDigest: string;
  report: WordlePreservationReport;
}

function parseArgs(args: string[]) {
  const values = new Map<string, string>();
  let apply = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg === '--apply') { apply = true; continue; }
    if (arg === '--help') return { help: true as const };
    if (!['--source-tag', '--cutover-date', '--audit'].includes(arg) || !args[index + 1] || args[index + 1]!.startsWith('--')) {
      throw new Error(`Unexpected or incomplete argument: ${arg}`);
    }
    if (values.has(arg)) throw new Error(`Duplicate argument: ${arg}`);
    values.set(arg, args[++index]!);
  }
  const sourceTag = values.get('--source-tag');
  if (sourceTag !== 'v0.0.3' && sourceTag !== 'fresh') throw new Error('--source-tag must be v0.0.3 or fresh');
  const cutoverDate = values.get('--cutover-date');
  if (!cutoverDate) throw new Error('--cutover-date is required');
  const audit = values.get('--audit');
  if (!audit) throw new Error('--audit is required');
  return { help: false as const, sourceTag: sourceTag as 'v0.0.3' | 'fresh', cutoverDate, audit, apply };
}

async function main() {
  const options = parseArgs(Bun.argv.slice(2));
  if (options.help) {
    console.log('Usage: bun scripts/migrateGlobalWordle.ts --source-tag v0.0.3|fresh --cutover-date YYYY-MM-DD --audit /protected/path/inventory.json [--apply]');
    console.log('Schema migrations must be applied separately. Without --apply, preparation runs in a rolled-back write transaction.');
    return;
  }
  const text = await readFile(options.audit, 'utf8');
  const artifact = JSON.parse(text) as InventoryArtifact;
  if (artifact.artifactType !== 'wordle-preservation-inventory' || artifact.version !== 1 || artifact.report?.version !== 1) {
    throw new Error('Unsupported preservation inventory artifact');
  }
  if (wordlePreservationDigest(artifact.report) !== artifact.sourceDigest) throw new Error('Preservation inventory digest is invalid');
  if (options.sourceTag === 'v0.0.3' && artifact.source.expectedTag !== 'v0.0.3') throw new Error('Audit artifact does not identify the expected v0.0.3 source');
  if (options.sourceTag === 'fresh' && Object.keys(artifact.report.tables).some((name) => name.startsWith('wordle_') && artifact.report.tables[name as keyof typeof artifact.report.tables]?.rowCount)) {
    throw new Error('Fresh source audit contains legacy Wordle rows');
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const handle = createDb(databaseUrl, 1);
  try {
    const result = await prepareGlobalWordleCutover(handle.db, {
      sourceTag: options.sourceTag,
      cutoverDate: options.cutoverDate,
      dryRun: !options.apply,
      before: artifact.report,
    });
    console.log(JSON.stringify(result));
  } finally {
    await handle.close();
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Global Wordle cutover failed');
    process.exitCode = 1;
  });
}
