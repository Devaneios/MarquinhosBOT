import { discordSdk } from '../discordSdk';
import { devwarn } from './devlog';

// Best-effort map of userId -> display name for everyone currently connected
// to this Discord Activity instance. May be missing entries (a participant
// left, or the command failed) — callers fall back to a truncated userId for
// any id not present, matching the convention Minesweeper's board already
// established rather than duplicating that fallback here.
export async function getParticipantDisplayNames(): Promise<Record<string, string>> {
  try {
    const { participants } = await discordSdk.commands.getActivityInstanceConnectedParticipants();
    const result: Record<string, string> = {};
    for (const p of participants) {
      result[p.id] = p.nickname ?? p.global_name ?? p.username;
    }
    return result;
  } catch (err) {
    devwarn('[discord] failed to fetch participants', err);
    return {};
  }
}
