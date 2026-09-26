import { lazyGame, lazyRoomBoard, type GameModule } from '@/games/GameModule';

export const towerUnstableGame = {
  id: 'tower-unstable',
  status: 'PLAY',
  Game: lazyGame(() => import('./TowerGame'), 'TowerGame'),
  RoomBoard: lazyRoomBoard(
    () => import('./components/TowerRoomBoard'),
    'TowerRoomBoard',
  ),
} satisfies GameModule;
