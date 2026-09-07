import { act, render } from '@testing-library/react';
import { describe, expect, it, mock } from 'bun:test';
import { RoomConnectionContext } from '../../shared/RoomConnectionProvider';

function installPixiMock() {
  mock.module('pixi.js', () => {
    class Graphics {
      clear() {
        return this;
      }
      moveTo() {
        return this;
      }
      lineTo() {
        return this;
      }
      stroke() {
        return this;
      }
      rect() {
        return this;
      }
      fill() {
        return this;
      }
    }
    class Application {
      stage = { addChild: () => {} };
      ticker = { start() {}, stop() {}, add() {}, remove() {} };
      renderer = { resize() {} };
      async init() {}
      destroy() {}
    }
    return { Application, Graphics };
  });
}

function baseValue(
  overrides: Partial<
    NonNullable<React.ContextType<typeof RoomConnectionContext>>
  >,
) {
  return {
    send: mock(() => {}),
    connectionState: 'connected' as const,
    role: 'player' as const,
    currentUserId: 'me',
    subscribe: () => () => {},
    isHost: false,
    roomState: {
      game: 'snake-game' as const,
      hostUserId: 'me',
      queueEnabled: false,
      matchInProgress: true,
      members: [{ userId: 'me', role: 'player' as const }],
    },
    ...overrides,
  };
}

async function renderRoomBoard(
  value: NonNullable<React.ContextType<typeof RoomConnectionContext>>,
) {
  installPixiMock();
  const { SnakeRoomBoard } = await import(
    `./SnakeRoomBoard.tsx?${Math.random()}`
  );
  await act(async () => {
    render(
      <RoomConnectionContext.Provider value={value}>
        <SnakeRoomBoard />
      </RoomConnectionContext.Provider>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });
}

function pressArrowUp() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
}

describe('SnakeRoomBoard input gating', () => {
  it('does not send input when the viewer is a spectator', async () => {
    const send = mock(() => {});
    await renderRoomBoard(baseValue({ send, role: 'spectator' }));

    pressArrowUp();

    expect(send).not.toHaveBeenCalled();
  });

  it('does not send input when the viewer is queued', async () => {
    const send = mock(() => {});
    await renderRoomBoard(baseValue({ send, role: 'queued' }));

    pressArrowUp();

    expect(send).not.toHaveBeenCalled();
  });

  it('sends input for a seated player', async () => {
    const send = mock(() => {});
    await renderRoomBoard(baseValue({ send, role: 'player' }));

    pressArrowUp();

    expect(send).toHaveBeenCalledWith({
      type: 'input',
      payload: { direction: 'up' },
    });
  });
});
