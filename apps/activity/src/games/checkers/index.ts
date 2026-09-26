import { lazyGame, lazyRoomBoard, type GameModule } from '@/games/GameModule';

export const checkersGame = {
  id: 'checkers',
  status: 'PLAY',
  Game: lazyGame(() => import('./CheckersGame'), 'CheckersGame'),
  RoomBoard: lazyRoomBoard(
    () => import('./components/CheckersRoomBoard'),
    'CheckersRoomBoard',
  ),
} satisfies GameModule;
