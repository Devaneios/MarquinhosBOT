import type { JSX } from 'react';
import type { DiscordIdentity } from '../hooks/useDiscordIdentity';
import type { GameId } from './gameId';
import { gameDescriptor as pong } from './pong';
import { gameDescriptor as wordle } from './wordle';

export interface GameDescriptor {
  id: GameId;
  name: string;
  status: 'PLAY' | 'COMING SOON';
  routes: (
    identity: DiscordIdentity,
    onAuthInvalid: () => void,
  ) => JSX.Element;
}

// Adding a game means adding one descriptor file (see games/pong/index.ts,
// games/wordle/index.ts) and one entry here — Hub.tsx and routes.tsx never
// need to change.
export const GAME_REGISTRY: GameDescriptor[] = [pong, wordle];
