import { describe, expect, it, mock } from 'bun:test';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import type { RoomListing } from '../../games/shared/activitySession';

const identity: DiscordIdentity = {
  userId: 'u1',
  guildId: 'g1',
  instanceId: 'i1',
  accessToken: 'acc',
};

function mockDeps(
  rooms: RoomListing[],
  overrides: {
    createRoom?: () => Promise<unknown>;
    fetchWsSessionToken?: () => Promise<unknown>;
    participants?: Record<string, string>;
  } = {},
) {
  mock.module('../../games/shared/activitySession', () => ({
    getAvailableRooms: async () => rooms,
    createRoom:
      overrides.createRoom ??
      (async () => ({ roomId: 'NEWROOM', token: 'tok', roomKey: 'key' })),
    fetchWsSessionToken:
      overrides.fetchWsSessionToken ??
      (async () => ({ token: 'tok', roomKey: 'key' })),
  }));
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
    const { RoomLobbyScreen } = await import(`./RoomLobbyScreen.tsx?${Math.random()}`);
    const onRoomReady = mock(() => {});

    render(
      <RoomLobbyScreen identity={identity} onRoomReady={onRoomReady} onBack={() => {}} />,
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
    const { RoomLobbyScreen } = await import(`./RoomLobbyScreen.tsx?${Math.random()}`);

    render(<RoomLobbyScreen identity={identity} onRoomReady={() => {}} onBack={() => {}} />);

    await waitFor(() =>
      expect(screen.getByText(/nenhuma sala/i)).toBeTruthy(),
    );
  });

  it('creates a room for the selected game and calls onRoomReady', async () => {
    mockDeps([], {
      createRoom: async () => ({
        roomId: 'NEWROOM',
        token: 'tok-2',
        roomKey: 'key-2',
      }),
    });
    const { RoomLobbyScreen } = await import(`./RoomLobbyScreen.tsx?${Math.random()}`);
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
    const { RoomLobbyScreen } = await import(`./RoomLobbyScreen.tsx?${Math.random()}`);
    const onBack = mock(() => {});

    render(<RoomLobbyScreen identity={identity} onRoomReady={() => {}} onBack={onBack} />);

    await waitFor(() => expect(screen.getByText(/nenhuma sala/i)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));

    expect(onBack).toHaveBeenCalled();
  });
});
