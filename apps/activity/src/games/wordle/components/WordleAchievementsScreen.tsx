import { MenuPanel, MenuScreen } from '@/games/shared/shell';
import type {
  WordleAchievementStatus,
  WordlePlayerStats,
} from '@marquinhos/contracts/wordle';
import { WORDLE_ACHIEVEMENT_FAMILIES } from '@marquinhos/domain/games/wordle/achievements/families';
import { useEffect, useMemo, useState, ViewTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { WordlePatternDisplay } from './WordlePatternDisplay';

const RARITY_CLASSES: Record<WordleAchievementStatus['rarity'], string> = {
  common: 'border-marquinhos-border bg-white/8 text-marquinhos-text-dim',
  rare: 'border-marquinhos-blue/45 bg-marquinhos-blue/15 text-marquinhos-blue',
  epic: 'border-marquinhos-danger/45 bg-marquinhos-danger/15 text-marquinhos-danger',
  legendary:
    'border-marquinhos-accent/50 bg-marquinhos-accent/15 text-marquinhos-accent',
};

const FAMILY_ORDER: readonly string[] = [
  ...WORDLE_ACHIEVEMENT_FAMILIES,
  'wordle',
];

const DEFAULT_STATS: WordlePlayerStats = {
  played: 0,
  wins: 0,
  winRate: 0,
  currentStreak: 0,
  bestStreak: 0,
  distribution: [0, 0, 0, 0, 0, 0, 0],
};

type AchievementFilter = 'all' | 'unlocked' | 'locked';

function formatHoldersPercent(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatUnlockedDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function WordleAchievementsScreen({
  achievements,
  stats = null,
  onBack,
}: {
  achievements: WordleAchievementStatus[];
  stats?: WordlePlayerStats | null;
  onBack: () => void;
}) {
  const { t } = useTranslation(['wordle', 'common']);
  const [filter, setFilter] = useState<AchievementFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const resolvedStats = stats ?? DEFAULT_STATS;
  const maxDistribution = Math.max(1, ...resolvedStats.distribution);
  const unlockedCount = achievements.filter(
    (item) => item.unlockedAt !== null,
  ).length;

  const filteredAchievements = useMemo(() => {
    return achievements.filter((item) => {
      if (filter === 'unlocked') return item.unlockedAt !== null;
      if (filter === 'locked') return item.unlockedAt === null;
      return true;
    });
  }, [achievements, filter]);

  const allByFamily = useMemo(() => {
    const map = new Map<string, WordleAchievementStatus[]>();
    for (const item of achievements) {
      const family = item.family || 'wordle';
      const list = map.get(family) ?? [];
      list.push(item);
      map.set(family, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) => (a.tier ?? 1) - (b.tier ?? 1) || a.id.localeCompare(b.id),
      );
    }
    return map;
  }, [achievements]);

  const groupedFamilies = useMemo(() => {
    const map = new Map<string, WordleAchievementStatus[]>();
    for (const item of filteredAchievements) {
      const family = item.family || 'wordle';
      const list = map.get(family) ?? [];
      list.push(item);
      map.set(family, list);
    }
    const keys = [...map.keys()].sort((a, b) => {
      const idxA = FAMILY_ORDER.indexOf(a);
      const idxB = FAMILY_ORDER.indexOf(b);
      const rankA = idxA === -1 ? FAMILY_ORDER.length : idxA;
      const rankB = idxB === -1 ? FAMILY_ORDER.length : idxB;
      return rankA - rankB || a.localeCompare(b);
    });
    return keys.map((family) => {
      const items = [...(map.get(family) ?? [])].sort(
        (a, b) => (a.tier ?? 1) - (b.tier ?? 1) || a.id.localeCompare(b.id),
      );
      const fullFamily = allByFamily.get(family) ?? items;
      return {
        family,
        items,
        fullFamily,
        unlockedInFamily: fullFamily.filter((item) => item.unlockedAt !== null)
          .length,
      };
    });
  }, [allByFamily, filteredAchievements]);

  const selectedAchievement = useMemo(
    () => achievements.find((item) => item.id === selectedId) ?? null,
    [achievements, selectedId],
  );

  useEffect(() => {
    if (!selectedAchievement) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedId(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedAchievement]);

  const distributionBuckets = [
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    t('wordle:distributionBucket7Plus'),
  ];

  return (
    <MenuScreen
      titleKey="wordle.name"
      titleNs="games"
      headingKey="achievementsTitle"
      headingNs="wordle"
      onBack={onBack}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-6 text-marquinhos-text-dim">
          {t('wordle:achievementsSubtitle')}
        </p>
        {achievements.length > 0 && (
          <div className="notch-4 border border-marquinhos-border bg-white/5 px-3 py-1 text-xs font-semibold tracking-wider text-marquinhos-accent">
            {t('wordle:achievementsProgress', {
              unlocked: unlockedCount,
              total: achievements.length,
            })}
          </div>
        )}
      </div>

      <ViewTransition name="game-panel">
        <div className="flex flex-col gap-4">
          <MenuPanel className="max-w-2xl p-4 sm:p-5">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <div
                  data-stat="played"
                  className="notch-4 flex flex-col items-center border border-marquinhos-border bg-black/25 px-2.5 py-2 text-center"
                >
                  <span className="font-pixel text-sm text-marquinhos-text">
                    {resolvedStats.played}
                  </span>
                  <span className="mt-1 text-[10px] uppercase tracking-wider text-marquinhos-text-dim">
                    {t('wordle:statsPlayed')}
                  </span>
                </div>
                <div
                  data-stat="wins"
                  className="notch-4 flex flex-col items-center border border-marquinhos-border bg-black/25 px-2.5 py-2 text-center"
                >
                  <span className="font-pixel text-sm text-marquinhos-text">
                    {resolvedStats.wins}
                  </span>
                  <span className="mt-1 text-[10px] uppercase tracking-wider text-marquinhos-text-dim">
                    {t('wordle:statsWins')}
                  </span>
                </div>
                <div
                  data-stat="winRate"
                  className="notch-4 flex flex-col items-center border border-marquinhos-border bg-black/25 px-2.5 py-2 text-center"
                >
                  <span className="font-pixel text-sm text-marquinhos-accent">
                    {resolvedStats.winRate}%
                  </span>
                  <span className="mt-1 text-[10px] uppercase tracking-wider text-marquinhos-text-dim">
                    {t('wordle:statsWinRate')}
                  </span>
                </div>
                <div
                  data-stat="currentStreak"
                  className="notch-4 flex flex-col items-center border border-marquinhos-border bg-black/25 px-2.5 py-2 text-center"
                >
                  <span className="font-pixel text-sm text-marquinhos-green">
                    {resolvedStats.currentStreak}
                  </span>
                  <span className="mt-1 text-[10px] uppercase tracking-wider text-marquinhos-text-dim">
                    {t('wordle:statsCurrentStreak')}
                  </span>
                </div>
                <div
                  data-stat="bestStreak"
                  className="notch-4 col-span-2 flex flex-col items-center border border-marquinhos-border bg-black/25 px-2.5 py-2 text-center sm:col-span-1"
                >
                  <span className="font-pixel text-sm text-marquinhos-blue">
                    {resolvedStats.bestStreak}
                  </span>
                  <span className="mt-1 text-[10px] uppercase tracking-wider text-marquinhos-text-dim">
                    {t('wordle:statsBestStreak')}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-marquinhos-text-dim">
                  {t('wordle:distributionTitle')}
                </span>
                <div className="flex flex-col gap-1">
                  {distributionBuckets.map((bucketLabel, index) => {
                    const count = resolvedStats.distribution[index] ?? 0;
                    const widthPercent =
                      count > 0
                        ? Math.max(
                            8,
                            Math.round((count / maxDistribution) * 100),
                          )
                        : 0;
                    return (
                      <div
                        key={bucketLabel}
                        data-distribution-bucket={bucketLabel}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="w-6 shrink-0 text-right font-mono text-marquinhos-text-dim">
                          {bucketLabel}
                        </span>
                        <div className="h-4 flex-1 overflow-hidden rounded bg-black/35">
                          <div
                            className="h-full rounded bg-marquinhos-accent/70 transition-all"
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                        <span className="w-7 shrink-0 text-right font-mono text-marquinhos-text">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </MenuPanel>

          <MenuPanel className="max-w-2xl p-5 sm:p-6">
            {achievements.length === 0 ? (
              <p className="py-6 text-center text-sm text-marquinhos-text-dim">
                {t('wordle:achievementsEmpty')}
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <div
                  role="group"
                  aria-label={t('wordle:achievementsTitle')}
                  className="flex flex-wrap gap-2"
                >
                  {(
                    [
                      ['all', t('wordle:filterAll')],
                      ['unlocked', t('wordle:filterUnlocked')],
                      ['locked', t('wordle:filterLocked')],
                    ] as const
                  ).map(([key, label]) => {
                    const active = filter === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setFilter(key)}
                        className={`notch-4 border px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors ${
                          active
                            ? 'border-marquinhos-accent bg-marquinhos-accent/20 text-marquinhos-accent'
                            : 'border-marquinhos-border bg-black/25 text-marquinhos-text-dim hover:text-marquinhos-text'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {groupedFamilies.length === 0 ? (
                  <p className="py-6 text-center text-sm text-marquinhos-text-dim">
                    {t('wordle:achievementsFilterEmpty')}
                  </p>
                ) : (
                  <div className="flex flex-col gap-5">
                    {groupedFamilies.map(
                      ({ family, items, fullFamily, unlockedInFamily }) => (
                        <section
                          key={family}
                          data-family={family}
                          className="flex flex-col gap-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-marquinhos-border/60 pb-2">
                            <div className="flex items-center gap-2">
                              <h3 className="font-pixel text-xs uppercase tracking-wider text-marquinhos-text">
                                {t(`wordle:families.${family}`, {
                                  defaultValue: family,
                                })}
                              </h3>
                              <span className="rounded border border-marquinhos-border bg-black/30 px-2 py-0.5 text-[10px] font-bold text-marquinhos-text-dim">
                                {t('wordle:familyProgress', {
                                  unlocked: unlockedInFamily,
                                  total: fullFamily.length,
                                })}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {fullFamily.map((rung) => {
                                const rungUnlocked = rung.unlockedAt !== null;
                                const rungTier = rung.tier ?? 1;
                                return (
                                  <span
                                    key={rung.id}
                                    data-tier-rung={rungTier}
                                    data-unlocked={
                                      rungUnlocked ? 'true' : 'false'
                                    }
                                    className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                                      rungUnlocked
                                        ? 'border-marquinhos-green/50 bg-marquinhos-green/15 text-marquinhos-green'
                                        : 'border-marquinhos-border/60 bg-black/30 text-marquinhos-text-dim'
                                    }`}
                                  >
                                    {t('wordle:tierShort', { tier: rungTier })}
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          <ul className="flex flex-col gap-3">
                            {items.map((achievement) => {
                              const isUnlocked =
                                achievement.unlockedAt !== null;
                              const hidden = achievement.hidden ?? false;
                              const tier = achievement.tier ?? 1;
                              const progress = achievement.progress ?? null;
                              const holdersPercent =
                                achievement.holdersPercent ?? null;
                              const isSecretMasked = hidden && !isUnlocked;
                              const displayIcon = isSecretMasked
                                ? '❔'
                                : achievement.icon;
                              const displayName = isSecretMasked
                                ? t('wordle:secretAchievementTitle')
                                : achievement.name;
                              const displayDescription = isSecretMasked
                                ? t('wordle:secretAchievementDescription')
                                : achievement.description;
                              const progressPercent =
                                progress && progress.target > 0
                                  ? Math.min(
                                      100,
                                      Math.round(
                                        (progress.current / progress.target) *
                                          100,
                                      ),
                                    )
                                  : 0;

                              return (
                                <li
                                  key={achievement.id}
                                  data-unlocked={isUnlocked ? 'true' : 'false'}
                                  data-hidden={hidden ? 'true' : 'false'}
                                  className={`notch-6 border transition-opacity ${
                                    isUnlocked
                                      ? 'border-marquinhos-border bg-white/8'
                                      : 'border-marquinhos-border/60 bg-black/20 opacity-75'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedId(achievement.id)
                                    }
                                    className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left"
                                  >
                                    <div className="flex min-w-0 flex-1 items-start gap-3">
                                      <span
                                        aria-hidden="true"
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-marquinhos-border bg-black/30 text-xl"
                                      >
                                        {displayIcon}
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="font-pixel text-sm text-marquinhos-text">
                                            {displayName}
                                          </span>
                                          <span className="rounded border border-marquinhos-border bg-black/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-marquinhos-text-dim">
                                            {t('wordle:tierLabel', { tier })}
                                          </span>
                                          <span
                                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${RARITY_CLASSES[achievement.rarity]}`}
                                          >
                                            {t(
                                              `wordle:rarity.${achievement.rarity}`,
                                            )}
                                          </span>
                                          {hidden && (
                                            <span className="rounded-full border border-marquinhos-accent/40 bg-marquinhos-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-marquinhos-accent">
                                              {t('wordle:secretBadge')}
                                            </span>
                                          )}
                                        </div>
                                        <p className="mt-1 text-sm leading-5 text-marquinhos-text-dim">
                                          {displayDescription}
                                        </p>

                                        {!isSecretMasked &&
                                          !isUnlocked &&
                                          progress !== null && (
                                            <div className="mt-2 flex items-center gap-2">
                                              <div
                                                role="progressbar"
                                                aria-label={displayName}
                                                aria-valuenow={progress.current}
                                                aria-valuemin={0}
                                                aria-valuemax={progress.target}
                                                className="h-2 flex-1 overflow-hidden rounded-full bg-black/40"
                                              >
                                                <div
                                                  className="h-full rounded-full bg-marquinhos-accent transition-all"
                                                  style={{
                                                    width: `${progressPercent}%`,
                                                  }}
                                                />
                                              </div>
                                              <span className="shrink-0 font-mono text-[11px] text-marquinhos-text-dim">
                                                {t(
                                                  'wordle:achievementProgressLabel',
                                                  {
                                                    current: progress.current,
                                                    target: progress.target,
                                                  },
                                                )}
                                              </span>
                                            </div>
                                          )}
                                      </div>
                                    </div>

                                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                                      <span className="font-pixel text-xs text-marquinhos-accent">
                                        {t('wordle:achievementRewardXp', {
                                          xp: achievement.rewardXp,
                                        })}
                                      </span>
                                      <span
                                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                          isUnlocked
                                            ? 'border-marquinhos-green/50 bg-marquinhos-green/15 text-marquinhos-green'
                                            : 'border-marquinhos-border bg-black/30 text-marquinhos-text-dim'
                                        }`}
                                      >
                                        {t(
                                          isUnlocked
                                            ? 'wordle:achievementUnlocked'
                                            : 'wordle:achievementLocked',
                                        )}
                                      </span>
                                      {holdersPercent !== null && (
                                        <span className="rounded border border-marquinhos-border/70 bg-black/30 px-2 py-0.5 text-[10px] text-marquinhos-text-dim">
                                          {t('wordle:holdersPercent', {
                                            percent:
                                              formatHoldersPercent(
                                                holdersPercent,
                                              ),
                                          })}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </section>
                      ),
                    )}
                  </div>
                )}
              </div>
            )}
          </MenuPanel>
        </div>
      </ViewTransition>

      {selectedAchievement &&
        (() => {
          const isUnlocked = selectedAchievement.unlockedAt !== null;
          const hidden = selectedAchievement.hidden ?? false;
          const tier = selectedAchievement.tier ?? 1;
          const family = selectedAchievement.family || 'wordle';
          const progress = selectedAchievement.progress ?? null;
          const holdersPercent = selectedAchievement.holdersPercent ?? null;
          const isSecretMasked = hidden && !isUnlocked;
          const displayIcon = isSecretMasked ? '❔' : selectedAchievement.icon;
          const displayName = isSecretMasked
            ? t('wordle:secretAchievementTitle')
            : selectedAchievement.name;
          const displayDescription = isSecretMasked
            ? t('wordle:secretAchievementDescription')
            : selectedAchievement.description;
          const progressPercent =
            progress && progress.target > 0
              ? Math.min(
                  100,
                  Math.round((progress.current / progress.target) * 100),
                )
              : 0;

          return (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="wordle-achievement-detail-title"
              className="fixed inset-0 z-30 flex items-end justify-center bg-black/70 p-4 sm:items-center"
              onClick={() => setSelectedId(null)}
            >
              <div
                className="termo-achievement-sheet notch-8 flex max-h-[90dvh] w-full max-w-md flex-col gap-4 overflow-y-auto border border-marquinhos-border bg-[#1c1b1c] p-5 shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="termo-achievement-badge flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-marquinhos-border bg-black/40 text-2xl"
                    >
                      {displayIcon}
                    </span>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-marquinhos-text-dim">
                        {t('wordle:detailSheetTitle')}
                      </span>
                      <h3
                        id="wordle-achievement-detail-title"
                        className="font-pixel text-base text-marquinhos-text"
                      >
                        {displayName}
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={t('wordle:closeAchievementDetail')}
                    onClick={() => setSelectedId(null)}
                    className="rounded px-2 py-1 text-sm text-marquinhos-text-dim hover:text-marquinhos-text"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-marquinhos-border bg-black/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-marquinhos-text-dim">
                    {t(`wordle:families.${family}`, { defaultValue: family })}
                  </span>
                  <span className="rounded border border-marquinhos-border bg-black/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-marquinhos-text-dim">
                    {t('wordle:tierLabel', { tier })}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${RARITY_CLASSES[selectedAchievement.rarity]}`}
                  >
                    {t(`wordle:rarity.${selectedAchievement.rarity}`)}
                  </span>
                  {hidden && (
                    <span className="rounded-full border border-marquinhos-accent/40 bg-marquinhos-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-marquinhos-accent">
                      {t('wordle:secretBadge')}
                    </span>
                  )}
                  <span className="font-pixel text-xs text-marquinhos-accent">
                    {t('wordle:achievementRewardXp', {
                      xp: selectedAchievement.rewardXp,
                    })}
                  </span>
                </div>

                <p className="text-sm leading-6 text-marquinhos-text">
                  {displayDescription}
                </p>

                {!isSecretMasked &&
                  (selectedAchievement.patternPreview ||
                    selectedAchievement.matchEvidence) && (
                    <WordlePatternDisplay
                      preview={selectedAchievement.patternPreview}
                      evidence={selectedAchievement.matchEvidence}
                    />
                  )}

                {!isSecretMasked && progress !== null && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs text-marquinhos-text-dim">
                      <span>{t('wordle:achievementsTitle')}</span>
                      <span className="font-mono">
                        {t('wordle:achievementProgressLabel', {
                          current: progress.current,
                          target: progress.target,
                        })}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={displayName}
                      aria-valuenow={progress.current}
                      aria-valuemin={0}
                      aria-valuemax={progress.target}
                      className="h-2.5 w-full overflow-hidden rounded-full bg-black/40"
                    >
                      <div
                        className="h-full rounded-full bg-marquinhos-accent transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-marquinhos-border/60 pt-3 text-xs">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      isUnlocked
                        ? 'border-marquinhos-green/50 bg-marquinhos-green/15 text-marquinhos-green'
                        : 'border-marquinhos-border bg-black/30 text-marquinhos-text-dim'
                    }`}
                  >
                    {selectedAchievement.unlockedAt
                      ? t('wordle:unlockedAtLabel', {
                          date: formatUnlockedDate(
                            selectedAchievement.unlockedAt,
                          ),
                        })
                      : t('wordle:achievementLocked')}
                  </span>

                  {holdersPercent !== null && (
                    <span className="rounded border border-marquinhos-border/70 bg-black/30 px-2 py-0.5 text-[10px] text-marquinhos-text-dim">
                      {t('wordle:holdersPercent', {
                        percent: formatHoldersPercent(holdersPercent),
                      })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
    </MenuScreen>
  );
}
