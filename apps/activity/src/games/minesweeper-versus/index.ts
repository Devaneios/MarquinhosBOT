import { lazyGame, type GameModule } from '@/games/GameModule';

export const minesweeperVersusGame = {
  id: 'minesweeper-versus',
  status: 'PLAY',
  Game: lazyGame(
    () => import('./MinesweeperVersusGame'),
    'MinesweeperVersusGame',
  ),
} satisfies GameModule;
