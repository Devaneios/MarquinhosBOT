import { WORDLE_ACHIEVEMENT_TIME_ZONE } from '@marquinhos/domain/games/wordle/achievements/engine/history';

export function getWordleTimeZone(): string {
  return process.env.WORDLE_TIMEZONE ?? WORDLE_ACHIEVEMENT_TIME_ZONE;
}
