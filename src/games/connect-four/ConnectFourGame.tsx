import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ConnectingScreen,
  ErrorScreen,
  GameHeader,
} from '../../components/game-shell';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { colyseusUrl } from '../../lib/apiBase';
import type { GameId } from '../gameId';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../shared/useColyseusRoom';
import { ConnectFourCanvas } from './ConnectFourCanvas';
import { ConnectFourModeMenu } from './ConnectFourModeMenu';
import { useConnectFourSession } from './useConnectFourSession';
import type { ConnectFourState, Disc } from './types';

// See useConnectFourSession.ts — 'connect-four' isn't in GameId until the
// registry wiring PR lands.
const GAME_ID = 'connect-four' as GameId;

function ConnectFourBoard({
  session,
  mode,
  onBackToMenu,
}: {
  session: import('../shared/activitySession').WsSession;
  mode: 'single' | 'multi';
  onBackToMenu: () => void;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation(['connect-four', 'common']);
  const [mySide, setMySide] = useState<Disc | null>(null);
  const [state, setState] = useState<ConnectFourState | null>(null);
  const [opponentStatus, setOpponentStatus] = useState<string | null>(null);
  const restartVotesRef = useRef<{ votes: number; required: number } | null>(
    null,
  );
  const [restartStatus, setRestartStatus] = useState<{
    votes: number;
    required: number;
  } | null>(null);

  const { send, connectionState } = useColyseusRoom(
    GAME_ID,
    session,
    colyseusUrl(),
    (message: ActivityMessage) => {
      if (message.type === 'init') {
        const payload = message.payload as {
          disc: Disc | null;
          state: ConnectFourState;
        };
        setMySide(payload.disc);
        setState(payload.state);
      } else if (message.type === 'state') {
        setState(message.payload as ConnectFourState);
        setOpponentStatus(null);
        restartVotesRef.current = null;
        setRestartStatus(null);
      } else if (message.type === 'opponent_disconnected') {
        setOpponentStatus(t('connect-four:opponentDisconnected'));
      } else if (message.type === 'opponent_reconnected') {
        setOpponentStatus(null);
      } else if (message.type === 'restart_status') {
        setRestartStatus(
          message.payload as { votes: number; required: number },
        );
      }
    },
    (room) => {
      room.send('leave');
    },
  );

  const handleDrop = useCallback(
    (col: number) => {
      if (!state || state.winner || state.isDraw) return;
      if (mySide !== state.currentTurn) return;
      send({ type: 'drop', payload: { col } });
    },
    [send, state, mySide],
  );

  const isMyTurn =
    !!state && !state.winner && !state.isDraw && mySide === state.currentTurn;

  const p1Label = t('connect-four:player1');
  const p2Label =
    mode === 'single' ? t('connect-four:cpu') : t('connect-four:player2');
  const winnerLabel =
    state?.winner === 'p1' ? p1Label : state?.winner === 'p2' ? p2Label : '';

  return (
    <div className="box-border flex flex-1 flex-col items-stretch justify-start gap-0">
      <GameHeader
        titleKey="connect-four.name"
        titleNs="games"
        onBack={() => navigate('/')}
        variant="minimal"
      />

      <div className="flex flex-1 flex-col items-stretch justify-start gap-0 px-10 pb-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col items-start gap-1.5">
            <div className="font-pixel text-xs text-marquinhos-accent">
              {p1Label}
            </div>
            <div className="text-sm text-marquinhos-text-dim">
              {mySide === 'p1' ? t('common:you') : ''}
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="font-pixel text-sm text-marquinhos-accent">
              {state?.winner
                ? t('connect-four:playerWins', { player: winnerLabel })
                : state?.isDraw
                  ? t('connect-four:draw')
                  : isMyTurn
                    ? t('connect-four:yourTurn')
                    : t('connect-four:opponentTurn')}
            </div>
            <button
              type="button"
              className="font-pixel cursor-pointer border border-marquinhos-border bg-marquinhos-panel px-3.5 py-2 text-[11px] text-marquinhos-text hover:border-marquinhos-border-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
              onClick={onBackToMenu}
            >
              {t('connect-four:backToMode')}
            </button>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="font-pixel text-sm text-marquinhos-green">
              {p2Label}
            </div>
            <div className="text-sm text-marquinhos-text-dim">
              {mySide === 'p2' ? t('common:you') : ''}
            </div>
          </div>
        </div>

        <div className="relative mt-5 flex flex-1 items-center justify-center overflow-hidden border border-marquinhos-border bg-marquinhos-bg">
          <ConnectFourCanvas
            state={state}
            onDrop={handleDrop}
            interactive={isMyTurn}
          />
          {!state && (
            <div className="font-pixel animate-pong-blink absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-marquinhos-text">
              {t('connect-four:waitingOpponent')}
            </div>
          )}
          {opponentStatus && (
            <div className="notch-3 absolute top-3 left-1/2 -translate-x-1/2 border border-marquinhos-accent bg-marquinhos-panel px-2.5 py-1 font-pixel text-[11px] tracking-wide text-marquinhos-accent">
              {opponentStatus}
            </div>
          )}
        </div>

        {(state?.winner || state?.isDraw) && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
              onClick={() => send({ type: 'restart' })}
            >
              {restartStatus
                ? t('connect-four:rematchWithVotes', {
                    votes: restartStatus.votes,
                    required: restartStatus.required,
                  })
                : t('connect-four:rematch')}
            </button>
            <button
              type="button"
              className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-5 py-3 text-sm text-marquinhos-text transition hover:border-marquinhos-border-hover"
              onClick={onBackToMenu}
            >
              {t('connect-four:backToMode')}
            </button>
          </div>
        )}

        {(connectionState === 'disconnected' ||
          connectionState === 'error') && (
          <div className="notch-6 mt-4 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-3 text-center text-sm text-marquinhos-danger">
            {t('common:connectionLost')}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConnectFourGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const { session, selectMode, backToMenu } = useConnectFourSession(
    identity,
    onAuthInvalid,
  );

  if (session.status === 'selecting-mode') {
    return (
      <ConnectFourModeMenu
        onSelect={selectMode}
        onExitToHub={() => navigate('/')}
      />
    );
  }

  if (session.status === 'connecting') {
    return (
      <ConnectingScreen
        subtitleKey="connectingSubtitle"
        subtitleNs="connect-four"
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

  return (
    <ConnectFourBoard
      session={session.session}
      mode={session.mode}
      onBackToMenu={backToMenu}
    />
  );
}
