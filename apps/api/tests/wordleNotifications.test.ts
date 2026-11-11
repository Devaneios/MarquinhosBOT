import { wordleNotifications } from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import {
  previousWordleWeek,
  WordleNotificationService,
} from '../src/modules/wordle/notifications/wordle-notification.service';

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
  await notifications.ambiguous('other', claimed!.id, claimed!.leaseId);
  expect(
    (
      await testDb.db
        .select()
        .from(wordleNotifications)
        .where(eq(wordleNotifications.id, claimed!.id))
    )[0]?.status,
  ).toBe('sending');
  await notifications.ambiguous('a', claimed!.id, claimed!.leaseId);
  expect(await notifications.claim('a')).toBeNull();
  expect((await notifications.uncertain('a')).map((item) => item.id)).toEqual([
    claimed!.id,
  ]);
  expect(
    await notifications.resolve('other', claimed!.id, 'found', 'message'),
  ).toBe(false);
  expect(
    await notifications.resolve('a', claimed!.id, 'found', 'message'),
  ).toBe(true);
  expect(await notifications.claim('a')).toBeNull();
});

it('marks expired leases uncertain so a crash cannot silently resend', async () => {
  await notifications.configure('b', {
    channelId: 'channel-b',
    collective: true,
    weekly: false,
  });
  await notifications.enqueue('b', 'goal', 'goal:p', { goalId: 'p' }, 1000);
  const claimed = await notifications.claim('b');
  now += 120_000;
  expect(await notifications.reapStale(60_000)).toBe(1);
  expect(await notifications.claim('b')).toBeNull();
  await notifications.resolve('b', claimed!.id, 'confirmed_absent');
  expect(await notifications.claim('b')).not.toBeNull();
});

it('accepts a late confirmed response for the same expired lease', async () => {
  await notifications.configure('late', {
    channelId: 'channel',
    collective: true,
    weekly: false,
  });
  await notifications.enqueue(
    'late',
    'goal',
    'goal:late',
    { goalId: 'late' },
    now,
  );
  const claimed = await notifications.claim('late');
  now += 120_000;
  await notifications.reapStale(60_000);
  await notifications.confirm(
    'late',
    claimed!.id,
    claimed!.leaseId,
    'discord-message',
  );
  expect(
    (
      await testDb.db
        .select()
        .from(wordleNotifications)
        .where(eq(wordleNotifications.id, claimed!.id))
    )[0],
  ).toMatchObject({ status: 'delivered', message_id: 'discord-message' });
});

it('allows a safe retry only when nothing was sent', async () => {
  await notifications.configure('retry', {
    channelId: 'channel',
    collective: true,
    weekly: false,
  });
  await notifications.enqueue(
    'retry',
    'goal',
    'goal:retry',
    { goalId: 'retry' },
    now,
  );
  const first = await notifications.claim('retry');
  await notifications.release('other', first!.id, first!.leaseId);
  expect(await notifications.claim('retry')).toBeNull();
  await notifications.release('retry', first!.id, first!.leaseId);
  const second = await notifications.claim('retry');
  expect(second?.id).toBe(first?.id);
  expect(second?.leaseId).not.toBe(first?.leaseId);
});

it('sends one nonempty weekly summary without enabling individual announcements', async () => {
  now = 1500;
  await notifications.configure('weekly', {
    channelId: 'channel',
    collective: false,
    weekly: true,
  });
  expect(
    await notifications.enqueue(
      'weekly',
      'goal',
      'goal:weekly',
      { goalId: 'weekly' },
      1600,
    ),
  ).toBe(true);
  expect(await notifications.claim('weekly')).toBeNull();
  now = 3000;
  expect(await notifications.queueWeekly('weekly', 'week-1', 1000, 2000)).toBe(
    true,
  );
  expect(await notifications.queueWeekly('weekly', 'week-1', 1000, 2000)).toBe(
    false,
  );
  expect(await notifications.queueWeekly('weekly', 'empty', 2000, 2500)).toBe(
    false,
  );
  const summary = await notifications.claim('weekly');
  expect(summary).toMatchObject({
    kind: 'weekly',
    payload: { goals: '1', pages: '0' },
  });
});

it('lets newer announcements proceed while a gallery is deferred or skipped', async () => {
  now = 3000;
  const guild = 'gallery-delivery';
  await notifications.configure(guild, {
    channelId: 'channel',
    collective: true,
    weekly: true,
  });
  const payload = { gallery: '1', week: '2026-10-26' };
  await notifications.enqueue(
    guild,
    'weekly',
    'gallery:2026-10-26',
    payload,
    1000,
  );
  await notifications.enqueue(guild, 'goal', 'goal:1', {}, 2000);
  const gallery = (await notifications.claim(guild))!;
  expect(gallery.eventKey).toBe('gallery:2026-10-26');
  expect(
    await notifications.release(
      guild,
      gallery.id,
      gallery.leaseId,
      'retry_later',
    ),
  ).toBe(true);
  expect((await notifications.claim(guild))?.eventKey).toBe('goal:1');
  expect(await notifications.claim(guild)).toBeNull();

  now += 5 * 60_000;
  const retry = (await notifications.claim(guild))!;
  expect(retry.id).toBe(gallery.id);
  expect(
    await notifications.release(guild, retry.id, retry.leaseId, 'skipped'),
  ).toBe(true);
  expect(
    await notifications.enqueue(
      guild,
      'weekly',
      gallery.eventKey,
      payload,
      now,
    ),
  ).toBe(false);
  expect(await notifications.claim(guild)).toBeNull();
});

it('uses a completed Monday-to-Monday week in the Wordle time zone', () => {
  expect(previousWordleWeek(Date.parse('2026-11-02T03:00:00Z'))).toEqual({
    weekKey: '2026-10-26',
    startsAt: Date.parse('2026-10-26T03:00:00Z'),
    endsAt: Date.parse('2026-11-02T03:00:00Z'),
  });
  expect(previousWordleWeek(Date.parse('2026-11-02T02:59:59Z')).weekKey).toBe(
    '2026-10-19',
  );
});
