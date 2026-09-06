import { act, render } from '@testing-library/react';
import { describe, expect, it, mock } from 'bun:test';
import type { DominoesClientState, Tile } from '../protocol';

interface FakeContainer {
  handlers: Record<string, () => void>;
  eventMode: string;
  cursor: string;
  visible: boolean;
  position: { set: () => void };
  on(event: string, cb: () => void): void;
  addChild(): void;
}

let createdContainers: FakeContainer[];

function installPixiMock() {
  createdContainers = [];
  mock.module('pixi.js', () => {
    class Graphics {
      clear() {
        return this;
      }
      roundRect() {
        return this;
      }
      fill() {
        return this;
      }
      stroke() {
        return this;
      }
      circle() {
        return this;
      }
      moveTo() {
        return this;
      }
      lineTo() {
        return this;
      }
    }
    class Container implements FakeContainer {
      handlers: Record<string, () => void> = {};
      eventMode = '';
      cursor = '';
      visible = false;
      position = { set: () => {} };
      on(event: string, cb: () => void) {
        this.handlers[event] = cb;
      }
      addChild() {}
      constructor() {
        createdContainers.push(this);
      }
    }
    class Application {
      stage = { addChild: () => {} };
      ticker = { start() {}, stop() {} };
      async init() {}
      destroy() {}
    }
    return { Application, Container, Graphics };
  });
}

const HAND: Tile[] = [{ a: 1, b: 2 }];

function stateWithHand(currentPlayer: string): DominoesClientState {
  return {
    players: ['user-a', 'user-b'],
    handCounts: { 'user-a': 1, 'user-b': 7 },
    hand: HAND,
    boneyard: 10,
    chain: [],
    leftEnd: null,
    rightEnd: null,
    currentPlayer,
    winner: null,
    winners: null,
    blocked: false,
    pipTotals: null,
  };
}

async function renderCanvas(props: {
  role: 'player' | 'spectator' | 'queued' | null;
  onTileClick: (tile: Tile) => void;
}) {
  installPixiMock();
  const { DominoesBlockCanvas } = await import(
    `./DominoesBlockCanvas.tsx?${Math.random()}`
  );
  await act(async () => {
    render(
      <DominoesBlockCanvas
        state={stateWithHand('user-a')}
        selfId="user-a"
        selectedTile={null}
        role={props.role}
        onTileClick={props.onTileClick}
      />,
    );
    await Promise.resolve();
    await Promise.resolve();
  });
}

// Several Container instances are created (chainContainer, handContainer,
// then one pool-entry Container per hand tile) — only the hand pool
// entry's container gets a pointertap handler wired (see getHandEntry in
// DominoesBlockCanvas.tsx), so find it by that rather than assuming an
// index. Assert one was actually found, so a broken lookup fails loudly
// instead of silently no-op'ing into a false-positive "not called".
describe('DominoesBlockCanvas move gating', () => {
  it('does not click a tile when the viewer is a spectator, even on their nominal turn', async () => {
    const onTileClick = mock((_tile: Tile) => {});
    await renderCanvas({ role: 'spectator', onTileClick });

    const handEntry = createdContainers.find((c) => c.handlers.pointertap);
    expect(handEntry).toBeTruthy();
    handEntry?.handlers.pointertap?.();

    expect(onTileClick).not.toHaveBeenCalled();
  });

  it('does not click a tile when the viewer is queued', async () => {
    const onTileClick = mock((_tile: Tile) => {});
    await renderCanvas({ role: 'queued', onTileClick });

    const handEntry = createdContainers.find((c) => c.handlers.pointertap);
    expect(handEntry).toBeTruthy();
    handEntry?.handlers.pointertap?.();

    expect(onTileClick).not.toHaveBeenCalled();
  });

  it('clicks a tile for a seated player on their turn', async () => {
    const onTileClick = mock((_tile: Tile) => {});
    await renderCanvas({ role: 'player', onTileClick });

    createdContainers
      .find((c) => c.handlers.pointertap)
      ?.handlers.pointertap?.();

    expect(onTileClick).toHaveBeenCalledWith(HAND[0]);
  });

  it('clicks a tile when role is null (the existing non-room path)', async () => {
    const onTileClick = mock((_tile: Tile) => {});
    await renderCanvas({ role: null, onTileClick });

    createdContainers
      .find((c) => c.handlers.pointertap)
      ?.handlers.pointertap?.();

    expect(onTileClick).toHaveBeenCalledWith(HAND[0]);
  });
});
