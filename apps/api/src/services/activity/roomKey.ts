import type { ActivityMode, GameId } from 'services/activity/gameId';

export interface ActivityScope {
  instanceId: string;
  game: GameId;
  mode: ActivityMode;
  userId: string;
  // Required for mode 'multi' (a room subdivides a Discord instance);
  // absent for 'single'/'local', which stay scoped per-user as before.
  roomId?: string;
  // Only meaningful for games that host more than one pluggable ruleset
  // (cards). Appended when present so two people in the same Activity
  // instance choosing different rulesets never collide on room key; absent
  // for every other caller, so this is purely additive.
  ruleset?: string;
}

// A Discord Activity instanceId is constant for the whole lifetime of the
// activity, so it can't identify a session on its own. The room key is what
// decides who shares state with whom, and it has to encode every axis of
// isolation:
//   - game, because one instance can host more than one game from the hub;
//   - mode, because a CPU or hot-seat game must never touch the shared match;
//   - userId for the private modes, because two people in the same voice
//     channel each playing the CPU are playing two different games.
// Only 'multi' deliberately omits userId — sharing one match per instance is
// the whole point of it.
export function roomKey({
  instanceId,
  game,
  mode,
  userId,
  roomId,
  ruleset,
}: ActivityScope): string {
  let base: string;
  if (mode === 'multi') {
    if (!roomId) {
      throw new Error('roomKey: roomId is required for mode "multi"');
    }
    base = `${instanceId}:${roomId}:${game}:multi`;
  } else {
    base = `${instanceId}:${game}:${mode}:${userId}`;
  }
  return game === 'cards' && ruleset ? `${base}:${ruleset}` : base;
}
