import type { GuessRow } from '@marquinhos/contracts/wordle';
import {
  buildResultImage,
  buildWinSummaryImage,
} from '@marquinhos/ui/screens/termo';
import { baseEmbed } from '@marquinhos/utils/discord';
import {
  AttachmentBuilder,
  type Client,
  type GuildTextBasedChannel,
} from 'discord.js';
import { buildTermoWinActionRow } from './termoResponse';

export interface TermoWinResult {
  guesses: GuessRow[];
  attempts: number;
}

export interface AnnounceTermoWinOptions {
  showPlayButton?: boolean;
  image?: 'board' | 'summary';
}

export async function announceTermoWin(
  client: Client,
  channel: GuildTextBasedChannel,
  name: string,
  result: TermoWinResult,
  { showPlayButton, image = 'board' }: AnnounceTermoWinOptions = {},
): Promise<void> {
  const imageBuffer =
    image === 'summary'
      ? await buildWinSummaryImage(result.attempts)
      : await buildResultImage(result.guesses);
  const attachment = new AttachmentBuilder(imageBuffer, {
    name: 'resultado.png',
  });
  const solvedMessage =
    result.attempts === 1
      ? 'acertou de primeira!'
      : `acertou em ${result.attempts} tentativa${result.attempts > 1 ? 's' : ''}!`;

  const embed = baseEmbed(client)
    .setTitle(`${name} ${solvedMessage}`)
    .setColor(0x588157);

  await channel.send({
    embeds: [embed],
    files: [attachment],
    components: showPlayButton ? [buildTermoWinActionRow()] : [],
  });

  if (result.attempts === 1) {
    const msg = await channel.send(
      `TAPORRA ${name} EU NUNCA ACREDITEI! ESPERO QUE NUNCA MAIS CONSIGA!`,
    );
    msg.react(':marquinhosverao:1192666622356361367');
  } else if (result.attempts === 2) {
    const msg = await channel.send(
      `OLOCO ${name} QUASE HEIN! DA PRÓXIMA VAI SER NO MÍNIMO 5!`,
    );
    msg.react(':marquinhosverao:1192666622356361367');
  }
}
