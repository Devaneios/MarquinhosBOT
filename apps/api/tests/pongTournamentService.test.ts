import { pongRatings } from '@marquinhos/database/schema';
import { describe, expect, it } from 'bun:test';
import { PongTournamentService } from 'services/activity/pong/PongTournamentService';
import { useTestDb } from './helpers/testDb';

const testDb = useTestDb();

describe('PongTournamentService', () => {
  it('seeds and persists a round robin from current ratings', async () => {
    await testDb.current.db.insert(pongRatings).values({
      user_id: 'high',
      guild_id: 'guild-1',
      pool: 'classic-1v1',
      rating: 1800,
      deviation: 80,
      volatility: 0.06,
      matches: 10,
      wins: 5,
      updated_at: 1,
    });
    const service = new PongTournamentService(testDb.current.db);

    const tournament = (await service.create({
      guildId: 'guild-1',
      name: 'Friday Pong',
      format: 'round-robin',
      pool: 'classic-1v1',
      createdBy: 'host',
      playerIds: ['low', 'high', 'mid'],
    }))!;

    expect(tournament.entries[0]).toMatchObject({ userId: 'high', seed: 1 });
    expect(tournament.matches).toHaveLength(3);
    expect(
      tournament.matches.every((match: any) => match.status === 'ready'),
    ).toBe(true);
  });

  it('completes round robin after every scheduled match is reported', async () => {
    const service = new PongTournamentService(testDb.current.db);
    let tournament = (await service.create({
      guildId: 'guild-1',
      name: 'League',
      format: 'round-robin',
      pool: 'classic-1v1',
      createdBy: 'host',
      playerIds: ['a', 'b', 'c'],
    }))!;

    for (const match of tournament.matches as any[]) {
      tournament = (await service.report(match.id, match.playerA, 'host'))!;
    }

    expect(tournament.status).toBe('complete');
    expect(
      (tournament.entries as any[]).reduce(
        (sum, entry) => sum + entry.score,
        0,
      ),
    ).toBe(3);
  });

  it('creates a seeded top-four playoff after the final Swiss round', async () => {
    const service = new PongTournamentService(testDb.current.db);
    let tournament = (await service.create({
      guildId: 'guild-1',
      name: 'Swiss Cup',
      format: 'swiss-playoff',
      pool: 'classic-1v1',
      createdBy: 'host',
      playerIds: ['a', 'b', 'c', 'd'],
      swissRounds: 1,
    }))!;
    const swiss = (tournament.matches as any[]).filter(
      (match) => match.bracket === 'swiss',
    );

    for (const match of swiss) {
      tournament = (await service.report(match.id, match.playerA, 'host'))!;
    }

    expect(
      (tournament.matches as any[]).filter(
        (match) => match.bracket === 'playoff',
      ),
    ).toHaveLength(3);
  });

  it('rejects reports from users outside the match', async () => {
    const service = new PongTournamentService(testDb.current.db);
    const tournament = (await service.create({
      guildId: 'guild-1',
      name: 'Protected',
      format: 'round-robin',
      pool: 'classic-1v1',
      createdBy: 'host',
      playerIds: ['a', 'b'],
    }))!;
    const match = (tournament.matches as any[])[0];

    await expect(service.report(match.id, 'a', 'outsider')).rejects.toThrow();
  });

  it('requires a bracket reset when the lower finalist wins grand final one', async () => {
    const service = new PongTournamentService(testDb.current.db);
    let tournament = (await service.create({
      guildId: 'guild-1',
      name: 'Double',
      format: 'double-elimination',
      pool: 'classic-1v1',
      createdBy: 'host',
      playerIds: ['a', 'b', 'c', 'd'],
    }))!;
    while (true) {
      const ready = (tournament.matches as any[]).find(
        (match) => match.status === 'ready' && match.bracket !== 'grand-final',
      );
      if (!ready) break;
      tournament = (await service.report(ready.id, ready.playerA, 'host'))!;
    }
    const grandFinal = (tournament.matches as any[]).find(
      (match) => match.bracket === 'grand-final' && match.round === 1,
    );

    tournament = (await service.report(
      grandFinal.id,
      grandFinal.playerB,
      'host',
    ))!;

    expect(
      (tournament.matches as any[]).some(
        (match) =>
          match.bracket === 'grand-final' &&
          match.round === 2 &&
          match.status === 'ready',
      ),
    ).toBe(true);
    expect(tournament.status).toBe('active');
  });
});
