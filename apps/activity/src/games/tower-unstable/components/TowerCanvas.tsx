import {
  serverMessageSchema,
  type TowerClientMessage,
} from '@marquinhos/contracts/activity/games/towerUnstable';
import { parseMessage } from '@marquinhos/contracts/activity/protocol';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GameHeader,
  menuButtonPrimary,
  menuButtonSecondary,
} from '../../../components/game-shell/index';
import { colyseusUrl } from '../../../lib/apiBase';
import type { WsSession } from '../../../realtime/gameSession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../../../realtime/useColyseusRoom';
import { applyTowerMessage, initialTowerView } from '../towerMessages';
import { TowerBoardCanvas } from './TowerBoardCanvas';

function sendLeaveOnDisconnect(room: { send: (type: string) => void }) {
  room.send('leave');
}

interface Props {
  session: WsSession;
  userId: string;
  onMainMenu: () => void;
}

export function TowerCanvas({ session, userId, onMainMenu }: Props) {
  const { t } = useTranslation(['tower-unstable', 'common']);
  const [view, setView] = useState(initialTowerView);
  const {
    state,
    joined,
    error,
    opponentDisconnected,
    restartStatus,
    restartRequested,
  } = view;

  const { send: roomSend, connectionState } = useColyseusRoom(
    'tower-unstable',
    session,
    colyseusUrl(),
    (raw: ActivityMessage) => {
      const message = parseMessage(serverMessageSchema, raw);
      if (message) setView((current) => applyTowerMessage(current, message));
    },
    sendLeaveOnDisconnect,
  );

  const isMyTurn =
    state?.status === 'playing' && state.currentPlayer === userId;
  const winnerIsMe = state?.status === 'ended' && state.winner === userId;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <GameHeader
        titleKey="tower-unstable.name"
        titleNs="games"
        onBack={onMainMenu}
      />

      <main className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto p-6">
        {!joined && (
          <div className="text-sm text-marquinhos-danger">
            {t('tower-unstable:spectating')}
          </div>
        )}

        <div className="relative border border-marquinhos-border bg-marquinhos-bg">
          <TowerBoardCanvas
            state={state}
            userId={userId}
            onPull={(level, position) =>
              roomSend({
                type: 'pull',
                payload: { level, position },
              } satisfies TowerClientMessage)
            }
          />
          {!state && (
            <div className="font-pixel animate-pong-blink absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-marquinhos-text">
              {t('tower-unstable:waitingOpponent')}
            </div>
          )}
        </div>

        {state && state.status === 'playing' && (
          <div className="text-sm text-marquinhos-text-dim">
            {isMyTurn
              ? t('tower-unstable:yourTurn')
              : t('tower-unstable:opponentTurn')}
          </div>
        )}

        {state?.lastPull && (
          <div className="text-xs text-marquinhos-text-dim">
            {t('tower-unstable:lastPullInstability', {
              percent: (state.lastPull.instability * 100).toFixed(1),
            })}
          </div>
        )}

        {error && <div className="text-sm text-marquinhos-danger">{error}</div>}

        {opponentDisconnected && (
          <div className="font-pixel animate-pong-blink text-sm text-marquinhos-text">
            {t('tower-unstable:opponentDisconnected')}
          </div>
        )}

        {(connectionState === 'disconnected' ||
          connectionState === 'error') && (
          <div className="text-sm text-marquinhos-danger">
            {t('common:connectionLost')}
          </div>
        )}

        {state?.status === 'ended' && (
          <div className="flex flex-col items-center gap-4">
            <div className="font-pixel text-2xl text-marquinhos-text">
              {winnerIsMe
                ? t('tower-unstable:youWin')
                : t('tower-unstable:towerToppled')}
            </div>
            <div className="flex gap-4">
              <button
                type="button"
                className={menuButtonPrimary}
                disabled={restartRequested}
                onClick={() => {
                  roomSend({ type: 'restart' } satisfies TowerClientMessage);
                  setView((current) => ({
                    ...current,
                    restartRequested: true,
                  }));
                }}
              >
                {restartRequested
                  ? t('tower-unstable:waitingRematch', {
                      votes: restartStatus?.votes ?? 1,
                      required: restartStatus?.required ?? 2,
                    })
                  : t('tower-unstable:rematch')}
              </button>
              <button
                type="button"
                className={menuButtonSecondary}
                onClick={onMainMenu}
              >
                {t('common:mainMenu')}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
