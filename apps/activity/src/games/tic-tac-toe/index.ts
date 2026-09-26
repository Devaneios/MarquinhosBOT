import { lazyGame, lazyRoomBoard, type GameModule } from '@/games/GameModule';

export const ticTacToeGame = {
  id: 'tic-tac-toe',
  status: 'PLAY',
  Game: lazyGame(() => import('./TicTacToeGame'), 'TicTacToeGame'),
  RoomBoard: lazyRoomBoard(
    () => import('./components/TicTacToeRoomBoard'),
    'TicTacToeRoomBoard',
  ),
} satisfies GameModule;
