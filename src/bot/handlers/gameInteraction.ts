import { GameManager } from '@marquinhos/game/core/GameManager';
import { UserFacingError } from '@marquinhos/game/core/UserFacingError';
import { logger } from '@marquinhos/utils/logger';
import { ActionRowBuilder, EmbedBuilder } from 'discord.js';

const gameManager = GameManager.getInstance();

export async function handleGameInteraction(
  userId: string,
  channelId: string,
  action: Record<string, unknown>,
  updateFn: (payload: {
    embeds: EmbedBuilder[];
    components: ActionRowBuilder[];
  }) => Promise<unknown>,
  errorFn: (msg: string) => Promise<void>,
): Promise<void> {
  const session = gameManager.getSessionByChannel(channelId);
  if (!session) return;

  const gameInstance = gameManager.getGameInstance(session.id);
  if (!gameInstance) return;

  // Reject button presses from users who are not participants in this session.
  // Discord component customIds are public — anyone in the channel can click.
  if (!session.players.some((p) => p.userId === userId)) return;

  // Acquire processing lock — prevents concurrent actions on same session (P0 fix)
  if (!gameManager.acquireSessionLock(session.id)) return;

  try {
    await gameInstance.handlePlayerAction(userId, action);

    if (gameInstance.isFinished()) {
      const result = await gameInstance.finish();
      await gameManager.endSessionWithResult(session.id, result);
      const finalEmbed = gameInstance.getGameEmbed();
      await updateFn({ embeds: [finalEmbed], components: [] });
    } else {
      const embed = gameInstance.getGameEmbed();
      const components = gameInstance.getComponents();
      await updateFn({ embeds: [embed], components });
    }
  } catch (error) {
    if (error instanceof UserFacingError) {
      await errorFn(error.message);
    } else {
      logger.error(`Game interaction error: ${error}`);
      await errorFn('Ocorreu um erro ao processar sua ação. Tente novamente.');
    }
  } finally {
    gameManager.releaseSessionLock(session.id);
  }
}
