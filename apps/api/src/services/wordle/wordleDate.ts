import { WORDLE_ACHIEVEMENT_TIME_ZONE } from '@marquinhos/domain/games/wordle/achievements/engine/history';

/** The day boundary for daily words, streaks and achievements alike. */
export function getWordleTimeZone(): string {
  return process.env.WORDLE_TIMEZONE ?? WORDLE_ACHIEVEMENT_TIME_ZONE;
}

export function getRecifeDate(): string {
  // 'sv-SE' locale gives YYYY-MM-DD format
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: getWordleTimeZone(),
  }).format(new Date());
}
