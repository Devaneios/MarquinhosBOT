import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, expect, it } from 'bun:test';
import { WordleGoalsService } from '../src/services/wordle/WordleGoalsService';

let testDb: TestDb;
let service: WordleGoalsService;
beforeAll(async () => {
  testDb = await createTestDb();
  service = new WordleGoalsService(testDb.db, () => 100);
});
afterAll(async () => {
  await testDb.drop();
});

it('creates a goal with a fixed positive target and a future time window', async () => {
  await expect(service.create('guild', 0, 200, 300)).rejects.toThrow();
  await expect(service.create('guild', 1, 99, 300)).rejects.toThrow();
  await expect(service.create('guild', 1, 200, 200)).rejects.toThrow();
  const goal = await service.create('guild', 2, 200, 300);
  expect(goal).toMatchObject({
    guildId: 'guild',
    target: 2,
    startsAt: 200,
    endsAt: 300,
    status: 'scheduled',
  });
  expect(await service.list('guild')).toEqual([goal]);
  expect(await service.list('other')).toEqual([]);
});
