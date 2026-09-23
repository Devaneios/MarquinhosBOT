import { describe, expect, it } from 'bun:test';
import { battleshipAdapter } from 'realtime/adapters/battleshipAdapter';
import { boggleAdapter } from 'realtime/adapters/boggleAdapter';
import { cardTableAdapter } from 'realtime/adapters/cardTableAdapter';
import { checkersAdapter } from 'realtime/adapters/checkersAdapter';
import { connectFourAdapter } from 'realtime/adapters/connectFourAdapter';
import { dominoesAdapter } from 'realtime/adapters/dominoesAdapter';
import { hangmanAdapter } from 'realtime/adapters/hangmanAdapter';
import { minesweeperAdapter } from 'realtime/adapters/minesweeperAdapter';
import { pongAdapter } from 'realtime/adapters/pongAdapter';
import { rpsAdapter } from 'realtime/adapters/rpsAdapter';
import { snakeAdapter } from 'realtime/adapters/snakeAdapter';
import { ticTacToeAdapter } from 'realtime/adapters/ticTacToeAdapter';
import { towerUnstableAdapter } from 'realtime/adapters/towerUnstableAdapter';
import { triviaQuizAdapter } from 'realtime/adapters/triviaQuizAdapter';
import { wordChainAdapter } from 'realtime/adapters/wordChainAdapter';
import { wordleRaceAdapter } from 'realtime/adapters/wordleRaceAdapter';
import { wordSearchRaceAdapter } from 'realtime/adapters/wordSearchRaceAdapter';
import type { AdapterContext, GameRoomAdapter } from 'realtime/GameRoomAdapter';
import type { WsSessionPayload } from 'services/activity/wsSessionToken';

const auth: WsSessionPayload = {
  userId: 'user-1',
  instanceId: 'inst-1',
  guildId: 'guild-1',
  mode: 'multi',
  game: 'pong',
  roomId: 'ROOM01',
};

function makeCtx(overrides: Partial<AdapterContext> = {}): AdapterContext {
  return {
    roomKey: 'multi:inst-1:ROOM01',
    instanceId: 'inst-1',
    guildId: 'guild-1',
    mode: 'multi',
    broadcast: () => {},
    broadcastBinary: () => {},
    sendToPlayer: () => {},
    onSessionEnded: () => {},
    ...overrides,
  };
}

// Replaces one session method with a recorder so each case asserts exactly
// what the handler forwarded (or that it forwarded nothing).
function harness<TSession>(
  adapter: GameRoomAdapter<TSession>,
  method: string,
  returnValue: unknown,
  ctx: AdapterContext = makeCtx(),
) {
  const { session, messageHandlers } = adapter.setup(ctx);
  const calls: unknown[][] = [];
  (session as any)[method] = (...args: unknown[]) => {
    calls.push(args);
    return returnValue;
  };
  const sent: [string, unknown][] = [];
  const client = {
    send: (type: string, payload: unknown) => sent.push([type, payload]),
  } as any;
  return {
    send(type: string, payload: unknown) {
      messageHandlers[type]!.handle(auth, client, payload);
    },
    calls,
    sent,
    dispose: () => adapter.onDispose(session),
  };
}

describe('battleship adapter payloads', () => {
  const placements = [
    { type: 'carrier', x: 0, y: 0, orientation: 'horizontal' },
    { type: 'battleship', x: 0, y: 1, orientation: 'horizontal' },
    { type: 'cruiser', x: 0, y: 2, orientation: 'horizontal' },
    { type: 'submarine', x: 0, y: 3, orientation: 'horizontal' },
    { type: 'destroyer', x: 0, y: 4, orientation: 'horizontal' },
  ];

  it('forwards well-formed placements', () => {
    const h = harness(battleshipAdapter, 'placeShips', undefined);
    h.send('place_ships', { placements });
    expect(h.calls).toEqual([['user-1', placements]]);
    h.dispose();
  });

  it('rejects placements whose elements are malformed', () => {
    const h = harness(battleshipAdapter, 'placeShips', undefined);
    h.send('place_ships', { placements: [null] });
    h.send('place_ships', { placements: [{ ...placements[0], x: '1' }] });
    h.send('place_ships', { placements: 'nope' });
    expect(h.calls).toEqual([]);
    expect(h.sent).toEqual([
      ['placement_error', { message: 'Invalid ship placements' }],
      ['placement_error', { message: 'Invalid ship placements' }],
      ['placement_error', { message: 'Invalid ship placements' }],
    ]);
    h.dispose();
  });

  it('forwards numeric fire coordinates and drops anything else', () => {
    const h = harness(battleshipAdapter, 'fire', undefined);
    h.send('fire', { x: 3, y: 4 });
    h.send('fire', { x: '3', y: 4 });
    h.send('fire', null);
    expect(h.calls).toEqual([['user-1', 3, 4]]);
    h.dispose();
  });
});

describe('boggle adapter payloads', () => {
  it('forwards a valid path and rejects malformed ones', () => {
    const h = harness(boggleAdapter, 'submitWord', { accepted: true });
    h.send('submit_word', {
      path: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
      ],
    });
    h.send('submit_word', { path: [] });
    h.send('submit_word', { path: [{ row: 0.5, col: 0 }] });
    h.send('submit_word', { path: 'abc' });
    expect(h.calls).toEqual([
      [
        'user-1',
        [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
        ],
      ],
    ]);
    expect(h.sent.filter(([type]) => type === 'submit_error')).toEqual([
      ['submit_error', { message: 'Invalid path' }],
      ['submit_error', { message: 'Invalid path' }],
      ['submit_error', { message: 'Invalid path' }],
    ]);
    h.dispose();
  });
});

describe('card table adapter payloads', () => {
  it('forwards a string move with its args and drops the rest', () => {
    const h = harness(
      cardTableAdapter,
      'handleMove',
      undefined,
      makeCtx({ ruleset: 'truco' }),
    );
    h.send('move', { move: 'play', args: { cardId: 'c1' } });
    h.send('move', { move: 'fold' });
    h.send('move', { move: '' });
    h.send('move', { move: 7 });
    h.send('move', null);
    expect(h.calls).toEqual([
      ['user-1', 'play', { cardId: 'c1' }],
      ['user-1', 'fold', undefined],
    ]);
    h.dispose();
  });
});

describe('checkers adapter payloads', () => {
  it('forwards integer positions and drops malformed ones', () => {
    const h = harness(checkersAdapter, 'requestMove', { ok: true });
    h.send('move', { from: { row: 5, col: 0 }, to: { row: 4, col: 1 } });
    h.send('move', { from: { row: 5, col: 0 }, to: { row: 4.5, col: 1 } });
    h.send('move', { from: null, to: { row: 4, col: 1 } });
    expect(h.calls).toEqual([
      ['user-1', { row: 5, col: 0 }, { row: 4, col: 1 }],
    ]);
    h.dispose();
  });
});

describe('connect four adapter payloads', () => {
  it('forwards a numeric column and rejects anything else', () => {
    const h = harness(connectFourAdapter, 'dropDisc', true);
    h.send('drop', { col: 3 });
    h.send('drop', { col: '3' });
    h.send('drop', {});
    expect(h.calls).toEqual([['user-1', 3]]);
    expect(h.sent).toEqual([
      ['move_rejected', { col: undefined }],
      ['move_rejected', { col: undefined }],
    ]);
    h.dispose();
  });
});

describe('dominoes adapter payloads', () => {
  it('forwards a valid tile and rejects malformed tiles or ends', () => {
    const h = harness(dominoesAdapter, 'playTile', undefined);
    h.send('play', { tile: { a: 1, b: 6 }, end: 'left' });
    h.send('play', { tile: { a: 1, b: 7 } });
    h.send('play', { tile: { a: 1, b: 6 }, end: 'middle' });
    expect(h.calls).toEqual([['user-1', { a: 1, b: 6 }, 'left']]);
    expect(h.sent).toEqual([
      ['move_rejected', { reason: 'Malformed tile' }],
      ['move_rejected', { reason: 'Malformed end' }],
    ]);
    h.dispose();
  });
});

describe('hangman adapter payloads', () => {
  it('forwards a string letter and rejects a non-string one', () => {
    const h = harness(hangmanAdapter, 'guessLetter', { success: true });
    h.send('guess', { letter: 'a' });
    h.send('guess', { letter: 5 });
    expect(h.calls).toEqual([['user-1', 'a']]);
    expect(h.sent).toEqual([
      ['guess_success', {}],
      ['guess_error', { message: 'Invalid letter' }],
    ]);
    h.dispose();
  });
});

describe('minesweeper adapter payloads', () => {
  it('forwards integer coordinates and rejects the rest', () => {
    const h = harness(minesweeperAdapter, 'reveal', {});
    h.send('reveal', { x: 1, y: 2 });
    h.send('reveal', { x: 1.5, y: 2 });
    expect(h.calls).toEqual([['user-1', 1, 2]]);
    expect(h.sent).toEqual([
      ['reveal_error', { message: 'Invalid tile coordinates' }],
    ]);
    h.dispose();
  });
});

describe('pong adapter payloads', () => {
  it('forwards a valid input and drops invalid ones', () => {
    const h = harness(pongAdapter, 'handleInput', undefined);
    h.send('input', { seq: 4, direction: -1, side: 'left', target: 12.5 });
    h.send('input', { seq: 5, action: 'release' });
    h.send('input', { seq: -1 });
    h.send('input', { seq: 1, direction: 2 });
    h.send('input', { seq: 1, side: 'middle' });
    h.send('input', { seq: 1, target: Infinity });
    h.send('input', null);
    expect(h.calls).toEqual([
      ['user-1', -1, 4, 'left', 12.5, false],
      ['user-1', 0, 5, undefined, undefined, true],
    ]);
    h.dispose();
  });

  it('reads ready as true only for a literal true', () => {
    const h = harness(pongAdapter, 'setReady', undefined);
    h.send('ready', { ready: true });
    h.send('ready', { ready: 'yes' });
    h.send('ready', null);
    expect(h.calls).toEqual([
      ['user-1', true],
      ['user-1', false],
      ['user-1', false],
    ]);
    h.dispose();
  });

  it('keeps only the valid lobby config fields', () => {
    const h = harness(pongAdapter, 'configure', undefined);
    h.send('lobby_config', {
      ruleset: 'nope',
      targetScore: 7,
      bestOf: 2,
      ranked: true,
    });
    h.send('lobby_config', { targetScore: 100, bestOf: 5 });
    h.send('lobby_config', null);
    expect(h.calls).toEqual([
      ['user-1', { targetScore: 7, ranked: true }],
      ['user-1', { bestOf: 5 }],
      ['user-1', {}],
    ]);
    h.dispose();
  });
});

describe('rps adapter payloads', () => {
  it('forwards a string pick and rejects a non-string one', () => {
    const h = harness(rpsAdapter, 'submitPick', true);
    h.send('pick', { pick: 'rock' });
    h.send('pick', { pick: { rock: true } });
    expect(h.calls).toEqual([['user-1', 'rock']]);
    expect(h.sent).toEqual([['error', { message: 'Invalid move' }]]);
    h.dispose();
  });
});

describe('snake adapter payloads', () => {
  it('forwards a valid direction and rejects the rest', () => {
    const h = harness(snakeAdapter, 'handleInput', undefined);
    h.send('input', { direction: 'up' });
    h.send('input', { direction: 'sideways' });
    expect(h.calls).toEqual([['user-1', 'up']]);
    expect(h.sent).toEqual([['input_error', { message: 'Invalid direction' }]]);
    h.dispose();
  });
});

describe('tic tac toe adapter payloads', () => {
  it('forwards numeric coordinates and rejects malformed ones', () => {
    const h = harness(ticTacToeAdapter, 'handleMove', { ok: true });
    h.send('move', { row: 1, col: 2 });
    h.send('move', { row: '1', col: 2 });
    expect(h.calls).toEqual([['user-1', 1, 2]]);
    expect(h.sent).toEqual([['action_rejected', { error: 'Invalid move' }]]);
    h.dispose();
  });
});

describe('tower unstable adapter payloads', () => {
  it('forwards integer coordinates and rejects the rest', () => {
    const h = harness(towerUnstableAdapter, 'handlePull', { ok: true });
    h.send('pull', { level: 2, position: 1 });
    h.send('pull', { level: 2, position: 1.5 });
    expect(h.calls).toEqual([['user-1', 2, 1]]);
    expect(h.sent).toEqual([
      ['action_rejected', { error: 'Invalid pull coordinates' }],
    ]);
    h.dispose();
  });
});

describe('trivia quiz adapter payloads', () => {
  it('forwards a non-negative answer index and drops the rest', () => {
    const h = harness(triviaQuizAdapter, 'handleAnswer', undefined);
    h.send('answer', { answerIndex: 2 });
    h.send('answer', { answerIndex: -1 });
    h.send('answer', { answerIndex: '2' });
    h.send('answer', null);
    expect(h.calls.map((call) => call.slice(0, 2))).toEqual([['user-1', 2]]);
    h.dispose();
  });
});

describe('word chain adapter payloads', () => {
  it('forwards a string word and rejects a non-string one', () => {
    const h = harness(wordChainAdapter, 'handleWordSubmission', { ok: true });
    h.send('word', { word: 'casa' });
    h.send('word', { word: 42 });
    expect(h.calls).toEqual([['user-1', 'casa']]);
    expect(h.sent).toEqual([['action_rejected', { error: 'Invalid word' }]]);
    h.dispose();
  });
});

describe('wordle race adapter payloads', () => {
  it('forwards a string guess and rejects a non-string one', () => {
    const h = harness(wordleRaceAdapter, 'submitGuess', { ok: true });
    h.send('guess', { guess: 'termo' });
    h.send('guess', { guess: 42 });
    expect(h.calls).toEqual([['user-1', 'termo']]);
    expect(h.sent).toEqual([['action_rejected', { error: 'Invalid guess' }]]);
    h.dispose();
  });
});

describe('word search race adapter payloads', () => {
  it('forwards integer cells and rejects malformed ones', () => {
    const h = harness(wordSearchRaceAdapter, 'submitSelection', { ok: true });
    h.send('select', { start: { row: 0, col: 0 }, end: { row: 0, col: 3 } });
    h.send('select', { start: { row: 0, col: 0 }, end: null });
    expect(h.calls).toEqual([
      ['user-1', { row: 0, col: 0 }, { row: 0, col: 3 }],
    ]);
    expect(h.sent.filter(([type]) => type === 'select_error')).toEqual([
      ['select_error', { message: 'Invalid selection' }],
    ]);
    h.dispose();
  });
});
