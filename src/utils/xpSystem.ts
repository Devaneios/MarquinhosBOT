import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { logger } from '@marquinhos/utils/logger';
import { CommandInteraction } from 'discord.js';

const apiService = new MarquinhosApiService();

// In-memory cooldown is a pre-filter optimisation — the backend is authoritative.
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
    } catch (error) {
      logger.error(`Failed to add command XP: ${error}`);
    }
  }
}
