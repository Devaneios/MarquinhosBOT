import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { GameHeader } from '../components/game-shell';
import type { GameId } from '../games/gameId';
import { GAME_REGISTRY } from '../games/registry';
import { cn } from '../lib/cn';

const GAME_ACCENTS: Record<GameId, string> = {
  cards: 'var(--color-marquinhos-accent)',
  pong: 'var(--color-marquinhos-green)',
  wordle: 'var(--color-marquinhos-blue)',
  'tic-tac-toe': 'var(--color-marquinhos-accent)',
  'connect-four': 'var(--color-marquinhos-blue)',
  hangman: 'var(--color-marquinhos-green)',
  battleship: 'var(--color-marquinhos-blue)',
  checkers: 'var(--color-marquinhos-accent)',
  'rock-paper-scissors': 'var(--color-marquinhos-green)',
  'wordle-race': 'var(--color-marquinhos-blue)',
  'minesweeper-versus': 'var(--color-marquinhos-accent)',
  'trivia-quiz': 'var(--color-marquinhos-green)',
  'dominoes-block': 'var(--color-marquinhos-blue)',
  'word-search-race': 'var(--color-marquinhos-accent)',
  'bingo-speed': 'var(--color-marquinhos-green)',
  'tower-unstable': 'var(--color-marquinhos-blue)',
  'boggle-word-race': 'var(--color-marquinhos-accent)',
  'word-chain': 'var(--color-marquinhos-green)',
  'snake-game': 'var(--color-marquinhos-blue)',
};

export function Hub() {
  const navigate = useNavigate();
  const { t } = useTranslation(['common', 'games']);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,176,0,0.12),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_20%),var(--color-marquinhos-bg)] text-marquinhos-text">
      <GameHeader
        titleKey="brand"
        titleNs="common"
        right={
          <div className="hidden items-center gap-2 sm:flex">
            <div className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
              {t('common:ready')}
            </div>
            <div className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
              {t('common:roomsHint')}
            </div>
          </div>
        }
      />

      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-6">
        <section>
          <div className="notch-8 border border-marquinhos-border bg-marquinhos-panel p-6 shadow-[0_20px_40px_rgba(0,0,0,0.28)] sm:p-7">
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
              {GAME_REGISTRY.map((game) => {
                const locked = game.status !== 'PLAY';
                const accent = GAME_ACCENTS[game.id];
                return (
                  <button
                    key={game.id}
                    type="button"
                    disabled={locked}
                    style={{ borderColor: locked ? undefined : accent }}
                    className={cn(
                      'notch-8 relative flex aspect-[2/3] flex-col justify-end gap-2 border px-4 py-4 text-left shadow-[0_12px_24px_rgba(0,0,0,0.16)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent',
                      locked
                        ? 'cursor-not-allowed border-marquinhos-border bg-black/15 opacity-70'
                        : 'cursor-pointer bg-marquinhos-bg transition hover:-translate-y-0.5',
                    )}
                    onClick={() => {
                      if (locked) return;
                      navigate(`/games/${game.id}`);
                    }}
                  >
                    <div
                      className={cn(
                        'absolute left-4 top-4 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.2em]',
                        locked
                          ? 'border-marquinhos-border text-marquinhos-text-dim'
                          : 'border-marquinhos-green/40 text-marquinhos-green',
                      )}
                    >
                      {t(
                        game.status === 'PLAY'
                          ? 'common:play'
                          : 'common:comingSoon',
                      )}
                    </div>
                    <div
                      className="font-pixel text-sm leading-snug tracking-[0.16em]"
                      style={{ color: locked ? undefined : accent }}
                    >
                      {t(`games:${game.id}.name`)}
                    </div>
                    <div className="text-xs leading-5 text-marquinhos-text-dim">
                      {t(`games:${game.id}.blurb`)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
