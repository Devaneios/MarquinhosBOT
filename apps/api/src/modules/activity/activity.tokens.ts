import { matchMaker } from 'colyseus';

export const ACTIVITY_ROOM_QUERY = Symbol('ACTIVITY_ROOM_QUERY');

export type ActivityRoomQuery = typeof matchMaker.query;
