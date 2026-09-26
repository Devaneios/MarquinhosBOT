import { lazyGame, lazyRoomBoard, type GameModule } from '@/games/GameModule';

export const snakeGame = {
  id: 'snake-game',
  status: 'PLAY',
  Game: lazyGame(() => import('./SnakeGame'), 'SnakeGame'),
  RoomBoard: lazyRoomBoard(
    () => import('./components/SnakeRoomBoard'),
    'SnakeRoomBoard',
  ),
} satisfies GameModule;
