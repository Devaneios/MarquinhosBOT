import type { GameDescriptor } from '@/games/GameDescriptor';
import { DominoesBlockRoomBoard } from './components/index';
import { dominoesBlockRoutes } from './dominoesBlockRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'dominoes-block',
  status: 'PLAY',
  routes: dominoesBlockRoutes,
  renderRoomBoard: () => <DominoesBlockRoomBoard />,
};
