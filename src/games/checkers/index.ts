import type { GameDescriptor } from '../registry';
import type { GameId } from '../gameId';
import { checkersRoutes } from './checkersRoutes';

// 'checkers' isn't in the shared GameId union yet — see the cast note in
// useCheckersSession.ts. Adding it there plus one entry in registry.ts is
// the whole wiring step left for this game.
export const gameDescriptor: GameDescriptor = {
  id: 'checkers' as GameId,
  status: 'PLAY',
  routes: checkersRoutes,
};
