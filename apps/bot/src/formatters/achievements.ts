import { UserAchievement } from '@marquinhos/types';
import { baseEmbed, type BaseEmbedClient } from '@marquinhos/utils/discord';
import { EmbedBuilder, User } from 'discord.js';

export const RARITY_ORDER = ['legendary', 'epic', 'rare', 'common'] as const;
type Rarity = (typeof RARITY_ORDER)[number];

export const RARITY_LABELS: Record<Rarity, string> = {
  legendary: '🌟 Lendárias',
  epic: '💜 Épicas',
  rare: '💙 Raras',
  common: '⚪ Comuns',
};

export function groupByRarity(
  achievements: UserAchievement[],
): Record<Rarity, UserAchievement[]> {
  const result: Record<Rarity, UserAchievement[]> = {
    legendary: [],
    epic: [],
    rare: [],
    common: [],
  };
  for (const a of achievements) {
    if (a.rarity in result) result[a.rarity].push(a);
  }
  return result;
}

export function buildAchievementsEmbed(
  client: BaseEmbedClient,
  user: User,
  achievements: UserAchievement[],
): EmbedBuilder {
  const byRarity = groupByRarity(achievements);
  const embed = baseEmbed(client)
    .setTitle(`🏆 Conquistas de ${user.username}`)
    .setThumbnail(user.displayAvatarURL())
    .setFooter({ text: `Total: ${achievements.length} conquistas` });

  for (const rarity of RARITY_ORDER) {
    const list = byRarity[rarity];
    if (list.length === 0) continue;
    embed.addFields({
      name: RARITY_LABELS[rarity],
      value: list.map((a) => `${a.icon} **${a.name}**`).join('\n'),
      inline: false,
    });
  }

  return embed;
}
