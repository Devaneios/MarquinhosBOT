import { describe, expect, it } from 'bun:test';
import { ConnectFourBot } from 'services/activity/connectFour/ConnectFourBot';
import { ConnectFourEngine } from 'services/activity/connectFour/ConnectFourEngine';

describe('ConnectFourBot', () => {
  it('takes a winning move when one is available', () => {
    const engine = new ConnectFourEngine();
    engine.dropDisc(0, 'p1');
    engine.dropDisc(6, 'p2');
    engine.dropDisc(1, 'p1');
    engine.dropDisc(6, 'p2');
    engine.dropDisc(2, 'p1');
    engine.dropDisc(6, 'p2');

    const bot = new ConnectFourBot('p1');
    expect(bot.chooseColumn(engine)).toBe(3);
  });

  it('blocks an opponent about to win', () => {
    const engine = new ConnectFourEngine();
    engine.dropDisc(0, 'p1');
    engine.dropDisc(0, 'p2');
    engine.dropDisc(6, 'p1');
    engine.dropDisc(1, 'p2');
    engine.dropDisc(5, 'p1');
    engine.dropDisc(2, 'p2');

    const bot = new ConnectFourBot('p1');
    expect(bot.chooseColumn(engine)).toBe(3);
  });

  it('prefers the center column with no forcing move available', () => {
    const engine = new ConnectFourEngine();
    const bot = new ConnectFourBot('p1');
    expect(bot.chooseColumn(engine)).toBe(3);
  });

  it('returns null when the board is full', () => {
    const engine = new ConnectFourEngine();
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row < 6; row++) {
        const turn = engine.getState().currentTurn;
        if (engine.getState().winner) break;
        engine.dropDisc(col, turn);
      }
    }
    const bot = new ConnectFourBot('p1');
    if (!engine.getState().winner) {
      expect(bot.chooseColumn(engine)).toBeNull();
    }
  });
});
