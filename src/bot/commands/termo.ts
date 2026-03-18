import { SlashCommand } from '@marquinhos/types';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { MessageFlags, SlashCommandBuilder, TextChannel } from 'discord.js';

type LetterFeedback = 'correct' | 'present' | 'absent';

const api = new MarquinhosApiService();

const SQUARE: Record<LetterFeedback, string> = {
  correct: '🟩',
  present: '🟨',
  absent: '⬛',
};

function feedbackToSquares(feedback: LetterFeedback[]): string {
  return feedback.map((f) => SQUARE[f]).join('');
}

function buildGuessGrid(
  guesses: { guess: string; feedback: LetterFeedback[] }[],
  wordLength: number,
): string {
  const rows = guesses.map(
    (g) => `\`${g.guess.toUpperCase()}\` ${feedbackToSquares(g.feedback)}`,
  );
  if (rows.length === 0) {
    rows.push('⬜'.repeat(wordLength) + ' *(sem tentativas ainda)*');
  }
  return rows.join('\n');
}

function buildKeyboard(guesses: { guess: string; feedback: LetterFeedback[] }[]): string {
  const letterState: Record<string, LetterFeedback> = {};
  const priority: Record<LetterFeedback, number> = { correct: 3, present: 2, absent: 1 };

  for (const { guess, feedback } of guesses) {
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i];
      const current = letterState[letter];
      if (!current || priority[feedback[i]] > priority[current]) {
        letterState[letter] = feedback[i];
      }
    }
  }

  const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  return rows
    .map((row) =>
      row
        .split('')
        .map((l) => {
          const state = letterState[l];
          if (state === 'correct') return `🟩`;
          if (state === 'present') return `🟨`;
          if (state === 'absent') return `⬛`;
          return `🔲`;
        })
        .join(''),
    )
    .join('\n');
}

export const termo: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('termo')
    .setDescription('Jogue o Termo — adivinhe a palavra do dia!')
    .addStringOption((opt) =>
      opt
        .setName('palpite')
        .setDescription('Sua tentativa')
        .setRequired(true),
    ),

  execute: async (interaction) => {
    const guess = interaction.options.getString('palpite', true);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let result: any;
    try {
      const response = await api.submitWordleGuess(
        interaction.user.id,
        interaction.guildId!,
        guess,
      );
      result = response.data;
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? 'Erro ao processar tentativa.';
      await interaction.editReply({ content: `❌ ${message}` });
      return;
    }

    const embed = interaction.client.baseEmbed();
    embed.setTitle('🟩 Termo — Palavra do Dia');

    const grid = buildGuessGrid(result.guesses, result.wordLength);
    const keyboard = buildKeyboard(result.guesses);

    embed.addFields(
      { name: `Tentativas (${result.attempts})`, value: grid },
      { name: 'Teclado', value: keyboard },
    );

    if (result.solved) {
      embed.setDescription(
        `🎉 Você acertou em **${result.attempts}** tentativa${result.attempts > 1 ? 's' : ''}!`,
      );
      embed.setColor(0x57f287);
    }

    await interaction.editReply({ embeds: [embed] });

    // Post public message in the configured Termo channel
    try {
      const configResponse = await api.getWordleConfig(interaction.guildId!);
      const channelId = (configResponse.data as any)?.channelId;
      if (!channelId) return;

      const channel = interaction.client.channels.cache.get(channelId) as
        | TextChannel
        | undefined;
      if (!channel) return;

      const latestGuess = result.guesses[result.guesses.length - 1];
      const squares = feedbackToSquares(latestGuess.feedback);

      let publicMsg = `${interaction.user} está jogando Termo — Tentativa ${result.attempts}:\n${squares}`;
      if (result.solved) {
        publicMsg = `${interaction.user} acertou o Termo em ${result.attempts} tentativa${result.attempts > 1 ? 's' : ''}! 🎉\n${squares}`;
      }

      await channel.send(publicMsg);
    } catch {
      // Silently ignore if channel config is missing or send fails
    }
  },
  cooldown: 3,
};
