import type { GameDescriptor } from '../GameDescriptor';
import { ConnectFourRoomBoard } from './components/index';
import { connectFourRoutes } from './connectFourRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'connect-four',
  status: 'PLAY',
  routes: connectFourRoutes,
  renderRoomBoard: () => <ConnectFourRoomBoard />,
};
