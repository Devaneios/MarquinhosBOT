import { describe, expect, it } from 'bun:test';
import type { ActivityMode } from 'services/activity/gameId';
import {
  WordSearchRaceSession,
  type WordSearchRaceSessionIdentity,
} from 'services/activity/word-search-race/WordSearchRaceSession';
import type { GamificationService } from 'services/gamification';

function identity(mode: ActivityMode = 'multi'): WordSearchRaceSessionIdentity {
  return {
    sessionKey: `inst-1:word-search-race:${mode}`,
    instanceId: 'inst-1',
    guildId: 'guild-1',
    mode,
  };
}

function fakeBroadcaster() {
  const messages: {
    key: string;
    message: { type: string; payload?: unknown };
  }[] = [];
  return {
    broadcast: (key: string, message: { type: string; payload?: unknown }) => {
      messages.push({ key, message });
    },
    messages,
  };
}

function fakeGamification() {
  const recorded: unknown[] = [];
  return {
    stub: {
      recordGameResult: (input: unknown) => recorded.push(input),
    } as unknown as GamificationService,
    recorded,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('WordSearchRaceSession', () => {
  it('rejects a selection from a player not registered in the room', () => {
    const broadcaster = fakeBroadcaster();
    const session = new WordSearchRaceSession(identity(), broadcaster);

    const result = session.submitSelection(
      'ghost',
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    );

    expect(result).toEqual({ error: 'Player not in room' });
  });

  it('broadcasts word_found with the finder and updated scores on a valid selection', () => {
    const broadcaster = fakeBroadcaster();
    const session = new WordSearchRaceSession(identity(), broadcaster);
    session.addPlayer('user-a', {});

    const grid = session.getPublicState().grid;
    const words = session.getPublicState().words;
    const { start, end } = locate(grid, words[0]!);

    const result = session.submitSelection('user-a', start, end);

    expect('error' in (result as object)).toBe(false);
    const found = broadcaster.messages.find(
      (m) => m.message.type === 'word_found',
    );
    expect(found).toBeTruthy();
    const payload = found!.message.payload as {
      userId: string;
      scores: Record<string, number>;
    };
    expect(payload.userId).toBe('user-a');
    expect(payload.scores).toEqual({ 'user-a': 1 });
  });

  it('ends the game and records gamification results once every word is found', () => {
    const broadcaster = fakeBroadcaster();
    const { stub, recorded } = fakeGamification();
    const session = new WordSearchRaceSession(identity(), broadcaster, stub);
    session.addPlayer('user-a', {});

    const state = session.getPublicState();
    for (const word of state.words) {
      const { start, end } = locate(session.getPublicState().grid, word);
      session.submitSelection('user-a', start, end);
    }

    const gameOver = broadcaster.messages.find(
      (m) => m.message.type === 'game_over',
    );
    expect(gameOver).toBeTruthy();
    expect((gameOver!.message.payload as { reason: string }).reason).toBe(
      'completed',
    );
    expect(recorded.length).toBe(1);
  });

  it('rejects further selections after the game has ended', () => {
    const broadcaster = fakeBroadcaster();
    const { stub } = fakeGamification();
    const session = new WordSearchRaceSession(identity(), broadcaster, stub);
    session.addPlayer('user-a', {});

    const state = session.getPublicState();
    for (const word of state.words) {
      const { start, end } = locate(session.getPublicState().grid, word);
      session.submitSelection('user-a', start, end);
    }

    const result = session.submitSelection(
      'user-a',
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    );
    expect(result).toEqual({ error: 'Game has already ended' });
  });

  it('ends the game on the time limit even if words remain unfound', async () => {
    const broadcaster = fakeBroadcaster();
    const { stub, recorded } = fakeGamification();
    const session = new WordSearchRaceSession(identity(), broadcaster, stub, {
      timeLimitMs: 10,
    });
    session.addPlayer('user-a', {});

    await wait(50);

    const gameOver = broadcaster.messages.find(
      (m) => m.message.type === 'game_over',
    );
    expect(gameOver).toBeTruthy();
    expect((gameOver!.message.payload as { reason: string }).reason).toBe(
      'timeout',
    );
    expect(recorded.length).toBe(1);
  });

  it('disposes the session once the last connection of the last player leaves', async () => {
    const broadcaster = fakeBroadcaster();
    let ended = false;
    const session = new WordSearchRaceSession(
      identity(),
      broadcaster,
      undefined,
      {
        onSessionEnded: () => {
          ended = true;
        },
        emptyRoomGraceMs: 0,
      },
    );
    const conn = {};
    session.addPlayer('user-a', conn);

    session.removePlayer('user-a', conn);
    expect(ended).toBe(false);
    expect(session.playerCount).toBe(0);

    // The empty-room grace timer defers `onSessionEnded` by a tick (see
    // WordSearchRaceSession) to absorb React StrictMode's dev-only phantom
    // mount/unmount — flush it here.
    await wait(0);
    expect(ended).toBe(true);
  });
});

function locate(
  grid: string[][],
  word: string,
): { start: { row: number; col: number }; end: { row: number; col: number } } {
  const size = grid.length;
  const directions = [
    { row: -1, col: -1 },
    { row: -1, col: 0 },
    { row: -1, col: 1 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
    { row: 1, col: -1 },
    { row: 1, col: 0 },
    { row: 1, col: 1 },
  ];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      for (const dir of directions) {
        const end = {
          row: row + dir.row * (word.length - 1),
          col: col + dir.col * (word.length - 1),
        };
        if (end.row < 0 || end.row >= size || end.col < 0 || end.col >= size) {
          continue;
        }
        let letters = '';
        for (let i = 0; i < word.length; i++) {
          letters += grid[row + dir.row * i]![col + dir.col * i];
        }
        if (letters === word) return { start: { row, col }, end };
      }
    }
  }
  throw new Error(`word ${word} not found on grid`);
}
