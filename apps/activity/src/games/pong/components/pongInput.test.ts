import { afterEach, describe, expect, it } from 'bun:test';
import { attachPongInput } from './pongInput';

afterEach(() => {
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp' }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown' }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
});

describe('Pong input controller', () => {
  it('sequences direction transitions and removes its listeners on disposal', () => {
    const sent: unknown[] = [];
    const predictions: unknown[] = [];
    const canvas = document.createElement('canvas');
    const dispose = attachPongInput({
      canvas,
      mode: 'multi',
      getSide: () => 'left',
      getAssignment: () => ({ slot: 0, side: 'left', team: 0 }),
      isSpectating: () => false,
      sendInput: (payload) => sent.push(payload),
      pushPrediction: (side, prediction) =>
        predictions.push({ side, ...prediction }),
      onExit: () => {},
    });

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }),
    );
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }),
    );
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp' }));

    expect(sent).toEqual([
      { direction: -1, seq: 1 },
      { direction: 0, seq: 3 },
    ]);
    expect(predictions).toHaveLength(2);
    expect(predictions).toMatchObject([
      { side: 'left', seq: 1, axis: -1 },
      { side: 'left', seq: 3, axis: 0 },
    ]);

    dispose();
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }),
    );
    expect(sent).toHaveLength(2);
  });

  it('sends the release action with the next input sequence', () => {
    const sent: unknown[] = [];
    const dispose = attachPongInput({
      canvas: document.createElement('canvas'),
      mode: 'single',
      getSide: () => 'left',
      getAssignment: () => ({ slot: 0, side: 'left', team: 0 }),
      isSpectating: () => false,
      sendInput: (payload) => sent.push(payload),
      pushPrediction: () => {},
      onExit: () => {},
    });

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', cancelable: true }),
    );

    expect(sent).toEqual([{ direction: 0, seq: 1, action: 'release' }]);
    dispose();
  });
});
