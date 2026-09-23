import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import type { EmojiReactionService } from 'services/aiChat/EmojiReactionService';
import { startContractServer } from '../helpers/contractServer';

const { callContract } = await import('@marquinhos/api-client/bot');
const emojiReaction =
  await import('@marquinhos/contracts/http/routes/emojiReaction');
const scrobble = await import('@marquinhos/contracts/http/routes/scrobble');

const fakeReactions = {
  chooseReactions: async () => ['😂', '🔥'],
} as unknown as EmojiReactionService;

let server: Awaited<ReturnType<typeof startContractServer>>;

beforeAll(async () => {
  const { createEmojiReactionRouter } =
    await import('../../src/routes/emojiReaction.route');
  const { default: EmojiReactionController } =
    await import('../../src/controllers/emojiReaction.controller');
  const { default: scrobbleRouter } =
    await import('../../src/routes/scrobble.route');
  server = await startContractServer((app) => {
    app.use(
      '/api/emoji-reaction',
      createEmojiReactionRouter(new EmojiReactionController(fakeReactions)),
    );
    app.use('/api/scrobble', scrobbleRouter);
  });
});

afterAll(() => server.close());

describe('emoji reaction contracts', () => {
  it('returns the chosen emojis', async () => {
    const response = await callContract(server.http, emojiReaction.choose, {
      body: { content: 'kkkkk', recentMessages: [] },
    });

    expect(response.data).toEqual({ emojis: ['😂', '🔥'] });
  });
});

describe('scrobble contracts', () => {
  it('adds and removes a listener, then dispatches the queued scrobble', async () => {
    const { db } = await import('@marquinhos/database/sqlite');
    const scrobbleId = randomUUID();
    const userId = `contract-user-${randomUUID()}`;
    db.run('INSERT INTO users (id, scrobbles_on) VALUES (?, 0)', [userId]);
    db.run(
      'INSERT INTO scrobbles_queue (id, track, playback_data, created_at) VALUES (?, ?, ?, ?)',
      [
        scrobbleId,
        JSON.stringify({ artist: 'A', name: 'Song', durationInMillis: 180000 }),
        JSON.stringify({
          title: 'A - Song',
          listeningUsersId: ['listener-without-lastfm'],
          timestamp: new Date().toISOString(),
          guildId: 'g1',
          channelId: 'c1',
          providerName: 'test',
        }),
        Math.floor(Date.now() / 1000),
      ],
    );

    const added = await callContract(server.http, scrobble.addUser, {
      params: { scrobbleId, userId },
    });
    const removed = await callContract(server.http, scrobble.removeUser, {
      params: { scrobbleId, userId },
    });
    const dispatched = await callContract(server.http, scrobble.dispatch, {
      params: { id: scrobbleId },
    });

    expect(added).toEqual({ data: scrobbleId, message: 'User added' });
    expect(removed).toEqual({ data: scrobbleId, message: 'User removed' });
    expect(dispatched).toEqual({ data: scrobbleId, message: 'Scrobbled' });
  });
});
