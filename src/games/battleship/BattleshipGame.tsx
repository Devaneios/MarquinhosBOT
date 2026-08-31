import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ConnectingScreen,
  ErrorScreen,
  GameHeader,
  ModeSelectScreen,
} from '../../components/game-shell';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { colyseusUrl } from '../../lib/apiBase';
import { errorMessage, isAuthError } from '../../lib/http';
import { fetchWsSessionToken, type WsSession } from '../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../shared/useColyseusRoom';
import {
  BattleshipCanvas,
  type PendingShip,
} from './components/BattleshipCanvas';
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
const GAME_ID = 'battleship';

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

function cellsFor(ship: PendingShip): { x: number; y: number }[] {
  const size = SHIP_SIZES[ship.type];
  return Array.from({ length: size }, (_, i) => ({
    x: ship.orientation === 'horizontal' ? ship.x + i : ship.x,
    y: ship.orientation === 'horizontal' ? ship.y : ship.y + i,
  }));
}

function isValidPlacement(ship: PendingShip, others: PendingShip[]): boolean {
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
  const { t } = useTranslation('battleship');
  const placedTypes = new Set(pendingShips.map((s) => s.type));
  const allPlaced = placedTypes.size === SHIP_ORDER.length;
  const shipLabelKey: Record<ShipType, string> = {
    carrier: 'shipCarrier',
    battleship: 'shipBattleship',
    cruiser: 'shipCruiser',
    submarine: 'shipSubmarine',
    destroyer: 'shipDestroyer',
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="text-sm uppercase tracking-[0.2em] text-marquinhos-text-dim">
        {t('placeFleet')}
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
            {t(shipLabelKey[type])} ({SHIP_SIZES[type]})
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleOrientation}
          className="notch-4 border border-marquinhos-border bg-marquinhos-panel px-3 py-2 text-xs uppercase tracking-[0.14em] text-marquinhos-text-dim"
        >
          {t('orientationLabel')}:{' '}
          {t(
            orientation === 'horizontal'
              ? 'orientationHorizontal'
              : 'orientationVertical',
          )}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="notch-4 border border-marquinhos-border bg-marquinhos-panel px-3 py-2 text-xs uppercase tracking-[0.14em] text-marquinhos-text-dim"
        >
          {t('reset')}
        </button>
      </div>
      {error && <div className="text-sm text-marquinhos-danger">{error}</div>}
      <button
        type="button"
        disabled={!allPlaced}
        onClick={onSubmit}
        className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t('confirmFleet')}
      </button>
    </div>
  );
}

function BattleshipBoard({ session }: { session: WsSession }) {
  const navigate = useNavigate();
  const { t } = useTranslation(['battleship', 'common']);
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
    const nextType = SHIP_ORDER.find((t) => !next.some((s) => s.type === t));
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
      <GameHeader
        titleKey="battleship.name"
        titleNs="games"
        onBack={() => navigate('/')}
      />

      <main className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto p-4 sm:p-6">
        {!state && (
          <div className="text-sm text-marquinhos-text-dim">
            {t('battleship:waitingMatch')}
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
            {t('battleship:fleetPlaced')}
          </div>
        )}

        {state && (phase === 'battle' || phase === 'ended') && (
          <div className="flex flex-col items-center gap-3">
            <div className="text-sm uppercase tracking-[0.2em] text-marquinhos-text-dim">
              {phase === 'ended'
                ? state.winner === side
                  ? t('battleship:youWon')
                  : t('battleship:youLost')
                : myTurn
                  ? t('battleship:yourTurn')
                  : t('battleship:opponentTurn')}
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
            {t('common:connectionLost')}
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
      <ModeSelectScreen
        onBack={() => navigate('/')}
        options={[
          {
            key: 'single',
            labelKey: 'vsBot',
            labelNs: 'common',
            onSelect: () => setMode('single'),
          },
          {
            key: 'multi',
            labelKey: 'vsPlayer',
            labelNs: 'common',
            onSelect: () => setMode('multi'),
          },
        ]}
      />
    );
  }

  if (session.status === 'connecting') {
    return <ConnectingScreen />;
  }

  if (session.status === 'error') {
    return (
      <ErrorScreen
        message={session.error}
        onRetryAuth={onAuthInvalid}
        onBack={() => navigate('/')}
      />
    );
  }

  return <BattleshipBoard session={session.session} />;
}
