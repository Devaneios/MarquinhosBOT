import { closeDefaultDb } from '@marquinhos/database/client';
import { createTestDb } from '@marquinhos/database/testing';
import { afterAll } from 'bun:test';

// One throwaway database per test run backs the module-level `db` that
// services import, the way SQLITE_PATH=:memory: used to.
const testDb = await createTestDb();
process.env.DATABASE_URL = testDb.url;

afterAll(async () => {
  await closeDefaultDb();
  await testDb.drop();
});
