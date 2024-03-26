import { SlashCommandBuilder, EmbedBuilder, GuildMember } from 'discord.js';

import { SlashCommand } from '@marquinhos/types';
import { getCoinBalance } from '@marquinhos/services/coinBalanceManager';

export const balance: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('saldo')
    .setDescription('Retorna o seu saldo de moedas'),
  execute: async (interaction) => {
    const balance = await getCoinBalance(
      interaction.user.id,
      interaction.guild?.id ?? ''
    );

    const balanceEmbed = new EmbedBuilder();

    balanceEmbed
      .setColor('#0099ff')
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({
        text: 'Marquinhos Bot ™️',
        iconURL: interaction.client.user?.displayAvatarURL(),
      });

    if (balance === null) {
      balanceEmbed
        .setTitle('Sem saldo')
        .setDescription(
          'Você ainda não possui saldo. Tente ganhar quinhões fazendo atividades no servidor para ganhar moedas.'
        );
    } else {
      balanceEmbed
        .setTitle(
          `Saldo de ${
            (interaction.member as GuildMember).nickname ??
            interaction.user.username
          }`
        )
        .addFields({
          name: 'Saldo Atual',
          value: `:coin: ${formatBalance(balance)}`,
          inline: true,
        });
    }

    interaction.reply({ embeds: [balanceEmbed] });
  },
  cooldown: 10,
};

function formatBalance(amount: Number) {
  if (amount === 0) return '0 Quinhões';
  if (amount === 1) return '1 Quinhão';
  return `${amount} Quinhões`;
}
