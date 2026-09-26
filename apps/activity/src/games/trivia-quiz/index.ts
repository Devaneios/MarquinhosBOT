import { lazyGame, type GameModule } from '@/games/GameModule';

export const triviaQuizGame = {
  id: 'trivia-quiz',
  status: 'PLAY',
  Game: lazyGame(() => import('./TriviaQuizGame'), 'TriviaQuizGame'),
} satisfies GameModule;
