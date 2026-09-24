import {
  SHIP_TYPES,
  serverMessageSchema,
  type BattleshipClientMessage,
  type Orientation,
  type ShipPlacement,
  type ShipType,
} from '@marquinhos/contracts/activity/games/battleship';
import { parseMessage } from '@marquinhos/contracts/activity/protocol';
import {
  cellsFor,
  isValidPlacement,
} from '@marquinhos/domain/games/battleship/placement';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ConnectingScreen,
  ErrorScreen,
  GameHeader,
  GameMenu,
} from '../../../components/game-shell';
import type { DiscordIdentity } from '../../../discordAuth.ts';
import { colyseusUrl } from '../../../lib/apiBase';
import type { WsSession } from '../../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../../shared/useColyseusRoom';
import {
  applyBattleshipMessage,
  initialBattleshipView,
} from '../battleshipMessages';
import { useBattleshipSession } from '../hooks/useBattleshipSession';
import { BattleshipCanvas } from './BattleshipCanvas';
import { PlacementPanel } from './PlacementPanel';

const GAME_ID = 'battleship';

export function BattleshipBoard({ session }: { session: WsSession }) {
  const navigate = useNavigate();
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

  const { send, connectionState } = useColyseusRoom(
    GAME_ID,
    session,
    colyseusUrl(),
    (raw: ActivityMessage) => {
      const message = parseMessage(serverMessageSchema, raw);
      if (message)
        setView((current) => applyBattleshipMessage(current, message));
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
    const ship: ShipPlacement = { type: selectedType, orientation, ...cell };
    if (!isValidPlacement(ship, pendingShips)) return;
    const next = [...pendingShips, ship];
    setPendingShips(next);
    const nextType = SHIP_TYPES.find((t) => !next.some((s) => s.type === t));
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
    } satisfies BattleshipClientMessage);
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
                send({
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
      <GameMenu
        gameId="battleship"
        onBack={() => navigate('/')}
        actions={[
          {
            key: 'single',
            labelKey: 'vsBot',
            labelNs: 'common',
            descriptionKey: 'vsBotDescription',
            onSelect: () => setMode('single'),
          },
          {
            key: 'multi',
            labelKey: 'vsPlayer',
            labelNs: 'common',
            descriptionKey: 'vsPlayerDescription',
            onSelect: () => navigate('/rooms?create=battleship'),
          },
        ]}
      />
    );
  }

  if (session.status === 'connecting') {
    return (
      <ConnectingScreen
        subtitleKey="connectingSubtitle"
        subtitleNs="battleship"
      />
    );
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
