import { useTranslation } from 'react-i18next';
import { GameHeader } from '../components/game-shell';
import { GAME_REGISTRY } from '../games/registry';
import { FeaturedGame } from './FeaturedGame';
import { GameCard } from './GameCard';
import { HUB_GAME_IDS } from './hubGames';

export function Hub() {
  const { t } = useTranslation('common');
  const [featured, ...games] = HUB_GAME_IDS.flatMap((id) => {
    const game = GAME_REGISTRY.find((entry) => entry.id === id);
    return game?.status === 'PLAY' ? [game] : [];
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top_right,rgba(255,176,0,0.06),transparent_55%),var(--color-marquinhos-bg)] text-marquinhos-text">
      <GameHeader titleKey="brand" titleNs="common" />

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:py-10 [@media(max-height:600px)]:py-4">
        <div className="mx-auto flex w-full max-w-280 flex-col gap-6 md:gap-8 [@media(max-height:600px)]:gap-5">
          <div className="flex items-start gap-3 md:gap-4">
            <span
              aria-hidden="true"
              className="mt-1.5 h-6 w-1 shrink-0 bg-marquinhos-accent md:mt-2 md:h-7"
            />
            <h1 className="max-w-160 text-xl font-semibold leading-snug tracking-tight text-balance sm:text-2xl md:text-3xl">
              {t('hub.title')}
            </h1>
          </div>

          {featured && <FeaturedGame game={featured} />}

          {games.length > 0 && (
            <section
              aria-labelledby="hub-catalog-title"
              className="flex flex-col gap-4"
            >
              <div className="flex items-center gap-4">
                <h2
                  id="hub-catalog-title"
                  className="shrink-0 font-pixel text-xs leading-relaxed sm:text-sm"
                >
                  {t('hub.moreGames')}
                </h2>
                <div
                  aria-hidden="true"
                  className="h-px flex-1 bg-marquinhos-border"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {games.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
