import {
  SlashCommandBuilder,
  AttachmentBuilder,
  Embed,
  EmbedBuilder,
} from 'discord.js';

import { FlipCoinResult, SlashCommand } from '@marquinhos/types';
import { sleep } from '@marquinhos/utils/sleep';

export const coin: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('moeda')
    .setDescription('Tiro cara ou coroa numa moeda semi-viciada.'),
  execute: async (interaction) => {
    await interaction.deferReply();
    await interaction.followUp('Lançando a moeda... 🪙');

    const flipCoinResult = await flipCoin();

    if (flipCoinResult.result === null) {
      return interaction.reply({
        content: 'A moeda caiu no ralo e não consegui ver o resultado.',
        ephemeral: true,
      });
    }

    const attachment = new AttachmentBuilder(
      `./src/resources/images/coin_${flipCoinResult.result}.png`
    );

    const coinEmbed = buildEmbed(
      interaction.client.baseEmbed(),
      flipCoinResult
    );

    await interaction.editReply({
      content: '',
      embeds: [coinEmbed],
      files: [attachment],
    });
  },
  cooldown: 10,
};

async function flipCoin(): Promise<FlipCoinResult> {
  const randomTime = Math.floor(Math.random() * 5000);
  let finalResult = null;
  let heads = 0;
  let tails = 0;
  let count = 0;
  let timeEnd = 0;

  const timeStart = Date.now();
  while (true) {
    const result = ['Cara', 'Coroa'][Math.floor(Math.random() * 2)];
    result === 'Cara' ? heads++ : tails++;

    count++;
    if (Date.now() - timeStart > randomTime) {
      timeEnd = Date.now();
      finalResult = result;
      break;
    }
    await sleep(0);
  }
  const elapsedTime = timeEnd - timeStart;

  return { result: finalResult, heads, tails, count, elapsedTime };
}

function buildEmbed(
  baseEmbed: EmbedBuilder,
  flipCoinResult: FlipCoinResult
): EmbedBuilder {
  return baseEmbed
    .setTimestamp()
    .setTitle(`Deu ${flipCoinResult.result}!`)
    .setDescription(
      `A moeda caiu após ${(flipCoinResult.elapsedTime / 1000).toFixed(
        2
      )}s. Foram feitas ${flipCoinResult.count} tentativas.`
    )
    .addFields(
      {
        name: 'Cara',
        value: `${flipCoinResult.heads}x | ${(
          (flipCoinResult.heads / flipCoinResult.count) *
          100
        ).toFixed(2)}%`,
        inline: true,
      },
      {
        name: 'Coroa',
        value: `${flipCoinResult.tails}x | ${(
          (flipCoinResult.tails / flipCoinResult.count) *
          100
        ).toFixed(2)}%`,
        inline: true,
      }
    )
    .setThumbnail(`attachment://coin_${flipCoinResult.result}.png`);
}
