import {
  ConnectingScreen,
  ErrorScreen,
  GameHeader,
  GameMenu,
} from '@/games/shared/shell';
import { colyseusUrl } from '@/platform/api/apiBase';
import type { DiscordIdentity } from '@/platform/discord/auth';
import type { ActivityMessage } from '@/platform/realtime/colyseus/connection';
import { useColyseusRoom } from '@/platform/realtime/colyseus/useColyseusRoom';
import {
  serverMessageSchema,
  type TicTacToeClientMessage,
} from '@marquinhos/contracts/activity/games/ticTacToe';
import { parseMessage } from '@marquinhos/contracts/activity/protocol';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TicTacToeCanvas } from './rendering/TicTacToeCanvas';
import {
  applyTicTacToeMessage,
  initialTicTacToeView,
} from './session/ticTacToeMessages';
import { useTicTacToeSession } from './session/useTicTacToeSession';

export function TicTacToeGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation(['tic-tac-toe', 'common']);
  const {
    state: sessionState,
    selectMode,
    backToMenu,
  } = useTicTacToeSession(identity, onAuthInvalid);

  const [view, setView] = useState(initialTicTacToeView);
  const { state: gameState, player, error } = view;

  const onMessage = useCallback((raw: ActivityMessage) => {
    const message = parseMessage(serverMessageSchema, raw);
    if (message) setView((current) => applyTicTacToeMessage(current, message));
  }, []);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(
      () => setView((current) => ({ ...current, error: '' })),
      3000,
    );
    return () => clearTimeout(timer);
  }, [error]);

  const { send: roomSend, connectionState } = useColyseusRoom(
    'tic-tac-toe',
    sessionState.status === 'ready' ? sessionState.session.session : null,
    colyseusUrl(),
    onMessage,
    (room) => {
      room.send('leave');
    },
  );

  function toMainMenu() {
    backToMenu();
    navigate('/games/tic-tac-toe', { replace: true });
  }

  if (sessionState.status === 'selecting-mode') {
    return (
      <GameMenu
        gameId="tic-tac-toe"
        onBack={() => navigate('/')}
        actions={[
          {
            key: 'single',
            labelKey: 'vsBot',
            labelNs: 'common',
            descriptionKey: 'vsBotDescription',
            onSelect: () => selectMode('single'),
          },
          {
            key: 'multi',
            labelKey: 'vsPlayer',
            labelNs: 'common',
            descriptionKey: 'vsPlayerDescription',
            onSelect: () => navigate('/rooms?create=tic-tac-toe'),
          },
        ]}
      />
    );
  }

  if (sessionState.status === 'connecting') {
    return (
      <ConnectingScreen
        subtitleKey="connectingSubtitle"
        subtitleNs="tic-tac-toe"
      />
    );
  }

  if (sessionState.status === 'error') {
    return (
      <ErrorScreen
        message={sessionState.error}
        onRetryAuth={onAuthInvalid}
        onBack={toMainMenu}
      />
    );
  }

  const isGameOver = gameState.winner !== null || gameState.isDraw;
  const isMyTurn = gameState.currentPlayer === player;
  const statusText = isGameOver
    ? gameState.winner
      ? gameState.winner === player
        ? t('tic-tac-toe:youWinBang')
        : t('tic-tac-toe:playerWins', { player: gameState.winner })
      : t('tic-tac-toe:draw')
    : t(isMyTurn ? 'tic-tac-toe:turnYour' : 'tic-tac-toe:turnOpponent', {
        player: gameState.currentPlayer,
      });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <GameHeader
        titleKey="tic-tac-toe.name"
        titleNs="games"
        onBack={toMainMenu}
        variant="minimal"
        right={
          <div className="text-sm font-semibold text-marquinhos-text">
            {statusText}
          </div>
        }
      />

      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        {error && (
          <div className="notch-4 border border-marquinhos-danger bg-marquinhos-danger/10 px-4 py-2 text-sm text-marquinhos-danger">
            {error}
          </div>
        )}

        {(connectionState === 'disconnected' ||
          connectionState === 'error') && (
          <div className="notch-4 border border-marquinhos-danger bg-marquinhos-danger/10 px-4 py-2 text-sm text-marquinhos-danger">
            {t('common:connectionLost')}
          </div>
        )}

        <div className="flex flex-1 items-center justify-center">
          <TicTacToeCanvas
            state={gameState}
            player={player}
            onMove={(row, col) => {
              roomSend({
                type: 'move',
                payload: { row, col },
              } satisfies TicTacToeClientMessage);
            }}
            gameOver={isGameOver}
          />
        </div>
      </main>
    </div>
  );
}
