import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ConnectingScreen,
  EndScreen,
  ErrorScreen,
  GameHeader,
} from '../../../components/game-shell';
import type { DiscordIdentity } from '../../../hooks/useDiscordIdentity';
import { colyseusUrl } from '../../../lib/apiBase';
import type { WsSession } from '../../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../../shared/useColyseusRoom';
import { useMinesweeperSession } from '../hooks/useMinesweeperSession';
import type {
  BoardSnapshot,
  GameOverPayload,
  RevealPayload,
} from '../protocol';
import { applyRevealToBoard } from '../utils';
import { MinesweeperCanvas } from './MinesweeperCanvas';

export function MinesweeperBoard({ session }: { session: WsSession }) {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
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
      <GameHeader
        titleKey="minesweeper-versus.name"
        titleNs="games"
        onBack={() => navigate('/')}
      />

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
            <div className="absolute inset-0">
              <EndScreen
                outcomeKey="boardCleared"
                outcomeNs="minesweeper-versus"
                onBackToHub={() => navigate('/')}
              />
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
            {t('connectionLost')}
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
      <ConnectingScreen
        subtitleKey="connectingSubtitle"
        subtitleNs="minesweeper-versus"
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

  return <MinesweeperBoard session={session.session} />;
}
