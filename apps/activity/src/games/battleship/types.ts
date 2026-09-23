import { z } from 'zod';

const battleshipSideSchema = z.enum(['p1', 'p2']);
export type BattleshipSide = z.infer<typeof battleshipSideSchema>;

const shipTypeSchema = z.enum([
  'carrier',
  'battleship',
  'cruiser',
  'submarine',
  'destroyer',
]);
export type ShipType = z.infer<typeof shipTypeSchema>;

export type Orientation = 'horizontal' | 'vertical';

const phaseSchema = z.enum(['placement', 'battle', 'ended']);
export type Phase = z.infer<typeof phaseSchema>;

export interface PendingShip {
  type: ShipType;
  x: number;
  y: number;
  orientation: Orientation;
}

export {
  BOARD_SIZE,
  SHIP_SIZES,
} from '@marquinhos/domain/activity/battleship/BattleshipEngine';

export const SHIP_ORDER: ShipType[] = [
  'carrier',
  'battleship',
  'cruiser',
  'submarine',
  'destroyer',
];

const coordinateSchema = z.object({ x: z.number(), y: z.number() });
export type Coordinate = z.infer<typeof coordinateSchema>;

export interface ShipPlacement {
  type: ShipType;
  x: number;
  y: number;
  orientation: Orientation;
}

const shipViewSchema = z.object({
  type: shipTypeSchema,
  cells: z.array(coordinateSchema),
  sunk: z.boolean(),
});
export type ShipView = z.infer<typeof shipViewSchema>;

const shotViewSchema = z.object({
  x: z.number(),
  y: z.number(),
  hit: z.boolean(),
  shipType: shipTypeSchema.optional(),
  sunk: z.boolean().optional(),
});
export type ShotView = z.infer<typeof shotViewSchema>;

const boardViewSchema = z.object({
  ships: z.array(shipViewSchema),
  shots: z.array(shotViewSchema),
});
export type BoardView = z.infer<typeof boardViewSchema>;

const placementReadySchema = z.object({ p1: z.boolean(), p2: z.boolean() });

export const battleshipStateViewSchema = z.object({
  phase: phaseSchema,
  turn: battleshipSideSchema.nullable(),
  winner: battleshipSideSchema.nullable(),
  own: boardViewSchema,
  opponent: boardViewSchema,
  placementReady: placementReadySchema,
});
export type BattleshipStateView = z.infer<typeof battleshipStateViewSchema>;

// What a non-participant (spectator/queued) receives instead — see
// marquinhos-api's spectatorViewFor(): both fleets masked symmetrically,
// since a non-participant has no "own" side.
export const battleshipSpectatorStateViewSchema = z.object({
  phase: phaseSchema,
  turn: battleshipSideSchema.nullable(),
  winner: battleshipSideSchema.nullable(),
  p1: boardViewSchema,
  p2: boardViewSchema,
  placementReady: placementReadySchema,
});
export type BattleshipSpectatorStateView = z.infer<
  typeof battleshipSpectatorStateViewSchema
>;

export const initPayloadSchema = z.object({
  side: battleshipSideSchema.nullable(),
});

export const errorPayloadSchema = z.object({ message: z.string() });
