import type { GameDescriptor } from '../registry';
import { WordChainRoomBoard } from './components';
import { wordChainRoutes } from './wordChainRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'word-chain',
  status: 'PLAY',
  routes: wordChainRoutes,
  renderRoomBoard: () => <WordChainRoomBoard />,
};
