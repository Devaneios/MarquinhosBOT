import { z } from 'zod';

export interface WireMessage {
  type: string;
  payload?: unknown;
}

export function parseMessage<M extends WireMessage>(
  schema: z.ZodType<M>,
  message: WireMessage,
): M | null {
  const parsed = schema.safeParse(
    message.payload === undefined
      ? { type: message.type }
      : { type: message.type, payload: message.payload },
  );
  return parsed.success ? parsed.data : null;
}

export const ACTION_REJECTED = 'action_rejected';

export const actionRejectedMessageSchema = z.object({
  type: z.literal(ACTION_REJECTED),
  payload: z.object({ error: z.string() }),
});

export const restartStatusMessageSchema = z.object({
  type: z.literal('restart_status'),
  payload: z.object({ votes: z.number(), required: z.number() }),
});

export type RestartStatus = z.output<
  typeof restartStatusMessageSchema
>['payload'];

export const restartMessageSchema = z.object({ type: z.literal('restart') });
export const leaveMessageSchema = z.object({ type: z.literal('leave') });
