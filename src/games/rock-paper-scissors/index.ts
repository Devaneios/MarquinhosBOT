import type { GameDescriptor } from '../registry';
import { rpsRoutes } from './rpsRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'rock-paper-scissors',
  name: 'PEDRA, PAPEL OU TESOURA',
  status: 'PLAY',
  routes: rpsRoutes,
};
