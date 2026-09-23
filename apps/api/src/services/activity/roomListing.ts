import { type RoomListing } from '@marquinhos/contracts/activity/httpResponses';

export type MatchRoomMetadata = Omit<RoomListing, 'hostUserId'> & {
  roomKey: string;
  hostUserId: string | null;
};
