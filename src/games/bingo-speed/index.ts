import type { GameDescriptor } from '../registry';
import { bingoSpeedRoutes } from './bingoSpeedRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'bingo-speed',
  status: 'PLAY',
  routes: bingoSpeedRoutes,
};
