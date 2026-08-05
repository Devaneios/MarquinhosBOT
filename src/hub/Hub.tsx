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
          <div className="mt-1 text-sm text-marquinhos-text-dim">
            A polished activity hub for Discord multiplayer and solo games.
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
        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="notch-8 border border-marquinhos-border bg-marquinhos-panel p-6 shadow-[0_20px_40px_rgba(0,0,0,0.28)] sm:p-7">
            <div className="flex h-full flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-marquinhos-border bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-marquinhos-text-dim">
                  Activity library
                </div>
                <div className="space-y-3">
                  <h1 className="font-pixel text-3xl leading-tight tracking-[0.28em] text-marquinhos-accent sm:text-4xl">
                    SELECT AN ARCADE GAME
                  </h1>
                  <p className="max-w-[60ch] text-sm leading-6 text-marquinhos-text-dim sm:text-base">
                    The app now follows a single visual language: framed panels,
                    notched buttons, highlighted accents, and clear room/game
                    states for both multiplayer and solo experiences.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="notch-6 border border-marquinhos-border bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                      Multiplayer
                    </div>
                    <div className="mt-1 text-lg font-semibold">Rooms</div>
                  </div>
                  <div className="notch-6 border border-marquinhos-border bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                      Retro UI
                    </div>
                    <div className="mt-1 text-lg font-semibold">Panels</div>
                  </div>
                  <div className="notch-6 border border-marquinhos-border bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                      Discord
                    </div>
                    <div className="mt-1 text-lg font-semibold">Activity</div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {GAME_REGISTRY.map((game) => {
                  const locked = game.status !== 'PLAY';
                  return (
                    <button
                      key={game.id}
                      type="button"
                      disabled={locked}
                      className={cn(
                        'notch-8 flex flex-col gap-4 border px-5 py-5 text-left shadow-[0_12px_24px_rgba(0,0,0,0.16)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent',
                        locked
                          ? 'cursor-not-allowed border-marquinhos-border bg-black/15 opacity-70'
                          : 'cursor-pointer border-marquinhos-border bg-marquinhos-bg transition hover:border-marquinhos-border-hover hover:-translate-y-0.5',
                      )}
                      onClick={() => {
                        if (locked) return;
                        navigate(`/games/${game.id}`);
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-pixel text-sm tracking-[0.22em] text-marquinhos-accent">
                            {game.name}
                          </div>
                          <div className="mt-1 text-sm text-marquinhos-text-dim">
                            {GAME_BLURBS[game.id] ?? 'Game experience'}
                          </div>
                        </div>
                        <div
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.2em]',
                            locked
                              ? 'border-marquinhos-border text-marquinhos-text-dim'
                              : 'border-marquinhos-green/40 text-marquinhos-green',
                          )}
                        >
                          {game.status}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                        <span>{game.id}</span>
                        <span>{locked ? 'Unavailable' : 'Launch'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="notch-8 border border-marquinhos-border bg-marquinhos-panel p-5 shadow-[0_20px_40px_rgba(0,0,0,0.24)] sm:p-6">
            <div className="space-y-4">
              <div>
                <div className="font-pixel text-sm tracking-[0.22em] text-marquinhos-text">
                  WHAT CHANGED
                </div>
                <p className="mt-2 text-sm leading-6 text-marquinhos-text-dim">
                  The rest of the app now uses the same framed, notched,
                  high-contrast presentation introduced by the card game screen.
                </p>
              </div>

              <div className="grid gap-3">
                <div className="notch-6 border border-marquinhos-border bg-black/20 p-4">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                    Layout
                  </div>
                  <div className="mt-1 text-sm font-semibold">
                    Consistent shell
                  </div>
                  <div className="mt-2 text-sm leading-6 text-marquinhos-text-dim">
                    Same page framing, spacing, and visual hierarchy across the
                    hub and game menus.
                  </div>
                </div>
                <div className="notch-6 border border-marquinhos-border bg-black/20 p-4">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                    Buttons
                  </div>
                  <div className="mt-1 text-sm font-semibold">
                    Notched controls
                  </div>
                  <div className="mt-2 text-sm leading-6 text-marquinhos-text-dim">
                    Primary and secondary actions now feel like they belong to
                    the same product.
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
