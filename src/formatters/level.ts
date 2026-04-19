import { UserLevel } from '@marquinhos/types';
import { baseEmbed, type BaseEmbedClient } from '@marquinhos/utils/discord';
import { EmbedBuilder, User } from 'discord.js';

export function buildLevelEmbed(
  client: BaseEmbedClient,
  user: User,
  data: UserLevel,
): EmbedBuilder {
  const requiredXP = Math.floor(Math.pow(data.level + 1, 2) * 100);
  const progressPercentage = Math.floor((data.xp / requiredXP) * 100);

  return baseEmbed(client)
    .setColor(getColorForLevel(data.level))
    .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
    .setTitle('🌟 Cartão de Nível')
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setDescription(
      `**Cargo Atual:** ${getBadgeForLevel(data.level)}\n\n` +
        `**Nível:** \`${data.level}\`\n` +
        `**Experiência:** \`${data.xp} / ${requiredXP} XP\`\n\n` +
        `**Progresso:**\n` +
        `${createProgressBar(progressPercentage)} \`${progressPercentage}%\`\n\n` +
        `*XP Total Acumulado: ${data.totalXp}*`,
    );
}

export function createProgressBar(percentage: number): string {
  const filled = Math.floor(percentage / 10);
  const empty = 10 - filled;
  return '🟩'.repeat(filled) + '⬛'.repeat(empty);
}

export function getBadgeForLevel(level: number): string {
  if (level < 10) return '🌱 Iniciante';
  if (level < 20) return '🥉 Aventureiro de Bronze';
  if (level < 30) return '🥈 Cavaleiro de Prata';
  if (level < 40) return '🥇 Herói de Ouro';
  if (level < 50) return '💎 Lenda de Diamante';
  return '👑 Mestre Supremo';
}

export function getColorForLevel(level: number): number {
  if (level < 10) return 0x2ecc71;
  if (level < 20) return 0xcd7f32;
  if (level < 30) return 0xc0c0c0;
  if (level < 40) return 0xffd700;
  if (level < 50) return 0xb9f2ff;
  return 0x9b59b6;
}
