import {
  buildResultImage,
  type LetterFeedback,
} from '@marquinhos/ui/screens/termo';
import { baseEmbed } from '@marquinhos/utils/discord';
import {
  AttachmentBuilder,
  type Client,
  type GuildTextBasedChannel,
} from 'discord.js';
import { buildTermoWinActionRow } from './termoResponse';

export interface TermoWinResult {
  guesses: { guess: string; feedback: LetterFeedback[] }[];
  attempts: number;
}

export interface AnnounceTermoWinOptions {
  showPlayButton?: boolean;
}

export async function announceTermoWin(
  client: Client,
  channel: GuildTextBasedChannel,
  name: string,
  result: TermoWinResult,
  { showPlayButton }: AnnounceTermoWinOptions = {},
): Promise<void> {
  const resultBuffer = await buildResultImage(result.guesses);
  const resultAttachment = new AttachmentBuilder(resultBuffer, {
    name: 'resultado.png',
  });

  const solvedMessage =
    result.attempts === 1
      ? 'acertou de primeira!'
      : `acertou em ${result.attempts} tentativa${result.attempts > 1 ? 's' : ''}!`;

  const embed = baseEmbed(client)
    .setTitle(`${name} ${solvedMessage}`)
    .setColor(0x588157)
    .setImage('attachment://resultado.png');

  await channel.send({
    embeds: [embed],
    files: [resultAttachment],
    components: showPlayButton ? [buildTermoWinActionRow()] : [],
  });

  if (result.guesses.length === 1) {
    const msg = await channel.send(
      `TAPORRA ${name} EU NUNCA ACREDITEI! ESPERO QUE NUNCA MAIS CONSIGA!`,
    );
    msg.react(':marquinhosverao:1192666622356361367');
  } else if (result.guesses.length === 2) {
    const msg = await channel.send(
      `OLOCO ${name} QUASE HEIN! DA PRÓXIMA VAI SER NO MÍNIMO 5!`,
    );
    msg.react(':marquinhosverao:1192666622356361367');
  }
}
