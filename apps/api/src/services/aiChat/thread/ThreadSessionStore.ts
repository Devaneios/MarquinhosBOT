import {
  db as defaultDb,
  type Db,
  type DbExecutor,
} from '@marquinhos/database/client';
import { aiThreadItems, aiThreadSessions } from '@marquinhos/database/schema';
import { and, asc, desc, eq, lte, max, sql } from 'drizzle-orm';
import {
  conversationItemSchema,
  type ConversationItem,
} from 'services/aiChat/llm/ResponsesClient';
import { getErrorMessage } from 'utils/errorHandling';
import { logger } from 'utils/logger';

/**
 * Rough chars-per-token ratio. Deliberately conservative: overestimating the
 * transcript size compacts a little early, which is cheap. Underestimating it
 * blows the model's context window mid-thread, which is not.
 */
const CHARS_PER_TOKEN = 3.5;
const DEFAULT_TOKEN_BUDGET = Number(
  process.env.AI_THREAD_TOKEN_BUDGET ?? 120_000,
);
/** Turns kept verbatim when compacting; older ones collapse into a summary. */
const KEEP_RECENT_ITEMS = 20;

export type ThreadMode = 'ask' | 'research';

export interface ThreadSession {
  threadId: string;
  guildId: string;
  channelId: string;
  ownerUserId: string;
  mode: ThreadMode;
  status: 'active' | 'closed';
  turnCount: number;
}

export interface ThreadRegistration {
  threadId: string;
  guildId: string;
  channelId: string;
  ownerUserId: string;
  mode: ThreadMode;
}

/**
 * The transcript of an AI thread, as the raw Responses items the API produced.
 * Storing items verbatim — rather than a flattened "role + text" view — is what
 * lets a later turn replay the model's own reasoning instead of losing it.
 */
export class ThreadSessionStore {
  constructor(
    private db: Db = defaultDb,
    private tokenBudget: number = DEFAULT_TOKEN_BUDGET,
  ) {}

  /** Registers a thread, or refreshes it if the bot re-registers the same one. */
  async register(registration: ThreadRegistration): Promise<void> {
    const now = Date.now();
    await this.db
      .insert(aiThreadSessions)
      .values({
        thread_id: registration.threadId,
        guild_id: registration.guildId,
        channel_id: registration.channelId,
        owner_user_id: registration.ownerUserId,
        mode: registration.mode,
        status: 'active',
        turn_count: 0,
        created_at: now,
        last_used_at: now,
      })
      .onConflictDoUpdate({
        target: aiThreadSessions.thread_id,
        set: { last_used_at: now, status: 'active' },
      });
  }

  async get(threadId: string): Promise<ThreadSession | null> {
    const [row] = await this.db
      .select()
      .from(aiThreadSessions)
      .where(eq(aiThreadSessions.thread_id, threadId));
    if (!row) return null;
    return {
      threadId: row.thread_id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      ownerUserId: row.owner_user_id,
      mode: row.mode as ThreadMode,
      status: row.status as ThreadSession['status'],
      turnCount: row.turn_count,
    };
  }

  async loadTranscript(threadId: string): Promise<ConversationItem[]> {
    const rows = await this.db
      .select({ seq: aiThreadItems.seq, item_json: aiThreadItems.item_json })
      .from(aiThreadItems)
      .where(eq(aiThreadItems.thread_id, threadId))
      .orderBy(asc(aiThreadItems.seq));

    const items: ConversationItem[] = [];
    for (const row of rows) {
      try {
        items.push(conversationItemSchema.parse(JSON.parse(row.item_json)));
      } catch (error) {
        // A single unreadable row must not take the whole thread down; the
        // model can still work from the turns that survived.
        logger.warn('ai.thread.item_unreadable', {
          threadId,
          seq: row.seq,
          error: getErrorMessage(error),
        });
      }
    }
    return items;
  }

  async append(threadId: string, items: ConversationItem[]): Promise<void> {
    if (items.length === 0) return;
    const now = Date.now();

    await this.db.transaction(async (tx) => {
      // Bumping the session row first takes its lock, which serialises seq
      // allocation between concurrent appends to the same thread.
      await tx
        .update(aiThreadSessions)
        .set({
          turn_count: sql`${aiThreadSessions.turn_count} + 1`,
          last_used_at: now,
        })
        .where(eq(aiThreadSessions.thread_id, threadId));
      let seq = await this.nextSeq(tx, threadId);
      await tx.insert(aiThreadItems).values(
        items.map((item) => ({
          thread_id: threadId,
          seq: seq++,
          item_json: JSON.stringify(item),
          created_at: now,
        })),
      );
    });
  }

  /** Estimated tokens the stored transcript would cost to replay. */
  async estimateTokens(threadId: string): Promise<number> {
    const [row] = await this.db
      .select({
        total: sql<number | null>`sum(length(${aiThreadItems.item_json}))::int`,
      })
      .from(aiThreadItems)
      .where(eq(aiThreadItems.thread_id, threadId));
    return Math.ceil((row?.total ?? 0) / CHARS_PER_TOKEN);
  }

  async needsCompaction(threadId: string): Promise<boolean> {
    return (await this.estimateTokens(threadId)) > this.tokenBudget;
  }

  /**
   * Replaces everything older than the most recent {@link KEEP_RECENT_ITEMS}
   * items with a single summary item. Without this a long-lived thread
   * eventually exceeds the model's context window and every turn starts failing.
   */
  async compact(threadId: string, summary: string): Promise<void> {
    const rows = await this.db
      .select({ seq: aiThreadItems.seq })
      .from(aiThreadItems)
      .where(eq(aiThreadItems.thread_id, threadId))
      .orderBy(desc(aiThreadItems.seq));
    if (rows.length <= KEEP_RECENT_ITEMS) return;

    const cutoffSeq = rows[KEEP_RECENT_ITEMS]!.seq;
    const summaryItem: ConversationItem = {
      role: 'user',
      content: `<conversa_anterior_resumida>\n${summary}\n</conversa_anterior_resumida>`,
    };

    await this.db.transaction(async (tx) => {
      await tx
        .delete(aiThreadItems)
        .where(
          and(
            eq(aiThreadItems.thread_id, threadId),
            lte(aiThreadItems.seq, cutoffSeq),
          ),
        );
      await tx.insert(aiThreadItems).values({
        thread_id: threadId,
        seq: cutoffSeq,
        item_json: JSON.stringify(summaryItem),
        created_at: Date.now(),
      });
    });

    logger.info('ai.thread.compacted', {
      threadId,
      removedItems: rows.length - KEEP_RECENT_ITEMS,
      keptItems: KEEP_RECENT_ITEMS,
    });
  }

  /**
   * Items that would be dropped by the next compaction, so a caller can
   * summarize exactly what it is about to lose.
   */
  async itemsToCompact(threadId: string): Promise<ConversationItem[]> {
    const all = await this.loadTranscript(threadId);
    if (all.length <= KEEP_RECENT_ITEMS) return [];
    return all.slice(0, all.length - KEEP_RECENT_ITEMS);
  }

  private async nextSeq(exec: DbExecutor, threadId: string): Promise<number> {
    const [row] = await exec
      .select({ maxSeq: max(aiThreadItems.seq) })
      .from(aiThreadItems)
      .where(eq(aiThreadItems.thread_id, threadId));
    return (row?.maxSeq ?? 0) + 1;
  }
}
