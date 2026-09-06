import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/cn';

interface WordChainBoardProps {
  currentTurn: string;
  players: { userId: string; alive: boolean }[];
  gameOver: boolean;
  winner: string | null;
  usedWords: string[];
}

export function WordChainBoard({
  currentTurn,
  players,
  gameOver,
  winner,
  usedWords,
}: WordChainBoardProps) {
  const { t } = useTranslation('word-chain');

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="notch-6 border border-marquinhos-border bg-marquinhos-panel p-4">
        <div className="text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
          {t('players')}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {players.map((player) => (
            <div
              key={player.userId}
              className={cn(
                'notch-4 flex items-center justify-between gap-3 border border-marquinhos-border bg-marquinhos-bg px-3 py-2',
                !player.alive && 'opacity-50',
              )}
            >
              <span className="text-sm text-marquinhos-text">
                {player.userId}
              </span>
              <span className="flex items-center gap-2 text-xs uppercase tracking-[0.18em]">
                {currentTurn === player.userId && !gameOver && (
                  <span className="text-marquinhos-accent">
                    {t('turnLabel')}
                  </span>
                )}
                <span
                  className={
                    player.alive
                      ? 'text-marquinhos-accent'
                      : 'text-marquinhos-danger'
                  }
                >
                  {player.alive ? '✓' : '✗'}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="notch-6 flex-1 border border-marquinhos-border bg-black/20 p-4">
        <div className="text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
          {t('usedWordsLabel')}
        </div>
        {usedWords.length === 0 ? (
          <div className="mt-3 text-sm text-marquinhos-text-disabled">
            {t('noWordsYet')}
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {usedWords.map((word, index) => (
              <span
                key={`${word}-${index}`}
                className="notch-4 border border-marquinhos-border bg-marquinhos-bg px-2 py-1 font-mono text-xs text-marquinhos-text-dim"
              >
                {word.toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>

      {gameOver && (
        <div className="notch-6 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-4 text-center">
          <div className="font-pixel text-sm tracking-[0.24em] text-marquinhos-danger">
            {t('gameOverTitle')}
          </div>
          {winner && (
            <div className="mt-2 text-sm text-marquinhos-accent">
              {t('playerWon', { player: winner })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
