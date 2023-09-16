import { Client, EmbedBuilder, GuildMember, TextChannel } from 'discord.js';
import { BotEvent } from '../types';
import GuildModel from '../schemas/guild';

export const guildMemberAdd: BotEvent = {
  name: 'guildMemberAdd',
  execute: async (member: GuildMember) => {
    const guild = await GuildModel.findOne({ guildID: member.guild.id }).exec();
    if (!guild) {
      throw new Error('Guild not found');
    }

    const mainChannelId = guild?.options?.mainChannelId;
    if (!mainChannelId) {
      throw new Error('Main channel not configured');
    }

    const defaultChannel = member.guild.channels.cache.get(
      mainChannelId
    ) as TextChannel;

    if (!defaultChannel) {
      throw new Error('Default channel not found');
    }

    await defaultChannel.send(
      member.user.username + ' agora faz parte do motel!'
    );

    const externalRoleId = guild?.options?.externalRoleId;

    if (!externalRoleId) {
      throw new Error('External role not configured');
    }

    const role = member.guild.roles.cache.find((r) => r.id === externalRoleId);
    await member.roles.add(role);
    try {
      member.send(
        'Olá! Você foi colocado num cargo onde não é possível entrar em canais de voz. Favor contate um ' +
          '"Vice-Dono" ou o "Dono do Motel" e entre no canal de voz "Alone" para que seja atribuído um cargo e você possa ' +
          'usar o servidor normalmente! :D \n Outra coisa! Se possível, diminui o meu volume um pouquinho, eu posso ser ' +
          'um pouco barulhento nos fins de semana...'
      );
    } catch (error) {
      throw new Error('Error sending message to user');
    }

    const guildMembers = await member.guild.members.fetch();

    const admin = guildMembers
      .filter((user) => user.id === member.guild.ownerId) // TODO: Add other admins to the filter
      .first();

    if (!admin) throw new Error('ADMIN NOT FOUND!!!');

    await admin.send(
      `O usuário ${member.user.username} entrou no servidor e quer se registrar!`
    ); // TODO: Improve this with buttons to accept or deny the user

    const newcomersChannelId = guild?.options?.newcomersChannelId;
    if (!newcomersChannelId) {
      throw new Error('Newcomers channel not configured');
    }

    const channel = member.guild.channels.cache.get(
      newcomersChannelId
    ) as TextChannel;

    if (!channel) {
      throw new Error('Newcomers channel not found');
    }

    channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(`Olá ${member.user.username}`)
          .setThumbnail(member.user.avatarURL())
          .setColor('#0099ff')
          .addFields({
            name: `Boas vindas ao ${member.guild?.name}`,
            value:
              'Leia as regras para não tomar KICK/BAN e mantenha um bom relacionamento com o pessoal :sunglasses: ',
          })
          .setTimestamp()
          .setFooter({ text: 'Data de entrada' }),
      ],
    });
  },
};
