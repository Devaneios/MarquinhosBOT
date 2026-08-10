import type { GameDescriptor } from '../registry';
import type { GameId } from '../gameId';
import { boggleRoutes } from './boggleRoutes';

// 'boggle-word-race' isn't in gameId.ts yet — see the shared brief's hard
// constraints, that file is wired up serially by another process once every
// game lands. This cast is the documented way to shape the descriptor
// correctly ahead of that wiring.
export const gameDescriptor: GameDescriptor = {
  id: 'boggle-word-race' as GameId,
  status: 'PLAY',
  routes: boggleRoutes,
};
