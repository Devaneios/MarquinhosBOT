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

/** Unix seconds for the final second of one configured Wordle day. */
export function getWordleDayEndEpoch(date: string): number {
  const nextDate = new Date(`${date}T00:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const parts = {
    year: nextDate.getUTCFullYear(),
    month: nextDate.getUTCMonth() + 1,
    day: nextDate.getUTCDate(),
  };
  const targetLocalMidnight = Date.UTC(parts.year, parts.month - 1, parts.day);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: getWordleTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  let instant = targetLocalMidnight;
  for (let attempt = 0; attempt < 4; attempt++) {
    const local = Object.fromEntries(
      formatter
        .formatToParts(new Date(instant))
        .filter(({ type }) => type !== 'literal')
        .map(({ type, value }) => [type, Number(value)]),
    ) as Record<string, number>;
    const observedAsUtc = Date.UTC(
      local.year!,
      local.month! - 1,
      local.day!,
      local.hour!,
      local.minute!,
      local.second!,
    );
    const correction = targetLocalMidnight - observedAsUtc;
    instant += correction;
    if (correction === 0) break;
  }
  return Math.floor((instant - 1000) / 1000);
}
