import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import {
  buildTermoLeaderboardImage,
  denseRanks,
  type DailyEntry,
} from '@marquinhos/ui/screens/termo';
import { fetchAvatarBuffer } from '@marquinhos/utils/discord';
import type { Client } from 'discord.js';

const api = MarquinhosApiService.getInstance();

export interface DailyLeaderboardImage {
  buffer: Buffer;
  groupStreak: number;
}

// Shared by sendTermoLeaderboard (the once-daily final ranking, posted right
// before the word rotates) and broadcastTermoStats (the every-2-hours
// "Status do Termo" broadcast) — both show today's Wordle standings as the
// same retro leaderboard card, just under different embeds/titles.
export async function buildDailyLeaderboardAttachment(
  client: Client<true>,
  guildId: string,
): Promise<DailyLeaderboardImage | null> {
  const response = await api.getWordleLeaderboard(guildId, 'daily');
  const rawEntries = response.data as {
    userId: string;
    attempts: number;
    solved: boolean;
  }[];
  const { groupStreak } = response;

  if (!rawEntries || rawEntries.length === 0) return null;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;

  const userIds = rawEntries.map((e) => e.userId);
  const membersCollection = await guild.members
    .fetch({ user: userIds })
    .catch(() => null);

  const ranks = denseRanks(
    rawEntries.map((e) => (e.solved ? `s:${e.attempts}` : 'u')),
  );
  const entries: DailyEntry[] = await Promise.all(
    rawEntries.map(async (e, i) => {
      const member = membersCollection?.get(e.userId);
      const avatar = member ? await fetchAvatarBuffer(member) : undefined;
      return {
        rank: ranks[i],
        displayName: member?.displayName ?? `<@${e.userId}>`,
        attempts: e.attempts,
        solved: e.solved,
        avatar,
      };
    }),
  );

  const buffer = await buildTermoLeaderboardImage(
    entries,
    'daily',
    groupStreak,
  );
  return { buffer, groupStreak };
}
