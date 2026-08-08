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
import type { Cell, FoundWord } from './WordSearchRaceCanvas';
import { colorForPlayer, WordSearchRaceCanvas } from './WordSearchRaceCanvas';

type SessionState =
  | { status: 'connecting' }
  | { status: 'ready'; session: WsSession }
  | { status: 'error'; error: string };

interface InitPayload {
  size: number;
  grid: string[][];
  words: string[];
  found: FoundWord[];
  scores: Record<string, number>;
  deadline: number;
  ended: boolean;
}

function useWordSearchRaceSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'connecting' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'connecting' });
    fetchWsSessionToken({
      game: 'word-search-race',
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

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function Board({ session, selfId }: { session: WsSession; selfId: string }) {
  const navigate = useNavigate();
  const [init, setInit] = useState<InitPayload | null>(null);
  const [found, setFound] = useState<FoundWord[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());
  const [gameOver, setGameOver] = useState<{ reason: string } | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);

  const { send, connectionState } = useColyseusRoom(
    'word-search-race',
    session,
    colyseusUrl(),
    (message: ActivityMessage) => {
      if (message.type === 'init') {
        const payload = message.payload as InitPayload;
        setInit(payload);
        setFound(payload.found);
        setScores(payload.scores);
        setGameOver(payload.ended ? { reason: 'completed' } : null);
      } else if (message.type === 'word_found') {
        const payload = message.payload as FoundWord & {
          scores: Record<string, number>;
        };
        setFound((prev) => [...prev, payload]);
        setScores(payload.scores);
        setSelectError(null);
      } else if (message.type === 'select_error') {
        const payload = message.payload as { message: string };
        setSelectError(payload.message);
      } else if (message.type === 'game_over') {
        const payload = message.payload as {
          reason: string;
          scores: Record<string, number>;
        };
        setScores(payload.scores);
        setGameOver({ reason: payload.reason });
      }
    },
  );

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  if (!init) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-marquinhos-text-dim">
        Loading puzzle…
      </div>
    );
  }

  const remainingMs = init.deadline - now;
  const rankedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-marquinhos-bg">
      <header className="flex items-center justify-between gap-4 border-b border-marquinhos-border bg-black/10 px-4 py-3 sm:px-6">
        <div className="font-pixel text-sm tracking-[0.28em] text-marquinhos-accent sm:text-base">
          WORD SEARCH RACE
        </div>
        <div className="font-pixel text-sm text-marquinhos-accent">
          {gameOver ? '00:00' : formatRemaining(remainingMs)}
        </div>
        <button
          type="button"
          className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-4 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
          onClick={() => navigate('/')}
        >
          Back
        </button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto p-4 sm:flex-row sm:items-start sm:justify-center sm:p-6">
        <div className="relative">
          <WordSearchRaceCanvas
            grid={init.grid}
            size={init.size}
            found={found}
            selfId={selfId}
            onSelect={(start: Cell, end: Cell) => {
              if (gameOver) return;
              send({ type: 'select', payload: { start, end } });
            }}
          />
          {gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-marquinhos-bg/90">
              <div className="font-pixel text-lg text-marquinhos-accent">
                {gameOver.reason === 'completed' ? 'ALL WORDS FOUND' : "TIME'S UP"}
              </div>
            </div>
          )}
        </div>

        <div className="flex w-full max-w-[260px] flex-col gap-4">
          <div className="notch-6 flex flex-col gap-2 border border-marquinhos-border bg-marquinhos-panel p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim">
              Words
            </div>
            <div className="flex flex-wrap gap-1.5">
              {init.words.map((word) => {
                const foundEntry = found.find((f) => f.word === word);
                return (
                  <span
                    key={word}
                    className="rounded-md border px-2 py-1 text-xs uppercase"
                    style={
                      foundEntry
                        ? {
                            borderColor: colorForPlayer(foundEntry.userId, selfId),
                            color: colorForPlayer(foundEntry.userId, selfId),
                            textDecoration: 'line-through',
                            opacity: 0.7,
                          }
                        : { borderColor: 'var(--color-marquinhos-border)' }
                    }
                  >
                    {word}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="notch-6 flex flex-col gap-2 border border-marquinhos-border bg-marquinhos-panel p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim">
              Scores
            </div>
            {rankedScores.length === 0 && (
              <div className="text-xs text-marquinhos-text-dim">
                No words found yet.
              </div>
            )}
            {rankedScores.map(([userId, score]) => (
              <div
                key={userId}
                className="flex items-center justify-between text-sm"
                style={{ color: colorForPlayer(userId, selfId) }}
              >
                <span>{userId === selfId ? 'You' : userId}</span>
                <span>{score}</span>
              </div>
            ))}
          </div>

          {selectError && (
            <div className="notch-6 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-3 text-center text-sm text-marquinhos-danger">
              {selectError}
            </div>
          )}

          {(connectionState === 'disconnected' ||
            connectionState === 'error') && (
            <div className="notch-6 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-3 text-center text-sm text-marquinhos-danger">
              Connection lost. Reload to reconnect.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export function WordSearchRaceGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const session = useWordSearchRaceSession(identity, onAuthInvalid);

  if (session.status === 'connecting') {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[240px] w-full max-w-[520px] flex-col items-center justify-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel animate-pong-blink text-sm tracking-[0.28em] text-marquinhos-accent">
            STARTING GAME…
          </div>
          <div className="max-w-[36ch] text-sm leading-6 text-marquinhos-text-dim">
            Connecting to the realtime session and loading the puzzle.
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

  return <Board session={session.session} selfId={identity.userId} />;
}
