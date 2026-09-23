import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { startContractServer } from '../helpers/contractServer';

const { callContract } = await import('@marquinhos/api-client/bot');
const wordle = await import('@marquinhos/contracts/http/routes/wordle');

const guildId = `contract-${randomUUID()}`;

let server: Awaited<ReturnType<typeof startContractServer>>;
let validGuess = '';

beforeAll(async () => {
  const { default: wordleRouter } =
    await import('../../src/routes/wordle.route');
  const { getValidationSet } = await import('../../src/services/wordle');
  server = await startContractServer((app) => {
    app.use('/api/wordle', wordleRouter);
  });
  const stats = await callContract(server.http, wordle.getStats, {
    params: { guildId },
  });
  validGuess =
    [...getValidationSet()].find(
      (word) => word.length === stats.data.wordLength,
    ) ?? '';
});

afterAll(() => server.close());

describe('wordle contracts', () => {
  it('reports the daily stats for a fresh guild', async () => {
    const response = await callContract(server.http, wordle.getStats, {
      params: { guildId },
    });

    expect(response.data.playersCount).toBe(0);
    expect(response.data.wordLength).toBeGreaterThanOrEqual(5);
  });

  it('validates, submits a guess and reads the session back', async () => {
    const validation = await callContract(server.http, wordle.validateGuess, {
      params: { guildId },
      query: { guess: validGuess },
    });
    const result = await callContract(server.http, wordle.submitGuess, {
      body: { userId: 'u1', guildId, guess: validGuess },
    });
    const session = await callContract(server.http, wordle.getUserSession, {
      params: { userId: 'u1', guildId },
    });

    expect(validation.data.valid).toBe(true);
    expect(result.data.attempts).toBe(1);
    expect(result.data.feedback).toHaveLength(validGuess.length);
    expect(session.data?.user_id).toBe('u1');
    expect(session.data?.guesses.map((row) => row.guess)).toEqual([
      result.data.guess,
    ]);
  });

  it('returns a null session for a user who has not played', async () => {
    const session = await callContract(server.http, wordle.getUserSession, {
      params: { userId: 'nobody', guildId },
    });

    expect(session.data).toBeNull();
  });

  it('serves day guesses and both leaderboard shapes', async () => {
    const dayGuesses = await callContract(server.http, wordle.getDayGuesses, {
      params: { guildId },
    });
    const daily = await callContract(server.http, wordle.getLeaderboard, {
      params: { guildId },
      query: { period: 'daily' },
    });
    const allTime = await callContract(server.http, wordle.getLeaderboard, {
      params: { guildId },
      query: { period: 'all-time' },
    });

    expect(dayGuesses.data?.wordLength).toBe(validGuess.length);
    expect(daily.data).toEqual([
      { userId: 'u1', attempts: 1, solved: expect.any(Boolean) },
    ]);
    expect(typeof daily.groupStreak).toBe('number');
    expect(Array.isArray(allTime.data)).toBe(true);
  });

  it('stores and reads the channel config', async () => {
    const saved = await callContract(server.http, wordle.setConfig, {
      body: { guildId, channelId: 'channel-1' },
    });
    const config = await callContract(server.http, wordle.getConfig, {
      params: { guildId },
    });

    expect(saved.message).toBe('Configuração salva.');
    expect(config.data).toEqual({ channelId: 'channel-1' });
  });

  it('claims an announcement once and reports streaks', async () => {
    const first = await callContract(server.http, wordle.markAnnounced, {
      body: { userId: 'u1', guildId },
    });
    const second = await callContract(server.http, wordle.markAnnounced, {
      body: { userId: 'u1', guildId },
    });
    const unannounced = await callContract(
      server.http,
      wordle.getUnannouncedWins,
      { params: { guildId } },
    );
    const streak = await callContract(server.http, wordle.getStreak, {
      params: { userId: 'u1', guildId },
    });

    expect(second.data.claimed).toBe(false);
    expect(typeof first.data.claimed).toBe('boolean');
    expect(unannounced.data.map((win) => win.userId)).not.toContain('u1');
    expect(streak.data.maxStreak).toBeGreaterThanOrEqual(0);
  });

  it('forces a new word and returns its stats', async () => {
    const response = await callContract(server.http, wordle.forceNewWord, {
      body: { guildId },
    });

    expect(response.data.stats.playersCount).toBe(0);
    expect(response.data.word).toHaveLength(response.data.wordLength);
  });

  it('serves the word pool and the review queue', async () => {
    const { db } = await import('@marquinhos/database/sqlite');
    db.run('DELETE FROM wordlist_review');
    const pool = await callContract(
      server.http,
      wordle.getWordlistPoolStats,
      {},
    );
    const next = await callContract(server.http, wordle.getNextReviewWord, {});

    const decided = await callContract(
      server.http,
      wordle.submitReviewDecision,
      { body: { word: next.data.word ?? '', decision: 'keep' } },
    );

    expect(pool.data.total).toBe(pool.data.used + pool.data.remaining);
    expect(next.data.word).not.toBeNull();
    expect(decided.data.index).toBe(next.data.index + 1);
  });
});
