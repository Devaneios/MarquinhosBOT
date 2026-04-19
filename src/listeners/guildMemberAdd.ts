import { env } from '@marquinhos/config/environment';
import { baseEmbed } from '@marquinhos/utils/discord';
import { logger } from '@marquinhos/utils/logger';
import { Listener } from '@sapphire/framework';
import { Events, GuildMember, TextChannel } from 'discord.js';

export class GuildMemberAddListener extends Listener<
  typeof Events.GuildMemberAdd
> {
  public constructor(context: Listener.LoaderContext) {
    super(context, { event: Events.GuildMemberAdd });
  }

  override async run(member: GuildMember) {
    const guildMemberAddEmbed = baseEmbed(member.client);
    const mainChannelId = env.GUILD_MAIN_CHANNEL_ID;
    const externalRoleId = env.GUILD_EXTERNAL_ROLE_ID;
    const newcomersChannelId = env.GUILD_NEWCOMERS_CHANNEL_ID;

    if (!mainChannelId || !externalRoleId || !newcomersChannelId) {
      logger.warn(
        'guildMemberAdd: Missing env vars GUILD_MAIN_CHANNEL_ID, GUILD_EXTERNAL_ROLE_ID, or GUILD_NEWCOMERS_CHANNEL_ID',
      );
      return;
    }

    const defaultChannel = member.guild.channels.cache.get(
      mainChannelId,
    ) as TextChannel;

    if (!defaultChannel) {
      logger.warn(`guildMemberAdd: Main channel ${mainChannelId} not found`);
      return;
    }

    await defaultChannel.send(
      `${member.user.username} agora faz parte do motel!`,
    );

    const role = member.guild.roles.cache.find((r) => r.id === externalRoleId);

    if (!role) {
      logger.warn(`guildMemberAdd: Role ${externalRoleId} not found`);
      return;
    }
    await member.roles.add(role);

    try {
      await member.send(
        'Olá! Você foi colocado num cargo onde não é possível entrar em canais de voz. Favor contate um ' +
          '"Vice-Dono" ou o "Dono do Motel" e entre no canal de voz "Alone" para que seja atribuído um cargo e você possa ' +
          'usar o servidor normalmente! :D \n Outra coisa! Se possível, diminui o meu volume um pouquinho, eu posso ser ' +
          'um pouco barulhento nos fins de semana...',
      );
    } catch {
      logger.warn(
        `guildMemberAdd: Could not DM user ${member.user.username} (DMs likely disabled)`,
      );
    }

    const guildMembers = await member.guild.members.fetch();

    const admin = guildMembers
      .filter((user) => user.id === member.guild.ownerId)
      .first();

    if (admin) {
      try {
        await admin.send(
          `O usuário ${member.user.username} entrou no servidor e quer se registrar!`,
        );
      } catch {
        logger.warn(`guildMemberAdd: Could not DM admin about new member`);
      }
    }

    const channel = member.guild.channels.cache.get(
      newcomersChannelId,
    ) as TextChannel;

    if (!channel) {
      logger.warn(
        `guildMemberAdd: Newcomers channel ${newcomersChannelId} not found`,
      );
      return;
    }

    await channel.send({
      embeds: [
        guildMemberAddEmbed
          .setThumbnail(member.user.avatarURL())
          .setColor('#0099ff')
          .setDescription(
            `**Boas vindas ao ${member.guild?.name},** <@${member.user.id}>\n
            Leia as regras para não tomar KICK/BAN e mantenha um bom relacionamento com o pessoal :sunglasses:\n`,
          )
          .setTimestamp()
          .setFooter({ text: 'Data de entrada' }),
      ],
    });
  }
}
