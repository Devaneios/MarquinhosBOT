import type { Db, DbExecutor } from '@marquinhos/database/client';
import {
  wordleNotificationConfig,
  wordleNotifications,
} from '@marquinhos/database/schema';
import { and, asc, eq, lt, lte, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getWordleDayEndEpoch, getWordleTimeZone } from './wordleDate';

type Config = {
  channelId: string | null;
  collective: boolean;
  weekly: boolean;
};
type Kind = 'page' | 'goal' | 'weekly';

export function previousWordleWeek(now: number): {
  weekKey: string;
  startsAt: number;
  endsAt: number;
} {
  const today = new Intl.DateTimeFormat('sv-SE', {
    timeZone: getWordleTimeZone(),
  }).format(new Date(now));
  const date = new Date(`${today}T12:00:00Z`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday - 1);
  const sunday = date.toISOString().slice(0, 10);
  const endsAt = (getWordleDayEndEpoch(sunday) + 1) * 1000;
  date.setUTCDate(date.getUTCDate() - 7);
  const priorSunday = date.toISOString().slice(0, 10);
  const startsAt = (getWordleDayEndEpoch(priorSunday) + 1) * 1000;
  date.setUTCDate(date.getUTCDate() + 1);
  return { weekKey: date.toISOString().slice(0, 10), startsAt, endsAt };
}

export class WordleNotificationService {
  constructor(
    private readonly database: Db,
    private readonly now: () => number = Date.now,
  ) {}

  async configure(guildId: string, config: Config): Promise<void> {
    await this.database
      .insert(wordleNotificationConfig)
      .values({
        guild_id: guildId,
        channel_id: config.channelId,
        collective: config.collective,
        weekly: config.weekly,
      })
      .onConflictDoUpdate({
        target: wordleNotificationConfig.guild_id,
        set: {
          channel_id: config.channelId,
          collective: config.collective,
          weekly: config.weekly,
        },
      });
  }

  async getConfig(guildId: string): Promise<Config> {
    const [row] = await this.database
      .select()
      .from(wordleNotificationConfig)
      .where(eq(wordleNotificationConfig.guild_id, guildId));
    return row
      ? {
          channelId: row.channel_id,
          collective: row.collective,
          weekly: row.weekly,
        }
      : { channelId: null, collective: false, weekly: false };
  }

  async enqueue(
    guildId: string,
    kind: Kind,
    eventKey: string,
    payload: Record<string, string>,
    eligibleAt: number,
  ): Promise<boolean> {
    return this.enqueueWithin(
      this.database,
      guildId,
      kind,
      eventKey,
      payload,
      eligibleAt,
    );
  }

  async enqueueWithin(
    tx: DbExecutor,
    guildId: string,
    kind: Kind,
    eventKey: string,
    payload: Record<string, string>,
    eligibleAt: number,
  ): Promise<boolean> {
    const [config] = await tx
      .select()
      .from(wordleNotificationConfig)
      .where(eq(wordleNotificationConfig.guild_id, guildId));
    if (
      !config ||
      !(kind === 'weekly' ? config.weekly : config.collective || config.weekly)
    )
      return false;
    const rows = await tx
      .insert(wordleNotifications)
      .values({
        id: randomUUID(),
        guild_id: guildId,
        event_type: kind,
        event_key: eventKey,
        payload,
        eligible_at: eligibleAt,
        deliver_individual: kind === 'weekly' || config.collective,
        status: 'pending',
        created_at: this.now(),
      })
      .onConflictDoNothing()
      .returning({ id: wordleNotifications.id });
    return rows.length > 0;
  }

  async queueWeekly(
    guildId: string,
    weekKey: string,
    startsAt: number,
    endsAt: number,
  ): Promise<boolean> {
    const config = await this.getConfig(guildId);
    if (!config.weekly || startsAt >= endsAt || endsAt > this.now())
      return false;
    const rows = await this.database
      .select({ kind: wordleNotifications.event_type })
      .from(wordleNotifications)
      .where(
        and(
          eq(wordleNotifications.guild_id, guildId),
          or(
            eq(wordleNotifications.event_type, 'page'),
            eq(wordleNotifications.event_type, 'goal'),
          ),
          sql`greatest(${wordleNotifications.created_at}, ${wordleNotifications.eligible_at}) >= ${startsAt}`,
          sql`greatest(${wordleNotifications.created_at}, ${wordleNotifications.eligible_at}) < ${endsAt}`,
          sql`(${wordleNotifications.event_type} <> 'page' OR EXISTS (SELECT 1 FROM wordle_album_contributions c WHERE c.guild_id = ${wordleNotifications.guild_id} AND c.pattern_id = ${wordleNotifications.payload}->>'patternId'))`,
        ),
      );
    if (!rows.length) return false;
    return this.enqueue(
      guildId,
      'weekly',
      `weekly:${weekKey}`,
      {
        pages: String(rows.filter((row) => row.kind === 'page').length),
        goals: String(rows.filter((row) => row.kind === 'goal').length),
        week: weekKey,
      },
      endsAt,
    );
  }

  async queueWeeklySummaries(): Promise<number> {
    const week = previousWordleWeek(this.now());
    const guilds = await this.database
      .select({ guildId: wordleNotificationConfig.guild_id })
      .from(wordleNotificationConfig)
      .where(eq(wordleNotificationConfig.weekly, true));
    let queued = 0;
    for (const { guildId } of guilds)
      if (
        await this.queueWeekly(
          guildId,
          week.weekKey,
          week.startsAt,
          week.endsAt,
        )
      )
        queued++;
    return queued;
  }

  async claim(guildId: string) {
    return this.database.transaction(async (tx) => {
      const [config] = await tx
        .select()
        .from(wordleNotificationConfig)
        .where(eq(wordleNotificationConfig.guild_id, guildId));
      if (!config?.channel_id || (!config.collective && !config.weekly))
        return null;
      const kinds: Kind[] = [
        ...(config.collective ? (['page', 'goal'] as const) : []),
        ...(config.weekly ? (['weekly'] as const) : []),
      ];
      const eventFilter = or(
        ...kinds.map((kind) => eq(wordleNotifications.event_type, kind)),
      );
      const [row] = await tx
        .select()
        .from(wordleNotifications)
        .where(
          and(
            eq(wordleNotifications.guild_id, guildId),
            eq(wordleNotifications.status, 'pending'),
            eq(wordleNotifications.deliver_individual, true),
            lte(wordleNotifications.eligible_at, this.now()),
            sql`(${wordleNotifications.event_type} <> 'page' OR EXISTS (SELECT 1 FROM wordle_album_contributions c WHERE c.guild_id = ${wordleNotifications.guild_id} AND c.pattern_id = ${wordleNotifications.payload}->>'patternId'))`,
            eventFilter,
          ),
        )
        .orderBy(
          asc(wordleNotifications.eligible_at),
          asc(wordleNotifications.id),
        )
        .limit(1)
        .for('update', { skipLocked: true });
      if (!row) return null;
      const leaseId = randomUUID();
      await tx
        .update(wordleNotifications)
        .set({
          status: 'sending',
          lease_id: leaseId,
          lease_started_at: this.now(),
          channel_id: config.channel_id,
        })
        .where(eq(wordleNotifications.id, row.id));
      return {
        id: row.id,
        eventKey: row.event_key,
        kind: row.event_type,
        payload: row.payload,
        status: 'sending' as const,
        leaseId,
        channelId: config.channel_id,
      };
    });
  }

  async confirm(
    guildId: string,
    id: string,
    leaseId: string,
    messageId: string,
  ): Promise<boolean> {
    const rows = await this.database
      .update(wordleNotifications)
      .set({ status: 'delivered', message_id: messageId })
      .where(
        and(
          eq(wordleNotifications.id, id),
          eq(wordleNotifications.guild_id, guildId),
          or(
            eq(wordleNotifications.status, 'sending'),
            eq(wordleNotifications.status, 'uncertain'),
          ),
          eq(wordleNotifications.lease_id, leaseId),
        ),
      )
      .returning({ id: wordleNotifications.id });
    return rows.length > 0;
  }
  async ambiguous(
    guildId: string,
    id: string,
    leaseId: string,
  ): Promise<boolean> {
    const rows = await this.database
      .update(wordleNotifications)
      .set({ status: 'uncertain' })
      .where(
        and(
          eq(wordleNotifications.id, id),
          eq(wordleNotifications.guild_id, guildId),
          eq(wordleNotifications.status, 'sending'),
          eq(wordleNotifications.lease_id, leaseId),
        ),
      )
      .returning({ id: wordleNotifications.id });
    return rows.length > 0;
  }
  async release(
    guildId: string,
    id: string,
    leaseId: string,
  ): Promise<boolean> {
    const rows = await this.database
      .update(wordleNotifications)
      .set({
        status: 'pending',
        lease_id: null,
        lease_started_at: null,
        channel_id: null,
      })
      .where(
        and(
          eq(wordleNotifications.guild_id, guildId),
          eq(wordleNotifications.id, id),
          eq(wordleNotifications.lease_id, leaseId),
          eq(wordleNotifications.status, 'sending'),
        ),
      )
      .returning({ id: wordleNotifications.id });
    return rows.length > 0;
  }
  async reapStale(leaseMs: number): Promise<number> {
    const rows = await this.database
      .update(wordleNotifications)
      .set({ status: 'uncertain' })
      .where(
        and(
          eq(wordleNotifications.status, 'sending'),
          lt(wordleNotifications.lease_started_at, this.now() - leaseMs),
        ),
      )
      .returning({ id: wordleNotifications.id });
    return rows.length;
  }
  async uncertain(guildId: string) {
    const rows = await this.database
      .select()
      .from(wordleNotifications)
      .where(
        and(
          eq(wordleNotifications.guild_id, guildId),
          eq(wordleNotifications.status, 'uncertain'),
        ),
      )
      .orderBy(asc(wordleNotifications.created_at))
      .limit(25);
    return rows.map((row) => ({
      id: row.id,
      kind: row.event_type,
      eventKey: row.event_key,
      channelId: row.channel_id,
      startedAt: row.lease_started_at,
    }));
  }
  async resolve(
    guildId: string,
    id: string,
    result: 'found' | 'confirmed_absent',
    messageId?: string,
  ): Promise<boolean> {
    if (result === 'found' && !messageId)
      throw new Error('A Discord message ID is required');
    const rows = await this.database
      .update(wordleNotifications)
      .set({
        status: result === 'found' ? 'delivered' : 'pending',
        lease_id: null,
        lease_started_at: null,
        message_id: result === 'found' ? messageId! : null,
      })
      .where(
        and(
          eq(wordleNotifications.id, id),
          eq(wordleNotifications.guild_id, guildId),
          eq(wordleNotifications.status, 'uncertain'),
        ),
      )
      .returning({ id: wordleNotifications.id });
    return rows.length > 0;
  }
}
