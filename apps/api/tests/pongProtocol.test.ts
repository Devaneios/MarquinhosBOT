import { describe, expect, it } from 'bun:test';
import {
  decodeStateSnapshot,
  encodeStateSnapshot,
  PONG_PROTOCOL_VERSION,
  type PongSnapshot,
} from 'services/activity/pong/pongProtocol';

function snapshot(): PongSnapshot {
  return {
    seq: 17,
    serverTimeMs: 1234,
    phase: 'rally',
    phaseRemainingMs: 0,
    ruleset: 'classic-1v1',
    arena: 'rectangular',
    targetScore: 11,
    bestOf: 3,
    gameIndex: 1,
    winnerSlot: null,
    lastEventSeq: 9,
    acks: [4, 6],
    score: [3, 2],
    gamesWon: [1, 0],
    lives: [0, 0],
    paddles: [
      {
        id: 0,
        slot: 0,
        team: 0,
        side: 'left',
        orientation: 'vertical',
        x: 12,
        y: 100,
        width: 12,
        height: 80,
        angle: 0,
        arc: 0,
        axisPosition: 100,
        velocity: -400,
        sizeMultiplier: 1,
        speedMultiplier: 1.5,
        shield: 1,
        reversedUntilMs: 0,
        stickyUntilMs: 2000,
        active: true,
      },
    ],
    balls: [
      {
        id: 5,
        x: 400,
        y: 240,
        vx: 300,
        vy: -20,
        radius: 8,
        spin: 0.25,
        lastTouchSlot: 0,
        stickyPaddleId: null,
        active: true,
      },
    ],
    bricks: [
      {
        id: 8,
        x: 350,
        y: 100,
        width: 30,
        height: 12,
        hp: 2,
        active: true,
      },
    ],
    powerUps: [
      {
        id: 3,
        kind: 'grow',
        x: 300,
        y: 200,
        radius: 10,
        active: true,
        expiresAtMs: 9000,
      },
    ],
  };
}

describe('pong protocol v2', () => {
  it('round-trips every entity family', () => {
    const decoded = decodeStateSnapshot(encodeStateSnapshot(snapshot()));

    expect(decoded).toEqual(snapshot());
  });

  it('round-trips radial orientation independently from paddle side', () => {
    const state = snapshot();
    state.paddles[0]!.side = 'bottom';
    state.paddles[0]!.orientation = 'radial';
    state.paddles[0]!.angle = Math.PI / 2;
    state.paddles[0]!.arc = Math.PI / 3;

    const decoded = decodeStateSnapshot(encodeStateSnapshot(state));

    expect(decoded.paddles[0]!.orientation).toBe('radial');
    expect(decoded.paddles[0]!.side).toBe('bottom');
  });

  it('rejects a truncated buffer', () => {
    const encoded = encodeStateSnapshot(snapshot());

    expect(() =>
      decodeStateSnapshot(encoded.slice(0, encoded.byteLength - 1)),
    ).toThrow('Invalid Pong snapshot size');
  });

  it('rejects a different protocol version', () => {
    const encoded = encodeStateSnapshot(snapshot());
    new DataView(encoded).setUint8(0, PONG_PROTOCOL_VERSION + 1);

    expect(() => decodeStateSnapshot(encoded)).toThrow(
      'Unsupported Pong protocol version',
    );
  });
});
