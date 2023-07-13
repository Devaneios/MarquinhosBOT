import { Client, EmbedBuilder, GuildMember, TextChannel } from 'discord.js';
import { BotEvent } from '../types';
import GuildModel from '../schemas/guild';

export const guildMemberAdd: BotEvent = {
  name: 'guildMemberAdd',
  execute: async (member: GuildMember) => {
    const guild = await GuildModel.findOne({ guildID: member.guild.id }).exec();
    const defaultChannel = member.guild.channels.cache.get(
      '680975188581416998' // TODO: add this as config in the database
    ) as TextChannel;
    defaultChannel.send(member.user.username + ' agora faz parte do motel!');
    const role = member.guild.roles.cache.find(
      (r) => r.id === guild.options.externalRoleId
    );
    member.roles.add(role);
    try {
      member.send(
        'Olá! Você foi colocado num cargo onde não é possível entrar em canais de voz. Favor contate um ' +
          '"Vice-Dono" ou o "Dono do Motel" e entre no canal de voz "Alone" para que seja atribuído um cargo e você possa ' +
          'usar o servidor normalmente! :D \n Outra coisa! Se possível, diminui o meu volume um pouquinho, eu posso ser ' +
          'um pouco barulhento nos fins de semana...'
      );
    } catch (error) {
      console.log(error);
    }

    const admin = member.guild.members.cache
      .filter((user) => user.id === member.guild.ownerId)
      .first();

    admin.send(
      `O usuário ${member.user.username} entrou no servidor e quer se registrar!`
    );

    const channel = member.guild.channels.cache.get(
      '739562824178729122' // TODO: add this as config in the database
    ) as TextChannel;

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
