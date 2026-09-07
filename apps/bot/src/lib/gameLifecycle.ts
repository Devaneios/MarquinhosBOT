import { GameSession } from '@marquinhos/game/core/GameTypes';
import { logger } from '@marquinhos/utils/logger';
import {
  ActionRowBuilder,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
} from 'discord.js';

/**
 * Edits the session's stored Discord message. No-ops if the session has no
 * attached message (not yet attached, or this session predates the field).
 * Swallows and logs edit failures (deleted message, missing perms, etc.) —
 * this must never throw, since callers invoke it from timers and intervals.
 */
export async function updateSessionMessage(
  session: GameSession,
  embed: EmbedBuilder,
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [],
): Promise<void> {
  if (!session.message) return;
  try {
    await session.message.edit({ embeds: [embed], components });
  } catch (error) {
    logger.error(`Failed to edit message for session ${session.id}: ${error}`);
  }
}

/**
 * Marks an abandoned (naturally expired, never finished) session's message
 * as expired. No rewards, no finish()/endSessionWithResult() — that's
 * reserved for genuine game-overs, handled separately by each caller.
 */
export async function expireSessionMessage(
  session: GameSession,
): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle('⏰ Partida Expirada')
    .setDescription('⏰ Esta partida expirou por inatividade.')
    .setColor(0x808080)
    .setTimestamp();
  await updateSessionMessage(session, embed, []);
}
