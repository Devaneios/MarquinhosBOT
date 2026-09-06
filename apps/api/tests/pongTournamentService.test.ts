import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PongTournamentService } from 'services/activity/pong/PongTournamentService';

function database(): Database {
  const db = new Database(':memory:');
  db.run(
    readFileSync(
      join(process.cwd(), 'src/database/migrations/003_pong_competitive.sql'),
      'utf8',
    ),
  );
  db.run(
    readFileSync(
      join(
        process.cwd(),
        'src/database/migrations/004_pong_tournament_sources.sql',
      ),
      'utf8',
    ),
  );
  return db;
}

describe('PongTournamentService', () => {
  it('seeds and persists a round robin from current ratings', () => {
    const db = database();
    db.query(
      `INSERT INTO pong_ratings
       (user_id, guild_id, pool, rating, deviation, volatility, matches, wins, updated_at)
       VALUES (?, 'guild-1', 'classic-1v1', ?, 80, 0.06, 10, 5, 1)`,
    ).run('high', 1800);
    const service = new PongTournamentService(db);

    const tournament = service.create({
      guildId: 'guild-1',
      name: 'Friday Pong',
      format: 'round-robin',
      pool: 'classic-1v1',
      createdBy: 'host',
      playerIds: ['low', 'high', 'mid'],
    })!;

    expect(tournament.entries[0]).toMatchObject({ userId: 'high', seed: 1 });
    expect(tournament.matches).toHaveLength(3);
    expect(
      tournament.matches.every((match: any) => match.status === 'ready'),
    ).toBe(true);
  });

  it('completes round robin after every scheduled match is reported', () => {
    const service = new PongTournamentService(database());
    let tournament = service.create({
      guildId: 'guild-1',
      name: 'League',
      format: 'round-robin',
      pool: 'classic-1v1',
      createdBy: 'host',
      playerIds: ['a', 'b', 'c'],
    })!;

    for (const match of tournament.matches as any[]) {
      tournament = service.report(match.id, match.playerA, 'host')!;
    }

    expect(tournament.status).toBe('complete');
    expect(
      (tournament.entries as any[]).reduce(
        (sum, entry) => sum + entry.score,
        0,
      ),
    ).toBe(3);
  });

  it('creates a seeded top-four playoff after the final Swiss round', () => {
    const service = new PongTournamentService(database());
    let tournament = service.create({
      guildId: 'guild-1',
      name: 'Swiss Cup',
      format: 'swiss-playoff',
      pool: 'classic-1v1',
      createdBy: 'host',
      playerIds: ['a', 'b', 'c', 'd'],
      swissRounds: 1,
    })!;
    const swiss = (tournament.matches as any[]).filter(
      (match) => match.bracket === 'swiss',
    );

    for (const match of swiss) {
      tournament = service.report(match.id, match.playerA, 'host')!;
    }

    expect(
      (tournament.matches as any[]).filter(
        (match) => match.bracket === 'playoff',
      ),
    ).toHaveLength(3);
  });

  it('rejects reports from users outside the match', () => {
    const service = new PongTournamentService(database());
    const tournament = service.create({
      guildId: 'guild-1',
      name: 'Protected',
      format: 'round-robin',
      pool: 'classic-1v1',
      createdBy: 'host',
      playerIds: ['a', 'b'],
    })!;
    const match = (tournament.matches as any[])[0];

    expect(() => service.report(match.id, 'a', 'outsider')).toThrow();
  });

  it('requires a bracket reset when the lower finalist wins grand final one', () => {
    const service = new PongTournamentService(database());
    let tournament = service.create({
      guildId: 'guild-1',
      name: 'Double',
      format: 'double-elimination',
      pool: 'classic-1v1',
      createdBy: 'host',
      playerIds: ['a', 'b', 'c', 'd'],
    })!;
    while (true) {
      const ready = (tournament.matches as any[]).find(
        (match) => match.status === 'ready' && match.bracket !== 'grand-final',
      );
      if (!ready) break;
      tournament = service.report(ready.id, ready.playerA, 'host')!;
    }
    const grandFinal = (tournament.matches as any[]).find(
      (match) => match.bracket === 'grand-final' && match.round === 1,
    );

    tournament = service.report(grandFinal.id, grandFinal.playerB, 'host')!;

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
