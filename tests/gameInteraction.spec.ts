import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  spyOn,
} from 'bun:test';
import { GameManager } from '../src/game/core/GameManager';
import { GameType } from '../src/game/core/GameTypes';
import { UserFacingError } from '../src/game/core/UserFacingError';
import { handleGameInteraction } from '../src/lib/gameInteraction';
import * as errorHandling from '../src/utils/errorHandling';

// gameInteraction.ts captures GameManager.getInstance() once at import time,
// so tests must reuse that same singleton rather than resetting it.
let manager: GameManager;
let sessionIds: string[] = [];
const reportErrorSpy = spyOn(errorHandling, 'reportError').mockImplementation(
  () => {},
);

beforeEach(() => {
  manager = GameManager.getInstance();
  sessionIds = [];
  reportErrorSpy.mockClear();
});

afterEach(() => {
  sessionIds.forEach((id) => manager.endSession(id));
});

afterAll(() => {
  reportErrorSpy.mockRestore();
});

describe('handleGameInteraction error escalation', () => {
  it('reports unexpected (non-UserFacingError) errors from handlePlayerAction', async () => {
    const session = manager.createSession(GameType.SLOTS, 'g', 'c', 'host');
    sessionIds.push(session.id);
    session.players.push({ userId: 'host', username: 'host' } as any);
    manager.registerGameInstance(session.id, {
      handlePlayerAction: async () => {
        throw new Error('boom');
      },
      isFinished: () => false,
    } as any);

    let captured = '';
    await handleGameInteraction(
      'host',
      'c',
      {},
      async () => {},
      async (msg) => {
        captured = msg;
      },
    );

    expect(reportErrorSpy).toHaveBeenCalledWith(expect.any(Error), {
      origin: 'gameInteraction',
      logLevel: 'error',
    });
    expect(captured).toBe(
      'Ocorreu um erro ao processar sua ação. Tente novamente.',
    );
  });

  it('does not report UserFacingError instances', async () => {
    const session = manager.createSession(GameType.SLOTS, 'g', 'c', 'host');
    sessionIds.push(session.id);
    session.players.push({ userId: 'host', username: 'host' } as any);
    manager.registerGameInstance(session.id, {
      handlePlayerAction: async () => {
        throw new UserFacingError('Não é sua vez!');
      },
      isFinished: () => false,
    } as any);

    let captured = '';
    await handleGameInteraction(
      'host',
      'c',
      {},
      async () => {},
      async (msg) => {
        captured = msg;
      },
    );

    expect(reportErrorSpy).not.toHaveBeenCalled();
    expect(captured).toBe('Não é sua vez!');
  });
});
