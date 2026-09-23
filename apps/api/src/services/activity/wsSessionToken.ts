import { cardGameRegistry } from 'services/activity/cards/registry';
import { activityModeSchema, gameIdSchema } from 'services/activity/gameId';
import { isPongRulesetId } from 'services/activity/pong/PongRulesetRegistry';
import { decryptTokenFull, encryptToken } from 'utils/crypto';
import { z } from 'zod';

const BOT_DIFFICULTIES = ['easy', 'normal', 'hard'] as const;

const wsSessionPayloadSchema = z
  .object({
    userId: z.string(),
    displayName: z.string().min(1).max(80).optional(),
    instanceId: z.string(),
    guildId: z.string(),
    mode: activityModeSchema,
    game: gameIdSchema,
    difficulty: z.enum(BOT_DIFFICULTIES).optional(),
    winningScore: z.number().int().min(1).max(99).optional(),
    // Required for mode 'multi' (a room subdivides a Discord instance);
    // absent for 'single'/'local', which stay scoped per-user as before.
    roomId: z.string().min(1).optional(),
    // Only meaningful (and required) for game:'cards' — selects which
    // pluggable GameDefinition the room loads. The shape of `options` is
    // validated by that GameDefinition's own setup(), not here, so this
    // layer only needs to know "is this a known ruleset id."
    ruleset: z.string().optional(),
    options: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((payload) => payload.mode !== 'multi' || payload.roomId)
  .refine((payload) => {
    if (payload.game === 'cards') {
      return (
        payload.ruleset !== undefined &&
        cardGameRegistry.isKnownRuleset(payload.ruleset)
      );
    }
    if (payload.game === 'pong') {
      return payload.ruleset === undefined || isPongRulesetId(payload.ruleset);
    }
    return payload.ruleset === undefined;
  });

export type WsSessionPayload = z.infer<typeof wsSessionPayloadSchema>;

const WS_SESSION_TTL_MS = 5 * 60_000;

export function mintWsSessionToken(payload: WsSessionPayload): string {
  if (payload.mode === 'multi' && !payload.roomId) {
    throw new Error('roomId is required for mode "multi"');
  }
  const token = encryptToken(
    JSON.stringify(payload),
    Date.now() + WS_SESSION_TTL_MS,
  );
  if (!token) throw new Error('Failed to mint WS session token');
  return token;
}

export function verifyWsSessionToken(token: string): WsSessionPayload | null {
  const decrypted = decryptTokenFull(token);
  if (!decrypted) return null;
  if (decrypted.expiresAt !== undefined && decrypted.expiresAt < Date.now()) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decrypted.token);
  } catch {
    return null;
  }
  const payload = wsSessionPayloadSchema.safeParse(parsed);
  return payload.success ? payload.data : null;
}
