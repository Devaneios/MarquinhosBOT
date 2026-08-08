import { useNavigate } from 'react-router-dom';
import type { GameId } from '../games/gameId';
import { GAME_REGISTRY } from '../games/registry';
import { cn } from '../lib/cn';

const GAME_BLURBS: Record<GameId, string> = {
  cards:
    'Local card table prototype — lobby, hand management, and endgame flow, not yet wired to a real multiplayer backend.',
  pong: 'Retro competitive arcade action with menu flow, settings, and local or online play.',
  wordle:
    'Solo word challenge connected to the realtime backend and Discord activity session.',
  'tic-tac-toe': 'Classic 3x3 grid duel — first to line up three wins.',
  'connect-four': 'Drop discs down a 7x6 grid and connect four before your opponent does.',
  hangman: 'Guess the hidden word letter by letter before you run out of strikes.',
  battleship: 'Place your fleet, then trade blind shots until every ship is sunk.',
  checkers: 'Diagonal moves, mandatory jumps, and king promotions on an 8x8 board.',
  'rock-paper-scissors': 'Simultaneous-reveal best-of-N showdown.',
  'wordle-race': 'Real-time multiplayer Wordle — same word, everyone racing to solve it first.',
  'minesweeper-versus': 'Shared minefield, real-time clicking — safe tiles score, mines cost you.',
  'trivia-quiz': 'Party trivia for up to 8 players with countdown timers and speed-based scoring.',
  'dominoes-block': 'Classic block dominoes — match tile ends and empty your hand first.',
  'word-search-race': 'Shared letter grid, hidden words — find them before anyone else does.',
  'bingo-speed': 'Numbers drawn every few seconds — first completed line wins.',
  'tower-unstable': 'Pull blocks from a wobbling tower without bringing it down on your turn.',
  'boggle-word-race': 'Trace adjacent letters to build words before the 3-minute timer runs out.',
  'word-chain': 'Name a word starting with the last letter of the previous one — 10 seconds per turn.',
  'snake-game': 'Grow your snake, dodge the walls and yourself, outlast your opponent.',
};

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

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,176,0,0.12),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_20%),var(--color-marquinhos-bg)] text-marquinhos-text">
      <header className="flex items-center justify-between gap-4 border-b border-marquinhos-border bg-black/10 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <div className="font-pixel text-sm tracking-[0.32em] text-marquinhos-accent sm:text-base">
            MARQUINHOS ARCADE
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <div className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
            Ready
          </div>
          <div className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
            2–4 player rooms
          </div>
        </div>
      </header>

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
                      {game.status}
                    </div>
                    <div
                      className="font-pixel text-sm leading-snug tracking-[0.16em]"
                      style={{ color: locked ? undefined : accent }}
                    >
                      {game.name}
                    </div>
                    <div className="text-xs leading-5 text-marquinhos-text-dim">
                      {GAME_BLURBS[game.id] ?? 'Game experience'}
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
