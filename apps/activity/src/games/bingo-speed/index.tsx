import type { GameDescriptor } from '../registry';
import { bingoSpeedRoutes } from './bingoSpeedRoutes';
import { BingoSpeedRoomBoard } from './components';

export const gameDescriptor: GameDescriptor = {
  id: 'bingo-speed',
  status: 'PLAY',
  routes: bingoSpeedRoutes,
  renderRoomBoard: () => <BingoSpeedRoomBoard />,
};
