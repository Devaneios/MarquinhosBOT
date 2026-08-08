import type { GameDescriptor } from '../registry';
import { bingoSpeedRoutes } from './bingoSpeedRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'bingo-speed',
  name: 'BINGO SPEED',
  status: 'PLAY',
  routes: bingoSpeedRoutes,
};
