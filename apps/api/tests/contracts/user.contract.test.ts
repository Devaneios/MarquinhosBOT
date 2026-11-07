import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { encryptToken } from 'common/crypto';
import { DiscordService } from 'integrations/discord/discord.service';
import { UserModule } from 'modules/user/user.module';
import { UserService } from 'modules/user/user.service';
import { startNestContractServer } from '../helpers/contractServer';

const { callContract } = await import('@marquinhos/api-client/bot');
const user = await import('@marquinhos/contracts/http/routes/user');

const fakeUsers = {
  enableLastfm: async () => undefined,
  toggleScrobbles: async (id: string) => ({ id, scrobblesOn: true }),
  deleteLastfmData: async () => undefined,
  deleteAllData: async () => undefined,
  exists: async (id: string) => (id === 'u1' ? { id } : null),
  hasValidLastfmSessionToken: async (id: string) => ({
    id,
    scrobblesOn: false,
  }),
  getTopArtists: async () => ({
    artists: [{ name: 'Artist', coverArtUrl: 'https://img/a' }],
    profileName: 'Gui',
  }),
  getTopAlbums: async () => ({
    albums: [{ name: 'Album', coverArtUrl: 'https://img/b' }],
    profileName: 'Gui',
  }),
  getTopTracks: async () => ({
    tracks: [{ name: 'Track', coverArtUrl: 'https://img/c' }],
    profileName: 'Gui',
  }),
} as unknown as UserService;

const fakeDiscord = {
  getDiscordUser: async () => ({ id: 'u1', username: 'gui' }),
  getDiscordGuildUserHighestRole: async () => 'admin',
} as unknown as DiscordService;

let server: Awaited<ReturnType<typeof startNestContractServer>>;

beforeAll(async () => {
  server = await startNestContractServer(
    { imports: [UserModule] },
    (builder) =>
      builder
        .overrideProvider(DiscordService)
        .useValue(fakeDiscord)
        .overrideProvider(UserService)
        .useValue(fakeUsers),
    { Authorization: `Bearer ${encryptToken('contract-user-token')}` },
  );
});

afterAll(() => server.close());

describe('user contracts', () => {
  it('returns the discord profile with extra fields kept', async () => {
    const profile = await callContract(server.http, user.getProfile, {});

    expect(profile).toEqual({
      id: 'u1',
      username: 'gui',
      highestRole: 'admin',
    });
  });

  it('checks existence and last.fm status', async () => {
    const found = await callContract(server.http, user.exists, {
      params: { id: 'u1' },
    });
    const missing = await callContract(server.http, user.exists, {
      params: { id: 'nobody' },
    });
    const status = await callContract(server.http, user.lastfmStatus, {});

    expect(found).toEqual({ id: 'u1' });
    expect(missing).toBeNull();
    expect(status).toEqual({ id: 'u1', scrobblesOn: false });
  });

  it('enables last.fm, toggles scrobbles and deletes data', async () => {
    const enabled = await callContract(server.http, user.enableLastfm, {
      body: { token: 'lastfm-token' },
    });
    const toggled = await callContract(server.http, user.toggleScrobbles, {});
    const lastfmDeleted = await callContract(
      server.http,
      user.deleteLastfmData,
      {},
    );
    const allDeleted = await callContract(server.http, user.deleteAllData, {});

    expect(enabled).toEqual({ message: 'Lastfm enabled' });
    expect(toggled).toEqual({ id: 'u1', scrobblesOn: true });
    expect(lastfmDeleted).toEqual({ message: 'User deleted' });
    expect(allDeleted).toEqual({ message: 'User deleted' });
  });

  it('serves top artists, albums and tracks', async () => {
    const params = { period: '7day', id: 'u1' } as const;
    const options = { headers: { Authorization: 'Bearer contract-test-key' } };
    const artists = await callContract(
      server.http,
      user.getTopArtists,
      {
        params,
      },
      options,
    );
    const albums = await callContract(
      server.http,
      user.getTopAlbums,
      {
        params,
      },
      options,
    );
    const tracks = await callContract(
      server.http,
      user.getTopTracks,
      {
        params,
      },
      options,
    );

    expect(artists.artists[0]?.name).toBe('Artist');
    expect(albums.albums[0]?.name).toBe('Album');
    expect(tracks.tracks[0]?.name).toBe('Track');
  });
});
