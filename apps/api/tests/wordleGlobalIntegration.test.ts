import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => {
  await testDb.drop();
});

describe('global Wordle integration', () => {
  it('continues the same game and draft when opened from another community', async () => {
    const child = Bun.spawn(
      [process.execPath, 'tests/helpers/globalWordleScenario.ts'],
      {
        cwd: `${import.meta.dir}/..`,
        env: { ...process.env, DATABASE_URL: testDb.url },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );
    const [stdout, stderr] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(await child.exited, stderr).toBe(0);
    const result = JSON.parse(stdout.trim());
    expect(result.dayA).toBe('termo');
    expect(result.dayB).toBe('termo');
    expect(result.played).toMatchObject({ attempts: 1, solved: false });
    expect(result.rankA).toEqual([
      { userId: 'global-player', attempts: 1, solved: false },
    ]);
    expect(result.rankB).toEqual([
      { userId: 'global-player', attempts: 1, solved: false },
    ]);
    expect(result.rankOther).toEqual([]);
    expect(result.session).toMatchObject({
      attempts: 1,
      guesses: [{ guess: 'porta' }],
    });
    expect(result.before).toMatchObject({ rowIndex: 1, revision: 1 });
    expect(result.saved).toMatchObject({ status: 'saved' });
    expect(result.after).toMatchObject({
      cells: ['t', '', '', '', ''],
      revision: 2,
    });
    expect(result.closedDay).toMatchObject({
      word: 'carta',
      guesses: [{ guess: 'porta' }],
    });
    expect(result.unrelatedDay.guesses).toEqual([]);
    expect(result.forced).toBe(false);
    expect(result.rotatedA.word).toBe('termo');
    expect(result.rotatedB).toEqual(result.rotatedA);
  });
});
