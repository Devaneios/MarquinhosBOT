import { lazyGame, lazyRoomBoard, type GameModule } from '@/games/GameModule';

export const bingoSpeedGame = {
  id: 'bingo-speed',
  status: 'PLAY',
  Game: lazyGame(() => import('./BingoSpeedGame'), 'BingoSpeedGame'),
  RoomBoard: lazyRoomBoard(
    () => import('./components/BingoSpeedRoomBoard'),
    'BingoSpeedRoomBoard',
  ),
} satisfies GameModule;
