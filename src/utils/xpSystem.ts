import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { CommandInteraction, GuildMember } from 'discord.js';

const apiService = new MarquinhosApiService();

// In-memory cooldown is a pre-filter optimization — the backend is authoritative.
const cooldowns = new Map<string, number>();
const COMMAND_COOLDOWN_MS = 60_000;

export class XPSystem {
  static async addCommandXP(interaction: CommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    if (!guildId) return;

    const key = `${userId}-${guildId}`;
    const now = Date.now();
    if (now - (cooldowns.get(key) ?? 0) < COMMAND_COOLDOWN_MS) return;

    try {
      const response = await apiService.addXP(userId, guildId, 'command');
      const result = response?.data;
      if (!result || result.onCooldown) return;

      cooldowns.set(key, now);

      if (result.leveledUp && result.newLevel && interaction.channel) {
        const embed = interaction.client
          .baseEmbed()
          .setTitle('🎉 Level Up!')
          .setDescription(
            `Parabéns <@${userId}>! Você subiu para o nível **${result.newLevel}**!`,
          )
          .addFields(
            {
              name: '⚡ XP Atual',
              value: result.userLevel.xp.toString(),
              inline: true,
            },
            {
              name: '📈 XP Total',
              value: result.userLevel.totalXp.toString(),
              inline: true,
            },
          );
        await interaction.followUp({ embeds: [embed] });
      }

      if (result.unlockedAchievements.length > 0 && interaction.channel) {
        await interaction.followUp({
          content: `🏆 Nova conquista desbloqueada! Use \`/achievements\` para ver.`,
        });
      }
    } catch (error) {
      console.error('Failed to add command XP:', error);
    }
  }

  static async addVoiceXP(member: GuildMember): Promise<void> {
    try {
      await apiService.addXP(member.id, member.guild.id, 'voice_join');
    } catch (error) {
      console.error('Failed to add voice XP:', error);
    }
  }

  static async addScrobbleXP(userId: string, guildId: string): Promise<void> {
    try {
      await apiService.addXP(userId, guildId, 'scrobble');
    } catch (error) {
      console.error('Failed to add scrobble XP:', error);
    }
  }
}
