import type { GameDescriptor } from '../registry';
import { ticTacToeRoutes } from './ticTacToeRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'tic-tac-toe',
  name: 'TIC-TAC-TOE',
  status: 'PLAY',
  routes: ticTacToeRoutes,
};
