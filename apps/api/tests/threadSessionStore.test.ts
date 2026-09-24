import { aiThreadItems } from '@marquinhos/database/schema';
import { beforeEach, describe, expect, it } from 'bun:test';
import type { ConversationItem } from 'services/aiChat/llm/ResponsesClient';
import { ThreadSessionStore } from 'services/aiChat/thread/ThreadSessionStore';
import { useTestDb } from './helpers/testDb';

const testDb = useTestDb();

const registration = {
  threadId: 'thread-1',
  guildId: 'guild-1',
  channelId: 'channel-1',
  ownerUserId: 'user-1',
  mode: 'ask' as const,
};

let store: ThreadSessionStore;

beforeEach(async () => {
  store = new ThreadSessionStore(testDb.current.db);
});

describe('ThreadSessionStore.register / get', () => {
  it('registers a thread and reads it back', async () => {
    await store.register(registration);

    expect(await store.get('thread-1')).toMatchObject({
      threadId: 'thread-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      ownerUserId: 'user-1',
      mode: 'ask',
      status: 'active',
      turnCount: 0,
    });
  });

  it('returns null for a thread the bot never registered', async () => {
    expect(await store.get('nao-existe')).toBeNull();
  });

  it('re-registering the same thread does not duplicate or reset it', async () => {
    await store.register(registration);
    await store.append('thread-1', [{ role: 'user', content: 'oi' }]);
    await store.register(registration);

    expect((await store.get('thread-1'))?.turnCount).toBe(1);
    expect(await store.loadTranscript('thread-1')).toHaveLength(1);
  });

  it('keeps research threads distinguishable from ask threads', async () => {
    await store.register({ ...registration, mode: 'research' });

    expect((await store.get('thread-1'))?.mode).toBe('research');
  });
});

describe('ThreadSessionStore transcript', () => {
  beforeEach(() => store.register(registration));

  it('starts empty', async () => {
    expect(await store.loadTranscript('thread-1')).toEqual([]);
  });

  it('appends items and reads them back in order', async () => {
    await store.append('thread-1', [
      { role: 'user', content: 'primeiro' },
      { type: 'message', role: 'assistant', content: [] },
    ]);
    await store.append('thread-1', [{ role: 'user', content: 'segundo' }]);

    const items = await store.loadTranscript('thread-1');
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({ role: 'user', content: 'primeiro' });
    expect(items[2]).toEqual({ role: 'user', content: 'segundo' });
  });

  it('preserves a reasoning item with its encrypted content byte for byte', async () => {
    const reasoning: ConversationItem = {
      type: 'reasoning',
      id: 'rs_1',
      summary: [{ type: 'summary_text', text: 'pensei' }],
      encrypted_content: 'BLOB==/+abc',
    };

    await store.append('thread-1', [reasoning]);

    expect((await store.loadTranscript('thread-1'))[0]).toEqual(reasoning);
  });

  it('counts one turn per append, not per item', async () => {
    await store.append('thread-1', [
      { role: 'user', content: 'a' },
      { type: 'message', role: 'assistant', content: [] },
    ]);
    await store.append('thread-1', [{ role: 'user', content: 'b' }]);

    expect((await store.get('thread-1'))?.turnCount).toBe(2);
  });

  it('ignores an empty append', async () => {
    await store.append('thread-1', []);

    expect((await store.get('thread-1'))?.turnCount).toBe(0);
  });

  it('keeps threads isolated from one another', async () => {
    await store.register({ ...registration, threadId: 'thread-2' });
    await store.append('thread-1', [{ role: 'user', content: 'da um' }]);
    await store.append('thread-2', [{ role: 'user', content: 'da dois' }]);

    expect(await store.loadTranscript('thread-1')).toEqual([
      { role: 'user', content: 'da um' },
    ]);
    expect(await store.loadTranscript('thread-2')).toEqual([
      { role: 'user', content: 'da dois' },
    ]);
  });

  it('skips an unreadable row instead of failing the whole thread', async () => {
    await store.append('thread-1', [{ role: 'user', content: 'bom' }]);
    await testDb.current.db.insert(aiThreadItems).values({
      thread_id: 'thread-1',
      seq: 99,
      item_json: '{not json',
      created_at: 0,
    });
    await store.append('thread-1', [{ role: 'user', content: 'tambem bom' }]);

    const items = await store.loadTranscript('thread-1');
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.content)).toEqual(['bom', 'tambem bom']);
  });
});

describe('ThreadSessionStore compaction', () => {
  beforeEach(() => store.register(registration));

  function appendItems(count: number, prefix = 'msg') {
    return store.append(
      'thread-1',
      Array.from({ length: count }, (_, i) => ({
        role: 'user',
        content: `${prefix}-${i}`,
      })),
    );
  }

  it('does not ask for compaction while the transcript is small', async () => {
    await appendItems(5);

    expect(await store.needsCompaction('thread-1')).toBe(false);
  });

  it('asks for compaction once the transcript passes the token budget', async () => {
    const tight = new ThreadSessionStore(testDb.current.db, 100);
    await store.append(
      'thread-1',
      Array.from({ length: 10 }, (_, i) => ({
        role: 'user',
        content: 'x'.repeat(500) + i,
      })),
    );

    expect(await tight.needsCompaction('thread-1')).toBe(true);
  });

  it('estimates tokens as a function of stored size', async () => {
    expect(await store.estimateTokens('thread-1')).toBe(0);
    await appendItems(10);
    expect(await store.estimateTokens('thread-1')).toBeGreaterThan(0);
  });

  it('reports nothing to compact while under the keep-recent window', async () => {
    await appendItems(5);

    expect(await store.itemsToCompact('thread-1')).toEqual([]);
  });

  it('reports the oldest items as the ones about to be lost', async () => {
    await appendItems(25);

    const doomed = await store.itemsToCompact('thread-1');
    expect(doomed).toHaveLength(5);
    expect(doomed[0]).toEqual({ role: 'user', content: 'msg-0' });
    expect(doomed[4]).toEqual({ role: 'user', content: 'msg-4' });
  });

  it('replaces the old items with a single summary item and keeps the recent ones', async () => {
    await appendItems(25);

    await store.compact('thread-1', 'falamos de bun e postgres');

    const items = await store.loadTranscript('thread-1');
    expect(items).toHaveLength(21);
    expect(String(items[0]!.content)).toContain('falamos de bun e postgres');
    expect(String(items[0]!.content)).toContain('conversa_anterior_resumida');
    expect(items[1]).toEqual({ role: 'user', content: 'msg-5' });
    expect(items.at(-1)).toEqual({ role: 'user', content: 'msg-24' });
  });

  it('is a no-op when there is nothing old enough to compact', async () => {
    await appendItems(10);

    await store.compact('thread-1', 'resumo');

    expect(await store.loadTranscript('thread-1')).toHaveLength(10);
  });

  it('brings the transcript back under budget', async () => {
    const tight = new ThreadSessionStore(testDb.current.db, 200);
    await store.append(
      'thread-1',
      Array.from({ length: 40 }, (_, i) => ({
        role: 'user',
        content: 'y'.repeat(200) + i,
      })),
    );
    expect(await tight.needsCompaction('thread-1')).toBe(true);

    await tight.compact('thread-1', 'curto');

    expect(await tight.loadTranscript('thread-1')).toHaveLength(21);
  });

  it('can compact twice without seq collisions', async () => {
    await appendItems(25, 'first');
    await store.compact('thread-1', 'resumo 1');
    await appendItems(25, 'second');

    await store.compact('thread-1', 'resumo 2');

    const items = await store.loadTranscript('thread-1');
    expect(items).toHaveLength(21);
    expect(String(items[0]!.content)).toContain('resumo 2');
    expect(items.at(-1)).toEqual({ role: 'user', content: 'second-24' });
  });
});
