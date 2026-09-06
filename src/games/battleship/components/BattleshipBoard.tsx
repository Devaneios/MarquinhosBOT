import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ConnectingScreen,
  ErrorScreen,
  GameHeader,
  ModeSelectScreen,
} from '../../../components/game-shell';
import type { DiscordIdentity } from '../../../discordAuth.ts';
import { colyseusUrl } from '../../../lib/apiBase';
import type { WsSession } from '../../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../../shared/useColyseusRoom';
import { useBattleshipSession } from '../hooks/useBattleshipSession';
import {
  SHIP_ORDER,
  type BattleshipSide,
  type BattleshipStateView,
  type Orientation,
  type PendingShip,
  type ShipType,
} from '../types';
import { cellsFor, isValidPlacement } from '../utils';
import { BattleshipCanvas } from './BattleshipCanvas';
import { PlacementPanel } from './PlacementPanel';

const GAME_ID = 'battleship';

export function BattleshipBoard({ session }: { session: WsSession }) {
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
            onSelect: () => navigate('/rooms?create=battleship'),
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
