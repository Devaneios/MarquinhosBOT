import { describe, expect, it } from 'bun:test';
import { isSeatActive, TurnOrder } from 'services/activity/cards/core/seating';

function seats() {
  return [
    { seatIndex: 0, playerId: 'p1' },
    { seatIndex: 1, playerId: 'p2' },
    { seatIndex: 2, playerId: 'p3' },
  ];
}

describe('TurnOrder', () => {
  it('advances to the next seat in seat-index order', () => {
    const order = new TurnOrder(seats());
    expect(order.currentSeat).toBe(0);
    order.advance();
    expect(order.currentSeat).toBe(1);
    order.advance();
    expect(order.currentSeat).toBe(2);
    order.advance();
    expect(order.currentSeat).toBe(0); // wraps around
  });

  it('advances backward when direction is reversed', () => {
    const order = new TurnOrder(seats());
    order.direction = -1;
    order.advance();
    expect(order.currentSeat).toBe(2);
  });

  it('skips seats when skipCount is given (Uno-style skip)', () => {
    const order = new TurnOrder(seats());
    order.advance(2); // skip p2, land on p3
    expect(order.currentSeat).toBe(2);
  });

  it('sorts seats by index, so array order cannot define a wrong adjacency', () => {
    const order = new TurnOrder([
      { seatIndex: 2, playerId: 'p3' },
      { seatIndex: 0, playerId: 'p1' },
      { seatIndex: 1, playerId: 'p2' },
    ]);
    expect(order.currentSeat).toBe(0);
    order.advance();
    expect(order.currentSeat).toBe(1);
  });

  describe('inactive seats', () => {
    it('never hands the turn to an empty chair', () => {
      const order = new TurnOrder([
        { seatIndex: 0, playerId: 'p1' },
        { seatIndex: 1, playerId: null },
        { seatIndex: 2, playerId: 'p3' },
      ]);
      order.advance();
      expect(order.currentSeat).toBe(2);
    });

    it('skips an eliminated seat (bust, fold, out of cards)', () => {
      const order = new TurnOrder(seats());
      order.eliminate(1);
      order.advance();
      expect(order.currentSeat).toBe(2);
      order.advance();
      expect(order.currentSeat).toBe(0);
    });

    it('advances off a seat that was eliminated while holding the turn', () => {
      const order = new TurnOrder(seats());
      order.advance(); // p2's turn
      expect(order.currentSeat).toBe(1);
      order.eliminate(1);
      order.advance();
      expect(order.currentSeat).toBe(2);
    });

    it('starts on the first active seat rather than seat 0 blindly', () => {
      const order = new TurnOrder([
        { seatIndex: 0, playerId: null },
        { seatIndex: 1, playerId: 'p2' },
      ]);
      expect(order.currentSeat).toBe(1);
    });

    it('does nothing when every seat is inactive, rather than looping', () => {
      const order = new TurnOrder([
        { seatIndex: 0, playerId: null },
        { seatIndex: 1, playerId: null },
      ]);
      order.advance();
      expect(order.currentSeat).toBe(0);
    });

    it('isSeatActive treats an empty or eliminated seat as out', () => {
      expect(isSeatActive({ seatIndex: 0, playerId: 'p1' })).toBe(true);
      expect(isSeatActive({ seatIndex: 0, playerId: null })).toBe(false);
      expect(
        isSeatActive({ seatIndex: 0, playerId: 'p1', eliminated: true }),
      ).toBe(false);
    });
  });

  describe('extra turns', () => {
    it('grants a queued extra turn, then resumes the normal rotation', () => {
      // The point of a queue rather than a currentSeat setter: "play again" has
      // to hand the turn back afterwards.
      const order = new TurnOrder(seats());
      order.grantExtraTurn(0);
      order.advance();
      expect(order.currentSeat).toBe(0); // the extra turn
      order.advance();
      expect(order.currentSeat).toBe(1); // rotation resumes
    });

    it('stacks several extra turns in order', () => {
      const order = new TurnOrder(seats());
      order.grantExtraTurn(2);
      order.grantExtraTurn(0);
      order.advance();
      expect(order.currentSeat).toBe(2);
      order.advance();
      expect(order.currentSeat).toBe(0);
    });

    it('drops queued extra turns for a seat that gets eliminated', () => {
      const order = new TurnOrder(seats());
      order.grantExtraTurn(1);
      order.eliminate(1);
      order.advance();
      expect(order.currentSeat).toBe(2);
    });
  });

  it('clone() copies position, direction and queued turns independently', () => {
    const order = new TurnOrder(seats());
    order.advance();
    order.grantExtraTurn(0);
    order.direction = -1;

    const copy = order.clone();
    expect(copy.currentSeat).toBe(1);
    expect(copy.direction).toBe(-1);

    copy.advance();
    copy.eliminate(2);
    expect(order.currentSeat).toBe(1); // original untouched
    expect(
      order.seats.find((s) => s.seatIndex === 2)?.eliminated,
    ).toBeUndefined();
  });

  it('supports team ids on seats without the engine interpreting them', () => {
    const order = new TurnOrder([
      { seatIndex: 0, playerId: 'p1', teamId: 'A' },
      { seatIndex: 1, playerId: 'p2', teamId: 'B' },
      { seatIndex: 2, playerId: 'p3', teamId: 'A' },
      { seatIndex: 3, playerId: 'p4', teamId: 'B' },
    ]);
    expect(order.seats[2]!.teamId).toBe('A');
  });
});
