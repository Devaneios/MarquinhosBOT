import type { GameDescriptor } from '../registry';
import type { GameId } from '../gameId';
import { connectFourRoutes } from './connectFourRoutes';

// 'connect-four' isn't part of the GameId union yet — that type (and
// registry.ts's GAME_REGISTRY) are shared files another process wires up
// serially across all 16 games, so this descriptor is deliberately not
// added to GAME_REGISTRY here. Cast removed the same moment that lands.
export const gameDescriptor: GameDescriptor = {
  id: 'connect-four' as GameId,
  name: 'CONECTA 4',
  status: 'PLAY',
  routes: connectFourRoutes,
};
