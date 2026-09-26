import type { WsSession } from '@/games/shared/session/gameSession';
import {
  menuButtonPrimary,
  menuButtonSecondary,
} from '@/games/shared/shell/menu/menuButtons';
import { colyseusUrl } from '@/platform/api/apiBase';
import type { ActivityMessage } from '@/platform/realtime/colyseus/connection';
import { useColyseusRoom } from '@/platform/realtime/colyseus/useColyseusRoom';
import { devinfo, devlog, devwarn } from '@/shared/logging/devlog';
import { cn } from '@/shared/utils/cn';
import type { Room } from '@colyseus/sdk';
import {
  serverMessageSchema,
  type PongAssignment,
  type PongClientMessage,
  type PongLobbyState,
  type PongServerMessage,
} from '@marquinhos/contracts/activity/games/pong';
import {
  decodeStateSnapshot,
  withClassicView,
  type DecodedSnapshot,
} from '@marquinhos/contracts/activity/pong/codec';
import {
  bestOfSchema,
  PONG_RULESETS,
  pongRulesetIdSchema,
  type GameMode,
} from '@marquinhos/contracts/activity/pong/types';
import { parseMessage } from '@marquinhos/contracts/activity/protocol';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PongSfx } from '../audio/sfx';
import { LocalPaddlePredictor, PongSnapshotBuffer } from '../netcode/netcode';
import type { Side } from '../pongTypes';
import { attachPongInput } from '../rendering/pongInput';
import {
  circleOverlapsPoint,
  closestPointOnRect,
  createPongScene,
  DEFAULT_CONFIG,
  type PongConfig,
  type PongSceneFrame,
  type PongSceneHandle,
} from '../rendering/pongScene';

interface Snapshot {
  state: DecodedSnapshot;
  receivedAt: number;
}

export function PongBoard({
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
  const assignmentRef = useRef<PongAssignment | null>(null);
  const configRef = useRef<PongConfig>(DEFAULT_CONFIG);
  const matchStartRef = useRef<number | null>(null);
  const touchingLeftRef = useRef(false);
  const touchingRightRef = useRef(false);
  const sceneRef = useRef<PongSceneHandle | null>(null);
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
  const [pausedOpponent, setPausedOpponent] = useState<
    | Extract<PongServerMessage, { type: 'player_disconnected' }>['payload']
    | null
  >(null);
  const [spectating, setSpectating] = useState(false);
  const [lobby, setLobby] = useState<PongLobbyState | null>(null);
  const [selfUserId, setSelfUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const spectatingRef = useRef(false);
  const messageHandlerRef = useRef<(message: ActivityMessage) => void>(
    () => {},
  );

  // Sending 'leave' before the room disconnects (rather than a bare close)
  // is what tells the server to forfeit the match immediately instead of
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
    touchingLeftRef.current = false;
    touchingRightRef.current = false;
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
        min: config.cornerGap,
        max: config.height - config.paddleHeight - config.cornerGap,
        speed: config.paddleSpeed,
      });
      return predictors[side]!;
    }

    function handleJsonMessage(raw: ActivityMessage) {
      const message = parseMessage(serverMessageSchema, raw);
      if (!message) return;
      switch (message.type) {
        case 'init': {
          const payload = message.payload;
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
          return;
        }
        case 'lobby_state': {
          setLobby(message.payload);
          const own = message.payload.players.find(
            (player) => player.slot === assignmentRef.current?.slot,
          );
          setReady(own?.ready ?? false);
          return;
        }
        case 'restart_status':
          devlog('[pong-canvas] restart status', message.payload);
          setRestartStatus(message.payload);
          return;
        case 'player_disconnected':
          devwarn('[pong-canvas] opponent disconnected', message.payload);
          setPausedOpponent(message.payload);
          return;
        case 'player_reconnected':
          devinfo('[pong-canvas] opponent reconnected');
          setPausedOpponent(null);
          return;
        case 'state':
          return;
      }
    }

    function handleBinary(bytes: Uint8Array) {
      const state = withClassicView(decodeStateSnapshot(bytes.slice().buffer));
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
      const previousWinner = prevWinnerRef.current;
      if (state.winnerSlot !== previousWinner) {
        devlog('[pong-canvas] winner changed', state.winnerSlot);
        if (state.winnerSlot !== null) sfx.win();
        prevWinnerRef.current = state.winnerSlot;
      }
      if (state.winnerSlot === null) {
        setRestartStatus(null);
        setRequested(false);
        // A rematch reuses this same canvas/session, so the elapsed-time
        // clock has to be re-armed here too, not just at mount.
        if (previousWinner !== null) matchStartRef.current = null;
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
        sceneRef.current?.paddleHit(
          'left',
          leftContact.x,
          leftContact.y,
          ballSpeed,
          receivedAt,
        );
        sfx.hit();
      }
      if (touchingRight && !touchingRightRef.current) {
        sceneRef.current?.paddleHit(
          'right',
          rightContact.x,
          rightContact.y,
          ballSpeed,
          receivedAt,
        );
        sfx.hit();
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

    function sendInput(
      payload: Extract<PongClientMessage, { type: 'input' }>['payload'],
    ) {
      roomSend({ type: 'input', payload } satisfies PongClientMessage);
    }

    // 'state' snapshots arrive as raw bytes on their own message type;
    // everything else is the small JSON control-message set handled above.
    messageHandlerRef.current = (message) => {
      if (message.type === 'state') {
        if (message.payload instanceof Uint8Array) {
          handleBinary(message.payload);
        }
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

    const canvas = canvasRef.current!;
    const inputCleanup = attachPongInput({
      canvas,
      mode,
      getSide: () => sideRef.current,
      getAssignment: () => assignmentRef.current,
      isSpectating: () => spectatingRef.current,
      sendInput,
      pushPrediction: (side, input) => predictorFor(side).push(input),
      onExit: pauseExit,
    });

    function getFrame(now: number): PongSceneFrame {
      const config = configRef.current;
      const sample = snapshotBuffer.sample(now);
      if (!sample) {
        return {
          config,
          state: null,
          leftY: null,
          rightY: null,
          elapsedMs:
            matchStartRef.current === null ? null : now - matchStartRef.current,
        };
      }

      const state = sample.state;
      let leftY = state.classicPaddles.left;
      let rightY = state.classicPaddles.right;
      const side = sideRef.current;
      if (side) {
        const controlledSides: Side[] =
          mode === 'local' ? ['left', 'right'] : [side];
        for (const controlledSide of controlledSides) {
          const latestAuthority = authoritative[controlledSide];
          if (!latestAuthority) continue;
          const predicted = predictorFor(controlledSide).reconcile(
            latestAuthority.position,
            latestAuthority.ack,
            latestAuthority.at,
            now,
          );
          const maxY = config.height - config.paddleHeight;
          if (controlledSide === 'left')
            leftY = Math.min(Math.max(predicted, 0), maxY);
          else rightY = Math.min(Math.max(predicted, 0), maxY);
        }
      }

      return {
        config,
        state,
        leftY,
        rightY,
        elapsedMs:
          matchStartRef.current === null ? null : now - matchStartRef.current,
      };
    }

    const scene = createPongScene({
      canvas,
      getTimer: () => timerRef.current,
      getFrame,
      onResume: () => {
        prevSnapshotRef.current = null;
      },
    });
    sceneRef.current = scene;

    return () => {
      devlog('[pong-canvas] unmounting, leaving session');
      inputCleanup();
      scene.dispose();
      if (sceneRef.current === scene) sceneRef.current = null;
      messageHandlerRef.current = () => {};
      sfx.dispose();
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
                    onChange={(event) => {
                      const ruleset = pongRulesetIdSchema.safeParse(
                        event.target.value,
                      );
                      if (ruleset.success)
                        roomSend({
                          type: 'lobby_config',
                          payload: { ruleset: ruleset.data },
                        } satisfies PongClientMessage);
                    }}
                    className="col-span-2 min-w-0 border border-marquinhos-border bg-marquinhos-bg px-2 py-2 font-mono text-xs text-marquinhos-text"
                  >
                    {PONG_RULESETS.map((ruleset) => (
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
                      } satisfies PongClientMessage)
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
                    onChange={(event) => {
                      const bestOf = bestOfSchema.safeParse(
                        Number(event.target.value),
                      );
                      if (bestOf.success)
                        roomSend({
                          type: 'lobby_config',
                          payload: { bestOf: bestOf.data },
                        } satisfies PongClientMessage);
                    }}
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
                      } satisfies PongClientMessage)
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
                    roomSend({
                      type: 'ready',
                      payload: { ready: !ready },
                    } satisfies PongClientMessage)
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
                  className={menuButtonPrimary}
                  disabled={requested}
                  onClick={() => {
                    devlog('[pong-canvas] requesting rematch');
                    roomSend({ type: 'restart' } satisfies PongClientMessage);
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
                className={menuButtonSecondary}
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
