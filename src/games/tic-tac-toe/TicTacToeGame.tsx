import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ConnectingScreen,
  ErrorScreen,
  GameHeader,
  ModeSelectScreen,
} from '../../components/game-shell';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { colyseusUrl } from '../../lib/apiBase';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../shared/useColyseusRoom';
import { TicTacToeCanvas } from './components/TicTacToeCanvas';
import type { TicTacToeState } from './hooks/useTicTacToeSession';
import { useTicTacToeSession } from './hooks/useTicTacToeSession';

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

  const [gameState, setGameState] = useState<TicTacToeState>({
    board: [
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ],
    currentPlayer: 'X',
    winner: null,
    isDraw: false,
    moveCount: 0,
  });

  const [player, setPlayer] = useState<string>('X');
  const [error, setError] = useState<string>('');

  const onMessage = useCallback((message: ActivityMessage) => {
    if (message.type === 'init') {
      const payload = message.payload as {
        player: string;
        state: TicTacToeState;
      };
      setPlayer(payload.player);
      setGameState(payload.state);
    } else if (message.type === 'state_update') {
      const payload = message.payload as {
        board: (string | null)[][];
        currentPlayer: string;
        winner: string | null;
        isDraw: boolean;
        moveCount: number;
      };
      setGameState(payload);
    } else if (message.type === 'move_error') {
      const payload = message.payload as { error: string };
      setError(payload.error);
      setTimeout(() => setError(''), 3000);
    }
  }, []);

  const { send: roomSend, connectionState } = useColyseusRoom(
    'tic-tac-toe',
    sessionState.status === 'ready' ? sessionState.session.session : null,
    colyseusUrl(),
    onMessage,
    (room) => {
      room.send('leave', {});
    },
  );

  function toMainMenu() {
    backToMenu();
    navigate('/games/tic-tac-toe', { replace: true });
  }

  if (sessionState.status === 'selecting-mode') {
    return (
      <ModeSelectScreen
        onBack={() => navigate('/')}
        options={[
          {
            key: 'single',
            labelKey: 'vsBot',
            labelNs: 'common',
            onSelect: () => selectMode('single'),
          },
          {
            key: 'multi',
            labelKey: 'vsPlayer',
            labelNs: 'common',
            onSelect: () => selectMode('multi'),
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
              roomSend({ type: 'move', payload: { row, col } });
            }}
            gameOver={isGameOver}
          />
        </div>
      </main>
    </div>
  );
}
