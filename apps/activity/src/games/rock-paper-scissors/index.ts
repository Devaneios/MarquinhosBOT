import { lazyGame, lazyRoomBoard, type GameModule } from '@/games/GameModule';

export const rockPaperScissorsGame = {
  id: 'rock-paper-scissors',
  status: 'PLAY',
  Game: lazyGame(() => import('./RpsGame'), 'RpsGame'),
  RoomBoard: lazyRoomBoard(
    () => import('./components/RpsRoomBoard'),
    'RpsRoomBoard',
  ),
} satisfies GameModule;
