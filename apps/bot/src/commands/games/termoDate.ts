/** The Wordle day boundary; must match the API's `WORDLE_TIMEZONE`. */
export function wordleTimeZone(): string {
  return process.env.WORDLE_TIMEZONE || 'America/Recife';
}

export function previousRecifeDate(now: Date = new Date()): string {
  const today = new Intl.DateTimeFormat('sv-SE', {
    timeZone: wordleTimeZone(),
  }).format(now);
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
