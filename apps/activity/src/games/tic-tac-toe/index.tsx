import type { GameDescriptor } from '../registry';
import { TicTacToeRoomBoard } from './components';
import { ticTacToeRoutes } from './ticTacToeRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'tic-tac-toe',
  status: 'PLAY',
  routes: ticTacToeRoutes,
  renderRoomBoard: () => <TicTacToeRoomBoard />,
};
