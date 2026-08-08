import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
        setOpponentStatus('Opponent disconnected — waiting for reconnect…');
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

  const p1Label = 'PLAYER 1';
  const p2Label = mode === 'single' ? 'CPU' : 'PLAYER 2';
  const winnerLabel =
    state?.winner === 'p1' ? p1Label : state?.winner === 'p2' ? p2Label : '';

  return (
    <div className="box-border flex flex-1 flex-col items-stretch justify-start gap-0 px-10 py-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-col items-start gap-1.5">
          <div className="font-pixel text-xs text-marquinhos-accent">
            {p1Label}
          </div>
          <div className="text-sm text-marquinhos-text-dim">
            {mySide === 'p1' ? 'YOU' : ''}
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="font-pixel text-sm text-marquinhos-accent">
            {state?.winner
              ? `${winnerLabel} WINS`
              : state?.isDraw
                ? 'DRAW'
                : isMyTurn
                  ? 'YOUR TURN'
                  : "OPPONENT'S TURN"}
          </div>
          <button
            type="button"
            className="font-pixel cursor-pointer border border-marquinhos-border bg-marquinhos-panel px-3.5 py-2 text-[11px] text-marquinhos-text hover:border-marquinhos-border-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
            onClick={onBackToMenu}
          >
            II PAUSE
          </button>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="font-pixel text-sm text-marquinhos-green">
            {p2Label}
          </div>
          <div className="text-sm text-marquinhos-text-dim">
            {mySide === 'p2' ? 'YOU' : ''}
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
            WAITING FOR OPPONENT…
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
              ? `Rematch (${restartStatus.votes}/${restartStatus.required})`
              : 'Rematch'}
          </button>
          <button
            type="button"
            className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-5 py-3 text-sm text-marquinhos-text transition hover:border-marquinhos-border-hover"
            onClick={onBackToMenu}
          >
            Menu
          </button>
        </div>
      )}

      {(connectionState === 'disconnected' ||
        connectionState === 'error') && (
        <div className="notch-6 mt-4 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-3 text-center text-sm text-marquinhos-danger">
          Connection lost. Reload to reconnect.
        </div>
      )}

      <button
        type="button"
        className="notch-6 mt-4 self-center border border-marquinhos-border bg-marquinhos-bg px-4 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
        onClick={() => navigate('/')}
      >
        Exit to hub
      </button>
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
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[240px] w-full max-w-[520px] flex-col items-center justify-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel animate-pong-blink text-sm tracking-[0.28em] text-marquinhos-accent">
            STARTING GAME…
          </div>
          <div className="max-w-[36ch] text-sm leading-6 text-marquinhos-text-dim">
            Connecting to the realtime session.
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
    <ConnectFourBoard
      session={session.session}
      mode={session.mode}
      onBackToMenu={backToMenu}
    />
  );
}
