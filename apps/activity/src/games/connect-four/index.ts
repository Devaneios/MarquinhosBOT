import { lazyGame, lazyRoomBoard, type GameModule } from '@/games/GameModule';

export const connectFourGame = {
  id: 'connect-four',
  status: 'PLAY',
  Game: lazyGame(() => import('./ConnectFourGame'), 'ConnectFourGame'),
  RoomBoard: lazyRoomBoard(
    () => import('./components/ConnectFourRoomBoard'),
    'ConnectFourRoomBoard',
  ),
} satisfies GameModule;
