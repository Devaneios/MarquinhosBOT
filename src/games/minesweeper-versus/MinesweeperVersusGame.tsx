import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { colyseusUrl } from '../../lib/apiBase';
import { errorMessage, isAuthError } from '../../lib/http';
import { fetchWsSessionToken, type WsSession } from '../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../shared/useColyseusRoom';
import { MinesweeperCanvas } from './MinesweeperCanvas';
import type {
  BoardSnapshot,
  GameOverPayload,
  RevealPayload,
} from './minesweeperProtocol';

type SessionState =
  | { status: 'connecting' }
  | { status: 'ready'; session: WsSession }
  | { status: 'error'; error: string };

// No mode selection (always the shared 'multi' room, like Wordle's 'single'
// puzzle) so the session connects on mount instead of waiting on a menu.
function useMinesweeperSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'connecting' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'connecting' });
    fetchWsSessionToken({
      game: 'minesweeper-versus',
      mode: 'multi',
      identity,
    })
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
  }, [identity, onAuthInvalid]);

  return state;
}

function applyRevealToBoard(
  board: BoardSnapshot,
  payload: RevealPayload,
): BoardSnapshot {
  const grid = board.grid.map((row) => row.slice());
  for (const tile of payload.revealedTiles) {
    const row = grid[tile.y];
    if (!row) continue;
    row[tile.x] = {
      revealed: true,
      mine: tile.mine,
      adjacent: tile.adjacent,
      revealedBy: tile.revealedBy,
    };
  }
  return {
    ...board,
    grid,
    scores: payload.scores,
    gameOver: payload.gameOver,
  };
}

function MinesweeperBoard({ session }: { session: WsSession }) {
  const navigate = useNavigate();
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { send, connectionState } = useColyseusRoom(
    'minesweeper-versus',
    session,
    colyseusUrl(),
    (message: ActivityMessage) => {
      if (message.type === 'init') {
        setBoard(message.payload as BoardSnapshot);
        setErrorMsg(null);
      } else if (message.type === 'reveal') {
        const payload = message.payload as RevealPayload;
        setBoard((prev) => (prev ? applyRevealToBoard(prev, payload) : prev));
      } else if (message.type === 'game_over') {
        const payload = message.payload as GameOverPayload;
        setBoard((prev) =>
          prev ? { ...prev, scores: payload.scores, gameOver: true } : prev,
        );
      } else if (message.type === 'reveal_error') {
        const payload = message.payload as { message: string };
        setErrorMsg(payload.message);
      }
    },
  );

  function revealTile(x: number, y: number) {
    send({ type: 'reveal', payload: { x, y } });
  }

  const scoreEntries = board ? Object.entries(board.scores) : [];
  scoreEntries.sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--color-marquinhos-bg)]">
      <header className="flex items-center justify-between gap-4 border-b border-marquinhos-border bg-black/10 px-4 py-3 sm:px-6">
        <div className="font-pixel text-sm tracking-[0.28em] text-marquinhos-accent sm:text-base">
          MINESWEEPER VERSUS
        </div>
        <button
          type="button"
          className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-4 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
          onClick={() => navigate('/')}
        >
          Back
        </button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto p-4 sm:p-6">
        <div className="flex w-full max-w-[560px] flex-wrap items-center justify-center gap-2">
          {scoreEntries.map(([userId, score]) => (
            <div
              key={userId}
              className="notch-3 border border-marquinhos-border bg-marquinhos-panel px-3 py-1.5 text-xs text-marquinhos-text"
            >
              {userId.slice(0, 8)}: {score}
            </div>
          ))}
        </div>

        <div className="relative flex items-center justify-center overflow-hidden border border-marquinhos-border bg-marquinhos-bg">
          <MinesweeperCanvas board={board} onReveal={revealTile} />
          {board?.gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-marquinhos-bg/90">
              <div className="font-pixel text-2xl text-marquinhos-text">
                BOARD CLEARED
              </div>
              <button
                type="button"
                className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-6 py-4 font-mono text-xs tracking-wide text-marquinhos-text hover:border-marquinhos-border-hover"
                onClick={() => navigate('/')}
              >
                MAIN MENU
              </button>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="text-center text-sm text-marquinhos-danger">
            {errorMsg}
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

export function MinesweeperVersusGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const session = useMinesweeperSession(identity, onAuthInvalid);

  if (session.status === 'connecting') {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[240px] w-full max-w-[520px] flex-col items-center justify-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel animate-pong-blink text-sm tracking-[0.28em] text-marquinhos-accent">
            STARTING GAME…
          </div>
          <div className="max-w-[36ch] text-sm leading-6 text-marquinhos-text-dim">
            Connecting to the shared minefield.
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

  return <MinesweeperBoard session={session.session} />;
}
