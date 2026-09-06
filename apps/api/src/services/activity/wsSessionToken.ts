import { cardGameRegistry } from 'services/activity/cards/registry';
import {
  isGameId,
  type ActivityMode,
  type GameId,
} from 'services/activity/gameId';
import type { BotDifficulty } from 'services/activity/pong/PongBotAI';
import { isPongRulesetId } from 'services/activity/pong/PongRulesetRegistry';
import { decryptTokenFull, encryptToken } from 'utils/crypto';

const BOT_DIFFICULTIES = ['easy', 'normal', 'hard'] as const;

export interface WsSessionPayload {
  userId: string;
  displayName?: string;
  instanceId: string;
  guildId: string;
  mode: ActivityMode;
  game: GameId;
  difficulty?: BotDifficulty;
  winningScore?: number;
  // Required for mode 'multi' (a room subdivides a Discord instance);
  // absent for 'single'/'local', which stay scoped per-user as before.
  roomId?: string;
  // Only meaningful (and required) for game:'cards' — selects which
  // pluggable GameDefinition the room loads. The shape of `options` is
  // validated by that GameDefinition's own setup(), not here, so this
  // layer only needs to know "is this a known ruleset id."
  ruleset?: string;
  options?: Record<string, unknown>;
}

const WS_SESSION_TTL_MS = 5 * 60_000;

export function mintWsSessionToken(payload: WsSessionPayload): string {
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
  try {
    const parsed = JSON.parse(decrypted.token);
    const hasValidDifficulty =
      parsed?.difficulty === undefined ||
      BOT_DIFFICULTIES.includes(parsed?.difficulty);
    const hasValidWinningScore =
      parsed?.winningScore === undefined ||
      (typeof parsed?.winningScore === 'number' &&
        Number.isInteger(parsed.winningScore) &&
        parsed.winningScore >= 1 &&
        parsed.winningScore <= 99);
    const hasValidRuleset =
      parsed?.game === 'cards'
        ? typeof parsed?.ruleset === 'string' &&
          cardGameRegistry.isKnownRuleset(parsed.ruleset)
        : parsed?.game === 'pong'
          ? parsed?.ruleset === undefined || isPongRulesetId(parsed.ruleset)
          : parsed?.ruleset === undefined;
    const hasValidRoomId =
      (typeof parsed?.roomId === 'string' && parsed.roomId.length > 0) ||
      parsed?.roomId === undefined;
    const hasValidOptions =
      parsed?.options === undefined ||
      (typeof parsed.options === 'object' &&
        parsed.options !== null &&
        !Array.isArray(parsed.options));
    const hasValidDisplayName =
      parsed?.displayName === undefined ||
      (typeof parsed.displayName === 'string' &&
        parsed.displayName.length > 0 &&
        parsed.displayName.length <= 80);
    if (
      typeof parsed?.userId === 'string' &&
      typeof parsed?.instanceId === 'string' &&
      typeof parsed?.guildId === 'string' &&
      (parsed?.mode === 'single' ||
        parsed?.mode === 'multi' ||
        parsed?.mode === 'local') &&
      isGameId(parsed?.game) &&
      hasValidDisplayName &&
      hasValidDifficulty &&
      hasValidWinningScore &&
      hasValidRuleset &&
      hasValidRoomId &&
      hasValidOptions
    ) {
      return {
        userId: parsed.userId,
        ...(parsed.displayName !== undefined
          ? { displayName: parsed.displayName }
          : {}),
        instanceId: parsed.instanceId,
        guildId: parsed.guildId,
        mode: parsed.mode,
        game: parsed.game,
        ...(parsed.difficulty !== undefined
          ? { difficulty: parsed.difficulty }
          : {}),
        ...(parsed.winningScore !== undefined
          ? { winningScore: parsed.winningScore }
          : {}),
        ...(parsed.roomId !== undefined ? { roomId: parsed.roomId } : {}),
        ...(parsed.ruleset !== undefined ? { ruleset: parsed.ruleset } : {}),
        ...(parsed.options !== undefined ? { options: parsed.options } : {}),
      };
    }
  } catch {
    // malformed payload
  }
  return null;
}
