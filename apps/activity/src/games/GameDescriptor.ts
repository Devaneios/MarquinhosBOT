import type { DiscordIdentity } from '@/discord/auth';
import type { GameId } from '@marquinhos/contracts/activity/gameId';
import type { JSX } from 'react';

export interface GameDescriptor {
  id: GameId;
  status: 'PLAY' | 'COMING SOON';
  routes: (identity: DiscordIdentity, onAuthInvalid: () => void) => JSX.Element;
  // Renders this game's board inside a multiplayer Room view (see
  // src/rooms/RoomView.tsx) — reads room state via useRoomConnectionContext
  // rather than owning its own connection. Optional so this field can roll
  // out per-game: a room whose game has no renderRoomBoard yet falls back
  // to a "not available in rooms yet" message instead of breaking.
  renderRoomBoard?: (props: { identity: DiscordIdentity }) => JSX.Element;
}
