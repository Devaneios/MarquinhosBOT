import { lazyGame, type GameModule } from '@/games/GameModule';

export const minesweeperVersusGame = {
  id: 'minesweeper-versus',
  status: 'PLAY',
  Game: lazyGame(
    () => import('./components/MinesweeperBoard'),
    'MinesweeperVersusGame',
  ),
} satisfies GameModule;
