import type { GameDescriptor } from '@/games/GameDescriptor';
import { bingoSpeedRoutes } from './bingoSpeedRoutes';
import { BingoSpeedRoomBoard } from './components/index';

export const gameDescriptor: GameDescriptor = {
  id: 'bingo-speed',
  status: 'PLAY',
  routes: bingoSpeedRoutes,
  renderRoomBoard: () => <BingoSpeedRoomBoard />,
};
