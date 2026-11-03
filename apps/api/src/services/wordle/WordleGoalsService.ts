import type { Db } from '@marquinhos/database/client';
import { wordleCommunityGoals } from '@marquinhos/database/schema';
import { asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

export class WordleGoalsService {
  constructor(
    private readonly database: Db,
    private readonly now: () => number = Date.now,
  ) {}

  async create(
    guildId: string,
    target: number,
    startsAt: number,
    endsAt: number,
  ) {
    const now = this.now();
    if (
      !guildId ||
      !Number.isSafeInteger(target) ||
      target <= 0 ||
      !Number.isSafeInteger(startsAt) ||
      !Number.isSafeInteger(endsAt) ||
      startsAt <= now ||
      startsAt >= endsAt
    )
      throw new Error('Invalid community goal');
    const [row] = await this.database
      .insert(wordleCommunityGoals)
      .values({
        id: randomUUID(),
        guild_id: guildId,
        target,
        starts_at: startsAt,
        ends_at: endsAt,
        status: 'scheduled',
        created_at: now,
      })
      .returning();
    return this.map(row!);
  }

  async list(guildId: string) {
    const rows = await this.database
      .select()
      .from(wordleCommunityGoals)
      .where(eq(wordleCommunityGoals.guild_id, guildId))
      .orderBy(
        asc(wordleCommunityGoals.starts_at),
        asc(wordleCommunityGoals.id),
      );
    return rows.map((row) => this.map(row));
  }

  private map(row: typeof wordleCommunityGoals.$inferSelect) {
    return {
      id: row.id,
      guildId: row.guild_id,
      target: row.target,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
    };
  }
}
