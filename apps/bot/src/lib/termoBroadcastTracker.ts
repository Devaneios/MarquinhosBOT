interface DayWinners {
  wordDate: string;
  winnersCount: number;
}

// Remembers each guild's winner count at its last status broadcast, per word
// date, so the first winners of a new day are news again.
export class TermoBroadcastTracker {
  private readonly lastBroadcast = new Map<string, DayWinners>();

  hasNews(guildId: string, today: DayWinners): boolean {
    const last = this.lastBroadcast.get(guildId);
    const alreadyShown =
      last?.wordDate === today.wordDate ? last.winnersCount : 0;
    return today.winnersCount > alreadyShown;
  }

  record(guildId: string, today: DayWinners): void {
    this.lastBroadcast.set(guildId, today);
  }
}
