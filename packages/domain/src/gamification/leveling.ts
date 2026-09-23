export const DEFAULT_XP_CONFIG = [
  { event_type: 'command', xp_amount: 5, cooldown_ms: 60_000 },
  { event_type: 'voice_join', xp_amount: 2, cooldown_ms: 300_000 },
  { event_type: 'scrobble', xp_amount: 3, cooldown_ms: 60_000 },
  { event_type: 'achievement', xp_amount: 50, cooldown_ms: null },
  { event_type: 'game_win', xp_amount: 20, cooldown_ms: null },
  { event_type: 'game_participate', xp_amount: 5, cooldown_ms: null },
];

export function requiredXpForLevel(level: number): number {
  return Math.floor(Math.pow(level, 2) * 100);
}
