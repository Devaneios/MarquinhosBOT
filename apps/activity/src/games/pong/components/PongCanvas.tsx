import type { Room } from '@colyseus/sdk';
import { Application, BlurFilter, Graphics } from 'pixi.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { colyseusUrl } from '../../../lib/apiBase';
import { cn } from '../../../lib/cn';
import { devinfo, devlog, devwarn } from '../../../lib/devlog';
import type { WsSession } from '../../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../../shared/useColyseusRoom';
import { LocalPaddlePredictor, PongSnapshotBuffer } from '../netcode';
import { decodeStateSnapshot, type DecodedSnapshot } from '../protocol';
import type { GameMode, PongSide } from '../types';
import { PongSfx } from './sfx';

type Side = 'left' | 'right';

interface PongLobbyState {
  hostUserId: string | null;
  started: boolean;
  config: {
    ruleset: string;
    targetScore: number;
    bestOf: number;
    ranked: boolean;
  };
  players: {
    userId: string;
    displayName: string;
    slot: number;
    side: PongSide;
    team: number;
    connected: boolean;
    ready: boolean;
  }[];
  spectators: string[];
}

const LOBBY_RULESETS = [
  'classic-1v1',
  'doubles-2v2',
  'quad-elimination',
  'superpong',
  'rebound',
  'breakout',
  'brick-battle',
  'multiball',
  'powerup-battle',
  'radial-solo',
  'radial-duel',
  'pong-tennis',
  'air-hockey',
  'coop-keep-alive',
] as const;

const COURT_BG = '#17181a';
const COURT_LINE = '#34363a';
const LEFT_COLOR = '#ffb000';
const RIGHT_COLOR = '#5fbf77';

interface PongConfig {
  width: number;
  height: number;
  paddleWidth: number;
  paddleHeight: number;
  paddleSpeed: number;
  ballRadius: number;
  cornerGap?: number;
}

const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_RADIUS = 8;
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 480;
const DEFAULT_PADDLE_SPEED = 400;
const PARTICLE_MIN_SPEED = 60;
const PARTICLE_MAX_SPEED = 220;
const PARTICLE_RADIUS = 3;
const PARTICLE_LIFETIME_MS = 350;
const PARTICLE_SPAWN_SPREAD = 10;
const PARTICLE_BASE_COUNT = 10;
const PARTICLE_MIN_COUNT = 8;
const PARTICLE_MAX_COUNT = 40;
const BALL_SQUASH_DURATION_MS = 110;
const BALL_SQUASH_AMOUNT = 0.18;
// Mirrors PongEngine's initial ballSpeed (marquinhos-api) — the reference
// point a hit's particle count is scaled against, not derivable client-side.
const BALL_SPEED_REFERENCE = 300;

// Ball FX: comet trail, glow, speed-heat color, and direction-aligned
// stretch/spin. Speed thresholds are tuned against BALL_SPEED_REFERENCE
// (server's initial speed) so the ball only starts looking "hot" once a
// rally has ramped up a few hits.
const BALL_TRAIL_LENGTH = 10;
const BALL_TRAIL_MAX_ALPHA = 0.4;
const BALL_TRAIL_MIN_RADIUS_FACTOR = 0.15;
const BALL_GLOW_SCALE = 2.6;
const BALL_GLOW_ALPHA_BASE = 0.28;
const BALL_HEAT_SPEED_MIN = BALL_SPEED_REFERENCE;
const BALL_HEAT_SPEED_MAX = BALL_SPEED_REFERENCE * 3;
const BALL_COLOR_NUM = 0xf2ede3;
const BALL_HOT_COLOR_NUM = 0xfff45c;
const BALL_STRETCH_MAX = 0.32;
const BALL_STRETCH_SPEED_MAX = BALL_SPEED_REFERENCE * 3;
const BALL_SPIN_RATE = 0.02;
const BALL_MIN_DIR_SPEED = 15;

// Paddle FX: hit flash, impact squash, ambient energy glow, and a motion
// trail that only appears once the paddle is moving fast enough to read as
// intentional (not jitter from reconciliation).
const PADDLE_GLOW_PAD = 6;
const PADDLE_GLOW_ALPHA_BASE = 0.22;
const PADDLE_GLOW_ALPHA_HIT = 0.85;
const PADDLE_GLOW_DECAY_MS = 260;
const PADDLE_FLASH_DURATION_MS = 150;
const PADDLE_FLASH_MAX_ALPHA = 0.85;
const PADDLE_SQUASH_DURATION_MS = 150;
const PADDLE_SQUASH_AMOUNT = 0.22;
const PADDLE_TRAIL_LENGTH = 6;
const PADDLE_TRAIL_SPEED_THRESHOLD = 90;
const PADDLE_TRAIL_MAX_ALPHA = 0.22;
const PADDLE_TRAIL_MAX_AGE_MS = 160;

// Screen shake on paddle contact, scaled by how fast the ball was moving.
const SHAKE_DURATION_MS = 220;
const SHAKE_MAGNITUDE_MIN = 2;
const SHAKE_MAGNITUDE_MAX = 8;

const DEFAULT_CONFIG: PongConfig = {
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  paddleWidth: PADDLE_WIDTH,
  paddleHeight: PADDLE_HEIGHT,
  paddleSpeed: DEFAULT_PADDLE_SPEED,
  ballRadius: BALL_RADIUS,
};

interface Snapshot {
  state: DecodedSnapshot;
  receivedAt: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function lerpColorHex(colorA: number, colorB: number, t: number): number {
  const clampedT = clamp(t, 0, 1);
  const ar = (colorA >> 16) & 0xff;
  const ag = (colorA >> 8) & 0xff;
  const ab = colorA & 0xff;
  const br = (colorB >> 16) & 0xff;
  const bg = (colorB >> 8) & 0xff;
  const bb = colorB & 0xff;
  const r = Math.round(lerp(ar, br, clampedT));
  const g = Math.round(lerp(ag, bg, clampedT));
  const b = Math.round(lerp(ab, bb, clampedT));
  return (r << 16) | (g << 8) | b;
}

function closestPointOnRect(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): { x: number; y: number } {
  return { x: clamp(cx, rx, rx + rw), y: clamp(cy, ry, ry + rh) };
}

function circleOverlapsPoint(
  cx: number,
  cy: number,
  radius: number,
  point: { x: number; y: number },
): boolean {
  const dx = cx - point.x;
  const dy = cy - point.y;
  return dx * dx + dy * dy <= radius * radius;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function drawDashedVerticalLine(
  graphics: Graphics,
  x: number,
  height: number,
  dash = 24,
  gap = 20,
  color = COURT_LINE,
  width = 4,
) {
  graphics.clear();
  let y = 0;
  while (y < height) {
    const segmentEnd = Math.min(y + dash, height);
    graphics.moveTo(x, y).lineTo(x, segmentEnd);
    y += dash + gap;
  }
  graphics.stroke({ width, color });
}

interface PaddleTrailPoint {
  y: number;
  age: number;
}

function paddleGlowAlpha(now: number, phase: number, flashStart: number) {
  const idle = PADDLE_GLOW_ALPHA_BASE + 0.1 * Math.sin(now * 0.0035 + phase);
  const hitProgress = clamp((now - flashStart) / PADDLE_GLOW_DECAY_MS, 0, 1);
  const hitBoost =
    (PADDLE_GLOW_ALPHA_HIT - PADDLE_GLOW_ALPHA_BASE) *
    (1 - hitProgress) *
    (1 - hitProgress);
  return clamp(idle + hitBoost, 0, 1);
}

function paddleFlashAlpha(now: number, flashStart: number) {
  const progress = clamp((now - flashStart) / PADDLE_FLASH_DURATION_MS, 0, 1);
  return PADDLE_FLASH_MAX_ALPHA * (1 - progress) * (1 - progress);
}

function updatePaddleTrail(
  points: PaddleTrailPoint[],
  centerY: number,
  velocity: number,
  dtMs: number,
) {
  for (const point of points) point.age += dtMs;
  if (Math.abs(velocity) > PADDLE_TRAIL_SPEED_THRESHOLD) {
    points.push({ y: centerY, age: 0 });
  }
  while (points.length > PADDLE_TRAIL_LENGTH) points.shift();
  while (points.length && points[0].age > PADDLE_TRAIL_MAX_AGE_MS) {
    points.shift();
  }
}

function drawPaddleTrail(
  gfx: Graphics,
  points: PaddleTrailPoint[],
  centerX: number,
  color: string,
  width: number,
  height: number,
) {
  gfx.clear();
  for (const point of points) {
    const alpha =
      PADDLE_TRAIL_MAX_ALPHA * (1 - point.age / PADDLE_TRAIL_MAX_AGE_MS);
    gfx
      .rect(centerX - width / 2, point.y - height / 2, width, height)
      .fill({ color, alpha });
  }
}

export function PongCanvas({
  session,
  mode,
  sound,
  onMainMenu,
}: {
  session: WsSession;
  mode: GameMode;
  sound: boolean;
  onMainMenu: () => void;
}) {
  const { t } = useTranslation(['pong', 'common']);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<HTMLDivElement>(null);
  const latestSnapshotRef = useRef<Snapshot | null>(null);
  const prevSnapshotRef = useRef<Snapshot | null>(null);
  const sideRef = useRef<Side | null>(null);
  const assignmentRef = useRef<{
    slot: number;
    side: PongSide;
    team: number;
  } | null>(null);
  const configRef = useRef<PongConfig>(DEFAULT_CONFIG);
  const matchStartRef = useRef<number | null>(null);
  const localDirectionRef = useRef<{ left: -1 | 0 | 1; right: -1 | 0 | 1 }>({
    left: 0,
    right: 0,
  });
  const appRef = useRef<Application | null>(null);
  const touchingLeftRef = useRef(false);
  const touchingRightRef = useRef(false);
  const ballSquashStartRef = useRef(-Infinity);
  const paddleLeftSquashStartRef = useRef(-Infinity);
  const paddleRightSquashStartRef = useRef(-Infinity);
  const paddleLeftFlashStartRef = useRef(-Infinity);
  const paddleRightFlashStartRef = useRef(-Infinity);
  const shakeStartRef = useRef(-Infinity);
  const shakeMagnitudeRef = useRef(0);
  const prevWinnerRef = useRef<number | null>(null);
  const [score, setScore] = useState<{ left: number; right: number } | null>(
    null,
  );
  const [matchStats, setMatchStats] = useState<{
    ruleset: string;
    score: number[];
    gamesWon: number[];
    lives: number[];
    winnerSlot: number | null;
    phase: string;
    phaseRemainingMs: number;
  } | null>(null);
  const [restartStatus, setRestartStatus] = useState<{
    votes: number;
    required: number;
  } | null>(null);
  const [requested, setRequested] = useState(false);
  const [pausedOpponent, setPausedOpponent] = useState<{
    side: Side;
    timeoutMs: number;
  } | null>(null);
  const [spectating, setSpectating] = useState(false);
  const [lobby, setLobby] = useState<PongLobbyState | null>(null);
  const [selfUserId, setSelfUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const spectatingRef = useRef(false);
  const messageHandlerRef = useRef<(message: ActivityMessage) => void>(
    () => {},
  );

  // Sending 'leave' before the room disconnects (rather than a bare close)
  // is what tells PongRoom to forfeit the match immediately instead of
  // treating this like a network drop and holding the slot open.
  const sendLeaveOnDisconnect = useCallback((room: Room) => {
    room.send('leave');
  }, []);

  const { send: roomSend, connectionState } = useColyseusRoom(
    'pong',
    session,
    colyseusUrl(),
    (message) => messageHandlerRef.current(message),
    sendLeaveOnDisconnect,
  );

  // eslint-disable react-hooks/exhaustive-deps -- intentional [session]-only
  // deps per §6.2; mode/sound/onMainMenu/roomSend are fixed for the
  // session's lifetime and MUST NOT retrigger this effect.
  useEffect(() => {
    devlog('[pong-canvas] mounting');
    const sfx = new PongSfx(sound);
    latestSnapshotRef.current = null;
    prevSnapshotRef.current = null;
    sideRef.current = null;
    assignmentRef.current = null;
    configRef.current = DEFAULT_CONFIG;
    matchStartRef.current = null;
    localDirectionRef.current = { left: 0, right: 0 };
    touchingLeftRef.current = false;
    touchingRightRef.current = false;
    ballSquashStartRef.current = -Infinity;
    paddleLeftSquashStartRef.current = -Infinity;
    paddleRightSquashStartRef.current = -Infinity;
    paddleLeftFlashStartRef.current = -Infinity;
    paddleRightFlashStartRef.current = -Infinity;
    shakeStartRef.current = -Infinity;
    shakeMagnitudeRef.current = 0;
    prevWinnerRef.current = null;
    spectatingRef.current = false;
    setSpectating(false);
    setLobby(null);
    setSelfUserId(null);
    setReady(false);
    const snapshotBuffer = new PongSnapshotBuffer(100, 100);
    const predictors: Partial<Record<Side, LocalPaddlePredictor>> = {};
    const authoritative: Partial<
      Record<Side, { position: number; ack: number; at: number }>
    > = {};

    function predictorFor(side: Side) {
      const config = configRef.current;
      predictors[side] ??= new LocalPaddlePredictor({
        min: config.cornerGap ?? 0,
        max: config.height - config.paddleHeight - (config.cornerGap ?? 0),
        speed: config.paddleSpeed,
      });
      return predictors[side]!;
    }

    let spawnHitParticles:
      ((side: Side, x: number, y: number, ballSpeed: number) => void) | null =
      null;

    function handleJsonMessage(message: ActivityMessage) {
      if (message.type === 'init') {
        const payload = message.payload as {
          side: PongSide | null;
          selfUserId: string;
          assignment: {
            slot: number;
            side: PongSide;
            team: number;
          } | null;
          config: PongConfig;
          lobby: PongLobbyState;
        };
        // A null side means the match already has both players: we watch it
        // rather than drive a paddle in it.
        devinfo('[pong-canvas] assigned side', payload.side);
        assignmentRef.current = payload.assignment;
        setSelfUserId(payload.selfUserId);
        sideRef.current =
          payload.side === 'left' || payload.side === 'right'
            ? payload.side
            : null;
        configRef.current = payload.config;
        spectatingRef.current = payload.assignment === null;
        setSpectating(payload.assignment === null);
        setLobby(payload.lobby);
        const own = payload.lobby.players.find(
          (player) => player.slot === payload.assignment?.slot,
        );
        setReady(own?.ready ?? false);
      } else if (message.type === 'lobby_state') {
        const payload = message.payload as PongLobbyState;
        setLobby(payload);
        const own = payload.players.find(
          (player) => player.slot === assignmentRef.current?.slot,
        );
        setReady(own?.ready ?? false);
      } else if (message.type === 'restart_status') {
        devlog('[pong-canvas] restart status', message.payload);
        setRestartStatus(
          message.payload as { votes: number; required: number },
        );
      } else if (
        message.type === 'opponent_disconnected' ||
        message.type === 'player_disconnected'
      ) {
        devwarn('[pong-canvas] opponent disconnected', message.payload);
        setPausedOpponent(message.payload as { side: Side; timeoutMs: number });
      } else if (
        message.type === 'opponent_reconnected' ||
        message.type === 'player_reconnected'
      ) {
        devinfo('[pong-canvas] opponent reconnected');
        setPausedOpponent(null);
      }
    }

    function handleBinary(bytes: Uint8Array) {
      const data = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      const state = decodeStateSnapshot(data);
      const receivedAt = performance.now();
      snapshotBuffer.push(state, receivedAt);
      if (matchStartRef.current === null) matchStartRef.current = receivedAt;
      const prevScore = prevSnapshotRef.current?.state.classicScore;
      prevSnapshotRef.current = latestSnapshotRef.current;
      latestSnapshotRef.current = { state, receivedAt };
      setPausedOpponent(null);
      setScore(state.classicScore);
      setMatchStats({
        ruleset: state.ruleset,
        score: state.score,
        gamesWon: state.gamesWon,
        lives: state.lives,
        winnerSlot: state.winnerSlot,
        phase: state.phase,
        phaseRemainingMs: state.phaseRemainingMs,
      });
      if (
        prevScore &&
        (state.classicScore.left !== prevScore.left ||
          state.classicScore.right !== prevScore.right)
      ) {
        sfx.score();
      }
      if (state.winnerSlot !== prevWinnerRef.current) {
        devlog('[pong-canvas] winner changed', state.winnerSlot);
        if (state.winnerSlot !== null) sfx.win();
        prevWinnerRef.current = state.winnerSlot;
      }
      if (state.winnerSlot === null) {
        setRestartStatus(null);
        setRequested(false);
      }

      const config = configRef.current;
      const prevForSpeed = prevSnapshotRef.current;
      let ballSpeed = 0;
      if (prevForSpeed) {
        const dtSeconds = (receivedAt - prevForSpeed.receivedAt) / 1000;
        if (dtSeconds > 0) {
          const dx = state.ball.x - prevForSpeed.state.ball.x;
          const dy = state.ball.y - prevForSpeed.state.ball.y;
          ballSpeed = Math.hypot(dx, dy) / dtSeconds;
        }
      }

      const leftContact = closestPointOnRect(
        state.ball.x,
        state.ball.y,
        0,
        state.classicPaddles.left,
        config.paddleWidth,
        config.paddleHeight,
      );
      const rightContact = closestPointOnRect(
        state.ball.x,
        state.ball.y,
        config.width - config.paddleWidth,
        state.classicPaddles.right,
        config.paddleWidth,
        config.paddleHeight,
      );
      const touchingLeft = circleOverlapsPoint(
        state.ball.x,
        state.ball.y,
        config.ballRadius,
        leftContact,
      );
      const touchingRight = circleOverlapsPoint(
        state.ball.x,
        state.ball.y,
        config.ballRadius,
        rightContact,
      );
      if (touchingLeft && !touchingLeftRef.current) {
        spawnHitParticles?.('left', leftContact.x, leftContact.y, ballSpeed);
        sfx.hit();
        ballSquashStartRef.current = receivedAt;
        paddleLeftSquashStartRef.current = receivedAt;
        paddleLeftFlashStartRef.current = receivedAt;
        shakeStartRef.current = receivedAt;
        shakeMagnitudeRef.current = clamp(
          SHAKE_MAGNITUDE_MAX * (ballSpeed / BALL_SPEED_REFERENCE),
          SHAKE_MAGNITUDE_MIN,
          SHAKE_MAGNITUDE_MAX,
        );
      }
      if (touchingRight && !touchingRightRef.current) {
        spawnHitParticles?.('right', rightContact.x, rightContact.y, ballSpeed);
        sfx.hit();
        ballSquashStartRef.current = receivedAt;
        paddleRightSquashStartRef.current = receivedAt;
        paddleRightFlashStartRef.current = receivedAt;
        shakeStartRef.current = receivedAt;
        shakeMagnitudeRef.current = clamp(
          SHAKE_MAGNITUDE_MAX * (ballSpeed / BALL_SPEED_REFERENCE),
          SHAKE_MAGNITUDE_MIN,
          SHAKE_MAGNITUDE_MAX,
        );
      }
      touchingLeftRef.current = touchingLeft;
      touchingRightRef.current = touchingRight;

      const side = sideRef.current;
      if (!side) return;
      // In local hot-seat mode this one connection drives both paddles, so
      // both need client-side prediction/reconciliation, not just the
      // connection's own registered side.
      const controlledSides: Side[] =
        mode === 'local' ? ['left', 'right'] : [side];

      for (const s of controlledSides) {
        const authoritativeY =
          s === 'left' ? state.classicPaddles.left : state.classicPaddles.right;
        const slot = s === 'left' ? 0 : 1;
        authoritative[s] = {
          position: authoritativeY,
          ack: state.acks[slot] ?? 0,
          at:
            snapshotBuffer.localTimeForServer(state.serverTimeMs) ?? receivedAt,
        };
        predictorFor(s).reconcile(
          authoritativeY,
          state.acks[slot] ?? 0,
          authoritative[s]!.at,
          receivedAt,
        );
      }
    }

    function send(type: string, payload?: unknown) {
      roomSend({ type, payload });
    }

    // 'state' snapshots arrive as raw bytes on their own message type;
    // everything else is the small JSON control-message set handled above.
    messageHandlerRef.current = (message) => {
      if (message.type === 'state') {
        handleBinary(message.payload as Uint8Array);
      } else {
        handleJsonMessage(message);
      }
    };

    // Leaving is not sent from here: the unmount cleanup below sends it for
    // every exit path (menu, hub, auth error, remount), so a match can never
    // be walked out of without detaching from its session.
    function pauseExit() {
      devlog('[pong-canvas] pause -> leaving to main menu');
      onMainMenu();
    }

    // In local hot-seat mode this single connection drives both paddles
    // (W/S -> left, arrows -> right) and every input message must carry an
    // explicit side. In every other mode arrows control whichever side the
    // server assigned this connection, and side is omitted from the
    // message — the server infers it from the sender.
    const seqBySide: Record<Side, number> = { left: 0, right: 0 };
    const seqBySlot: Record<number, number> = {};
    const arrowKeysDown = new Set<string>();
    const wsKeysDown = new Set<string>();

    function sendTrackedInput(
      side: Side,
      direction: -1 | 0 | 1,
      nextSeq: number,
    ) {
      if (spectatingRef.current) return;
      if (direction === localDirectionRef.current[side]) return;
      localDirectionRef.current[side] = direction;
      predictorFor(side).push({
        seq: nextSeq,
        sentAt: performance.now(),
        axis: direction,
      });
      send(
        'input',
        mode === 'local'
          ? { direction, seq: nextSeq, side }
          : { direction, seq: nextSeq },
      );
    }

    function sendArrowInput() {
      const assigned = assignmentRef.current;
      if (
        mode !== 'local' &&
        assigned &&
        (assigned.side === 'top' || assigned.side === 'bottom')
      ) {
        const direction: -1 | 0 | 1 = arrowKeysDown.has('ArrowLeft')
          ? -1
          : arrowKeysDown.has('ArrowRight')
            ? 1
            : 0;
        const seq = (seqBySlot[assigned.slot] ?? 0) + 1;
        seqBySlot[assigned.slot] = seq;
        send('input', { direction, seq });
        return;
      }
      const direction: -1 | 0 | 1 = arrowKeysDown.has('ArrowUp')
        ? -1
        : arrowKeysDown.has('ArrowDown')
          ? 1
          : 0;
      const side: Side =
        mode === 'local' ? 'right' : (sideRef.current ?? 'left');
      seqBySide[side] += 1;
      sendTrackedInput(side, direction, seqBySide[side]);
    }

    function sendWsInput() {
      const direction: -1 | 0 | 1 = wsKeysDown.has('w')
        ? -1
        : wsKeysDown.has('s')
          ? 1
          : 0;
      seqBySide.left += 1;
      sendTrackedInput('left', direction, seqBySide.left);
    }

    function onKeyDown(event: KeyboardEvent) {
      const key = event.key;
      const lower = key.toLowerCase();
      if (
        key === 'ArrowUp' ||
        key === 'ArrowDown' ||
        key === 'ArrowLeft' ||
        key === 'ArrowRight'
      ) {
        event.preventDefault();
        arrowKeysDown.add(key);
        sendArrowInput();
      } else if (mode === 'local' && (lower === 'w' || lower === 's')) {
        event.preventDefault();
        wsKeysDown.add(lower);
        sendWsInput();
      } else if (key === 'Escape') {
        event.preventDefault();
        pauseExit();
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      const key = event.key;
      const lower = key.toLowerCase();
      if (
        key === 'ArrowUp' ||
        key === 'ArrowDown' ||
        key === 'ArrowLeft' ||
        key === 'ArrowRight'
      ) {
        arrowKeysDown.delete(key);
        sendArrowInput();
      } else if (mode === 'local' && (lower === 'w' || lower === 's')) {
        wsKeysDown.delete(lower);
        sendWsInput();
      }
    }
    let activePointerId: number | null = null;
    let lastPointerSentAt = -Infinity;

    function sendPointerTarget(event: PointerEvent) {
      if (spectatingRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const now = performance.now();
      if (now - lastPointerSentAt < 8) return;
      lastPointerSentAt = now;
      const rect = canvas.getBoundingClientRect();
      const assignedSide = assignmentRef.current?.side;
      const target =
        assignedSide === 'top' || assignedSide === 'bottom'
          ? clamp((event.clientX - rect.left) / rect.width, 0, 1)
          : clamp((event.clientY - rect.top) / rect.height, 0, 1);
      if (
        mode !== 'local' &&
        assignedSide &&
        assignedSide !== 'left' &&
        assignedSide !== 'right'
      ) {
        const slot = assignmentRef.current?.slot ?? 0;
        const seq = (seqBySlot[slot] ?? 0) + 1;
        seqBySlot[slot] = seq;
        send('input', { target, seq });
        return;
      }
      const side: Side =
        mode === 'local'
          ? event.clientX < rect.left + rect.width / 2
            ? 'left'
            : 'right'
          : (sideRef.current ?? 'left');
      seqBySide[side] += 1;
      predictorFor(side).push({
        seq: seqBySide[side],
        sentAt: now,
        target,
      });
      localDirectionRef.current[side] = 0;
      send(
        'input',
        mode === 'local'
          ? { target, seq: seqBySide[side], side }
          : { target, seq: seqBySide[side] },
      );
    }

    function onPointerDown(event: PointerEvent) {
      if (spectatingRef.current) return;
      activePointerId = event.pointerId;
      canvasRef.current?.setPointerCapture(event.pointerId);
      event.preventDefault();
      sendPointerTarget(event);
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerId !== activePointerId) return;
      event.preventDefault();
      sendPointerTarget(event);
    }

    function onPointerEnd(event: PointerEvent) {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
      event.preventDefault();
      const canvas = canvasRef.current;
      const assigned = assignmentRef.current;
      if (!canvas || !assigned || spectatingRef.current) return;
      if (mode === 'local') {
        const rect = canvas.getBoundingClientRect();
        const side: Side =
          event.clientX < rect.left + rect.width / 2 ? 'left' : 'right';
        seqBySide[side] += 1;
        send('input', {
          direction: 0,
          seq: seqBySide[side],
          side,
          action: 'release',
        });
      } else {
        const classicSide =
          assigned.side === 'left' || assigned.side === 'right'
            ? assigned.side
            : null;
        const seq = classicSide
          ? (seqBySide[classicSide] += 1)
          : (seqBySlot[assigned.slot] ?? 0) + 1;
        if (!classicSide) seqBySlot[assigned.slot] = seq;
        send('input', { direction: 0, seq, action: 'release' });
      }
    }

    const pointerCanvas = canvasRef.current;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    pointerCanvas?.addEventListener('pointerdown', onPointerDown);
    pointerCanvas?.addEventListener('pointermove', onPointerMove);
    pointerCanvas?.addEventListener('pointerup', onPointerEnd);
    pointerCanvas?.addEventListener('pointercancel', onPointerEnd);

    let cancelled = false;
    let initialized = false;
    let tick: (() => void) | null = null;
    let onContextLost: ((event: Event) => void) | null = null;
    let onContextRestored: (() => void) | null = null;
    let contextCanvas: HTMLCanvasElement | null = null;

    function onVisibilityChange() {
      if (!initialized) return;
      if (document.hidden) {
        appRef.current?.ticker.stop();
      } else {
        prevSnapshotRef.current = null;
        appRef.current?.ticker.start();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    let lastConfig: PongConfig = DEFAULT_CONFIG;
    let centerLine: Graphics;
    let paddleLeft: Graphics;
    let paddleRight: Graphics;
    let paddleLeftGlow: Graphics;
    let paddleRightGlow: Graphics;
    let paddleLeftTrail: Graphics;
    let paddleRightTrail: Graphics;
    let paddleLeftFlash: Graphics;
    let paddleRightFlash: Graphics;
    let ball: Graphics;
    let ballGlow: Graphics;
    let ballTrail: Graphics;
    let particlesGfx: Graphics;
    let variantEntities: Graphics;

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      color: string;
    }
    let particles: Particle[] = [];

    // Frame-to-frame ball/paddle motion tracking, used to derive velocity
    // for the ball's heat/stretch/spin FX and the paddles' trail/tilt FX.
    // Reset naturally on every effect re-run since these are plain closure
    // variables, not refs.
    let prevRenderBallX: number | null = null;
    let prevRenderBallY: number | null = null;
    let lastBallDirAngle = 0;
    let ballSpinAngle = 0;
    let ballTrailPoints: { x: number; y: number }[] = [];
    let prevLeftCenterY: number | null = null;
    let prevRightCenterY: number | null = null;
    let leftTrailPoints: PaddleTrailPoint[] = [];
    let rightTrailPoints: PaddleTrailPoint[] = [];

    const app = new Application();
    appRef.current = app;

    function drawStaticGeometry(config: PongConfig) {
      const hw = config.paddleWidth / 2;
      const hh = config.paddleHeight / 2;

      paddleLeft
        .clear()
        .rect(-hw, -hh, config.paddleWidth, config.paddleHeight)
        .fill(LEFT_COLOR);
      paddleRight
        .clear()
        .rect(-hw, -hh, config.paddleWidth, config.paddleHeight)
        .fill(RIGHT_COLOR);

      paddleLeftFlash
        .clear()
        .rect(-hw, -hh, config.paddleWidth, config.paddleHeight)
        .fill(0xffffff);
      paddleRightFlash
        .clear()
        .rect(-hw, -hh, config.paddleWidth, config.paddleHeight)
        .fill(0xffffff);

      paddleLeftGlow
        .clear()
        .roundRect(
          -hw - PADDLE_GLOW_PAD,
          -hh - PADDLE_GLOW_PAD,
          config.paddleWidth + PADDLE_GLOW_PAD * 2,
          config.paddleHeight + PADDLE_GLOW_PAD * 2,
          6,
        )
        .fill(LEFT_COLOR);
      paddleRightGlow
        .clear()
        .roundRect(
          -hw - PADDLE_GLOW_PAD,
          -hh - PADDLE_GLOW_PAD,
          config.paddleWidth + PADDLE_GLOW_PAD * 2,
          config.paddleHeight + PADDLE_GLOW_PAD * 2,
          6,
        )
        .fill(RIGHT_COLOR);

      ballGlow
        .clear()
        .circle(0, 0, config.ballRadius * BALL_GLOW_SCALE)
        .fill(0xffffff);

      paddleLeft.position.x = hw;
      paddleLeftFlash.position.x = hw;
      paddleLeftGlow.position.x = hw;
      paddleRight.position.x = config.width - hw;
      paddleRightFlash.position.x = config.width - hw;
      paddleRightGlow.position.x = config.width - hw;
    }

    function buildScene(config: PongConfig) {
      centerLine = new Graphics();
      drawDashedVerticalLine(centerLine, config.width / 2, config.height);

      ballTrail = new Graphics();

      paddleLeftGlow = new Graphics();
      paddleRightGlow = new Graphics();
      paddleLeftGlow.filters = [new BlurFilter({ strength: 10, quality: 3 })];
      paddleRightGlow.filters = [new BlurFilter({ strength: 10, quality: 3 })];
      paddleLeftGlow.alpha = PADDLE_GLOW_ALPHA_BASE;
      paddleRightGlow.alpha = PADDLE_GLOW_ALPHA_BASE;

      paddleLeftTrail = new Graphics();
      paddleRightTrail = new Graphics();

      paddleLeft = new Graphics();
      paddleRight = new Graphics();

      paddleLeftFlash = new Graphics();
      paddleRightFlash = new Graphics();
      paddleLeftFlash.alpha = 0;
      paddleRightFlash.alpha = 0;

      ballGlow = new Graphics();
      ballGlow.filters = [new BlurFilter({ strength: 12, quality: 3 })];

      ball = new Graphics();
      particlesGfx = new Graphics();
      variantEntities = new Graphics();

      drawStaticGeometry(config);

      app.stage.addChild(
        centerLine,
        ballTrail,
        paddleLeftGlow,
        paddleRightGlow,
        paddleLeftTrail,
        paddleRightTrail,
        paddleLeft,
        paddleLeftFlash,
        paddleRight,
        paddleRightFlash,
        ballGlow,
        ball,
        variantEntities,
        particlesGfx,
      );
      lastConfig = config;
    }

    spawnHitParticles = (side, x, y, ballSpeed) => {
      if (!initialized) return;
      const color = side === 'left' ? LEFT_COLOR : RIGHT_COLOR;
      const baseAngle = side === 'left' ? 0 : Math.PI;
      const count = clamp(
        Math.round(PARTICLE_BASE_COUNT * (ballSpeed / BALL_SPEED_REFERENCE)),
        PARTICLE_MIN_COUNT,
        PARTICLE_MAX_COUNT,
      );
      for (let i = 0; i < count; i++) {
        const angle = baseAngle + (Math.random() - 0.5) * (Math.PI * 0.7);
        const speed =
          PARTICLE_MIN_SPEED +
          Math.random() * (PARTICLE_MAX_SPEED - PARTICLE_MIN_SPEED);
        particles.push({
          x: x + (Math.random() - 0.5) * PARTICLE_SPAWN_SPREAD,
          y: y + (Math.random() - 0.5) * PARTICLE_SPAWN_SPREAD,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: PARTICLE_LIFETIME_MS,
          color,
        });
      }
    };

    function applyConfigChange(config: PongConfig) {
      lastConfig = config;
      app.renderer.resize(config.width, config.height);
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.width = `min(100%, ${config.width}px)`;
        canvas.style.height = 'auto';
        canvas.style.aspectRatio = `${config.width} / ${config.height}`;
      }
      drawDashedVerticalLine(centerLine, config.width / 2, config.height);
      drawStaticGeometry(config);
    }

    (async () => {
      // Yield a microtask before touching the canvas. React 19 StrictMode
      // double-invokes this effect synchronously (mount, cleanup, mount)
      // before any promise settles. If both invocations called app.init()
      // on the same <canvas>, they'd end up sharing one underlying WebGL
      // context (getContext() returns the existing context on a second
      // call) — then the stale instance's cleanup would call destroy(),
      // which kills that shared context out from under the real instance,
      // leaving a permanently blank canvas. Checking `cancelled` after a
      // microtask tick lets the phantom first invocation bail out here,
      // before it ever calls init(), so only the real instance touches the
      // canvas.
      await Promise.resolve();
      if (cancelled) return;

      await app.init({
        canvas: canvasRef.current!,
        width: configRef.current.width,
        height: configRef.current.height,
        background: COURT_BG,
        antialias: true,
        resolution: window.devicePixelRatio,
        autoDensity: true,
      });
      if (cancelled) {
        app.destroy({ removeView: false });
        return;
      }
      initialized = true;
      buildScene(configRef.current);
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.width = `min(100%, ${configRef.current.width}px)`;
        canvas.style.height = 'auto';
        canvas.style.aspectRatio = `${configRef.current.width} / ${configRef.current.height}`;
      }

      onContextLost = (event: Event) => {
        event.preventDefault();
        app.ticker.stop();
      };
      onContextRestored = () => {
        app.ticker.start();
      };
      contextCanvas = canvasRef.current!;
      contextCanvas.addEventListener('webglcontextlost', onContextLost, false);
      contextCanvas.addEventListener(
        'webglcontextrestored',
        onContextRestored,
        false,
      );

      tick = () => {
        const config = configRef.current;
        if (config !== lastConfig) applyConfigChange(config);

        const dtMs = app.ticker.deltaMS;
        const dtSeconds = dtMs / 1000;
        const now = performance.now();

        if (matchStartRef.current !== null && timerRef.current) {
          timerRef.current.textContent = formatElapsed(
            now - matchStartRef.current,
          );
        }

        particlesGfx.clear();
        particles = particles.filter((particle) => particle.life > 0);
        for (const particle of particles) {
          particle.x += particle.vx * dtSeconds;
          particle.y += particle.vy * dtSeconds;
          particle.life -= dtMs;
          const alpha = Math.max(particle.life / PARTICLE_LIFETIME_MS, 0);
          particlesGfx
            .circle(particle.x, particle.y, PARTICLE_RADIUS)
            .fill({ color: particle.color, alpha });
        }

        // Screen shake decays on its own clock, independent of snapshots.
        const shakeElapsed = now - shakeStartRef.current;
        if (shakeElapsed < SHAKE_DURATION_MS) {
          const shakeProgress = shakeElapsed / SHAKE_DURATION_MS;
          const shakeDecay = (1 - shakeProgress) * (1 - shakeProgress);
          const magnitude = shakeMagnitudeRef.current * shakeDecay;
          app.stage.position.set(
            (Math.random() - 0.5) * 2 * magnitude,
            (Math.random() - 0.5) * 2 * magnitude,
          );
        } else {
          app.stage.position.set(0, 0);
        }

        const sample = snapshotBuffer.sample(now);
        if (!sample) return;

        const state = sample.state;
        const ballX = state.ball.x;
        const ballY = state.ball.y;
        let leftY = state.classicPaddles.left;
        let rightY = state.classicPaddles.right;

        const classic = state.ruleset === 'classic-1v1';
        paddleLeft.visible = classic;
        paddleRight.visible = classic;
        paddleLeftGlow.visible = classic;
        paddleRightGlow.visible = classic;
        paddleLeftTrail.visible = classic;
        paddleRightTrail.visible = classic;
        paddleLeftFlash.visible = classic;
        paddleRightFlash.visible = classic;
        variantEntities.clear();
        if (!classic) {
          if (state.arena === 'circular') {
            variantEntities
              .circle(
                config.width / 2,
                config.height / 2,
                Math.min(config.width, config.height) * 0.46,
              )
              .stroke({ width: 3, color: COURT_LINE });
          }
          for (const brick of state.bricks) {
            if (!brick.active) continue;
            variantEntities
              .rect(brick.x, brick.y, brick.width, brick.height)
              .fill({ color: 0x5f6670, alpha: 0.85 })
              .stroke({ width: 1, color: 0xaeb4bd });
          }
          for (const paddle of state.paddles) {
            if (!paddle.active) continue;
            const color = paddle.team % 2 === 0 ? LEFT_COLOR : RIGHT_COLOR;
            if (paddle.orientation === 'radial') {
              const radius = Math.min(config.width, config.height) * 0.46;
              const start = paddle.angle - paddle.arc / 2;
              variantEntities
                .moveTo(
                  config.width / 2 + Math.cos(start) * radius,
                  config.height / 2 + Math.sin(start) * radius,
                )
                .arc(
                  config.width / 2,
                  config.height / 2,
                  radius,
                  start,
                  paddle.angle + paddle.arc / 2,
                )
                .stroke({ width: paddle.width, color });
            } else {
              variantEntities
                .rect(
                  paddle.x,
                  paddle.y,
                  paddle.width * paddle.sizeMultiplier,
                  paddle.height * paddle.sizeMultiplier,
                )
                .fill(color);
            }
            if (paddle.shield > 0) {
              variantEntities
                .rect(
                  paddle.x - 4,
                  paddle.y - 4,
                  paddle.width * paddle.sizeMultiplier + 8,
                  paddle.height * paddle.sizeMultiplier + 8,
                )
                .stroke({ width: 2, color: 0x58d8ff });
            }
          }
          for (const extraBall of state.balls.slice(1)) {
            if (!extraBall.active) continue;
            variantEntities
              .circle(extraBall.x, extraBall.y, extraBall.radius)
              .fill(BALL_COLOR_NUM);
          }
          for (const powerUp of state.powerUps) {
            if (!powerUp.active) continue;
            variantEntities
              .circle(powerUp.x, powerUp.y, powerUp.radius)
              .fill(0xffd84a)
              .stroke({ width: 2, color: 0xffffff });
          }
        }

        const side = sideRef.current;
        if (side) {
          const maxY = config.height - config.paddleHeight;
          const controlledSides: Side[] =
            mode === 'local' ? ['left', 'right'] : [side];
          for (const s of controlledSides) {
            const latestAuthority = authoritative[s];
            if (!latestAuthority) continue;
            const predicted = predictorFor(s).reconcile(
              latestAuthority.position,
              latestAuthority.ack,
              latestAuthority.at,
              now,
            );
            if (s === 'left') leftY = clamp(predicted, 0, maxY);
            else rightY = clamp(predicted, 0, maxY);
          }
        }

        // --- Ball: frame-to-frame velocity drives heat color, a comet
        // trail, a glow halo, and a direction-aligned stretch. Paddle
        // impacts layer a brief squash on top (ballSquashStartRef). ---
        let frameSpeed = 0;
        if (
          prevRenderBallX !== null &&
          prevRenderBallY !== null &&
          dtSeconds > 0
        ) {
          const fvx = (ballX - prevRenderBallX) / dtSeconds;
          const fvy = (ballY - prevRenderBallY) / dtSeconds;
          frameSpeed = Math.hypot(fvx, fvy);
          if (frameSpeed > BALL_MIN_DIR_SPEED) {
            lastBallDirAngle = Math.atan2(fvy, fvx);
          }
        }
        prevRenderBallX = ballX;
        prevRenderBallY = ballY;

        const speedNorm = clamp(
          (frameSpeed - BALL_HEAT_SPEED_MIN) /
            (BALL_HEAT_SPEED_MAX - BALL_HEAT_SPEED_MIN),
          0,
          1,
        );
        const heatColor = lerpColorHex(
          BALL_COLOR_NUM,
          BALL_HOT_COLOR_NUM,
          speedNorm,
        );

        ballSpinAngle += frameSpeed * dtSeconds * BALL_SPIN_RATE;

        const squashProgress = clamp(
          (now - ballSquashStartRef.current) / BALL_SQUASH_DURATION_MS,
          0,
          1,
        );
        const squashDecay = (1 - squashProgress) * (1 - squashProgress);
        const hitSquash = BALL_SQUASH_AMOUNT * squashDecay;
        const stretch =
          BALL_STRETCH_MAX * clamp(frameSpeed / BALL_STRETCH_SPEED_MAX, 0, 1);

        ball.clear();
        ball.circle(0, 0, config.ballRadius).fill(heatColor);
        const highlightOffset = config.ballRadius * 0.42;
        ball
          .circle(
            Math.cos(ballSpinAngle) * highlightOffset,
            Math.sin(ballSpinAngle) * highlightOffset,
            config.ballRadius * 0.26,
          )
          .fill({ color: 0xffffff, alpha: 0.55 });
        ball.rotation = lastBallDirAngle;
        ball.scale.set(
          (1 + stretch) * (1 - hitSquash),
          (1 - stretch * 0.5) * (1 + hitSquash * 1.4),
        );
        ball.position.set(ballX, ballY);

        ballGlow.tint = heatColor;
        ballGlow.alpha = clamp(
          BALL_GLOW_ALPHA_BASE + 0.4 * speedNorm + 0.35 * squashDecay,
          0,
          0.9,
        );
        ballGlow.scale.set(1 + 0.5 * squashDecay);
        ballGlow.position.set(ballX, ballY);

        ballTrailPoints.unshift({ x: ballX, y: ballY });
        if (ballTrailPoints.length > BALL_TRAIL_LENGTH) {
          ballTrailPoints.length = BALL_TRAIL_LENGTH;
        }
        ballTrail.clear();
        for (let i = 0; i < ballTrailPoints.length; i++) {
          const point = ballTrailPoints[i];
          const trailT = i / ballTrailPoints.length;
          const alpha =
            BALL_TRAIL_MAX_ALPHA * (1 - trailT) * (0.4 + 0.6 * speedNorm);
          const radius =
            config.ballRadius * lerp(1, BALL_TRAIL_MIN_RADIUS_FACTOR, trailT);
          ballTrail
            .circle(point.x, point.y, radius)
            .fill({ color: heatColor, alpha });
        }

        // --- Paddles: impact squash/flash/glow, a velocity-driven tilt,
        // and a motion trail that only appears above a speed threshold. ---
        const leftCenterY = leftY + config.paddleHeight / 2;
        const rightCenterY = rightY + config.paddleHeight / 2;
        const leftVelocity =
          prevLeftCenterY !== null && dtSeconds > 0
            ? (leftCenterY - prevLeftCenterY) / dtSeconds
            : 0;
        const rightVelocity =
          prevRightCenterY !== null && dtSeconds > 0
            ? (rightCenterY - prevRightCenterY) / dtSeconds
            : 0;
        prevLeftCenterY = leftCenterY;
        prevRightCenterY = rightCenterY;

        const leftSquashProgress = clamp(
          (now - paddleLeftSquashStartRef.current) / PADDLE_SQUASH_DURATION_MS,
          0,
          1,
        );
        const rightSquashProgress = clamp(
          (now - paddleRightSquashStartRef.current) / PADDLE_SQUASH_DURATION_MS,
          0,
          1,
        );
        const leftSquash =
          PADDLE_SQUASH_AMOUNT *
          (1 - leftSquashProgress) *
          (1 - leftSquashProgress);
        const rightSquash =
          PADDLE_SQUASH_AMOUNT *
          (1 - rightSquashProgress) *
          (1 - rightSquashProgress);

        paddleLeft.position.y = leftCenterY;
        paddleRight.position.y = rightCenterY;
        paddleLeft.scale.set(1 + leftSquash * 1.2, 1 - leftSquash);
        paddleRight.scale.set(1 + rightSquash * 1.2, 1 - rightSquash);

        paddleLeftGlow.position.y = leftCenterY;
        paddleRightGlow.position.y = rightCenterY;
        paddleLeftGlow.alpha = paddleGlowAlpha(
          now,
          0,
          paddleLeftFlashStartRef.current,
        );
        paddleRightGlow.alpha = paddleGlowAlpha(
          now,
          Math.PI,
          paddleRightFlashStartRef.current,
        );

        paddleLeftFlash.position.y = leftCenterY;
        paddleRightFlash.position.y = rightCenterY;
        paddleLeftFlash.alpha = paddleFlashAlpha(
          now,
          paddleLeftFlashStartRef.current,
        );
        paddleRightFlash.alpha = paddleFlashAlpha(
          now,
          paddleRightFlashStartRef.current,
        );

        updatePaddleTrail(leftTrailPoints, leftCenterY, leftVelocity, dtMs);
        updatePaddleTrail(rightTrailPoints, rightCenterY, rightVelocity, dtMs);
        drawPaddleTrail(
          paddleLeftTrail,
          leftTrailPoints,
          config.paddleWidth / 2,
          LEFT_COLOR,
          config.paddleWidth,
          config.paddleHeight,
        );
        drawPaddleTrail(
          paddleRightTrail,
          rightTrailPoints,
          config.width - config.paddleWidth / 2,
          RIGHT_COLOR,
          config.paddleWidth,
          config.paddleHeight,
        );
      };
      app.ticker.add(tick);
    })();

    return () => {
      devlog('[pong-canvas] unmounting, leaving session');
      cancelled = true;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      pointerCanvas?.removeEventListener('pointerdown', onPointerDown);
      pointerCanvas?.removeEventListener('pointermove', onPointerMove);
      pointerCanvas?.removeEventListener('pointerup', onPointerEnd);
      pointerCanvas?.removeEventListener('pointercancel', onPointerEnd);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (contextCanvas && onContextLost) {
        contextCanvas.removeEventListener('webglcontextlost', onContextLost);
      }
      if (contextCanvas && onContextRestored) {
        contextCanvas.removeEventListener(
          'webglcontextrestored',
          onContextRestored,
        );
      }
      // The room's own leave (including the 'leave' message that tells
      // PongRoom to forfeit immediately rather than treat this as a
      // transient network drop) is handled by useColyseusRoom's cleanup.
      messageHandlerRef.current = () => {};
      sfx.dispose();
      if (initialized) {
        if (tick) app.ticker.remove(tick);
        app.destroy({ removeView: false });
      }
      appRef.current = null;
    };
  }, [session]);
  // eslint-enable react-hooks/exhaustive-deps

  const soloChallenge =
    matchStats?.ruleset === 'breakout' ||
    matchStats?.ruleset === 'radial-solo' ||
    matchStats?.ruleset === 'coop-keep-alive';
  const p1Name = soloChallenge ? t('pong:scoreLabel') : t('pong:player1');
  const p2Name = soloChallenge
    ? ''
    : mode === 'single'
      ? t('pong:cpu')
      : t('pong:player2');
  const winnerSlot = matchStats?.winnerSlot ?? null;
  const winnerName =
    lobby?.players.find((player) => player.slot === winnerSlot)?.displayName ??
    (winnerSlot === 0
      ? p1Name
      : winnerSlot === 1
        ? p2Name
        : t('pong:roundOver'));
  const gameOver = winnerSlot !== null || matchStats?.phase === 'series-over';
  const readyPlayers =
    lobby?.players.filter((player) => player.ready).length ?? 0;

  return (
    <div className="box-border flex flex-1 flex-col items-stretch justify-start gap-0 px-4 py-4 sm:px-10 sm:py-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-col items-start gap-1.5">
          <div className="font-pixel text-xs text-marquinhos-accent">
            {p1Name}
          </div>
          <div
            key={`left-${score?.left ?? 0}`}
            className="font-pixel animate-pong-score-pop inline-block text-5xl text-marquinhos-text"
          >
            {score?.left ?? 0}
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div
            ref={timerRef}
            className="font-pixel text-sm text-marquinhos-accent"
          >
            00:00
          </div>
          <button
            type="button"
            aria-label={t('pong:pauseAriaLabel')}
            className="font-pixel cursor-pointer border border-marquinhos-border bg-marquinhos-panel px-3.5 py-2 text-[11px] text-marquinhos-text hover:border-marquinhos-border-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
            onClick={() => {
              devlog('[pong-canvas] pause -> leaving to main menu');
              onMainMenu();
            }}
          >
            {t('pong:pauseButton')}
          </button>
        </div>
        <div
          className={cn(
            'flex flex-col items-end gap-1.5',
            soloChallenge && 'invisible',
          )}
        >
          <div className="font-pixel text-xs text-marquinhos-green">
            {p2Name}
          </div>
          <div
            key={`right-${score?.right ?? 0}`}
            className="font-pixel animate-pong-score-pop inline-block text-5xl text-marquinhos-text"
          >
            {score?.right ?? 0}
          </div>
        </div>
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {score ? `${p1Name} ${score.left}, ${p2Name} ${score.right}` : ''}
      </div>

      {matchStats && matchStats.score.length > 2 && (
        <div
          className="mt-3 grid grid-cols-4 gap-2"
          aria-label={t('pong:lives')}
        >
          {matchStats.score.slice(0, 4).map((value, slot) => (
            <div
              key={slot}
              className="border border-marquinhos-border bg-marquinhos-panel px-2 py-1.5 text-center font-pixel text-[10px] text-marquinhos-text"
            >
              P{slot + 1} {value}
              {matchStats.lives[slot] !== undefined &&
              matchStats.lives[slot] > 0
                ? ` · ${matchStats.lives[slot]} ${t('pong:lives')}`
                : ''}
            </div>
          ))}
        </div>
      )}

      <div className="relative mt-5 flex aspect-[5/3] w-full flex-none items-center justify-center overflow-hidden border border-marquinhos-border bg-marquinhos-bg sm:aspect-auto sm:flex-1">
        <canvas
          ref={canvasRef}
          className="block !h-auto max-h-full max-w-full touch-none border border-marquinhos-border"
        />
        {mode === 'multi' && lobby && !lobby.started && (
          <div className="absolute inset-0 flex items-center justify-center bg-marquinhos-bg/95 p-4">
            <div className="notch-6 w-full max-w-md border border-marquinhos-border bg-marquinhos-panel p-5">
              <div className="font-pixel text-center text-lg text-marquinhos-text">
                {t('pong:lobbyTitle')}
              </div>
              <div className="mt-2 text-center font-pixel text-[10px] text-marquinhos-text-dim">
                {t('pong:playersReady', {
                  ready: readyPlayers,
                  total: lobby.players.length,
                })}
              </div>
              {lobby.hostUserId === selfUserId && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <select
                    value={lobby.config.ruleset}
                    onChange={(event) =>
                      roomSend({
                        type: 'lobby_config',
                        payload: { ruleset: event.target.value },
                      })
                    }
                    className="col-span-2 min-w-0 border border-marquinhos-border bg-marquinhos-bg px-2 py-2 font-mono text-xs text-marquinhos-text"
                  >
                    {LOBBY_RULESETS.map((ruleset) => (
                      <option key={ruleset} value={ruleset}>
                        {t(`pong:rulesets.${ruleset}`)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={lobby.config.targetScore}
                    onChange={(event) =>
                      roomSend({
                        type: 'lobby_config',
                        payload: { targetScore: Number(event.target.value) },
                      })
                    }
                    className="border border-marquinhos-border bg-marquinhos-bg px-2 py-2 font-pixel text-[10px] text-marquinhos-text"
                    aria-label={t('pong:winScoreLabel')}
                  >
                    {[7, 10, 11, 15, 21].map((target) => (
                      <option key={target} value={target}>
                        {target} PT
                      </option>
                    ))}
                  </select>
                  <select
                    value={lobby.config.bestOf}
                    onChange={(event) =>
                      roomSend({
                        type: 'lobby_config',
                        payload: { bestOf: Number(event.target.value) },
                      })
                    }
                    className="border border-marquinhos-border bg-marquinhos-bg px-2 py-2 font-pixel text-[10px] text-marquinhos-text"
                    aria-label={t('pong:bestOfLabel')}
                  >
                    <option value={1}>BO1</option>
                    <option value={3}>BO3</option>
                    <option value={5}>BO5</option>
                  </select>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={lobby.config.ranked}
                    disabled={
                      lobby.config.ruleset !== 'classic-1v1' &&
                      lobby.config.ruleset !== 'quad-elimination'
                    }
                    onClick={() =>
                      roomSend({
                        type: 'lobby_config',
                        payload: { ranked: !lobby.config.ranked },
                      })
                    }
                    className={cn(
                      'col-span-2 border px-2 py-2 font-pixel text-[10px] disabled:opacity-40',
                      lobby.config.ranked
                        ? 'border-marquinhos-green text-marquinhos-green'
                        : 'border-marquinhos-border text-marquinhos-text-dim',
                    )}
                  >
                    {t('pong:rankedLabel')}
                  </button>
                </div>
              )}
              <div className="mt-4 grid gap-2">
                {lobby.players.map((player) => (
                  <div
                    key={player.userId}
                    className="flex items-center justify-between border border-marquinhos-border bg-marquinhos-bg px-3 py-2"
                  >
                    <span className="truncate font-mono text-sm text-marquinhos-text">
                      {player.displayName}
                    </span>
                    <span
                      className={cn(
                        'font-pixel text-[9px]',
                        player.ready
                          ? 'text-marquinhos-green'
                          : 'text-marquinhos-text-disabled',
                      )}
                    >
                      {player.ready ? t('pong:ready') : '...'}
                    </span>
                  </div>
                ))}
              </div>
              {!spectating && (
                <button
                  type="button"
                  className="notch-6 mt-4 w-full border border-marquinhos-accent bg-marquinhos-accent px-4 py-3 font-pixel text-[11px] text-marquinhos-bg"
                  onClick={() =>
                    roomSend({ type: 'ready', payload: { ready: !ready } })
                  }
                >
                  {ready ? t('pong:notReady') : t('pong:ready')}
                </button>
              )}
            </div>
          </div>
        )}
        {(mode !== 'multi' || lobby?.started) &&
          (matchStats?.phase === 'countdown' ||
            matchStats?.phase === 'serving') && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-marquinhos-bg/45 font-pixel text-5xl text-marquinhos-text">
              {matchStats.phase === 'countdown'
                ? Math.max(1, Math.ceil(matchStats.phaseRemainingMs / 1000))
                : t('pong:serve')}
            </div>
          )}
        {matchStats?.phase === 'point-scored' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/10 font-pixel text-xl text-marquinhos-text">
            {t('pong:pointScored')}
          </div>
        )}
        {spectating ? (
          <div className="notch-3 absolute top-3 left-1/2 -translate-x-1/2 border border-marquinhos-accent bg-marquinhos-panel px-2.5 py-1 font-pixel text-[11px] tracking-wide text-marquinhos-accent">
            {t('pong:spectating')}
          </div>
        ) : (
          !score && (
            <div className="font-pixel animate-pong-blink absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-marquinhos-text">
              {t('pong:waitingForOpponent')}
            </div>
          )
        )}
        {pausedOpponent && !gameOver && (
          <div className="font-pixel animate-pong-blink absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-marquinhos-text">
            {t('pong:opponentDisconnected')}
          </div>
        )}
        {(connectionState === 'disconnected' ||
          connectionState === 'error') && (
          <div className="font-pixel absolute top-3 left-1/2 -translate-x-1/2 border border-marquinhos-danger/60 bg-marquinhos-panel px-3 py-1.5 text-[11px] tracking-wide text-marquinhos-danger">
            {t('common:connectionLost')}
          </div>
        )}
        {gameOver && (
          <div className="animate-pong-game-over-in absolute inset-0 flex flex-col items-center justify-center gap-8 bg-marquinhos-bg/90">
            <div className="animate-pong-game-over-title-in font-pixel text-center text-3xl text-marquinhos-text">
              {winnerSlot === null
                ? winnerName
                : `${winnerName} ${t('pong:wins')}`}
            </div>
            <div className="font-pixel flex items-center gap-6 text-2xl text-marquinhos-text">
              {matchStats?.score.map((value, slot) => (
                <span key={slot} className="text-marquinhos-accent">
                  {value}
                </span>
              ))}
            </div>
            <div className="flex gap-4.5">
              {/* A spectator has no vote in the rematch — the server would
                  reject it anyway, so don't offer a button that does nothing. */}
              {!spectating && (
                <button
                  type="button"
                  className="notch-6 cursor-pointer border border-marquinhos-accent bg-marquinhos-accent px-6 py-4.5 font-mono text-xs tracking-wide text-marquinhos-bg hover:bg-marquinhos-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent disabled:cursor-not-allowed disabled:bg-marquinhos-panel disabled:text-marquinhos-text-disabled"
                  disabled={requested}
                  onClick={() => {
                    devlog('[pong-canvas] requesting rematch');
                    roomSend({ type: 'restart' });
                    setRequested(true);
                  }}
                >
                  {requested
                    ? t('pong:waitingVotes', {
                        votes: restartStatus?.votes ?? 1,
                        required:
                          restartStatus?.required ?? (mode === 'multi' ? 2 : 1),
                      })
                    : t('pong:rematch')}
                </button>
              )}
              <button
                type="button"
                className="notch-6 cursor-pointer border border-marquinhos-border bg-marquinhos-panel px-6 py-4.5 font-mono text-xs tracking-wide text-marquinhos-text hover:border-marquinhos-border-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
                onClick={() => {
                  devlog('[pong-canvas] leaving to main menu');
                  onMainMenu();
                }}
              >
                {t('common:mainMenu')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
