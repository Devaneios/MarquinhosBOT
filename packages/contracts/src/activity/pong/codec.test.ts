import { describe, expect, it } from "bun:test";
import {
  decodeStateSnapshot,
  encodeStateSnapshot,
  PONG_PROTOCOL_VERSION,
  withClassicView,
  type PongSnapshot,
} from "./codec";
import {
  PONG_ARENAS,
  PONG_PHASES,
  PONG_POWERUPS,
  PONG_RULESETS,
  PONG_SIDES,
} from "./types";

function snapshot(): PongSnapshot {
  return {
    seq: 17,
    serverTimeMs: 1234,
    phase: "rally",
    phaseRemainingMs: 0,
    ruleset: "classic-1v1",
    arena: "rectangular",
    targetScore: 11,
    bestOf: 3,
    gameIndex: 1,
    winnerSlot: null,
    lastEventSeq: 9,
    acks: [4, 6],
    score: [3, 2],
    gamesWon: [1, 0],
    lives: [0, 0],
    paddles: [
      {
        id: 0,
        slot: 0,
        team: 0,
        side: "left",
        orientation: "vertical",
        x: 12,
        y: 100,
        width: 12,
        height: 80,
        angle: 0,
        arc: 0,
        axisPosition: 100,
        velocity: -400,
        sizeMultiplier: 1,
        speedMultiplier: 1.5,
        shield: 1,
        reversedUntilMs: 0,
        stickyUntilMs: 2000,
        active: true,
      },
    ],
    balls: [
      {
        id: 5,
        x: 400,
        y: 240,
        vx: 300,
        vy: -20,
        radius: 8,
        spin: 0.25,
        lastTouchSlot: 0,
        stickyPaddleId: null,
        active: true,
      },
    ],
    bricks: [
      {
        id: 8,
        x: 350,
        y: 100,
        width: 30,
        height: 12,
        hp: 2,
        active: true,
      },
    ],
    powerUps: [
      {
        id: 3,
        kind: "grow",
        x: 300,
        y: 200,
        radius: 10,
        active: true,
        expiresAtMs: 9000,
      },
    ],
  };
}

describe("pong protocol v2", () => {
  it("round-trips every entity family", () => {
    const decoded = decodeStateSnapshot(encodeStateSnapshot(snapshot()));

    expect(decoded).toEqual(snapshot());
  });

  it("round-trips radial orientation independently from paddle side", () => {
    const state = snapshot();
    state.paddles[0]!.side = "bottom";
    state.paddles[0]!.orientation = "radial";
    state.paddles[0]!.angle = Math.PI / 2;
    state.paddles[0]!.arc = Math.PI / 3;

    const decoded = decodeStateSnapshot(encodeStateSnapshot(state));

    expect(decoded.paddles[0]!.orientation).toBe("radial");
    expect(decoded.paddles[0]!.side).toBe("bottom");
  });

  it("rejects a truncated buffer", () => {
    const encoded = encodeStateSnapshot(snapshot());

    expect(() =>
      decodeStateSnapshot(encoded.slice(0, encoded.byteLength - 1)),
    ).toThrow("Invalid Pong snapshot size");
  });

  it("rejects a different protocol version", () => {
    const encoded = encodeStateSnapshot(snapshot());
    new DataView(encoded).setUint8(0, PONG_PROTOCOL_VERSION + 1);

    expect(() => decodeStateSnapshot(encoded)).toThrow(
      "Unsupported Pong protocol version",
    );
  });

  it("round-trips every phase, ruleset, arena, side and power-up kind", () => {
    const decode = (state: PongSnapshot) =>
      decodeStateSnapshot(encodeStateSnapshot(state));

    for (const phase of PONG_PHASES) {
      expect(decode({ ...snapshot(), phase }).phase).toBe(phase);
    }
    for (const ruleset of PONG_RULESETS) {
      expect(decode({ ...snapshot(), ruleset }).ruleset).toBe(ruleset);
    }
    for (const arena of PONG_ARENAS) {
      expect(decode({ ...snapshot(), arena }).arena).toBe(arena);
    }
    for (const side of PONG_SIDES) {
      const state = snapshot();
      state.paddles[0]!.side = side;
      expect(decode(state).paddles[0]!.side).toBe(side);
    }
    for (const kind of PONG_POWERUPS) {
      const state = snapshot();
      state.powerUps[0]!.kind = kind;
      expect(decode(state).powerUps[0]!.kind).toBe(kind);
    }
  });

  it("keeps enum wire indexes stable", () => {
    const view = new DataView(
      encodeStateSnapshot({
        ...snapshot(),
        phase: "no-contest",
        ruleset: "coop-keep-alive",
        arena: "air-hockey",
      }),
    );

    expect([view.getUint8(1), view.getUint8(2), view.getUint8(27)]).toEqual([
      8, 13, 5,
    ]);
  });

  it("derives the classic two-player view from the wire snapshot", () => {
    const state = snapshot();
    state.winnerSlot = 1;

    const view = withClassicView(
      decodeStateSnapshot(encodeStateSnapshot(state)),
    );

    expect(view.ball.id).toBe(5);
    expect(view.classicPaddles).toEqual({ left: 100, right: 0 });
    expect(view.classicScore).toEqual({ left: 3, right: 2 });
    expect(view.winner).toBe("right");
  });
});
