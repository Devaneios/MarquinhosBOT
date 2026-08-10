import type { GameDescriptor } from '../registry';
import { wordChainRoutes } from './wordChainRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'word-chain',
  status: 'PLAY',
  routes: wordChainRoutes,
};
