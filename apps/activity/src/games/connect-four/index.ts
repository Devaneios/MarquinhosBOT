import { lazyGame, lazyRoomBoard, type GameModule } from '@/games/GameModule';

export const connectFourGame = {
  id: 'connect-four',
  status: 'PLAY',
  Game: lazyGame(
    () => import('./components/ConnectFourBoard'),
    'ConnectFourGame',
  ),
  RoomBoard: lazyRoomBoard(
    () => import('./components/ConnectFourRoomBoard'),
    'ConnectFourRoomBoard',
  ),
} satisfies GameModule;
