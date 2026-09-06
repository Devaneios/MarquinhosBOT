import { ConnectFourRoomBoard } from './components';
import type { GameDescriptor } from '../registry';
import { connectFourRoutes } from './connectFourRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'connect-four',
  status: 'PLAY',
  routes: connectFourRoutes,
  renderRoomBoard: () => <ConnectFourRoomBoard />,
};
