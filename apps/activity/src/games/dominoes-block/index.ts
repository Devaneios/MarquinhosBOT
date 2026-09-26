import { lazyGame, lazyRoomBoard, type GameModule } from '@/games/GameModule';

export const dominoesBlockGame = {
  id: 'dominoes-block',
  status: 'PLAY',
  Game: lazyGame(() => import('./DominoesBlockGame'), 'DominoesBlockGame'),
  RoomBoard: lazyRoomBoard(
    () => import('./components/DominoesBlockRoomBoard'),
    'DominoesBlockRoomBoard',
  ),
} satisfies GameModule;
