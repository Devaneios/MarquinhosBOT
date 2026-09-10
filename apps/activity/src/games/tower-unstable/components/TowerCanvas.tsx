import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GameHeader,
  menuButtonPrimary,
  menuButtonSecondary,
} from '../../../components/game-shell';
import { colyseusUrl } from '../../../lib/apiBase';
import type { WsSession } from '../../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../../shared/useColyseusRoom';
import type { TowerState } from '../types';
import { TowerBoardCanvas } from './TowerBoardCanvas';

interface Props {
  session: WsSession;
  userId: string;
  onMainMenu: () => void;
}

export function TowerCanvas({ session, userId, onMainMenu }: Props) {
  const { t } = useTranslation(['tower-unstable', 'common']);
  const messageHandlerRef = useRef<(message: ActivityMessage) => void>(
    () => {},
  );
  const [state, setState] = useState<TowerState | null>(null);
  const [joined, setJoined] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [restartStatus, setRestartStatus] = useState<{
    votes: number;
    required: number;
  } | null>(null);
  const [requested, setRequested] = useState(false);

  const sendLeaveOnDisconnect = useRef(
    (room: { send: (t: string) => void }) => {
      room.send('leave');
    },
  ).current;

  const { send: roomSend, connectionState } = useColyseusRoom(
    'tower-unstable',
    session,
    colyseusUrl(),
    (message) => messageHandlerRef.current(message),
    sendLeaveOnDisconnect,
  );

  useEffect(() => {
    function applyState(next: TowerState) {
      setState(next);
      setOpponentDisconnected(false);
      if (next.status === 'playing') {
        setRestartStatus(null);
        setRequested(false);
      }
    }

    messageHandlerRef.current = (message) => {
      if (message.type === 'init') {
        const payload = message.payload as {
          joined: boolean;
          state: TowerState | null;
        };
        setJoined(payload.joined);
        if (payload.state) applyState(payload.state);
      } else if (
        message.type === 'game_ready' ||
        message.type === 'state_update'
      ) {
        const payload = message.payload as { state: TowerState };
        applyState(payload.state);
      } else if (message.type === 'action_rejected') {
        // towerUnstableAdapter.ts (server) sends ACTION_REJECTED
        // ('action_rejected') for a rejected pull, not 'pull_error' — same
        // bug class found in Checkers/Tic-Tac-Toe, fixed here too.
        const payload = message.payload as { error: string };
        setError(payload.error);
      } else if (message.type === 'restart_status') {
        setRestartStatus(
          message.payload as { votes: number; required: number },
        );
      } else if (message.type === 'opponent_disconnected') {
        setOpponentDisconnected(true);
      } else if (message.type === 'opponent_reconnected') {
        setOpponentDisconnected(false);
      }
    };

    return () => {
      messageHandlerRef.current = () => {};
    };
  }, []);

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
              roomSend({ type: 'pull', payload: { level, position } })
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
                disabled={requested}
                onClick={() => {
                  roomSend({ type: 'restart' });
                  setRequested(true);
                }}
              >
                {requested
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
