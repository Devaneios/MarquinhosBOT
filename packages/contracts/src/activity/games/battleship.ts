import { z } from 'zod';
import { leaveMessageSchema } from '../protocol';

export const SHIP_TYPES = [
  'carrier',
  'battleship',
  'cruiser',
  'submarine',
  'destroyer',
] as const;
export const shipTypeSchema = z.enum(SHIP_TYPES);
export type ShipType = z.output<typeof shipTypeSchema>;

export const battleshipSideSchema = z.enum(['p1', 'p2']);
export type BattleshipSide = z.output<typeof battleshipSideSchema>;

export const orientationSchema = z.enum(['horizontal', 'vertical']);
export type Orientation = z.output<typeof orientationSchema>;

export const phaseSchema = z.enum(['placement', 'battle', 'ended']);
export type Phase = z.output<typeof phaseSchema>;

export const coordinateSchema = z.object({ x: z.number(), y: z.number() });
export type Coordinate = z.output<typeof coordinateSchema>;

export const shipPlacementSchema = z.object({
  type: shipTypeSchema,
  x: z.number().int(),
  y: z.number().int(),
  orientation: orientationSchema,
});
export type ShipPlacement = z.output<typeof shipPlacementSchema>;

export const shipViewSchema = z.object({
  type: shipTypeSchema,
  cells: z.array(coordinateSchema),
  sunk: z.boolean(),
});
export type ShipView = z.output<typeof shipViewSchema>;

export const shotViewSchema = z.object({
  x: z.number(),
  y: z.number(),
  hit: z.boolean(),
  shipType: shipTypeSchema.optional(),
  sunk: z.boolean().optional(),
});
export type ShotView = z.output<typeof shotViewSchema>;

export const boardViewSchema = z.object({
  ships: z.array(shipViewSchema),
  shots: z.array(shotViewSchema),
});
export type BoardView = z.output<typeof boardViewSchema>;

const placementReadySchema = z.object({ p1: z.boolean(), p2: z.boolean() });

export const battleshipStateViewSchema = z.object({
  phase: phaseSchema,
  turn: battleshipSideSchema.nullable(),
  winner: battleshipSideSchema.nullable(),
  own: boardViewSchema,
  opponent: boardViewSchema,
  placementReady: placementReadySchema,
});
export type BattleshipStateView = z.output<typeof battleshipStateViewSchema>;

export const battleshipSpectatorStateViewSchema = z.object({
  phase: phaseSchema,
  turn: battleshipSideSchema.nullable(),
  winner: battleshipSideSchema.nullable(),
  p1: boardViewSchema,
  p2: boardViewSchema,
  placementReady: placementReadySchema,
});
export type BattleshipSpectatorStateView = z.output<
  typeof battleshipSpectatorStateViewSchema
>;

export const placeShipsPayloadSchema = z.object({
  placements: z.array(shipPlacementSchema),
});

export const firePayloadSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('place_ships'),
    payload: placeShipsPayloadSchema,
  }),
  z.object({ type: z.literal('fire'), payload: firePayloadSchema }),
  leaveMessageSchema,
]);
export type BattleshipClientMessage = z.output<typeof clientMessageSchema>;

const errorPayloadSchema = z.object({ message: z.string() });

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('init'),
    payload: z.object({ side: battleshipSideSchema.nullable() }),
  }),
  z.object({
    type: z.literal('state'),
    payload: z.union([
      battleshipStateViewSchema,
      battleshipSpectatorStateViewSchema,
    ]),
  }),
  z.object({ type: z.literal('placement_error'), payload: errorPayloadSchema }),
  z.object({ type: z.literal('fire_error'), payload: errorPayloadSchema }),
  z.object({
    type: z.literal('opponent_disconnected'),
    payload: z.object({ side: battleshipSideSchema, timeoutMs: z.number() }),
  }),
  z.object({
    type: z.literal('opponent_reconnected'),
    payload: z.object({ side: battleshipSideSchema }),
  }),
]);
export type BattleshipServerMessage = z.output<typeof serverMessageSchema>;
