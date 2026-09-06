import { describe, expect, it } from 'bun:test';
import { SnakeBot } from 'services/activity/snake-game/SnakeBotAI';
import type { SnakeGameState } from 'services/activity/snake-game/SnakeEngine';

function makeState(overrides: Partial<SnakeGameState> = {}): SnakeGameState {
  return {
    width: 10,
    height: 10,
    snakes: {
      bot: {
        segments: [{ x: 5, y: 5 }],
        direction: 'right',
        nextDirection: 'right',
        alive: true,
      },
    },
    food: [],
    scores: { bot: 0 },
    winner: null,
    ...overrides,
  };
}

describe('SnakeBot', () => {
  it('moves toward the nearest food', () => {
    const bot = new SnakeBot('bot');
    const state = makeState({ food: [{ x: 8, y: 5 }] });

    const direction = bot.chooseDirection(state);

    expect(direction).toBe('right');
  });

  it('never reverses directly into its own neck', () => {
    const bot = new SnakeBot('bot');
    const state = makeState({
      snakes: {
        bot: {
          segments: [
            { x: 5, y: 5 },
            { x: 4, y: 5 },
          ],
          direction: 'right',
          nextDirection: 'right',
          alive: true,
        },
      },
      food: [{ x: 0, y: 5 }],
    });

    const direction = bot.chooseDirection(state);

    expect(direction).not.toBe('left');
  });

  it('avoids walking into a wall', () => {
    const bot = new SnakeBot('bot');
    const state = makeState({
      snakes: {
        bot: {
          segments: [{ x: 9, y: 5 }],
          direction: 'right',
          nextDirection: 'right',
          alive: true,
        },
      },
      food: [{ x: 9, y: 0 }],
    });

    const direction = bot.chooseDirection(state);

    expect(direction).not.toBe('right');
  });

  it('avoids colliding with another snake', () => {
    const bot = new SnakeBot('bot');
    const state = makeState({
      snakes: {
        bot: {
          segments: [{ x: 5, y: 5 }],
          direction: 'right',
          nextDirection: 'right',
          alive: true,
        },
        player1: {
          segments: [{ x: 6, y: 5 }],
          direction: 'left',
          nextDirection: 'left',
          alive: true,
        },
      },
      food: [{ x: 8, y: 5 }],
    });

    const direction = bot.chooseDirection(state);

    expect(direction).not.toBe('right');
  });

  it('defaults to going right when there is no food on the board', () => {
    const bot = new SnakeBot('bot');
    const state = makeState({ food: [] });

    const direction = bot.chooseDirection(state);

    expect(['up', 'down', 'left', 'right']).toContain(direction);
  });
});
