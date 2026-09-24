import { describe, expect, it } from 'bun:test';
import {
  battleshipSpectatorStateViewSchema,
  battleshipStateViewSchema,
  clientMessageSchema,
  firePayloadSchema,
  placeShipsPayloadSchema,
  serverMessageSchema,
} from './battleship';

const board = { ships: [], shots: [] };
const commonState = {
  phase: 'battle',
  turn: 'p1',
  winner: null,
  placementReady: { p1: true, p2: true },
} as const;

describe('Battleship contract', () => {
  it('accepts valid placements and rejects malformed entries', () => {
    const placement = {
      type: 'carrier',
      x: 0,
      y: 1,
      orientation: 'horizontal',
    };
    expect(
      placeShipsPayloadSchema.safeParse({ placements: [placement] }).success,
    ).toBe(true);
    expect(
      placeShipsPayloadSchema.safeParse({
        placements: [{ ...placement, x: 0.5 }],
      }).success,
    ).toBe(false);
    expect(
      placeShipsPayloadSchema.safeParse({
        placements: [{ ...placement, type: 'unknown' }],
      }).success,
    ).toBe(false);
    expect(
      clientMessageSchema.safeParse({
        type: 'place_ships',
        payload: { placements: [placement] },
      }).success,
    ).toBe(true);
  });

  it('accepts numeric fire coordinates and rejects nonnumbers', () => {
    expect(firePayloadSchema.safeParse({ x: 0.5, y: 4 }).success).toBe(true);
    expect(firePayloadSchema.safeParse({ x: '0', y: 4 }).success).toBe(false);
    expect(
      clientMessageSchema.safeParse({ type: 'fire', payload: { x: 3, y: 4 } })
        .success,
    ).toBe(true);
  });

  it('parses player and spectator state views', () => {
    const player = { ...commonState, own: board, opponent: board };
    const spectator = { ...commonState, p1: board, p2: board };
    expect(battleshipStateViewSchema.safeParse(player).success).toBe(true);
    expect(
      battleshipSpectatorStateViewSchema.safeParse(spectator).success,
    ).toBe(true);
    expect(battleshipStateViewSchema.safeParse(spectator).success).toBe(false);
    expect(battleshipSpectatorStateViewSchema.safeParse(player).success).toBe(
      false,
    );
    expect(
      serverMessageSchema.safeParse({ type: 'state', payload: player }).success,
    ).toBe(true);
    expect(
      serverMessageSchema.safeParse({ type: 'state', payload: spectator })
        .success,
    ).toBe(true);
  });

  it('parses init and error messages', () => {
    expect(
      serverMessageSchema.safeParse({ type: 'init', payload: { side: null } })
        .success,
    ).toBe(true);
    expect(
      serverMessageSchema.safeParse({
        type: 'placement_error',
        payload: { message: 'Invalid ship placements' },
      }).success,
    ).toBe(true);
    expect(
      serverMessageSchema.safeParse({
        type: 'fire_error',
        payload: { message: 'Not your turn' },
      }).success,
    ).toBe(true);
  });
});
