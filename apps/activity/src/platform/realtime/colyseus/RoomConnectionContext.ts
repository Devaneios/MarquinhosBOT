import type {
  RoomMemberRole,
  RoomState,
} from '@marquinhos/contracts/activity/room';
import { createContext, useContext } from 'react';
import type { ActivityMessage, ColyseusConnectionState } from './connection';

interface RoomConnectionContextValue {
  send: (message: ActivityMessage) => void;
  connectionState: ColyseusConnectionState;
  roomState: RoomState | null;
  role: RoomMemberRole | null;
  currentUserId: string;
  isHost: boolean;
  subscribe: (onMessage: (message: ActivityMessage) => void) => () => void;
}

// Exported (not just the hook below) so tests can wrap components directly
// with a fixed context value, without spinning up a real provider/connection.
export const RoomConnectionContext =
  createContext<RoomConnectionContextValue | null>(null);

export function useRoomConnectionContext(): RoomConnectionContextValue | null {
  return useContext(RoomConnectionContext);
}
