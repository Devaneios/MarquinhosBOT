import { logger } from '@marquinhos/utils/logger';
import { useMainPlayer, useQueue } from 'discord-player';
import {
  GuildVoiceChannelResolvable,
  InteractionEditReplyOptions,
  MessagePayload,
  TextBasedChannel,
} from 'discord.js';

export const handlePlay = async (
  query: string,
  interactionChannel: TextBasedChannel,
  voiceChannel: GuildVoiceChannelResolvable,
  addedBy: string,
  playOnTop = false
): Promise<string | MessagePayload | InteractionEditReplyOptions> => {
  try {
    const player = useMainPlayer();
    const queue = useQueue();

    const searchResult = await player.search(query);
    if (!searchResult.hasTracks()) {
      return 'Nenhuma música encontrada!';
    }

    if (queue && playOnTop) {
      const track = searchResult.tracks[0];
      queue.insertTrack(track, 0);

      return 'Música adicionada ao topo da fila';
    } else {
      await player.play(voiceChannel, searchResult, {
        nodeOptions: {
          metadata: {
            interactionChannel,
            voiceChannel,
            addedBy,
          },
          leaveOnEnd: true,
          leaveOnEndCooldown: 15000,
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 60000,
          volume: 20,
        },
      });

      return 'Música adicionada a fila';
    }
  } catch (error) {
    logger.error(error);
    return 'Ocorreu um erro inesperado';
  }
};
