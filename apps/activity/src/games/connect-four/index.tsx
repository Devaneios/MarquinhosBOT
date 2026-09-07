import type { GameDescriptor } from '../registry';
import { ConnectFourRoomBoard } from './components';
import { connectFourRoutes } from './connectFourRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'connect-four',
  status: 'PLAY',
  routes: connectFourRoutes,
  renderRoomBoard: () => <ConnectFourRoomBoard />,
};
