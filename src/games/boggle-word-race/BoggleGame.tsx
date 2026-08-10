import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { GameId } from '../gameId';
import { fetchWsSessionToken, type WsSession } from '../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../shared/useColyseusRoom';
import { BoggleBoard } from './BoggleBoard';
import {
  type Cell,
  type GameOverPayload,
  type InitPayload,
  type SubmitErrorPayload,
  type WordAcceptedPayload,
} from './boggleProtocol';

// gameId.ts (a shared registry file) hasn't been wired up for this game yet
// — see the shared brief's "hard constraints". Casting the id locally here
// is the documented way to plug in without touching that file.
const GAME_ID = 'boggle-word-race' as GameId;

type BoggleSessionState =
  | { status: 'connecting' }
  | { status: 'ready'; session: WsSession }
  | { status: 'error'; error: string };

interface ScoreEntry {
  score: number;
  wordCount: number;
}

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function BoggleGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const [session, setSession] = useState<BoggleSessionState>({
    status: 'connecting',
  });
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    fetchWsSessionToken({ game: GAME_ID, mode: 'multi', identity })
      .then((s) => {
        if (cancelledRef.current) return;
        setSession({ status: 'ready', session: s });
      })
      .catch((err) => {
        if (cancelledRef.current) return;
        if (isAuthError(err)) {
          onAuthInvalid();
          return;
        }
        setSession({ status: 'error', error: errorMessage(err) });
      });
    return () => {
      cancelledRef.current = true;
    };
  }, [identity, onAuthInvalid]);

  if (session.status === 'connecting') {
    return (
      <ConnectingScreen
        subtitleKey="connectingSubtitle"
        subtitleNs="boggle-word-race"
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
    <BoggleBoardScreen
      session={session.session}
      selfUserId={identity.userId}
      onExit={() => navigate('/')}
    />
  );
}

function BoggleBoardScreen({
  session,
  selfUserId,
  onExit,
}: {
  session: WsSession;
  selfUserId: string;
  onExit: () => void;
}) {
  const { t } = useTranslation(['boggle-word-race', 'common']);
  const [grid, setGrid] = useState<string[][] | null>(null);
  const [scores, setScores] = useState<Map<string, ScoreEntry>>(new Map());
  const [myWords, setMyWords] = useState<string[]>([]);
  const [lastError, setLastError] = useState<SubmitErrorPayload['reason'] | null>(
    null,
  );
  const [timeRemainingMs, setTimeRemainingMs] = useState<number | null>(null);
  const [finalResults, setFinalResults] = useState<
    GameOverPayload['results'] | null
  >(null);
  const deadlineRef = useRef<number | null>(null);
  const messageHandlerRef = useRef<(message: ActivityMessage) => void>(
    () => {},
  );

  const { send, connectionState } = useColyseusRoom(
    GAME_ID,
    session,
    colyseusUrl(),
    (message) => messageHandlerRef.current(message),
  );

  useEffect(() => {
    messageHandlerRef.current = (message) => {
      if (message.type === 'init') {
        const payload = message.payload as InitPayload;
        setGrid(payload.state.grid);
        deadlineRef.current = Date.now() + payload.state.timeRemainingMs;
        setTimeRemainingMs(payload.state.timeRemainingMs);
        setScores(
          new Map(
            payload.state.players.map((p) => [
              p.userId,
              { score: p.score, wordCount: p.wordCount },
            ]),
          ),
        );
      } else if (message.type === 'word_accepted') {
        const payload = message.payload as WordAcceptedPayload;
        setScores((prev) => {
          const next = new Map(prev);
          const existing = next.get(payload.userId) ?? {
            score: 0,
            wordCount: 0,
          };
          next.set(payload.userId, {
            score: payload.totalScore,
            wordCount: existing.wordCount + 1,
          });
          return next;
        });
        if (payload.userId === selfUserId) {
          setMyWords((prev) => [...prev, payload.word]);
          setLastError(null);
        }
      } else if (message.type === 'submit_error') {
        const payload = message.payload as SubmitErrorPayload;
        setLastError(payload.reason);
      } else if (message.type === 'game_over') {
        const payload = message.payload as GameOverPayload;
        setFinalResults(payload.results);
        setTimeRemainingMs(0);
      }
    };
    return () => {
      messageHandlerRef.current = () => {};
    };
  }, [selfUserId]);

  useEffect(() => {
    if (finalResults) return;
    const interval = setInterval(() => {
      if (deadlineRef.current === null) return;
      setTimeRemainingMs(Math.max(0, deadlineRef.current - Date.now()));
    }, 250);
    return () => clearInterval(interval);
  }, [finalResults]);

  const scoreboard = useMemo(
    () =>
      Array.from(scores.entries())
        .map(([userId, entry]) => ({ userId, ...entry }))
        .sort((a, b) => b.score - a.score),
    [scores],
  );

  const gameEnded = finalResults !== null || timeRemainingMs === 0;

  function handleSubmit(path: Cell[]) {
    send({ type: 'submit_word', payload: { path } });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <GameHeader
        titleKey="boggle-word-race.name"
        titleNs="games"
        onBack={onExit}
        right={
          <div className="font-pixel text-2xl text-marquinhos-text">
            {timeRemainingMs !== null ? formatClock(timeRemainingMs) : '03:00'}
          </div>
        }
      />

      <div className="box-border flex flex-1 flex-col items-stretch justify-start gap-4 px-10 py-6">
        {(connectionState === 'disconnected' || connectionState === 'error') && (
          <div className="font-pixel text-center text-[11px] text-marquinhos-danger">
            {t('common:connectionLost')}
          </div>
        )}

        <div className="flex flex-1 items-start justify-center gap-8">
          <div className="flex flex-col items-center gap-3">
            {grid ? (
              <BoggleBoard
                grid={grid}
                disabled={gameEnded}
                onSubmit={handleSubmit}
              />
            ) : (
              <div className="font-pixel animate-pong-blink text-sm text-marquinhos-text">
                {t('boggle-word-race:loadingBoard')}
              </div>
            )}
            <div className="font-mono h-5 text-xs text-marquinhos-danger">
              {lastError ? t(`boggle-word-race:submitError.${lastError}`) : ''}
            </div>
            <div className="flex max-w-[360px] flex-wrap gap-2">
              {myWords.map((word, i) => (
                <span
                  key={`${word}-${i}`}
                  className="notch-3 border border-marquinhos-border bg-marquinhos-panel px-2 py-1 font-mono text-xs text-marquinhos-text"
                >
                  {word.toUpperCase()}
                </span>
              ))}
            </div>
          </div>

          <div className="flex w-[220px] flex-col gap-2">
            <div className="font-pixel text-xs text-marquinhos-accent">
              {t('boggle-word-race:scoreboard')}
            </div>
            {scoreboard.map((entry) => (
              <div
                key={entry.userId}
                className="flex items-center justify-between border border-marquinhos-border bg-marquinhos-panel px-3 py-2 font-mono text-xs text-marquinhos-text"
              >
                <span>
                  {entry.userId === selfUserId
                    ? t('common:you')
                    : t('boggle-word-race:playerLabel', {
                        id: entry.userId.slice(-4),
                      })}
                </span>
                <span className="text-marquinhos-accent">{entry.score}</span>
              </div>
            ))}
          </div>
        </div>

        {finalResults && (
          <div className="animate-pong-game-over-in absolute inset-0 flex flex-col items-center justify-center gap-6 bg-marquinhos-bg/90">
            <div className="font-pixel text-2xl text-marquinhos-text">
              {t('boggle-word-race:timesUp')}
            </div>
            <div className="flex flex-col gap-2">
              {finalResults.map((r, i) => (
                <div
                  key={r.userId}
                  className="font-mono flex w-[280px] items-center justify-between border border-marquinhos-border bg-marquinhos-panel px-4 py-2 text-sm text-marquinhos-text"
                >
                  <span>
                    #{i + 1}{' '}
                    {r.userId === selfUserId
                      ? t('common:you')
                      : t('boggle-word-race:playerLabel', {
                          id: r.userId.slice(-4),
                        })}
                  </span>
                  <span className="text-marquinhos-accent">{r.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
