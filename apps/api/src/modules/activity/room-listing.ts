import type { RoomListing } from '@marquinhos/contracts/http/routes/activity';

export type MatchRoomMetadata = Omit<RoomListing, 'hostUserId'> & {
  roomKey: string;
  hostUserId: string | null;
};
