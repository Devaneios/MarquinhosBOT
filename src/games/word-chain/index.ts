import type { GameDescriptor } from '../registry';
import { wordChainRoutes } from './wordChainRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'word-chain',
  name: 'CORRENTE DE PALAVRAS',
  status: 'PLAY',
  routes: wordChainRoutes,
};
