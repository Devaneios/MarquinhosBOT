import type { GameDescriptor } from '../GameDescriptor';
import { WordChainRoomBoard } from './components/index';
import { wordChainRoutes } from './wordChainRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'word-chain',
  status: 'PLAY',
  routes: wordChainRoutes,
  renderRoomBoard: () => <WordChainRoomBoard />,
};
