import { Client, GuildMember, Message } from 'discord.js';
import { Command } from '../../types';

export const allowMember: Command = {
  name: 'permitir',
  execute: async (message: Message, args: string[]) => {
    const { BASE_ROLE_NAME, EXTERNAL_ROLE_NAME } = message.guild
      ?.client as Client;
    const { baseRole, outsidersRole } = await getRoles(message);
    if (!baseRole || !outsidersRole) return;

    const targetUser = await getTargetUserIfValid(message, args);
    if (!targetUser) return;

    await targetUser.roles.add(baseRole);
    await targetUser.roles.remove(outsidersRole);

    if (
      userHasRole(targetUser, BASE_ROLE_NAME) &&
      !userHasRole(targetUser, EXTERNAL_ROLE_NAME)
    ) {
      return message.reply('Permissão concedida com sucesso');
    }

    return message.reply('Algo deu errado, tente novamente');
  },
  cooldown: 10,
  aliases: [],
  permissions: [],
};

const getTargetUserIfValid = async (
  message: Message,
  args: string[]
): Promise<GuildMember | null> => {
  const client = message.guild?.client as Client;

  if (!userIsVIP(message)) return null;
  if (!usernameIsPresent(message, args)) return null;

  const userName = args.slice(1).join(' ');
  const targetUser = await findUser(message, userName);
  if (!targetUser) return null;

  if (await userAlreadyHasPermissions(targetUser, client, message)) return null;

  return targetUser;
};

const userHasRole = (user: GuildMember | null, roleName: string) => {
  return user?.roles.cache.some((role) => role.name === roleName);
};

const userIsVIP = async (message: Message) => {
  if (!(message.guild?.client as Client).VIP_ROLE_NAME) {
    await message.reply('Não existe um cargo VIP configurado');
    return false;
  }
  if (
    !userHasRole(
      message.member,
      (message.guild?.client as Client).VIP_ROLE_NAME
    )
  ) {
    await message.reply(
      'Você precisar ser um cliente VIP pra usar esse comando'
    );

    return false;
  }
  return true;
};

const usernameIsPresent = async (message: Message, args: string[]) => {
  const containUsername = args.length >= 2;
  if (!containUsername) {
    await message.reply(
      'Você precisar digitar o user da pessoa que você quer dar permissão'
    );
    return false;
  }
  return true;
};

const findUser = async (message: Message, userName: string) => {
  const allMembers = await message.guild?.members.fetch();

  const targetUser = allMembers
    ?.filter(
      (member) =>
        member.user.tag == userName || member.user.username == userName
    )
    .first();

  if (!targetUser) {
    await message.reply('Usuário não encontrado');
    return null;
  }

  return targetUser;
};

const userAlreadyHasPermissions = async (
  targetUser: GuildMember,
  client: Client,
  message: Message
) => {
  const userAlreadyHasPermission =
    userHasRole(targetUser, client.BASE_ROLE_NAME) &&
    !userHasRole(targetUser, client.EXTERNAL_ROLE_NAME);

  if (userAlreadyHasPermission) {
    await message.reply('Usuário já possui permissões');
    return true;
  }
  return false;
};

const getRoles = async (message: Message) => {
  const client = message.guild?.client as Client;

  const baseRole = message.guild?.roles.cache.find(
    (role) => role.name === client.BASE_ROLE_NAME
  );
  const outsidersRole = message.guild?.roles.cache.find(
    (role) => role.name === client.EXTERNAL_ROLE_NAME
  );

  if (!baseRole) {
    await message.reply('Parece que não existe um cargo base');
  } else if (!outsidersRole) {
    await message.reply('Parece que não existe um cargo de outsiders');
  }

  return { baseRole, outsidersRole };
};
