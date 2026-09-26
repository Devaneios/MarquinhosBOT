import { lazyGame, lazyRoomBoard, type GameModule } from '@/games/GameModule';

export const battleshipGame = {
  id: 'battleship',
  status: 'PLAY',
  Game: lazyGame(() => import('./BattleshipGame'), 'BattleshipGame'),
  RoomBoard: lazyRoomBoard(
    () => import('./components/BattleshipRoomBoard'),
    'BattleshipRoomBoard',
  ),
} satisfies GameModule;
