import { TicTacToeRoomBoard } from './components';
import type { GameDescriptor } from '../registry';
import { ticTacToeRoutes } from './ticTacToeRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'tic-tac-toe',
  status: 'PLAY',
  routes: ticTacToeRoutes,
  renderRoomBoard: () => <TicTacToeRoomBoard />,
};
