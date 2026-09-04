import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoomConnectionContext } from '../../shared/RoomConnectionProvider';
import {
  SHIP_ORDER,
  type BattleshipSide,
  type BattleshipSpectatorStateView,
  type BattleshipStateView,
  type Orientation,
  type PendingShip,
  type ShipType,
} from '../types';
import { cellsFor, isValidPlacement } from '../utils';
import { BattleshipCanvas } from './BattleshipCanvas';
import { PlacementPanel } from './PlacementPanel';

// Renders Battleship inside a multiplayer Room view — driven by
// RoomConnectionContext instead of BattleshipBoard's own useColyseusRoom
// call. Two distinct sub-views, since the server sends a genuinely
// different `state` payload shape depending on role (Task 14's
// spectatorViewFor vs the existing per-player viewFor): a seated player
// gets BattleshipBoard's own placement+battle flow reimplemented here
// against ctx.send/ctx.subscribe; a spectator/queued viewer gets a
// read-only side-by-side view of both fleets, reusing BattleshipCanvas in
// 'battle' mode with canFire=false for each board.
export function BattleshipRoomBoard() {
  const ctx = useRoomConnectionContext();
  if (ctx?.role === 'player') return <BattleshipPlayerView />;
  return <BattleshipSpectatorView />;
}

function BattleshipPlayerView() {
  const ctx = useRoomConnectionContext();
  const { t } = useTranslation(['battleship', 'common']);
  const [side, setSide] = useState<BattleshipSide | null>(null);
  const [state, setState] = useState<BattleshipStateView | null>(null);
  const [pendingShips, setPendingShips] = useState<PendingShip[]>([]);
  const [selectedType, setSelectedType] = useState<ShipType | null>(SHIP_ORDER[0] ?? null);
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [fireError, setFireError] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((message) => {
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
    });
  }, [ctx]);

  const previewCells = useMemo(() => {
    if (!hoverCell || !selectedType) return [];
    return cellsFor({ type: selectedType, orientation, ...hoverCell });
  }, [hoverCell, selectedType, orientation]);

  const previewValid = useMemo(() => {
    if (!hoverCell || !selectedType) return false;
    return isValidPlacement({ type: selectedType, orientation, ...hoverCell }, pendingShips);
  }, [hoverCell, selectedType, orientation, pendingShips]);

  function placeSelectedAt(cell: { x: number; y: number }) {
    if (!selectedType) return;
    const ship: PendingShip = { type: selectedType, orientation, ...cell };
    if (!isValidPlacement(ship, pendingShips)) return;
    const next = [...pendingShips, ship];
    setPendingShips(next);
    const nextType = SHIP_ORDER.find((type) => !next.some((s) => s.type === type));
    setSelectedType(nextType ?? null);
  }

  function submitFleet() {
    ctx?.send({
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
    <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto p-4 sm:p-6">
      {!state && (
        <div className="text-sm text-marquinhos-text-dim">{t('battleship:waitingMatch')}</div>
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
              setOrientation((o) => (o === 'horizontal' ? 'vertical' : 'horizontal'))
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
            onClickOpponentCell={(cell) => ctx?.send({ type: 'fire', payload: cell })}
          />
          {fireError && <div className="text-sm text-marquinhos-danger">{fireError}</div>}
        </div>
      )}
    </div>
  );
}

function BattleshipSpectatorView() {
  const ctx = useRoomConnectionContext();
  const { t } = useTranslation(['battleship', 'common']);
  const [state, setState] = useState<BattleshipSpectatorStateView | null>(null);

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((message) => {
      if (message.type === 'state') {
        setState(message.payload as BattleshipSpectatorStateView);
      }
    });
  }, [ctx]);

  if (!state) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-sm text-marquinhos-text-dim">
        {t('battleship:waitingMatch')}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto p-4 sm:p-6">
      <div className="text-sm uppercase tracking-[0.2em] text-marquinhos-text-dim">
        {state.phase === 'ended'
          ? t(state.winner === 'p1' ? 'battleship:player1Wins' : 'battleship:player2Wins')
          : t(state.turn === 'p1' ? 'battleship:player1Turn' : 'battleship:player2Turn')}
      </div>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <BattleshipCanvas mode="battle" ownBoard={state.p1} canFire={false} />
        <BattleshipCanvas mode="battle" ownBoard={state.p2} canFire={false} />
      </div>
    </div>
  );
}
