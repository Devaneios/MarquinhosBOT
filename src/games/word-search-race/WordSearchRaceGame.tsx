import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ConnectingScreen,
  ErrorScreen,
  GameHeader,
} from '../../components/game-shell';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { colyseusUrl } from '../../lib/apiBase';
import { errorMessage, isAuthError } from '../../lib/http';
import { fetchWsSessionToken, type WsSession } from '../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../shared/useColyseusRoom';
import type { Cell, FoundWord } from './components/WordSearchRaceCanvas';
import {
  colorForPlayer,
  WordSearchRaceCanvas,
} from './components/WordSearchRaceCanvas';

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
  const { t } = useTranslation(['word-search-race', 'common']);
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
      <ConnectingScreen
        subtitleKey="loadingPuzzle"
        subtitleNs="word-search-race"
      />
    );
  }

  const remainingMs = init.deadline - now;
  const rankedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-marquinhos-bg">
      <GameHeader
        titleKey="word-search-race.name"
        titleNs="games"
        onBack={() => navigate('/')}
        right={
          <div className="font-pixel text-sm text-marquinhos-accent">
            {gameOver ? '00:00' : formatRemaining(remainingMs)}
          </div>
        }
      />

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
                {gameOver.reason === 'completed'
                  ? t('word-search-race:allWordsFound')
                  : t('word-search-race:timesUp')}
              </div>
            </div>
          )}
        </div>

        <div className="flex w-full max-w-[260px] flex-col gap-4">
          <div className="notch-6 flex flex-col gap-2 border border-marquinhos-border bg-marquinhos-panel p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim">
              {t('word-search-race:words')}
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
                            borderColor: colorForPlayer(
                              foundEntry.userId,
                              selfId,
                            ),
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
              {t('word-search-race:scores')}
            </div>
            {rankedScores.length === 0 && (
              <div className="text-xs text-marquinhos-text-dim">
                {t('word-search-race:noWordsFound')}
              </div>
            )}
            {rankedScores.map(([userId, score]) => (
              <div
                key={userId}
                className="flex items-center justify-between text-sm"
                style={{ color: colorForPlayer(userId, selfId) }}
              >
                <span>{userId === selfId ? t('common:you') : userId}</span>
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
              {t('common:connectionLost')}
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
      <ConnectingScreen
        subtitleKey="connectingSubtitle"
        subtitleNs="word-search-race"
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

  return <Board session={session.session} selfId={identity.userId} />;
}
