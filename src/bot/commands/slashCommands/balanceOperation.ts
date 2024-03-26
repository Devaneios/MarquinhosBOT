import { SlashCommandBuilder } from '@discordjs/builders';
import {
  addCoins,
  resetCoins,
  subtractCoins,
  updateCoinBalance,
} from '@marquinhos/services/coinBalanceManager';
import { BalanceChangeStatus, BalanceOperationType } from '@marquinhos/types';
import {
  BaseInteraction,
  CommandInteraction,
  CommandInteractionOptionResolver,
  EmbedBuilder,
  PermissionsBitField,
} from 'discord.js';

export const balanceOperation = {
  command: new SlashCommandBuilder()
    .setName('atualizar-saldo')
    .setDescription('Execute operações no saldo')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('adicionar')
        .setDescription('Adiciona moedas ao saldo')
        .addIntegerOption((option) =>
          option
            .setName('valor')
            .setDescription('A quantidade de moedas a adicionar')
            .setRequired(true)
        )
        .addUserOption((option) =>
          option
            .setName('usuário')
            .setDescription('O usuário que receberá as moedas')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('subtrair')
        .setDescription('Subtrai moedas do saldo')
        .addIntegerOption((option) =>
          option
            .setName('valor')
            .setDescription('A quantidade de moedas a subtrair')
            .setRequired(true)
        )
        .addUserOption((option) =>
          option
            .setName('usuário')
            .setDescription('O usuário que terá as moedas subtraídas')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('definir')
        .setDescription('Define um novo saldo')
        .addIntegerOption((option) =>
          option
            .setName('valor')
            .setDescription('O novo saldo')
            .setRequired(true)
        )
        .addUserOption((option) =>
          option
            .setName('usuário')
            .setDescription('O usuário que terá o saldo definido')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remover')
        .setDescription('Apaga o saldo atual')
        .addUserOption((option) =>
          option
            .setName('usuário')
            .setDescription('O usuário que terá o saldo apagado')
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  execute: async (interaction: CommandInteraction) => {
    const subcommand = (
      interaction.options as CommandInteractionOptionResolver
    ).getSubcommand();

    const amount = interaction.options.get('valor')?.value as number;

    const baseEmbed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Operação no saldo')
      .setTimestamp()
      .setFooter({
        text: 'Marquinhos Bot ™️',
        iconURL: interaction.client.user?.displayAvatarURL(),
      });

    let operationResult: BalanceChangeStatus & {
      operationType: BalanceOperationType | null;
    } = {
      operationSuccess: false,
      statementCreated: false,
      validAmount: false,
      operationType: null,
    };
    const user = interaction.options.get('usuário')?.user;

    switch (subcommand) {
      case 'adicionar': {
        operationResult = {
          ...(await addCoins(
            user?.id ?? '',
            interaction.guild?.id ?? '',
            amount,
            interaction.user.id
          )),
          operationType: 'add',
        };

        break;
      }
      case 'subtrair': {
        operationResult = {
          ...(await subtractCoins(
            user?.id ?? '',
            interaction.guild?.id ?? '',
            amount,
            interaction.user.id
          )),
          operationType: 'subtract',
        };
        break;
      }
      case 'definir': {
        operationResult = {
          ...(await updateCoinBalance(
            user?.id ?? '',
            interaction.guild?.id ?? '',
            amount,
            interaction.user.id
          )),
          operationType: 'set',
        };
        break;
      }
      case 'remover': {
        operationResult = {
          ...(await resetCoins(
            user?.id ?? '',
            interaction.guild?.id ?? '',
            interaction.user.id
          )),
          operationType: 'reset',
        };
        break;
      }
    }
    const replyContent = operationReply(
      operationResult,
      amount,
      user?.username ?? ''
    );

    baseEmbed.setTitle(replyContent.title);
    baseEmbed.setDescription(replyContent.description);

    await interaction.reply({
      embeds: [baseEmbed],
      ephemeral: true,
    });
  },
};

function operationReply(
  operationResult: BalanceChangeStatus & {
    operationType: BalanceOperationType | null;
  },
  amount: number,
  username: string
): { title: string; description: string } {
  if (operationResult.operationSuccess) {
    switch (operationResult.operationType) {
      case 'add':
        return {
          title: 'Operação bem-sucedida',
          description: `Adicionado ${amount} quinhões ao saldo de ${username}.`,
        };
      case 'subtract':
        return {
          title: 'Operação bem-sucedida',
          description: `Subtraido ${amount} quinhões do saldo de ${username}.`,
        };
      case 'reset':
        return {
          title: 'Operação bem-sucedida',
          description: `O saldo de ${username} foi removido.`,
        };
      case 'set':
        return {
          title: 'Operação bem-sucedida',
          description: `O saldo de ${username} foi definido para ${amount}.`,
        };
      default:
        return {
          title: 'Erro na operação',
          description: 'Tipo de operação inválido.',
        };
    }
  } else if (!operationResult.validAmount) {
    return {
      title: 'Erro na operação',
      description: 'O valor deve ser um número maior que 0.',
    };
  } else {
    return {
      title: 'Erro na operação',
      description: 'Ocorreu um erro ao executar a operação.',
    };
  }
}
