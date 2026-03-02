import { SlashCommand } from '@marquinhos/types';
import { GuildMember, SlashCommandBuilder } from 'discord.js';

const DATE_LOCALE_CONFIG: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Recife',
};

const WEEKDAY_LOCALE_CONFIG: Intl.DateTimeFormatOptions = {
  weekday: 'long',
};

export const checkIn: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('check-in')
    .setDescription('Receba um carimbo no seu passaporte do servidor!'),
  execute: async (interaction) => {
    const member = interaction.member as GuildMember;
    const guildName = interaction.guild?.name as string;

    if (!member) {
      await interaction.reply({
        content: 'Você não está em um servidor!',
        ephemeral: true,
      });
      return;
    }

    const memberJoinedDate = new Date(member.joinedTimestamp as number);
    const formatedMemberJoinedTimestamp = memberJoinedDate.toLocaleString(
      'pt-BR',
      DATE_LOCALE_CONFIG,
    );
    const dayOfTheWeekMemberJoined = memberJoinedDate.toLocaleString(
      'pt-BR',
      WEEKDAY_LOCALE_CONFIG,
    );

    const description = `Você entrou no **${guildName}** ${
      ['sábado', 'domingo'].includes(dayOfTheWeekMemberJoined) ? 'no' : 'na'
    } **${formatedMemberJoinedTimestamp}**`;

    const embed = interaction.client
      .baseEmbed()
      .setTitle('🛂 Passaporte do Servidor')
      .setColor(0x3498db)
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '👤 Cidadão', value: member.user.username, inline: true },
        {
          name: '🏷️ Apelido',
          value: member.nickname || 'Nenhum',
          inline: true,
        },
        {
          name: '📅 Data de Emissão (Entrada)',
          value: formatedMemberJoinedTimestamp,
          inline: false,
        },
        {
          name: '🗓️ Conta Criada em',
          value: member.user.createdAt.toLocaleDateString('pt-BR'),
          inline: false,
        },
      )
      .setDescription(description)
      .setFooter({
        text: `Passaporte oficial de ${guildName} | Carimbado com sucesso! ✅`,
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
  cooldown: 10,
};
