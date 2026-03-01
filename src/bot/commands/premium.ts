import { SlashCommand } from '@marquinhos/types';
import { SlashCommandBuilder } from 'discord.js';

export const premium: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('premium')
    .setDescription('Sistema premium do bot')
    .addSubcommand((subcommand) =>
      subcommand.setName('info').setDescription('Informações sobre o premium'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('subscribe')
        .setDescription('Assinar premium')
        .addStringOption((option) =>
          option
            .setName('plano')
            .setDescription('Plano de assinatura')
            .setRequired(true)
            .addChoices(
              { name: 'Básico - R$ 9,90/mês', value: 'basic' },
              { name: 'Premium - R$ 19,90/mês', value: 'premium' },
              { name: 'Vitalício - R$ 199,90', value: 'lifetime' },
            ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Status da sua assinatura'),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('donate').setDescription('Fazer uma doação'),
    ),
  execute: async (interaction) => {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'info':
        const infoEmbed = interaction.client
          .baseEmbed()
          .setTitle('💎 Marquinhos Premium')
          .setDescription('Desbloqueie recursos exclusivos!')
          .addFields(
            {
              name: '🆓 Plano Gratuito',
              value:
                '• Comandos básicos\n• 5 playlists\n• Recomendações limitadas',
              inline: true,
            },
            {
              name: '⭐ Plano Básico',
              value:
                '• Playlists ilimitadas\n• Prioridade na fila\n• Estatísticas avançadas',
              inline: true,
            },
            {
              name: '💎 Plano Premium',
              value:
                '• Todos os recursos\n• Themes exclusivos\n• Recursos beta\n• Suporte prioritário',
              inline: true,
            },
          );

        await interaction.editReply({ embeds: [infoEmbed] });
        break;

      case 'subscribe':
        const plan = interaction.options.getString('plano');
        const planNames = {
          basic: 'Básico',
          premium: 'Premium',
          lifetime: 'Vitalício',
        };

        const subscribeEmbed = interaction.client
          .baseEmbed()
          .setTitle('💳 Assinatura Premium')
          .setDescription(
            `Você selecionou o plano **${planNames[plan as keyof typeof planNames]}**`,
          )
          .addFields(
            {
              name: 'Próximo Passo',
              value: 'Acesse nosso site para finalizar a compra',
              inline: false,
            },
            {
              name: 'Link de Pagamento',
              value: 'https://marquinhos.dev/premium',
              inline: false,
            },
          );

        await interaction.editReply({ embeds: [subscribeEmbed] });
        break;

      case 'status':
        const statusEmbed = interaction.client
          .baseEmbed()
          .setTitle('💎 Status Premium')
          .addFields(
            { name: 'Plano Atual', value: 'Gratuito', inline: true },
            { name: 'Recursos Usados', value: '3/5 playlists', inline: true },
            { name: 'Próxima Renovação', value: 'N/A', inline: true },
          );

        await interaction.editReply({ embeds: [statusEmbed] });
        break;

      case 'donate':
        const donateEmbed = interaction.client
          .baseEmbed()
          .setTitle('❤️ Apoie o Desenvolvimento')
          .setDescription('Sua doação ajuda a manter o bot funcionando!')
          .addFields(
            { name: 'PayPal', value: 'paypal.me/marquinhosbot', inline: false },
            { name: 'PIX', value: 'marquinhos@bot.com', inline: false },
          );

        await interaction.editReply({ embeds: [donateEmbed] });
        break;
    }
  },
  cooldown: 10,
};
