import { MenuPanel, MenuScreen } from '@/games/shared/shell';
import type { WordleAchievementStatus } from '@marquinhos/contracts/wordle';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WordleAlbumPage } from '../api/wordleAlbumApi';
import type { WordleBingoCard } from '../api/wordleBingoApi';
import type { WordleChallenge } from '../api/wordleChallengesApi';
import type { WordleGoal } from '../api/wordleGoalsApi';
import { WordleBingoPanel } from './WordleBingoPanel';
import { WordleChallengesPanel } from './WordleChallengesPanel';
import { WordleGoalsPanel } from './WordleGoalsPanel';

export function WordleAlbumScreen({
  load,
  onBack,
  goals,
  challenges,
  bingo,
}: {
  load: () => Promise<WordleAlbumPage[]>;
  onBack: () => void;
  goals?: { load: () => Promise<WordleGoal[]>; userId: string };
  challenges?: {
    achievements: WordleAchievementStatus[];
    load: () => Promise<WordleChallenge[]>;
    create: (pattern: string, closesAt: number) => Promise<WordleChallenge>;
    join: (id: string) => Promise<void>;
  };
  bingo?: () => Promise<WordleBingoCard[]>;
}) {
  const { t } = useTranslation('wordle');
  const [pages, setPages] = useState<WordleAlbumPage[] | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setError(false);
    load().then(
      (result) => {
        if (active) setPages(result);
      },
      () => {
        if (active) setError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [load, retry]);
  const selected = pages?.find((page) => page.patternId === selectedId);
  const families = useMemo(
    () => [...new Set((pages ?? []).map((page) => page.family))],
    [pages],
  );
  return (
    <MenuScreen
      titleKey="wordle.name"
      titleNs="games"
      headingKey="albumTitle"
      headingNs="wordle"
      onBack={onBack}
    >
      <p className="text-sm text-marquinhos-text-dim">
        {t('albumDescription')}
      </p>
      {goals && <WordleGoalsPanel {...goals} />}
      {challenges && <WordleChallengesPanel {...challenges} />}
      {bingo && <WordleBingoPanel load={bingo} />}
      {error ? (
        <div role="alert">
          {t('albumError')}{' '}
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            {t('showcaseRetry')}
          </button>
        </div>
      ) : !pages ? (
        <p role="status">{t('albumLoading')}</p>
      ) : (
        <MenuPanel className="max-w-2xl p-4">
          <p>
            {t('albumProgress', {
              found: pages.filter((page) => page.contributorCount > 0).length,
              total: pages.length,
            })}
          </p>
          {pages.length === 0 && <p>{t('albumEmpty')}</p>}
          {families.map((family) => (
            <section key={family} className="mt-4">
              <h2 className="font-semibold">
                {t(`families.${family}`, { defaultValue: family })}
              </h2>
              {pages.find((page) => page.family === family)
                ?.familyMilestone && (
                <p className="text-sm text-marquinhos-text-dim">
                  {t(
                    pages.find((page) => page.family === family)
                      ?.familyMilestone?.status === 'completed'
                      ? 'albumMilestoneCompleted'
                      : 'albumMilestoneRevised',
                  )}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {pages
                  .filter((page) => page.family === family)
                  .map((page) => (
                    <button
                      key={page.patternId}
                      type="button"
                      className="border border-marquinhos-border px-2 py-1"
                      onClick={() => setSelectedId(page.patternId)}
                    >
                      {page.icon} {page.name}{' '}
                      {page.contributorCount > 0 ? '✓' : '○'}
                    </button>
                  ))}
              </div>
            </section>
          ))}
          {selected && (
            <section
              className="mt-4 border border-marquinhos-border p-3"
              aria-label={selected.name}
            >
              <h2 className="font-semibold">
                {selected.icon} {selected.name}
              </h2>
              <div
                role="img"
                aria-label={selected.name}
                className="my-3 grid w-fit gap-1"
                style={{
                  gridTemplateColumns: `repeat(${selected.mask[0]?.length ?? 1}, 1.25rem)`,
                }}
              >
                {selected.mask.flatMap((row, y) =>
                  [...row].map((cell, x) => (
                    <span
                      key={`${y}-${x}`}
                      aria-hidden="true"
                      className={`h-5 w-5 border ${cell === '#' ? 'border-white/30 bg-[#538d4e]' : 'border-dashed border-white/20'}`}
                    />
                  )),
                )}
              </div>
              <p>
                {t('albumContributors', { count: selected.contributorCount })}
              </p>
              {selected.firstContribution ? (
                <p>
                  {t('albumFirst', { user: selected.firstContribution.userId })}
                </p>
              ) : (
                <p>{t('albumAvailable')}</p>
              )}
              {selected.contributors.length > 0 && (
                <p>
                  {t('albumContributorList', {
                    users: selected.contributors.join(', '),
                  })}
                </p>
              )}
            </section>
          )}
        </MenuPanel>
      )}
    </MenuScreen>
  );
}
