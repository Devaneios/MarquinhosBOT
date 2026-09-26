import { lazyGame, type GameModule } from '@/games/GameModule';

export const pongGame = {
  id: 'pong',
  status: 'PLAY',
  Game: lazyGame(() => import('./PongGame'), 'PongGame'),
} satisfies GameModule;
