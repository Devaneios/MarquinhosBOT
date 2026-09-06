import { describe, expect, it } from 'bun:test';
import {
  allowsMove,
  opposingTeamSeats,
  owesResponse,
  type PendingResponse,
} from 'services/activity/cards/core/pendingResponse';
import type { Seat } from 'services/activity/cards/core/seating';

const SEATS: Seat[] = [
  { seatIndex: 0, playerId: 'p1', teamId: 'A' },
  { seatIndex: 1, playerId: 'p2', teamId: 'B' },
  { seatIndex: 2, playerId: 'p3', teamId: 'A' },
  { seatIndex: 3, playerId: 'p4', teamId: 'B' },
];

function pending(overrides: Partial<PendingResponse> = {}): PendingResponse {
  return {
    initiatorSeat: 0,
    respondingSeats: [1, 3],
    allowedMoves: ['accept', 'fold', 'raise'],
    resumeSeat: 0,
    data: undefined,
    ...overrides,
  };
}

describe('pending response', () => {
  it('knows which seats owe an answer', () => {
    const call = pending();
    expect(owesResponse(call, 1)).toBe(true);
    expect(owesResponse(call, 3)).toBe(true);
    expect(owesResponse(call, 0)).toBe(false); // the initiator answers nothing
    expect(owesResponse(call, 2)).toBe(false);
  });

  it('treats no pending response as nobody owing anything', () => {
    expect(owesResponse(null, 1)).toBe(false);
  });

  it('gates moves to the ones the open response allows', () => {
    const call = pending();
    expect(allowsMove(call, 'accept')).toBe(true);
    expect(allowsMove(call, 'play_card')).toBe(false);
  });

  it('allows every move when nothing is pending', () => {
    expect(allowsMove(null, 'play_card')).toBe(true);
  });

  it('records where the rotation resumes, so accept and fold agree on it', () => {
    expect(pending({ resumeSeat: 2 }).resumeSeat).toBe(2);
  });

  it('resolves the opposing team as the responding seats', () => {
    expect(opposingTeamSeats(SEATS, 0)).toEqual([1, 3]);
    expect(opposingTeamSeats(SEATS, 1)).toEqual([0, 2]);
  });

  it('excludes inactive seats from the responding set', () => {
    const seats: Seat[] = [
      ...SEATS.slice(0, 3),
      { seatIndex: 3, playerId: null, teamId: 'B' },
    ];
    expect(opposingTeamSeats(seats, 0)).toEqual([1]);
  });
});
