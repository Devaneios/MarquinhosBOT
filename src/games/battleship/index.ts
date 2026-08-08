import type { GameDescriptor } from '../registry';
import { battleshipRoutes } from './battleshipRoutes';

export const gameDescriptor: GameDescriptor = {
  // 'battleship' isn't in GameId yet — see the comment on GAME_ID in
  // BattleshipGame.tsx for why (src/games/gameId.ts is a shared registry
  // file wired in later, once, for all 16 new games at once).
  id: 'battleship' as unknown as GameDescriptor['id'],
  name: 'BATTLESHIP',
  status: 'PLAY',
  routes: battleshipRoutes,
};
