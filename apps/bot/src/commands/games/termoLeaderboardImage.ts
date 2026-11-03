import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import {
  buildTermoLeaderboardImage,
  type DailyEntry,
} from '@marquinhos/ui/screens/termo';
import { fetchAvatarBuffer } from '@marquinhos/utils/discord';
import {
  AttachmentBuilder,
  EmbedBuilder,
  type Client,
  type TextChannel,
} from 'discord.js';
import { collectVerifiedLeaderboard } from './termoLeaderboardMembers';
import { buildTermoWinActionRow } from './termoResponse';

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
  wordDate?: string,
): Promise<DailyLeaderboardImage | null> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;
  const { entries: verified, groupStreak } = await collectVerifiedLeaderboard(
    (offset) =>
      offset === 0
        ? api.getWordleLeaderboard(guildId, 'daily', wordDate)
        : api.getWordleLeaderboard(guildId, 'daily', wordDate, offset),
    (user) => guild.members.fetch({ user }),
  );
  if (verified.length === 0) return null;

  const entries: DailyEntry[] = await Promise.all(
    verified.map(async ({ entry: e, member }, i) => {
      const avatar = await fetchAvatarBuffer(member);
      return {
        rank: i + 1,
        displayName: member.displayName,
        attempts: e.attempts,
        solved: e.solved,
        showcase: e.showcase,
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

// Shared by the automatic every-2-hours "Status do Termo" broadcast
// (ready.ts) and the on-demand `/admin termo status` command — both post the
// same message (leaderboard image + "Jogar na atividade" button) to the
// guild's configured Termo channel. Never reveals the word itself, only
// today's standings. Returns false (without sending) when there's nothing to
// show yet for the day.
export async function sendTermoStatusBroadcast(
  client: Client<true>,
  guildId: string,
  channel: TextChannel,
): Promise<boolean> {
  const leaderboard = await buildDailyLeaderboardAttachment(client, guildId);
  if (!leaderboard) return false;

  const attachment = new AttachmentBuilder(leaderboard.buffer, {
    name: 'termo-status.png',
  });

  const embed = new EmbedBuilder()
    .setTitle('Status do Termo')
    .setColor(0x588157)
    .setImage('attachment://termo-status.png');

  const statsRes = await api.getWordleStats(guildId);
  const wordDate = statsRes.data.wordDate;
  if (wordDate) {
    embed.setFooter({ text: wordDate.split('-').reverse().join('/') });
  }

  await channel.send({
    embeds: [embed],
    files: [attachment],
    components: [buildTermoWinActionRow()],
  });
  return true;
}
