import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { EmojiReactionModule } from 'modules/emoji-reaction/emoji-reaction.module';
import { EmojiReactionService } from 'modules/emoji-reaction/emoji-reaction.service';
import { ScrobbleModule } from 'modules/scrobble/scrobble.module';
import { randomUUID } from 'node:crypto';
import { startNestContractServer } from '../helpers/contractServer';

const { callContract } = await import('@marquinhos/api-client/bot');
const emojiReaction =
  await import('@marquinhos/contracts/http/routes/emojiReaction');
const scrobble = await import('@marquinhos/contracts/http/routes/scrobble');

const fakeReactions = {
  chooseReactions: async () => ['😂', '🔥'],
} as unknown as EmojiReactionService;

let emojiServer: Awaited<ReturnType<typeof startNestContractServer>>;
let scrobbleServer: Awaited<ReturnType<typeof startNestContractServer>>;

beforeAll(async () => {
  emojiServer = await startNestContractServer(
    { imports: [EmojiReactionModule] },
    (builder) =>
      builder.overrideProvider(EmojiReactionService).useValue(fakeReactions),
  );
  scrobbleServer = await startNestContractServer({
    imports: [ScrobbleModule],
  });
});

afterAll(async () => {
  await emojiServer.close();
  await scrobbleServer.close();
});

describe('emoji reaction contracts', () => {
  it('returns the chosen emojis', async () => {
    const response = await callContract(
      emojiServer.http,
      emojiReaction.choose,
      {
        body: { content: 'kkkkk', recentMessages: [] },
      },
    );

    expect(response.data).toEqual({ emojis: ['😂', '🔥'] });
  });
});

describe('scrobble contracts', () => {
  it('adds and removes a listener, then dispatches the queued scrobble', async () => {
    const { db } = await import('@marquinhos/database/client');
    const { scrobblesQueue, users } =
      await import('@marquinhos/database/schema');
    const scrobbleId = randomUUID();
    const userId = `contract-user-${randomUUID()}`;
    await db.insert(users).values({ id: userId, scrobbles_on: false });
    await db.insert(scrobblesQueue).values({
      id: scrobbleId,
      track: JSON.stringify({
        artist: 'A',
        name: 'Song',
        durationInMillis: 180000,
      }),
      playback_data: JSON.stringify({
        title: 'A - Song',
        listeningUsersId: ['listener-without-lastfm'],
        timestamp: new Date().toISOString(),
        guildId: 'g1',
        channelId: 'c1',
        providerName: 'test',
      }),
      created_at: Math.floor(Date.now() / 1000),
    });

    const added = await callContract(scrobbleServer.http, scrobble.addUser, {
      params: { scrobbleId, userId },
    });
    const removed = await callContract(
      scrobbleServer.http,
      scrobble.removeUser,
      {
        params: { scrobbleId, userId },
      },
    );
    const dispatched = await callContract(
      scrobbleServer.http,
      scrobble.dispatch,
      {
        params: { id: scrobbleId },
      },
    );

    expect(added).toEqual({ data: scrobbleId, message: 'User added' });
    expect(removed).toEqual({ data: scrobbleId, message: 'User removed' });
    expect(dispatched).toEqual({ data: scrobbleId, message: 'Scrobbled' });
  });
});
