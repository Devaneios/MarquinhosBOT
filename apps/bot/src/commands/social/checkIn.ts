import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { baseEmbed, requireGuildMember } from '@marquinhos/utils/discord';
import { Command } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';

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

export class CheckInCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'check-in', cooldownDelay: 10_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription('Receba um carimbo no seu passaporte do servidor!'),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const member = requireGuildMember(interaction.member, interaction);
    const guildName = interaction.guild?.name ?? 'servidor desconhecido';

    if (member.joinedTimestamp === null) {
      await interaction.reply({
        content:
          'Não consegui encontrar a data em que você entrou no servidor.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const memberJoinedDate = new Date(member.joinedTimestamp);
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

    const embed = baseEmbed(this.container.client)
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
  }
}
