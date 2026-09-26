import { lazyGame, type GameModule } from '@/games/GameModule';

export const cardsGame = {
  id: 'cards',
  status: 'PLAY',
  Game: lazyGame(() => import('./CardsGame'), 'CardsGame'),
} satisfies GameModule;
