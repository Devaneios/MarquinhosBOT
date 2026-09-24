import { db } from '@marquinhos/database/client';
import { xpConfig } from '@marquinhos/database/schema';
import { afterEach, beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { randomUUID } from 'crypto';
import { GamificationService } from 'services/gamification';

const COMMAND_XP = 5;
const COMMAND_COOLDOWN_MS = 60_000;

// Runs the real addXP against the shared test database; Date.now is pinned so
// the cooldown window is deterministic.
let nowSpy: ReturnType<typeof spyOn<DateConstructor, 'now'>> | undefined;

function at(timestamp: number) {
  nowSpy?.mockRestore();
  nowSpy = spyOn(Date, 'now').mockReturnValue(timestamp);
}

beforeAll(async () => {
  await db
    .insert(xpConfig)
    .values({
      event_type: 'command',
      xp_amount: COMMAND_XP,
      cooldown_ms: COMMAND_COOLDOWN_MS,
    })
    .onConflictDoUpdate({
      target: xpConfig.event_type,
      set: { xp_amount: COMMAND_XP, cooldown_ms: COMMAND_COOLDOWN_MS },
    });
});

afterEach(() => {
  nowSpy?.mockRestore();
  nowSpy = undefined;
});

describe('XP cooldown logic', () => {
  const service = new GamificationService();
  const guildId = () => `guild-${randomUUID()}`;

  it('grants XP on the first addXP call', async () => {
    const result = await service.addXP('user1', guildId(), 'command');
    expect(result.onCooldown).toBe(false);
    expect(result.userLevel.total_xp).toBe(COMMAND_XP);
  });

  it('refuses XP when the same call is made within the cooldown window', async () => {
    const guild = guildId();
    const now = 1_800_000_000_000;
    at(now);
    await service.addXP('user1', guild, 'command');
    at(now + 1000);
    const second = await service.addXP('user1', guild, 'command');
    expect(second.onCooldown).toBe(true);
    expect(second.userLevel.total_xp).toBe(COMMAND_XP);
  });

  it('grants XP again after the cooldown expires', async () => {
    const guild = guildId();
    const now = 1_800_000_000_000;
    at(now);
    await service.addXP('user1', guild, 'command');
    at(now + COMMAND_COOLDOWN_MS + 1000);
    const after = await service.addXP('user1', guild, 'command');
    expect(after.onCooldown).toBe(false);
    expect(after.userLevel.total_xp).toBe(COMMAND_XP * 2);
  });

  it('does not enforce the cooldown across different users', async () => {
    const guild = guildId();
    const now = 1_800_000_000_000;
    at(now);
    await service.addXP('user1', guild, 'command');
    at(now + 1000);
    const result = await service.addXP('user2', guild, 'command');
    expect(result.onCooldown).toBe(false);
  });

  it('grants a burst of concurrent calls exactly once, even within one millisecond', async () => {
    const guild = guildId();
    at(1_800_000_000_000);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => service.addXP('user1', guild, 'command')),
    );
    expect(results.filter((result) => !result.onCooldown)).toHaveLength(1);
  });
});

describe('recordGameResult', () => {
  const service = new GamificationService();

  it('awards XP once even when the same result is recorded twice at once', async () => {
    const guild = `guild-${randomUUID()}`;
    const input = {
      sessionId: randomUUID(),
      guildId: guild,
      gameType: 'tic-tac-toe',
      results: [
        { userId: 'winner', position: 1 },
        { userId: 'loser', position: 2 },
      ],
    };

    await Promise.allSettled([
      service.recordGameResult(input),
      service.recordGameResult(input),
    ]);

    const stats = await service.getUserGameStats('winner', guild);
    expect(stats.stats.total_games).toBe(1);
    expect(stats.stats.games_won).toBe(1);
  });
});
