import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, beforeEach } from 'bun:test';

/**
 * Gives the calling test file its own migrated database, emptied before
 * every test. Read `.current` inside hooks and tests, not at import time.
 */
export function useTestDb(): { current: TestDb } {
  const handle = {} as { current: TestDb };
  beforeAll(async () => {
    handle.current = await createTestDb();
  });
  afterAll(() => handle.current.drop());
  beforeEach(() => handle.current.reset());
  return handle;
}
