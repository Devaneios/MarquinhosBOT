import type { Db, DbExecutor } from '@marquinhos/database/client';
import {
  wordleNotificationConfig,
  wordleNotifications,
} from '@marquinhos/database/schema';
import { and, asc, eq, lt, lte, or } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

type Config = {
  channelId: string | null;
  collective: boolean;
  weekly: boolean;
};
type Kind = 'page' | 'goal' | 'weekly';

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
    if (!config || !(kind === 'weekly' ? config.weekly : config.collective))
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
        status: 'pending',
        created_at: this.now(),
      })
      .onConflictDoNothing()
      .returning({ id: wordleNotifications.id });
    return rows.length > 0;
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
            lte(wordleNotifications.eligible_at, this.now()),
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

  async confirm(id: string, leaseId: string, messageId: string): Promise<void> {
    await this.database
      .update(wordleNotifications)
      .set({ status: 'delivered', message_id: messageId })
      .where(
        and(
          eq(wordleNotifications.id, id),
          eq(wordleNotifications.status, 'sending'),
          eq(wordleNotifications.lease_id, leaseId),
        ),
      );
  }
  async ambiguous(id: string, leaseId: string): Promise<void> {
    await this.database
      .update(wordleNotifications)
      .set({ status: 'uncertain' })
      .where(
        and(
          eq(wordleNotifications.id, id),
          eq(wordleNotifications.status, 'sending'),
          eq(wordleNotifications.lease_id, leaseId),
        ),
      );
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
  async resolve(
    id: string,
    result: 'found' | 'confirmed_absent',
  ): Promise<void> {
    await this.database
      .update(wordleNotifications)
      .set({
        status: result === 'found' ? 'delivered' : 'pending',
        lease_id: null,
        lease_started_at: null,
      })
      .where(
        and(
          eq(wordleNotifications.id, id),
          eq(wordleNotifications.status, 'uncertain'),
        ),
      );
  }
}
