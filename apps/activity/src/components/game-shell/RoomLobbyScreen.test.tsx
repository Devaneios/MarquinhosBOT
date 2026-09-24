import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, mock } from 'bun:test';
import type { DiscordIdentity } from '../../discordAuth.ts';
import type { RoomListing } from '../../games/shared/activitySession';

const identity: DiscordIdentity = {
  userId: 'u1',
  guildId: 'g1',
  instanceId: 'i1',
  accessToken: 'acc',
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockDeps(
  rooms: RoomListing[],
  overrides: {
    createdRoom?: { roomId: string; token: string; roomKey: string };
    participants?: Record<string, string>;
  } = {},
) {
  const responses: [string, unknown][] = [
    ['/activities/rooms/list', rooms],
    [
      '/activities/rooms',
      overrides.createdRoom ?? {
        roomId: 'NEWROOM',
        token: 'tok',
        roomKey: 'key',
      },
    ],
    ['/activities/ws-session', { token: 'tok', roomKey: 'key' }],
  ];
  globalThis.fetch = Object.assign(
    async (input: Parameters<typeof fetch>[0]) => {
      const url = input.toString();
      const match = responses.find(([path]) => url.endsWith(path));
      if (!match) return new Response('', { status: 404 });
      return new Response(JSON.stringify({ data: match[1] }), { status: 200 });
    },
    { preconnect: originalFetch.preconnect },
  );
  mock.module('../../lib/discordParticipants', () => ({
    getParticipantDisplayNames: async () => overrides.participants ?? {},
  }));
}

describe('RoomLobbyScreen', () => {
  it('lists open multiplayer rooms and lets the user join one', async () => {
    mockDeps([
      {
        instanceId: 'i1',
        roomId: 'ROOM01',
        game: 'tic-tac-toe',
        hostUserId: 'u2',
        playerCount: 1,
        spectatorCount: 0,
        queueDepth: 0,
        queueEnabled: false,
        mode: 'multi',
      },
    ]);
    const { RoomLobbyScreen } = await import(
      `./RoomLobbyScreen.tsx?${Math.random()}`
    );
    const onRoomReady = mock(() => {});

    render(
      <RoomLobbyScreen
        identity={identity}
        onRoomReady={onRoomReady}
        onBack={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByText(/ROOM01/i)).toBeTruthy());

    fireEvent.click(screen.getByText(/ROOM01/i));

    await waitFor(() =>
      expect(onRoomReady).toHaveBeenCalledWith({
        roomId: 'ROOM01',
        token: 'tok',
        roomKey: 'key',
        game: 'tic-tac-toe',
        queueEnabled: false,
      }),
    );
  });

  it('shows a message when no rooms are open', async () => {
    mockDeps([]);
    const { RoomLobbyScreen } = await import(
      `./RoomLobbyScreen.tsx?${Math.random()}`
    );

    render(
      <RoomLobbyScreen
        identity={identity}
        onRoomReady={() => {}}
        onBack={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByText(/nenhuma sala/i)).toBeTruthy());
  });

  it('creates a room for the selected game and calls onRoomReady', async () => {
    mockDeps([], {
      createdRoom: { roomId: 'NEWROOM', token: 'tok-2', roomKey: 'key-2' },
    });
    const { RoomLobbyScreen } = await import(
      `./RoomLobbyScreen.tsx?${Math.random()}`
    );
    const onRoomReady = mock(() => {});

    render(
      <RoomLobbyScreen
        identity={identity}
        preselectedGame="tic-tac-toe"
        onRoomReady={onRoomReady}
        onBack={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByText(/nenhuma sala/i)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /criar sala/i }));

    await waitFor(() =>
      expect(onRoomReady).toHaveBeenCalledWith({
        roomId: 'NEWROOM',
        token: 'tok-2',
        roomKey: 'key-2',
        game: 'tic-tac-toe',
        queueEnabled: false,
      }),
    );
  });

  it('calls onBack when the back button is pressed', async () => {
    mockDeps([]);
    const { RoomLobbyScreen } = await import(
      `./RoomLobbyScreen.tsx?${Math.random()}`
    );
    const onBack = mock(() => {});

    render(
      <RoomLobbyScreen
        identity={identity}
        onRoomReady={() => {}}
        onBack={onBack}
      />,
    );

    await waitFor(() => expect(screen.getByText(/nenhuma sala/i)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));

    expect(onBack).toHaveBeenCalled();
  });

  it('says the room list is unavailable when it fails to load', async () => {
    mockDeps([]);
    globalThis.fetch = Object.assign(
      async () => new Response('', { status: 500 }),
      { preconnect: originalFetch.preconnect },
    );
    const { RoomLobbyScreen } = await import(
      `./RoomLobbyScreen.tsx?${Math.random()}`
    );

    render(
      <RoomLobbyScreen
        identity={identity}
        onRoomReady={() => {}}
        onBack={() => {}}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText(/não foi possível carregar/i)).toBeTruthy(),
    );
    expect(screen.queryByText(/nenhuma sala/i)).toBeNull();
  });
});
