import { z } from 'zod';
import { actionRejectedMessageSchema, leaveMessageSchema } from '../protocol';

export const wordChainStateSchema = z.object({
  gameOver: z.boolean(),
  winner: z.string().nullable(),
  currentTurn: z.string(),
  currentWord: z.string(),
  usedWords: z.array(z.string()),
  players: z.array(z.object({ userId: z.string(), alive: z.boolean() })),
});
export type WordChainState = z.output<typeof wordChainStateSchema>;

export const wordPayloadSchema = z.object({ word: z.string().default('') });

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('word'), payload: wordPayloadSchema }),
  leaveMessageSchema,
]);
export type WordChainClientMessage = z.input<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('init'), payload: wordChainStateSchema }),
  z.object({ type: z.literal('state'), payload: wordChainStateSchema }),
  z.object({
    type: z.literal('opponent_disconnected'),
    payload: z.object({ userId: z.string(), timeoutMs: z.number() }),
  }),
  z.object({
    type: z.literal('opponent_reconnected'),
    payload: z.object({ userId: z.string() }),
  }),
  actionRejectedMessageSchema,
]);
export type WordChainServerMessage = z.output<typeof serverMessageSchema>;
