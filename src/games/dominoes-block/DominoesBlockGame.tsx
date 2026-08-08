import { Application, Container, Graphics } from 'pixi.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { colyseusUrl } from '../../lib/apiBase';
import { cn } from '../../lib/cn';
import { errorMessage, isAuthError } from '../../lib/http';
import { fetchWsSessionToken, type WsSession } from '../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../shared/useColyseusRoom';
import {
  legalEndsFor,
  tileMatches,
  type ChainEnd,
  type DominoesClientState,
  type Tile,
} from './dominoesProtocol';

type SessionState =
  | { status: 'connecting' }
  | { status: 'ready'; session: WsSession }
  | { status: 'error'; error: string };

const TILE_W = 44;
const TILE_H = 72;
const CHAIN_TILE_W = 56;
const CHAIN_TILE_H = 34;
const HAND_GAP = 10;
const CHAIN_GAP = 4;
const BG_COLOR = 0x17181a;
const TILE_COLOR = 0xf2ede3;
const TILE_SELECTED_COLOR = 0xffb000;
const TILE_DISABLED_COLOR = 0x4a4a4c;
const TILE_BORDER = 0x1c1c1e;
const PIP_COLOR = 0x1c1c1e;

function useDominoesSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'connecting' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'connecting' });
    fetchWsSessionToken({ game: 'dominoes-block' as any, mode: 'multi', identity })
      .then((session) => {
        if (cancelled) return;
        setState({ status: 'ready', session });
      })
      .catch((err) => {
        if (cancelled) return;
        if (isAuthError(err)) {
          onAuthInvalid();
          return;
        }
        setState({ status: 'error', error: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [identity, onAuthInvalid]);

  return state;
}

function drawTileFace(
  gfx: Graphics,
  width: number,
  height: number,
  fill: number,
) {
  gfx
    .clear()
    .roundRect(0, 0, width, height, 6)
    .fill(fill)
    .stroke({ width: 2, color: TILE_BORDER });
}

// A domino's two halves rendered as pip dots so the board reads as an actual
// domino rather than a numbered chip. Pip layouts for 0-6, in a 3x3 grid.
const PIP_LAYOUTS: Record<number, [number, number][]> = {
  0: [],
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ],
  5: [
    [0, 0],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 2],
  ],
  6: [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 2],
    [1, 2],
    [2, 2],
  ],
};

function drawPips(
  gfx: Graphics,
  value: number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const pad = Math.min(w, h) * 0.16;
  const cellW = (w - pad * 2) / 2;
  const cellH = (h - pad * 2) / 2;
  const radius = Math.min(cellW, cellH) * 0.28;
  for (const [col, row] of PIP_LAYOUTS[value] ?? []) {
    const px = x + pad + cellW * (col / 2);
    const py = y + pad + cellH * (row / 2);
    gfx.circle(px, py, radius).fill(PIP_COLOR);
  }
}

interface HandTileEntry {
  tile: Tile;
  container: Container;
}

export function DominoesBlockBoard({
  session,
  selfId,
}: {
  session: WsSession;
  selfId: string;
}) {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const [state, setState] = useState<DominoesClientState | null>(null);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [pendingEnds, setPendingEnds] = useState<ChainEnd[] | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [restartStatus, setRestartStatus] = useState<{
    votes: number;
    required: number;
  } | null>(null);
  const [restartRequested, setRestartRequested] = useState(false);
  const [disconnectedOpponent, setDisconnectedOpponent] = useState<{
    userId: string;
    timeoutMs: number;
  } | null>(null);
  const stateRef = useRef<DominoesClientState | null>(null);
  const selfIdRef = useRef(selfId);
  selfIdRef.current = selfId;

  const { send: roomSend, connectionState } = useColyseusRoom(
    'dominoes-block' as any,
    session,
    colyseusUrl(),
    (message: ActivityMessage) => {
      if (message.type === 'state') {
        const payload = message.payload as DominoesClientState;
        stateRef.current = payload;
        setState(payload);
        setRejection(null);
        if (payload.winner || payload.blocked) {
          setRestartStatus(null);
          setRestartRequested(false);
        }
      } else if (message.type === 'move_rejected') {
        const payload = message.payload as { reason: string };
        setRejection(payload.reason);
      } else if (message.type === 'restart_status') {
        setRestartStatus(message.payload as { votes: number; required: number });
      } else if (message.type === 'opponent_disconnected') {
        setDisconnectedOpponent(
          message.payload as { userId: string; timeoutMs: number },
        );
      } else if (message.type === 'opponent_reconnected') {
        setDisconnectedOpponent(null);
      }
    },
  );

  const sendPlay = useCallback(
    (tile: Tile, end?: ChainEnd) => {
      roomSend({ type: 'play', payload: end ? { tile, end } : { tile } });
      setSelectedTile(null);
      setPendingEnds(null);
    },
    [roomSend],
  );

  const handleTileClick = useCallback(
    (tile: Tile) => {
      const current = stateRef.current;
      if (!current || current.currentPlayer !== selfIdRef.current) return;
      if (current.chain.length === 0) {
        sendPlay(tile);
        return;
      }
      const ends = legalEndsFor(tile, current.leftEnd, current.rightEnd);
      if (ends.length === 0) return;
      if (ends.length === 1) {
        sendPlay(tile, ends[0]);
        return;
      }
      setSelectedTile(tile);
      setPendingEnds(ends);
    },
    [sendPlay],
  );

  useEffect(() => {
    let cancelled = false;
    const app = new Application();
    appRef.current = app;
    let handEntries: HandTileEntry[] = [];
    let chainContainer: Container | null = null;
    let handContainer: Container | null = null;
    let unsub: (() => void) | null = null;

    (async () => {
      // Same StrictMode double-invoke guard as PongCanvas: bail before
      // touching the canvas if this effect instance was already superseded.
      await Promise.resolve();
      if (cancelled) return;

      await app.init({
        canvas: canvasRef.current!,
        width: 900,
        height: 360,
        background: BG_COLOR,
        antialias: true,
        resolution: window.devicePixelRatio,
        autoDensity: true,
      });
      if (cancelled) {
        app.destroy({ removeView: false });
        return;
      }

      chainContainer = new Container();
      handContainer = new Container();
      app.stage.addChild(chainContainer, handContainer);

      function render() {
        const current = stateRef.current;
        if (!chainContainer || !handContainer) return;
        chainContainer.removeChildren();
        handContainer.removeChildren();
        handEntries = [];
        if (!current) return;

        const chainWidth =
          current.chain.length * (CHAIN_TILE_W + CHAIN_GAP) - CHAIN_GAP;
        let cx = (app.renderer.width / window.devicePixelRatio - chainWidth) / 2;
        const cy = 60;
        for (const tile of current.chain) {
          const tileContainer = new Container();
          const gfx = new Graphics();
          drawTileFace(gfx, CHAIN_TILE_W, CHAIN_TILE_H, TILE_COLOR);
          drawPips(gfx, tile.a, 0, 0, CHAIN_TILE_W / 2, CHAIN_TILE_H);
          drawPips(gfx, tile.b, CHAIN_TILE_W / 2, 0, CHAIN_TILE_W / 2, CHAIN_TILE_H);
          const divider = new Graphics()
            .moveTo(CHAIN_TILE_W / 2, 2)
            .lineTo(CHAIN_TILE_W / 2, CHAIN_TILE_H - 2)
            .stroke({ width: 1, color: TILE_BORDER });
          tileContainer.addChild(gfx, divider);
          tileContainer.position.set(cx, cy);
          chainContainer.addChild(tileContainer);
          cx += CHAIN_TILE_W + CHAIN_GAP;
        }

        const hand = current.hand ?? [];
        const handWidth = hand.length * (TILE_W + HAND_GAP) - HAND_GAP;
        let hx = (app.renderer.width / window.devicePixelRatio - handWidth) / 2;
        const hy = 220;
        const isMyTurn = current.currentPlayer === selfIdRef.current;
        for (const tile of hand) {
          const ends = legalEndsFor(tile, current.leftEnd, current.rightEnd);
          const playable =
            current.chain.length === 0 || ends.length > 0;
          const isSelected =
            selectedTile !== null && tileMatches(selectedTile, tile);

          const tileContainer = new Container();
          const gfx = new Graphics();
          const fill = isSelected
            ? TILE_SELECTED_COLOR
            : isMyTurn && playable
              ? TILE_COLOR
              : TILE_DISABLED_COLOR;
          drawTileFace(gfx, TILE_W, TILE_H, fill);
          drawPips(gfx, tile.a, 0, 0, TILE_W, TILE_H / 2);
          drawPips(gfx, tile.b, 0, TILE_H / 2, TILE_W, TILE_H / 2);
          const divider = new Graphics()
            .moveTo(2, TILE_H / 2)
            .lineTo(TILE_W - 2, TILE_H / 2)
            .stroke({ width: 1, color: TILE_BORDER });
          tileContainer.addChild(gfx, divider);
          tileContainer.position.set(hx, hy);

          if (isMyTurn && playable) {
            tileContainer.eventMode = 'static';
            tileContainer.cursor = 'pointer';
            tileContainer.on('pointertap', () => handleTileClick(tile));
          }

          handContainer.addChild(tileContainer);
          handEntries.push({ tile, container: tileContainer });
          hx += TILE_W + HAND_GAP;
        }
      }

      render();
      unsub = () => {};
      (app as unknown as { __dominoesRender?: () => void }).__dominoesRender =
        render;
    })();

    return () => {
      cancelled = true;
      unsub?.();
      appRef.current = null;
      app.destroy({ removeView: false });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render the Pixi scene whenever the masked state, selection, or our
  // resolved identity changes — the effect above owns the Application and
  // exposes a render() hook rather than tearing the scene down every time.
  useEffect(() => {
    const app = appRef.current as
      | (Application & { __dominoesRender?: () => void })
      | null;
    app?.__dominoesRender?.();
  }, [state, selectedTile]);

  const isMyTurn = state?.currentPlayer === selfId;
  const winners = state?.winners;
  const matchOver = Boolean(state && (state.winner || state.blocked));

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-marquinhos-bg">
      <header className="flex items-center justify-between gap-4 border-b border-marquinhos-border bg-black/10 px-4 py-3 sm:px-6">
        <div className="font-pixel text-sm tracking-[0.28em] text-marquinhos-accent sm:text-base">
          DOMINOES
        </div>
        <button
          type="button"
          className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-4 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
          onClick={() => {
            roomSend({ type: 'leave' });
            navigate('/');
          }}
        >
          Back
        </button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-4 sm:p-6">
        {!state && (
          <div className="font-pixel animate-pong-blink text-sm text-marquinhos-accent">
            WAITING FOR PLAYERS…
          </div>
        )}

        {state && (
          <>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim">
              {state.players.map((player) => (
                <div
                  key={player}
                  className={cn(
                    'notch-3 border px-3 py-1.5',
                    player === state.currentPlayer
                      ? 'border-marquinhos-accent text-marquinhos-accent'
                      : 'border-marquinhos-border',
                  )}
                >
                  {player === selfId ? 'YOU' : player.slice(0, 6)} ·{' '}
                  {state.handCounts[player]}
                </div>
              ))}
              <div className="notch-3 border border-marquinhos-border px-3 py-1.5">
                BONEYARD · {state.boneyard}
              </div>
            </div>

            <div className="relative notch-8 border border-marquinhos-border bg-[#1c1b1c] shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
              <canvas ref={canvasRef} className="block" />

              {pendingEnds && pendingEnds.length === 2 && (
                <div className="absolute bottom-24 left-1/2 flex -translate-x-1/2 gap-3">
                  {pendingEnds.map((end) => (
                    <button
                      key={end}
                      type="button"
                      className="notch-6 border border-marquinhos-accent bg-marquinhos-accent px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-black"
                      onClick={() => selectedTile && sendPlay(selectedTile, end)}
                    >
                      Play {end}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-4 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim"
                    onClick={() => {
                      setSelectedTile(null);
                      setPendingEnds(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={!isMyTurn}
                className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-marquinhos-text transition hover:border-marquinhos-border-hover disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => roomSend({ type: 'pass' })}
              >
                Pass
              </button>
            </div>

            {rejection && (
              <div className="text-sm text-marquinhos-danger">{rejection}</div>
            )}

            {disconnectedOpponent && !matchOver && (
              <div className="font-pixel animate-pong-blink text-sm text-marquinhos-text">
                OPPONENT DISCONNECTED — WAITING…
              </div>
            )}

            {(connectionState === 'disconnected' ||
              connectionState === 'error') && (
              <div className="notch-6 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-3 text-center text-sm text-marquinhos-danger">
                Connection lost. Reload to reconnect.
              </div>
            )}

            {matchOver && (
              <div className="notch-8 flex flex-col items-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-8 py-6 text-center">
                <div className="font-pixel text-lg text-marquinhos-accent">
                  {state.blocked
                    ? 'BLOCKED GAME'
                    : winners?.includes(selfId ?? '')
                      ? 'YOU WIN'
                      : 'GAME OVER'}
                </div>
                {winners && (
                  <div className="text-sm text-marquinhos-text-dim">
                    Winner{winners.length > 1 ? 's' : ''}:{' '}
                    {winners
                      .map((w) => (w === selfId ? 'You' : w.slice(0, 6)))
                      .join(', ')}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={restartRequested}
                    className="notch-6 border border-marquinhos-accent bg-marquinhos-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-black disabled:opacity-50"
                    onClick={() => {
                      roomSend({ type: 'restart' });
                      setRestartRequested(true);
                    }}
                  >
                    {restartRequested
                      ? `Waiting… (${restartStatus?.votes ?? 1}/${restartStatus?.required ?? state.players.length})`
                      : 'Rematch'}
                  </button>
                  <button
                    type="button"
                    className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-marquinhos-text"
                    onClick={() => {
                      roomSend({ type: 'leave' });
                      navigate('/');
                    }}
                  >
                    Main Menu
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export function DominoesBlockGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const session = useDominoesSession(identity, onAuthInvalid);

  if (session.status === 'connecting') {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[240px] w-full max-w-[520px] flex-col items-center justify-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel animate-pong-blink text-sm tracking-[0.28em] text-marquinhos-accent">
            STARTING GAME…
          </div>
          <div className="max-w-[36ch] text-sm leading-6 text-marquinhos-text-dim">
            Connecting to the table and waiting for other players.
          </div>
        </div>
      </div>
    );
  }

  if (session.status === 'error') {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[240px] w-full max-w-[560px] flex-col items-center justify-center gap-5 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel text-lg tracking-[0.24em] text-marquinhos-danger">
            CONNECTION FAILED
          </div>
          <div className="max-w-[48ch] text-sm leading-6 text-marquinhos-text-dim">
            {session.error}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
              onClick={onAuthInvalid}
            >
              Retry auth
            </button>
            <button
              type="button"
              className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-5 py-3 text-sm text-marquinhos-text transition hover:border-marquinhos-border-hover"
              onClick={() => navigate('/')}
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DominoesBlockBoard session={session.session} selfId={identity.userId} />
  );
}
