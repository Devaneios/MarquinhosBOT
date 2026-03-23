import { GameManager } from '@marquinhos/game/core/GameManager';
import { MessageFlags } from 'discord.js';

const gameManager = GameManager.getInstance();

export async function handleGameInteraction(
  userId: string,
  channelId: string,
  action: Record<string, unknown>,
  updateFn: (payload: { embeds: any[]; components: any[] }) => Promise<unknown>,
  errorFn: (msg: string) => Promise<void>,
): Promise<void> {
  const session = gameManager.getSessionByChannel(channelId);
  if (!session) return;

  const gameInstance = gameManager.getGameInstance(session.id);
  if (!gameInstance) return;

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
    console.error('Game interaction error:', error);
    await errorFn('Ocorreu um erro ao processar sua ação. Tente novamente.');
  }
}
