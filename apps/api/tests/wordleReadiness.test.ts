import { createTestDb } from '@marquinhos/database/testing';
import { afterEach, describe, expect, it } from 'bun:test';
import { sql } from 'drizzle-orm';
import { prepareGlobalWordleCutover } from '../src/modules/wordle/migration/global-cutover';
import { auditWordlePreservation } from '../src/modules/wordle/migration/wordle-preservation';
import { assertGlobalWordleReady } from '../src/modules/wordle/wordle-readiness';
import { createWordleV003Db } from './helpers/wordleV003Db';

let drop: (() => Promise<void>) | undefined;
afterEach(async () => {
  await drop?.();
  drop = undefined;
});

describe('global Wordle readiness', () => {
  it('blocks an upgraded v0.0.3 database until the preservation cutover is prepared', async () => {
    const fixture = await createWordleV003Db();
    drop = fixture.drop;
    await fixture.upgrade();

    await expect(assertGlobalWordleReady(fixture.db)).rejects.toThrow(
      'prepare and verify the global cutover',
    );
  });

  it('accepts a prepared and verified v0.0.3 receipt', async () => {
    const fixture = await createWordleV003Db();
    drop = fixture.drop;
    const before = await auditWordlePreservation(fixture.db);
    await fixture.upgrade();
    await prepareGlobalWordleCutover(fixture.db, {
      sourceTag: 'v0.0.3',
      cutoverDate: '2026-11-10',
      before,
    });

    await expect(assertGlobalWordleReady(fixture.db)).resolves.toBeUndefined();
  });

  it('rejects a receipt that has not reached its verified state', async () => {
    const fixture = await createWordleV003Db();
    drop = fixture.drop;
    const before = await auditWordlePreservation(fixture.db);
    await fixture.upgrade();
    await prepareGlobalWordleCutover(fixture.db, {
      sourceTag: 'v0.0.3',
      cutoverDate: '2026-11-10',
      before,
    });
    await fixture.db.execute(sql`
      UPDATE wordle_global_cutovers
      SET verified_at = 0
      WHERE id = 'global-only-v003'
    `);

    await expect(assertGlobalWordleReady(fixture.db)).rejects.toThrow(
      'receipt is invalid or incomplete',
    );
  });

  it('accepts an explicitly initialized fresh database', async () => {
    const testDb = await createTestDb();
    drop = testDb.drop;
    const before = await auditWordlePreservation(testDb.db);
    await prepareGlobalWordleCutover(testDb.db, {
      sourceTag: 'fresh',
      cutoverDate: '2026-11-10',
      before,
    });

    await expect(assertGlobalWordleReady(testDb.db)).resolves.toBeUndefined();
  });
});
