import { Database } from 'bun:sqlite';
import { beforeEach, describe, expect, it } from 'bun:test';
import type { ConversationItem } from 'services/aiChat/llm/ResponsesClient';
import { ThreadSessionStore } from 'services/aiChat/thread/ThreadSessionStore';

function freshDb(): Database {
  const db = new Database(':memory:');
  db.run(`
    CREATE TABLE ai_thread_sessions (
      thread_id      TEXT NOT NULL PRIMARY KEY,
      guild_id       TEXT NOT NULL,
      channel_id     TEXT NOT NULL,
      owner_user_id  TEXT NOT NULL,
      mode           TEXT NOT NULL CHECK(mode IN ('ask','research')),
      status         TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')),
      turn_count     INTEGER NOT NULL DEFAULT 0,
      created_at     INTEGER NOT NULL,
      last_used_at   INTEGER NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE ai_thread_items (
      id         INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      thread_id  TEXT NOT NULL,
      seq        INTEGER NOT NULL,
      item_json  TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
  return db;
}

const registration = {
  threadId: 'thread-1',
  guildId: 'guild-1',
  channelId: 'channel-1',
  ownerUserId: 'user-1',
  mode: 'ask' as const,
};

let db: Database;
let store: ThreadSessionStore;

beforeEach(() => {
  db = freshDb();
  store = new ThreadSessionStore(db);
});

describe('ThreadSessionStore.register / get', () => {
  it('registers a thread and reads it back', () => {
    store.register(registration);

    expect(store.get('thread-1')).toMatchObject({
      threadId: 'thread-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      ownerUserId: 'user-1',
      mode: 'ask',
      status: 'active',
      turnCount: 0,
    });
  });

  it('returns null for a thread the bot never registered', () => {
    expect(store.get('nao-existe')).toBeNull();
  });

  it('re-registering the same thread does not duplicate or reset it', () => {
    store.register(registration);
    store.append('thread-1', [{ role: 'user', content: 'oi' }]);
    store.register(registration);

    expect(store.get('thread-1')?.turnCount).toBe(1);
    expect(store.loadTranscript('thread-1')).toHaveLength(1);
  });

  it('keeps research threads distinguishable from ask threads', () => {
    store.register({ ...registration, mode: 'research' });

    expect(store.get('thread-1')?.mode).toBe('research');
  });
});

describe('ThreadSessionStore transcript', () => {
  beforeEach(() => store.register(registration));

  it('starts empty', () => {
    expect(store.loadTranscript('thread-1')).toEqual([]);
  });

  it('appends items and reads them back in order', () => {
    store.append('thread-1', [
      { role: 'user', content: 'primeiro' },
      { type: 'message', role: 'assistant', content: [] },
    ]);
    store.append('thread-1', [{ role: 'user', content: 'segundo' }]);

    const items = store.loadTranscript('thread-1');
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({ role: 'user', content: 'primeiro' });
    expect(items[2]).toEqual({ role: 'user', content: 'segundo' });
  });

  it('preserves a reasoning item with its encrypted content byte for byte', () => {
    const reasoning: ConversationItem = {
      type: 'reasoning',
      id: 'rs_1',
      summary: [{ type: 'summary_text', text: 'pensei' }],
      encrypted_content: 'BLOB==/+abc',
    };

    store.append('thread-1', [reasoning]);

    expect(store.loadTranscript('thread-1')[0]).toEqual(reasoning);
  });

  it('counts one turn per append, not per item', () => {
    store.append('thread-1', [
      { role: 'user', content: 'a' },
      { type: 'message', role: 'assistant', content: [] },
    ]);
    store.append('thread-1', [{ role: 'user', content: 'b' }]);

    expect(store.get('thread-1')?.turnCount).toBe(2);
  });

  it('ignores an empty append', () => {
    store.append('thread-1', []);

    expect(store.get('thread-1')?.turnCount).toBe(0);
  });

  it('keeps threads isolated from one another', () => {
    store.register({ ...registration, threadId: 'thread-2' });
    store.append('thread-1', [{ role: 'user', content: 'da um' }]);
    store.append('thread-2', [{ role: 'user', content: 'da dois' }]);

    expect(store.loadTranscript('thread-1')).toEqual([
      { role: 'user', content: 'da um' },
    ]);
    expect(store.loadTranscript('thread-2')).toEqual([
      { role: 'user', content: 'da dois' },
    ]);
  });

  it('skips an unreadable row instead of failing the whole thread', () => {
    store.append('thread-1', [{ role: 'user', content: 'bom' }]);
    db.query(
      `INSERT INTO ai_thread_items (thread_id, seq, item_json, created_at)
       VALUES ('thread-1', 99, '{not json', 0)`,
    ).run();
    store.append('thread-1', [{ role: 'user', content: 'tambem bom' }]);

    const items = store.loadTranscript('thread-1');
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.content)).toEqual(['bom', 'tambem bom']);
  });
});

describe('ThreadSessionStore compaction', () => {
  beforeEach(() => store.register(registration));

  function appendItems(count: number, prefix = 'msg') {
    store.append(
      'thread-1',
      Array.from({ length: count }, (_, i) => ({
        role: 'user',
        content: `${prefix}-${i}`,
      })),
    );
  }

  it('does not ask for compaction while the transcript is small', () => {
    appendItems(5);

    expect(store.needsCompaction('thread-1')).toBe(false);
  });

  it('asks for compaction once the transcript passes the token budget', () => {
    const tight = new ThreadSessionStore(db, 100);
    store.append(
      'thread-1',
      Array.from({ length: 10 }, (_, i) => ({
        role: 'user',
        content: 'x'.repeat(500) + i,
      })),
    );

    expect(tight.needsCompaction('thread-1')).toBe(true);
  });

  it('estimates tokens as a function of stored size', () => {
    expect(store.estimateTokens('thread-1')).toBe(0);
    appendItems(10);
    expect(store.estimateTokens('thread-1')).toBeGreaterThan(0);
  });

  it('reports nothing to compact while under the keep-recent window', () => {
    appendItems(5);

    expect(store.itemsToCompact('thread-1')).toEqual([]);
  });

  it('reports the oldest items as the ones about to be lost', () => {
    appendItems(25);

    const doomed = store.itemsToCompact('thread-1');
    expect(doomed).toHaveLength(5);
    expect(doomed[0]).toEqual({ role: 'user', content: 'msg-0' });
    expect(doomed[4]).toEqual({ role: 'user', content: 'msg-4' });
  });

  it('replaces the old items with a single summary item and keeps the recent ones', () => {
    appendItems(25);

    store.compact('thread-1', 'falamos de bun e sqlite');

    const items = store.loadTranscript('thread-1');
    expect(items).toHaveLength(21);
    expect(String(items[0]!.content)).toContain('falamos de bun e sqlite');
    expect(String(items[0]!.content)).toContain('conversa_anterior_resumida');
    expect(items[1]).toEqual({ role: 'user', content: 'msg-5' });
    expect(items.at(-1)).toEqual({ role: 'user', content: 'msg-24' });
  });

  it('is a no-op when there is nothing old enough to compact', () => {
    appendItems(10);

    store.compact('thread-1', 'resumo');

    expect(store.loadTranscript('thread-1')).toHaveLength(10);
  });

  it('brings the transcript back under budget', () => {
    const tight = new ThreadSessionStore(db, 200);
    store.append(
      'thread-1',
      Array.from({ length: 40 }, (_, i) => ({
        role: 'user',
        content: 'y'.repeat(200) + i,
      })),
    );
    expect(tight.needsCompaction('thread-1')).toBe(true);

    tight.compact('thread-1', 'curto');

    expect(tight.loadTranscript('thread-1')).toHaveLength(21);
  });

  it('can compact twice without seq collisions', () => {
    appendItems(25, 'first');
    store.compact('thread-1', 'resumo 1');
    appendItems(25, 'second');

    store.compact('thread-1', 'resumo 2');

    const items = store.loadTranscript('thread-1');
    expect(items).toHaveLength(21);
    expect(String(items[0]!.content)).toContain('resumo 2');
    expect(items.at(-1)).toEqual({ role: 'user', content: 'second-24' });
  });
});
