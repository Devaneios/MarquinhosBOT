import type { GameDescriptor } from '@/games/GameDescriptor';
import { TicTacToeRoomBoard } from './components/index';
import { ticTacToeRoutes } from './ticTacToeRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'tic-tac-toe',
  status: 'PLAY',
  routes: ticTacToeRoutes,
  renderRoomBoard: () => <TicTacToeRoomBoard />,
};
