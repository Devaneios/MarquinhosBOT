import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { SlashCommand } from '@marquinhos/types';
import { createCanvas, registerFont } from 'canvas';
import {
  AttachmentBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { fileURLToPath, URL } from 'url';

type LetterFeedback = 'correct' | 'present' | 'absent';

interface WordleGuessResult {
  guess: string;
  feedback: LetterFeedback[];
  guesses: { guess: string; feedback: LetterFeedback[] }[];
  solved: boolean;
  attempts: number;
  wordLength: number;
}

const api = MarquinhosApiService.getInstance();

registerFont(
  fileURLToPath(
    new URL('../../resources/fonts/BebasNeueRegular.ttf', import.meta.url),
  ),
  { family: 'Bebas Neue' },
);

const KEY_SIZE = 52;
const KEY_GAP = 6;
const PADDING = 16;
const CORNER_RADIUS = 6;
const BG_COLOR = '#121213';
const KEY_COLORS: Record<LetterFeedback | 'unused', string> = {
  correct: '#538d4e',
  present: '#b59f3b',
  absent: '#3a3a3c',
  unused: '#818384',
};
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

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
    rows.push(`${'⬜'.repeat(wordLength)} *(sem tentativas ainda)*`);
  }
  return rows.join('\n');
}

function buildKeyboardImage(
  guesses: { guess: string; feedback: LetterFeedback[] }[],
): Buffer {
  const letterState: Record<string, LetterFeedback> = {};
  const priority: Record<LetterFeedback, number> = {
    correct: 3,
    present: 2,
    absent: 1,
  };

  for (const { guess, feedback } of guesses) {
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i];
      const current = letterState[letter];
      if (!current || priority[feedback[i]] > priority[current]) {
        letterState[letter] = feedback[i];
      }
    }
  }

  const maxKeys = ROWS.reduce((m, r) => Math.max(m, r.length), 0);
  const canvasWidth =
    PADDING * 2 + maxKeys * KEY_SIZE + (maxKeys - 1) * KEY_GAP;
  const canvasHeight =
    PADDING * 2 + ROWS.length * KEY_SIZE + (ROWS.length - 1) * KEY_GAP;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(KEY_SIZE * 0.55)}px "Bebas Neue"`;

  ROWS.forEach((row, rowIndex) => {
    const rowWidth = row.length * KEY_SIZE + (row.length - 1) * KEY_GAP;
    const rowX = (canvasWidth - rowWidth) / 2;
    const rowY = PADDING + rowIndex * (KEY_SIZE + KEY_GAP);

    row.split('').forEach((letter, colIndex) => {
      const x = rowX + colIndex * (KEY_SIZE + KEY_GAP);
      const y = rowY;

      const state = letterState[letter] ?? 'unused';
      ctx.fillStyle = KEY_COLORS[state];
      ctx.beginPath();
      ctx.roundRect(x, y, KEY_SIZE, KEY_SIZE, CORNER_RADIUS);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(letter.toUpperCase(), x + KEY_SIZE / 2, y + KEY_SIZE / 2);
    });
  });

  return canvas.toBuffer('image/png');
}

export const termo: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('termo')
    .setDescription('Jogue o Termo — adivinhe a palavra do dia!')
    .addStringOption((opt) =>
      opt
        .setName('palpite')
        .setDescription('Sua tentativa')
        .setRequired(true)
        .setMinLength(5)
        .setMaxLength(6),
    ),

  execute: async (interaction) => {
    if (!interaction.guildId) {
      await interaction.reply({
        content: '❌ O Termo só pode ser jogado em servidores.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const guess = interaction.options.getString('palpite', true).trim();

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let result: WordleGuessResult;
    try {
      const response = await api.submitWordleGuess(
        interaction.user.id,
        interaction.guildId,
        guess,
      );
      result = response.data as WordleGuessResult;
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Erro ao processar tentativa.';
      await interaction.editReply({ content: `❌ ${message}` });
      return;
    }

    const keyboardBuffer = buildKeyboardImage(result.guesses);
    const attachment = new AttachmentBuilder(keyboardBuffer, {
      name: 'keyboard.png',
    });

    const embed = interaction.client.baseEmbed();
    embed.setTitle('🟩 Termo — Palavra do Dia');
    embed.addFields({
      name: `Tentativas (${result.attempts})`,
      value: buildGuessGrid(result.guesses, result.wordLength),
    });
    embed.setImage('attachment://keyboard.png');

    if (result.solved) {
      embed.setDescription(
        `🎉 Você acertou em **${result.attempts}** tentativa${result.attempts > 1 ? 's' : ''}!`,
      );
      embed.setColor(0x57f287);
    }

    await interaction.editReply({ embeds: [embed], files: [attachment] });

    // Post public message in the configured Termo channel only when solved
    if (result.solved) {
      try {
        const configResponse = await api.getWordleConfig(interaction.guildId);
        const channelId = (configResponse.data as { channelId?: string })
          ?.channelId;
        if (!channelId) return;

        const channel = await interaction
          .guild!.channels.fetch(channelId)
          .catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const allSquares = result.guesses
          .map((g) => feedbackToSquares(g.feedback))
          .join('\n');

        const publicMsg = `${interaction.user} acertou o Termo em ${result.attempts} tentativa${result.attempts > 1 ? 's' : ''}! 🎉\n${allSquares}`;

        await channel.send(publicMsg);
      } catch {
        // Silently ignore if channel config is missing or send fails
      }
    }
  },
  cooldown: 3,
};
