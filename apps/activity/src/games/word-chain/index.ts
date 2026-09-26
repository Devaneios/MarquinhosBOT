import { lazyGame, lazyRoomBoard, type GameModule } from '@/games/GameModule';

export const wordChainGame = {
  id: 'word-chain',
  status: 'PLAY',
  Game: lazyGame(() => import('./WordChainGame'), 'WordChainGame'),
  RoomBoard: lazyRoomBoard(
    () => import('./components/WordChainRoomBoard'),
    'WordChainRoomBoard',
  ),
} satisfies GameModule;
