import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, expect, it } from 'bun:test';
import { WordleNotificationService } from '../src/services/wordle/WordleNotificationService';

let testDb: TestDb;
let now = 1000;
let notifications: WordleNotificationService;
beforeAll(async () => {
  testDb = await createTestDb();
  notifications = new WordleNotificationService(testDb.db, () => now);
});
afterAll(async () => {
  await testDb.drop();
});

it('queues opted-in events once and waits for a configured channel', async () => {
  expect(
    await notifications.enqueue('a', 'goal', 'goal:1', { goalId: '1' }, 1000),
  ).toBe(false);
  await notifications.configure('a', {
    channelId: null,
    collective: true,
    weekly: false,
  });
  expect(
    await notifications.enqueue('a', 'goal', 'goal:1', { goalId: '1' }, 1000),
  ).toBe(true);
  expect(
    await notifications.enqueue('a', 'goal', 'goal:1', { goalId: '1' }, 1000),
  ).toBe(false);
  expect(await notifications.claim('a')).toBeNull();
  await notifications.configure('a', {
    channelId: 'channel',
    collective: true,
    weekly: false,
  });
  const claimed = await notifications.claim('a');
  expect(claimed).toMatchObject({
    channelId: 'channel',
    eventKey: 'goal:1',
    status: 'sending',
  });
  expect(await notifications.claim('a')).toBeNull();
  await notifications.ambiguous(claimed!.id, claimed!.leaseId);
  expect(await notifications.claim('a')).toBeNull();
  await notifications.resolve(claimed!.id, 'found');
  expect(await notifications.claim('a')).toBeNull();
});

it('marks expired leases uncertain so a crash cannot silently resend', async () => {
  await notifications.configure('b', {
    channelId: 'channel-b',
    collective: true,
    weekly: false,
  });
  await notifications.enqueue('b', 'page', 'page:p', { patternId: 'p' }, 1000);
  const claimed = await notifications.claim('b');
  now += 120_000;
  expect(await notifications.reapStale(60_000)).toBe(1);
  expect(await notifications.claim('b')).toBeNull();
  await notifications.resolve(claimed!.id, 'confirmed_absent');
  expect(await notifications.claim('b')).not.toBeNull();
});
