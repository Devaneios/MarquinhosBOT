import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { FlipCoinResult } from '@marquinhos/types';
import { baseEmbed } from '@marquinhos/utils/discord';
import { resourcePath } from '@marquinhos/utils/resources';
import { sleep } from '@marquinhos/utils/sleep';
import { Command } from '@sapphire/framework';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
} from 'discord.js';

export class CoinCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'moeda', cooldownDelay: 10_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription('Tiro cara ou coroa numa moeda semi-viciada.'),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('coin_heads')
        .setLabel('Cara')
        .setEmoji('🪙')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('coin_tails')
        .setLabel('Coroa')
        .setEmoji('👑')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('coin_only_flip')
        .setLabel('Apenas lançar')
        .setStyle(ButtonStyle.Secondary),
    );

    const initialEmbed = baseEmbed(this.container.client)
      .setTitle('🪙 Cara ou Coroa?')
      .setDescription('Faça sua aposta ou apenas lance a moeda!');

    const response = await interaction.reply({
      embeds: [initialEmbed],
      components: [row],
      fetchReply: true,
    });

    try {
      const confirmation = await response.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id,
        time: 30000,
        componentType: ComponentType.Button,
      });

      await confirmation.deferUpdate();
      await interaction.editReply({
        embeds: [initialEmbed.setDescription('Lançando a moeda... 🪙')],
        components: [],
      });

      const flipCoinResult = await flipCoin();

      if (flipCoinResult.result === null) {
        return interaction.editReply({
          content: 'A moeda caiu no ralo e não consegui ver o resultado.',
          embeds: [],
        });
      }

      const attachment = new AttachmentBuilder(
        resourcePath(
          'images',
          `coin_${flipCoinResult.result.toLowerCase()}.png`,
        ),
      );

      const coinEmbed = buildCoinEmbed(
        baseEmbed(this.container.client),
        flipCoinResult,
      );

      let choice: string | null = null;
      if (confirmation.customId === 'coin_heads') choice = 'Cara';
      if (confirmation.customId === 'coin_tails') choice = 'Coroa';

      if (choice) {
        if (choice === flipCoinResult.result) {
          coinEmbed.setDescription(
            `Boa! Você apostou em **${choice}** e acertou!\n\nForam feitas ${
              flipCoinResult.count
            } tentativas durante ${(flipCoinResult.elapsedTime / 1000).toFixed(
              2,
            )}s.`,
          );
        } else {
          coinEmbed.setDescription(
            `Ih! Você apostou em **${choice}** e errou!\n\nForam feitas ${
              flipCoinResult.count
            } tentativas durante ${(flipCoinResult.elapsedTime / 1000).toFixed(
              2,
            )}s.`,
          );
        }
      }

      await interaction.editReply({
        content: '',
        embeds: [coinEmbed],
        files: [attachment],
      });
    } catch (_e) {
      await interaction.editReply({
        content: 'Tempo esgotado para escolher!',
        embeds: [],
        components: [],
      });
    }
  }
}

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

function buildCoinEmbed(
  embed: EmbedBuilder,
  flipCoinResult: FlipCoinResult,
): EmbedBuilder {
  return embed
    .setTimestamp()
    .setTitle(`Deu ${flipCoinResult.result}!`)
    .setDescription(
      `Foram feitas ${flipCoinResult.count} tentativas durante ${(
        flipCoinResult.elapsedTime / 1000
      ).toFixed(2)}s.`,
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
      },
    )
    .setThumbnail(
      `attachment://coin_${flipCoinResult.result.toLowerCase()}.png`,
    );
}
