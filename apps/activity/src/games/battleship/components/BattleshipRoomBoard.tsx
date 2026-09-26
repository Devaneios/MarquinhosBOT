import { useRoomConnectionContext } from '@/platform/realtime/colyseus/RoomConnectionContext';
import {
  SHIP_TYPES,
  serverMessageSchema,
  type BattleshipClientMessage,
  type BattleshipSpectatorStateView,
  type Orientation,
  type ShipPlacement,
  type ShipType,
} from '@marquinhos/contracts/activity/games/battleship';
import { parseMessage } from '@marquinhos/contracts/activity/protocol';
import {
  cellsFor,
  isValidPlacement,
} from '@marquinhos/domain/games/battleship/placement';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BattleshipCanvas } from '../rendering/BattleshipCanvas';
import {
  applyBattleshipMessage,
  initialBattleshipView,
} from '../session/battleshipMessages';
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
  const [view, setView] = useState(initialBattleshipView);
  const { side, state, placementError, fireError } = view;
  const [pendingShips, setPendingShips] = useState<ShipPlacement[]>([]);
  const [selectedType, setSelectedType] = useState<ShipType | null>(
    SHIP_TYPES[0] ?? null,
  );
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(
    null,
  );

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((raw) => {
      const message = parseMessage(serverMessageSchema, raw);
      if (message)
        setView((current) => applyBattleshipMessage(current, message));
    });
  }, [ctx]);

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
    const ship: ShipPlacement = { type: selectedType, orientation, ...cell };
    if (!isValidPlacement(ship, pendingShips)) return;
    const next = [...pendingShips, ship];
    setPendingShips(next);
    const nextType = SHIP_TYPES.find(
      (type) => !next.some((s) => s.type === type),
    );
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
    } satisfies BattleshipClientMessage);
  }

  const phase = state?.phase ?? 'placement';
  const mySelfReady = side ? (state?.placementReady[side] ?? false) : false;
  const myTurn = state?.turn === side;

  return (
    <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto p-4 sm:p-6">
      {!state && (
        <div className="text-sm text-marquinhos-text-dim">
          {t('battleship:waitingMatch')}
        </div>
      )}

      {state && phase === 'placement' && !mySelfReady && (
        <div className="flex w-full max-w-4xl flex-col items-center gap-4 sm:flex-row sm:items-start">
          <BattleshipCanvas
            mode="placement"
            className="w-full min-w-0 sm:flex-1"
            ownBoard={state.own}
            ownTitle={t('battleship:ownFleet')}
            activeBoard="own"
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
              setSelectedType(SHIP_TYPES[0] ?? null);
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
        <div className="flex w-full max-w-5xl flex-col items-center gap-3">
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
            ownTitle={t('battleship:ownFleet')}
            opponentTitle={t('battleship:enemyFleet')}
            activeBoard={
              phase === 'ended' ? 'none' : myTurn ? 'opponent' : 'own'
            }
            canFire={phase === 'battle' && myTurn}
            onClickOpponentCell={(cell) =>
              ctx?.send({
                type: 'fire',
                payload: cell,
              } satisfies BattleshipClientMessage)
            }
          />
          {fireError && (
            <div className="text-sm text-marquinhos-danger">{fireError}</div>
          )}
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
    return ctx.subscribe((raw) => {
      const message = parseMessage(serverMessageSchema, raw);
      if (message?.type === 'state' && 'p1' in message.payload)
        setState(message.payload);
    });
  }, [ctx]);

  if (!state) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-sm text-marquinhos-text-dim">
        {t('battleship:waitingMatch')}
      </div>
    );
  }

  // The side on turn fires at the other side's fleet.
  const firedAt =
    state.phase !== 'battle' ? null : state.turn === 'p1' ? 'p2' : 'p1';

  return (
    <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto p-4 sm:p-6">
      <div className="text-sm uppercase tracking-[0.2em] text-marquinhos-text-dim">
        {state.phase === 'ended'
          ? t(
              state.winner === 'p1'
                ? 'battleship:player1Wins'
                : 'battleship:player2Wins',
            )
          : t(
              state.turn === 'p1'
                ? 'battleship:player1Turn'
                : 'battleship:player2Turn',
            )}
      </div>
      <div className="flex w-full max-w-5xl flex-col items-center gap-4 lg:flex-row lg:items-start">
        <BattleshipCanvas
          mode="spectate"
          className="w-full min-w-0 lg:flex-1"
          ownBoard={state.p1}
          ownTitle={t('battleship:player1Fleet')}
          activeBoard={firedAt === 'p1' ? 'own' : 'none'}
          canFire={false}
        />
        <BattleshipCanvas
          mode="spectate"
          className="w-full min-w-0 lg:flex-1"
          ownBoard={state.p2}
          ownTitle={t('battleship:player2Fleet')}
          activeBoard={firedAt === 'p2' ? 'own' : 'none'}
          canFire={false}
        />
      </div>
    </div>
  );
}
