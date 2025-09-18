import { CommandInteraction, GuildMember } from 'discord.js';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';

const apiService = new MarquinhosApiService();

interface XPReward {
  command?: number;
  voiceJoin?: number;
  scrobble?: number;
  achievement?: number;
}

const XP_REWARDS: XPReward = {
  command: 5,
  voiceJoin: 2,
  scrobble: 3,
  achievement: 50,
};

export class XPSystem {
  private static cooldowns = new Map<string, number>();
  private static readonly COOLDOWN_TIME = 60000; // 1 minute

  static async addCommandXP(interaction: CommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    if (!guildId) return;

    // Check cooldown
    const cooldownKey = `${userId}-${guildId}`;
    const now = Date.now();
    const lastXpGain = this.cooldowns.get(cooldownKey) || 0;
    
    if (now - lastXpGain < this.COOLDOWN_TIME) return;

    try {
      await apiService.addXP(userId, guildId, XP_REWARDS.command || 5);
      this.cooldowns.set(cooldownKey, now);
    } catch (error) {
      console.error('Failed to add command XP:', error);
    }
  }

  static async addVoiceXP(member: GuildMember): Promise<void> {
    const userId = member.id;
    const guildId = member.guild.id;

    try {
      await apiService.addXP(userId, guildId, XP_REWARDS.voiceJoin || 2);
    } catch (error) {
      console.error('Failed to add voice XP:', error);
    }
  }

  static async addScrobbleXP(userId: string, guildId: string): Promise<void> {
    try {
      await apiService.addXP(userId, guildId, XP_REWARDS.scrobble || 3);
    } catch (error) {
      console.error('Failed to add scrobble XP:', error);
    }
  }

  static async checkAndNotifyLevelUp(userId: string, guildId: string, interaction?: CommandInteraction): Promise<void> {
    try {
      const userLevel = await apiService.getUserLevel(userId, guildId);
      
      if (userLevel?.data && interaction) {
        // Check if this is a level up by comparing timestamps
        const levelUpRecent = new Date(userLevel.data.lastXpGain).getTime() > (Date.now() - 10000);
        
        if (levelUpRecent) {
          const embed = interaction.client.baseEmbed()
            .setTitle('🎉 Level Up!')
            .setDescription(`Parabéns! Você subiu para o nível **${userLevel.data.level}**!`)
            .addFields(
              { name: 'XP Atual', value: userLevel.data.xp.toString(), inline: true },
              { name: 'XP Total', value: userLevel.data.totalXp.toString(), inline: true }
            );
          
          if (interaction.channel) {
            await interaction.followUp({ embeds: [embed] });
          }
        }
      }
    } catch (error) {
      console.error('Failed to check level up:', error);
    }
  }
}
