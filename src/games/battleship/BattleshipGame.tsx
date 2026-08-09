import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { colyseusUrl } from '../../lib/apiBase';
import { errorMessage, isAuthError } from '../../lib/http';
import type { GameId } from '../gameId';
import { fetchWsSessionToken, type WsSession } from '../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../shared/useColyseusRoom';
import { BattleshipCanvas, type PendingShip } from './BattleshipCanvas';
import {
  BOARD_SIZE,
  SHIP_ORDER,
  SHIP_SIZES,
  type BattleshipSide,
  type BattleshipStateView,
  type Orientation,
  type ShipType,
} from './types';

// 'battleship' isn't part of GameId yet (src/games/gameId.ts is one of the
// shared registry files another process wires in for all 16 games at once,
// serially, to avoid every game's PR colliding on the same line) — this
// cast is the one place that gap is bridged so the rest of this file can
// use the real GameId-typed helpers untouched.
const GAME_ID = 'battleship' as unknown as GameId;

type SessionState =
  | { status: 'selecting-mode' }
  | { status: 'connecting' }
  | { status: 'ready'; session: WsSession }
  | { status: 'error'; error: string };

function useBattleshipSession(
  identity: DiscordIdentity,
  mode: 'single' | 'multi' | null,
  onAuthInvalid: () => void,
): SessionState {
  const [state, setState] = useState<SessionState>({
    status: mode ? 'connecting' : 'selecting-mode',
  });

  useEffect(() => {
    if (!mode) {
      setState({ status: 'selecting-mode' });
      return;
    }

    let cancelled = false;
    setState({ status: 'connecting' });
    fetchWsSessionToken({ game: GAME_ID, mode, identity })
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
  }, [identity, mode, onAuthInvalid]);

  return state;
}

function cellsFor(
  ship: PendingShip,
): { x: number; y: number }[] {
  const size = SHIP_SIZES[ship.type];
  return Array.from({ length: size }, (_, i) => ({
    x: ship.orientation === 'horizontal' ? ship.x + i : ship.x,
    y: ship.orientation === 'horizontal' ? ship.y : ship.y + i,
  }));
}

function isValidPlacement(
  ship: PendingShip,
  others: PendingShip[],
): boolean {
  const cells = cellsFor(ship);
  if (
    cells.some(
      (c) => c.x < 0 || c.x >= BOARD_SIZE || c.y < 0 || c.y >= BOARD_SIZE,
    )
  ) {
    return false;
  }
  const occupied = new Set(
    others.flatMap((o) => cellsFor(o).map((c) => `${c.x},${c.y}`)),
  );
  return cells.every((c) => !occupied.has(`${c.x},${c.y}`));
}

function PlacementPanel({
  pendingShips,
  selectedType,
  orientation,
  onSelectType,
  onToggleOrientation,
  onSubmit,
  onReset,
  error,
}: {
  pendingShips: PendingShip[];
  selectedType: ShipType | null;
  orientation: Orientation;
  onSelectType: (type: ShipType) => void;
  onToggleOrientation: () => void;
  onSubmit: () => void;
  onReset: () => void;
  error: string | null;
}) {
  const placedTypes = new Set(pendingShips.map((s) => s.type));
  const allPlaced = placedTypes.size === SHIP_ORDER.length;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="text-sm uppercase tracking-[0.2em] text-marquinhos-text-dim">
        Place your fleet
      </div>
      <div className="flex flex-wrap gap-2">
        {SHIP_ORDER.map((type) => (
          <button
            key={type}
            type="button"
            disabled={placedTypes.has(type)}
            onClick={() => onSelectType(type)}
            className={`notch-4 border px-3 py-2 text-xs uppercase tracking-[0.14em] transition disabled:opacity-40 ${
              selectedType === type
                ? 'border-marquinhos-accent bg-marquinhos-accent/20 text-marquinhos-accent'
                : 'border-marquinhos-border bg-marquinhos-panel text-marquinhos-text-dim'
            }`}
          >
            {type} ({SHIP_SIZES[type]})
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleOrientation}
          className="notch-4 border border-marquinhos-border bg-marquinhos-panel px-3 py-2 text-xs uppercase tracking-[0.14em] text-marquinhos-text-dim"
        >
          Orientation: {orientation}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="notch-4 border border-marquinhos-border bg-marquinhos-panel px-3 py-2 text-xs uppercase tracking-[0.14em] text-marquinhos-text-dim"
        >
          Reset
        </button>
      </div>
      {error && <div className="text-sm text-marquinhos-danger">{error}</div>}
      <button
        type="button"
        disabled={!allPlaced}
        onClick={onSubmit}
        className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        Confirm fleet
      </button>
    </div>
  );
}

function BattleshipBoard({ session }: { session: WsSession }) {
  const navigate = useNavigate();
  const [side, setSide] = useState<BattleshipSide | null>(null);
  const [state, setState] = useState<BattleshipStateView | null>(null);
  const [pendingShips, setPendingShips] = useState<PendingShip[]>([]);
  const [selectedType, setSelectedType] = useState<ShipType | null>(
    SHIP_ORDER[0] ?? null,
  );
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [fireError, setFireError] = useState<string | null>(null);

  const { send, connectionState } = useColyseusRoom(
    GAME_ID,
    session,
    colyseusUrl(),
    (message: ActivityMessage) => {
      if (message.type === 'init') {
        const payload = message.payload as { side: BattleshipSide | null };
        setSide(payload.side);
      } else if (message.type === 'state') {
        setState(message.payload as BattleshipStateView);
        setPlacementError(null);
        setFireError(null);
      } else if (message.type === 'placement_error') {
        setPlacementError((message.payload as { message: string }).message);
      } else if (message.type === 'fire_error') {
        setFireError((message.payload as { message: string }).message);
      }
    },
  );

  const previewCells = useMemo(() => {
    if (!hoverCell || !selectedType) return [];
    return cellsFor({ type: selectedType, orientation, ...hoverCell });
  }, [hoverCell, selectedType, orientation]);

  const previewValid = useMemo(() => {
    if (!hoverCell || !selectedType) return false;
    return isValidPlacement(
      { type: selectedType, orientation, ...hoverCell },
      pendingShips,
    );
  }, [hoverCell, selectedType, orientation, pendingShips]);

  function placeSelectedAt(cell: { x: number; y: number }) {
    if (!selectedType) return;
    const ship: PendingShip = { type: selectedType, orientation, ...cell };
    if (!isValidPlacement(ship, pendingShips)) return;
    const next = [...pendingShips, ship];
    setPendingShips(next);
    const nextType = SHIP_ORDER.find(
      (t) => !next.some((s) => s.type === t),
    );
    setSelectedType(nextType ?? null);
  }

  function submitFleet() {
    send({
      type: 'place_ships',
      payload: {
        placements: pendingShips.map((s) => ({
          type: s.type,
          x: s.x,
          y: s.y,
          orientation: s.orientation,
        })),
      },
    });
  }

  const phase = state?.phase ?? 'placement';
  const mySelfReady = side ? (state?.placementReady[side] ?? false) : false;
  const myTurn = state?.turn === side;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--color-marquinhos-bg)]">
      <header className="flex items-center justify-between gap-4 border-b border-marquinhos-border bg-black/10 px-4 py-3 sm:px-6">
        <div className="font-pixel text-sm tracking-[0.28em] text-marquinhos-accent sm:text-base">
          BATTLESHIP
        </div>
        <button
          type="button"
          className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-4 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim"
          onClick={() => navigate('/')}
        >
          Back
        </button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto p-4 sm:p-6">
        {!state && (
          <div className="text-sm text-marquinhos-text-dim">
            Waiting for the match to start…
          </div>
        )}

        {state && phase === 'placement' && !mySelfReady && (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <BattleshipCanvas
              mode="placement"
              ownBoard={state.own}
              pendingShips={pendingShips}
              previewCells={previewCells}
              previewValid={previewValid}
              onHoverOwnCell={setHoverCell}
              onClickOwnCell={placeSelectedAt}
            />
            <PlacementPanel
              pendingShips={pendingShips}
              selectedType={selectedType}
              orientation={orientation}
              onSelectType={setSelectedType}
              onToggleOrientation={() =>
                setOrientation((o) =>
                  o === 'horizontal' ? 'vertical' : 'horizontal',
                )
              }
              onSubmit={submitFleet}
              onReset={() => {
                setPendingShips([]);
                setSelectedType(SHIP_ORDER[0] ?? null);
              }}
              error={placementError}
            />
          </div>
        )}

        {state && phase === 'placement' && mySelfReady && (
          <div className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-6 py-4 text-sm text-marquinhos-text-dim">
            Fleet placed. Waiting for the opponent…
          </div>
        )}

        {state && (phase === 'battle' || phase === 'ended') && (
          <div className="flex flex-col items-center gap-3">
            <div className="text-sm uppercase tracking-[0.2em] text-marquinhos-text-dim">
              {phase === 'ended'
                ? state.winner === side
                  ? 'You won!'
                  : 'You lost.'
                : myTurn
                  ? 'Your turn — fire on the right board'
                  : "Opponent's turn"}
            </div>
            <BattleshipCanvas
              mode="battle"
              ownBoard={state.own}
              opponentBoard={state.opponent}
              canFire={phase === 'battle' && myTurn}
              onClickOpponentCell={(cell) =>
                send({ type: 'fire', payload: cell })
              }
            />
            {fireError && (
              <div className="text-sm text-marquinhos-danger">{fireError}</div>
            )}
          </div>
        )}

        {(connectionState === 'disconnected' ||
          connectionState === 'error') && (
          <div className="notch-6 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-3 text-center text-sm text-marquinhos-danger">
            Connection lost. Reload to reconnect.
          </div>
        )}
      </main>
    </div>
  );
}

export function BattleshipGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'single' | 'multi' | null>(null);
  const session = useBattleshipSession(identity, mode, onAuthInvalid);

  if (session.status === 'selecting-mode') {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[240px] w-full max-w-[520px] flex-col items-center justify-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel text-lg tracking-[0.24em] text-marquinhos-accent">
            SELECT MODE
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
              onClick={() => setMode('single')}
            >
              VS BOT
            </button>
            <button
              type="button"
              className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
              onClick={() => setMode('multi')}
            >
              VS PLAYER
            </button>
          </div>
          <button
            type="button"
            className="notch-6 border border-marquinhos-border bg-transparent px-5 py-3 text-sm font-semibold text-marquinhos-text transition hover:bg-marquinhos-panel-hover"
            onClick={() => navigate('/')}
          >
            BACK
          </button>
        </div>
      </div>
    );
  }

  if (session.status === 'connecting') {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[240px] w-full max-w-[520px] flex-col items-center justify-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel animate-pong-blink text-sm tracking-[0.28em] text-marquinhos-accent">
            STARTING GAME…
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

  return <BattleshipBoard session={session.session} />;
}
