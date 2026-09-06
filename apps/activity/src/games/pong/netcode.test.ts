import { describe, expect, it } from 'bun:test';
import { LocalPaddlePredictor, PongSnapshotBuffer } from './netcode';
import type { DecodedSnapshot } from './protocol';

function snapshot(
  seq: number,
  serverTimeMs: number,
  ballX: number,
): DecodedSnapshot {
  return {
    seq,
    serverTimeMs,
    phase: 'rally',
    phaseRemainingMs: 0,
    ruleset: 'classic-1v1',
    arena: 'rectangular',
    targetScore: 11,
    bestOf: 1,
    gameIndex: 0,
    winnerSlot: null,
    lastEventSeq: 0,
    acks: [0, 0],
    score: [0, 0],
    gamesWon: [0, 0],
    lives: [0, 0],
    paddles: [],
    balls: [
      {
        id: 0,
        x: ballX,
        y: 100,
        vx: 250,
        vy: 0,
        radius: 8,
        spin: 0,
        lastTouchSlot: null,
        stickyPaddleId: null,
        active: true,
      },
    ],
    bricks: [],
    powerUps: [],
    ball: {
      id: 0,
      x: ballX,
      y: 100,
      vx: 250,
      vy: 0,
      radius: 8,
      spin: 0,
      lastTouchSlot: null,
      stickyPaddleId: null,
      active: true,
    },
    classicPaddles: { left: 0, right: 0 },
    classicScore: { left: 0, right: 0 },
    winner: null,
  };
}

describe('LocalPaddlePredictor', () => {
  it('drops acknowledged inputs and replays pending inputs', () => {
    const predictor = new LocalPaddlePredictor({
      min: 10,
      max: 390,
      speed: 400,
    });
    predictor.push({ seq: 1, sentAt: 100, axis: 1 });
    predictor.push({ seq: 2, sentAt: 150, axis: -1 });

    const position = predictor.reconcile(200, 1, 140, 200);

    expect(predictor.pendingSequences()).toEqual([2]);
    expect(position).toBeCloseTo(184);
  });

  it('pursues a normalized target without teleporting', () => {
    const predictor = new LocalPaddlePredictor({
      min: 10,
      max: 390,
      speed: 400,
    });
    predictor.push({ seq: 1, sentAt: 0, target: 1 });

    expect(predictor.reconcile(100, 0, 0, 100)).toBe(140);
  });
});

describe('PongSnapshotBuffer', () => {
  it('renders between snapshots at the configured delay', () => {
    const buffer = new PongSnapshotBuffer(100, 100);
    buffer.push(snapshot(1, 0, 0), 100);
    buffer.push(snapshot(2, 40, 10), 140);

    const sample = buffer.sample(220)!;

    expect(sample.extrapolated).toBe(false);
    expect(sample.state.balls[0]!.x).toBeCloseTo(5);
  });

  it('caps extrapolation when snapshots are late', () => {
    const buffer = new PongSnapshotBuffer(100, 100);
    buffer.push(snapshot(1, 0, 0), 100);

    const sample = buffer.sample(400)!;

    expect(sample.extrapolated).toBe(true);
    expect(sample.state.balls[0]!.x).toBeCloseTo(25);
  });

  it('ignores duplicate snapshots', () => {
    const buffer = new PongSnapshotBuffer(0, 100);
    buffer.push(snapshot(1, 0, 0), 100);
    buffer.push(snapshot(1, 0, 500), 100);

    expect(buffer.sample(100)!.state.balls[0]!.x).toBe(0);
  });
});
