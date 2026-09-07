import { Database } from 'bun:sqlite';
import { db as defaultDb } from 'database/sqlite';
import type { ConversationItem } from 'services/aiChat/llm/ResponsesClient';
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

interface SessionRow {
  thread_id: string;
  guild_id: string;
  channel_id: string;
  owner_user_id: string;
  mode: ThreadMode;
  status: 'active' | 'closed';
  turn_count: number;
}

interface ItemRow {
  seq: number;
  item_json: string;
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
    private db: Database = defaultDb,
    private tokenBudget: number = DEFAULT_TOKEN_BUDGET,
  ) {}

  /** Registers a thread, or refreshes it if the bot re-registers the same one. */
  register(registration: ThreadRegistration): void {
    const now = Date.now();
    this.db
      .query(
        `INSERT INTO ai_thread_sessions
           (thread_id, guild_id, channel_id, owner_user_id, mode, status, turn_count, created_at, last_used_at)
         VALUES ($threadId, $guildId, $channelId, $ownerUserId, $mode, 'active', 0, $now, $now)
         ON CONFLICT(thread_id) DO UPDATE SET
           last_used_at = $now,
           status = 'active'`,
      )
      .run({
        $threadId: registration.threadId,
        $guildId: registration.guildId,
        $channelId: registration.channelId,
        $ownerUserId: registration.ownerUserId,
        $mode: registration.mode,
        $now: now,
      });
  }

  get(threadId: string): ThreadSession | null {
    const row = this.db
      .query<SessionRow, { $threadId: string }>(
        'SELECT * FROM ai_thread_sessions WHERE thread_id = $threadId',
      )
      .get({ $threadId: threadId });
    if (!row) return null;
    return {
      threadId: row.thread_id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      ownerUserId: row.owner_user_id,
      mode: row.mode,
      status: row.status,
      turnCount: row.turn_count,
    };
  }

  loadTranscript(threadId: string): ConversationItem[] {
    const rows = this.db
      .query<ItemRow, { $threadId: string }>(
        'SELECT seq, item_json FROM ai_thread_items WHERE thread_id = $threadId ORDER BY seq ASC',
      )
      .all({ $threadId: threadId });

    const items: ConversationItem[] = [];
    for (const row of rows) {
      try {
        items.push(JSON.parse(row.item_json) as ConversationItem);
      } catch (error) {
        // A single unreadable row must not take the whole thread down; the
        // model can still work from the turns that survived.
        logger.warn('ai.thread.item_unreadable', {
          threadId,
          seq: row.seq,
          error: (error as Error).message,
        });
      }
    }
    return items;
  }

  append(threadId: string, items: ConversationItem[]): void {
    if (items.length === 0) return;
    const now = Date.now();
    let seq = this.nextSeq(threadId);

    const insert = this.db.prepare(
      `INSERT INTO ai_thread_items (thread_id, seq, item_json, created_at)
       VALUES ($threadId, $seq, $itemJson, $createdAt)`,
    );

    this.db.transaction(() => {
      for (const item of items) {
        insert.run({
          $threadId: threadId,
          $seq: seq++,
          $itemJson: JSON.stringify(item),
          $createdAt: now,
        });
      }
      this.db
        .query(
          `UPDATE ai_thread_sessions
             SET turn_count = turn_count + 1, last_used_at = $now
           WHERE thread_id = $threadId`,
        )
        .run({ $threadId: threadId, $now: now });
    })();
  }

  /** Estimated tokens the stored transcript would cost to replay. */
  estimateTokens(threadId: string): number {
    const row = this.db
      .query<{ total: number | null }, { $threadId: string }>(
        'SELECT SUM(LENGTH(item_json)) AS total FROM ai_thread_items WHERE thread_id = $threadId',
      )
      .get({ $threadId: threadId });
    return Math.ceil((row?.total ?? 0) / CHARS_PER_TOKEN);
  }

  needsCompaction(threadId: string): boolean {
    return this.estimateTokens(threadId) > this.tokenBudget;
  }

  /**
   * Replaces everything older than the most recent {@link KEEP_RECENT_ITEMS}
   * items with a single summary item. Without this a long-lived thread
   * eventually exceeds the model's context window and every turn starts failing.
   */
  compact(threadId: string, summary: string): void {
    const rows = this.db
      .query<{ seq: number }, { $threadId: string }>(
        'SELECT seq FROM ai_thread_items WHERE thread_id = $threadId ORDER BY seq DESC',
      )
      .all({ $threadId: threadId });
    if (rows.length <= KEEP_RECENT_ITEMS) return;

    const cutoffSeq = rows[KEEP_RECENT_ITEMS]!.seq;
    const summaryItem: ConversationItem = {
      role: 'user',
      content: `<conversa_anterior_resumida>\n${summary}\n</conversa_anterior_resumida>`,
    };

    this.db.transaction(() => {
      this.db
        .query(
          'DELETE FROM ai_thread_items WHERE thread_id = $threadId AND seq <= $cutoffSeq',
        )
        .run({ $threadId: threadId, $cutoffSeq: cutoffSeq });
      this.db
        .query(
          `INSERT INTO ai_thread_items (thread_id, seq, item_json, created_at)
           VALUES ($threadId, $seq, $itemJson, $createdAt)`,
        )
        .run({
          $threadId: threadId,
          $seq: cutoffSeq,
          $itemJson: JSON.stringify(summaryItem),
          $createdAt: Date.now(),
        });
    })();

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
  itemsToCompact(threadId: string): ConversationItem[] {
    const all = this.loadTranscript(threadId);
    if (all.length <= KEEP_RECENT_ITEMS) return [];
    return all.slice(0, all.length - KEEP_RECENT_ITEMS);
  }

  private nextSeq(threadId: string): number {
    const row = this.db
      .query<{ maxSeq: number | null }, { $threadId: string }>(
        'SELECT MAX(seq) AS maxSeq FROM ai_thread_items WHERE thread_id = $threadId',
      )
      .get({ $threadId: threadId });
    return (row?.maxSeq ?? 0) + 1;
  }
}
