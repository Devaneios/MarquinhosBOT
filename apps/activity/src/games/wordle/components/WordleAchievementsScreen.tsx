import { MenuPanel, MenuScreen } from '@/games/shared/shell';
import type { WordleAchievementStatus } from '@marquinhos/contracts/wordle';
import { ViewTransition } from 'react';
import { useTranslation } from 'react-i18next';

const RARITY_CLASSES: Record<WordleAchievementStatus['rarity'], string> = {
  common: 'border-marquinhos-border bg-white/8 text-marquinhos-text-dim',
  rare: 'border-marquinhos-blue/45 bg-marquinhos-blue/15 text-marquinhos-blue',
  epic: 'border-marquinhos-green/45 bg-marquinhos-green/15 text-marquinhos-green',
  legendary:
    'border-marquinhos-accent/50 bg-marquinhos-accent/15 text-marquinhos-accent',
};

export function WordleAchievementsScreen({
  achievements,
  onBack,
}: {
  achievements: WordleAchievementStatus[];
  onBack: () => void;
}) {
  const { t } = useTranslation(['wordle', 'common']);
  const unlockedCount = achievements.filter(
    (item) => item.unlockedAt !== null,
  ).length;

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
        <MenuPanel className="max-w-2xl p-5 sm:p-6">
          {achievements.length === 0 ? (
            <p className="py-6 text-center text-sm text-marquinhos-text-dim">
              {t('wordle:achievementsEmpty')}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {achievements.map((achievement) => {
                const isUnlocked = achievement.unlockedAt !== null;
                return (
                  <li
                    key={achievement.id}
                    data-unlocked={isUnlocked ? 'true' : 'false'}
                    className={`notch-6 flex items-start justify-between gap-4 border px-4 py-3 transition-opacity ${
                      isUnlocked
                        ? 'border-marquinhos-border bg-white/8'
                        : 'border-marquinhos-border/60 bg-black/20 opacity-65'
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-marquinhos-border bg-black/30 text-xl"
                      >
                        {achievement.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-pixel text-sm text-marquinhos-text">
                            {achievement.name}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${RARITY_CLASSES[achievement.rarity]}`}
                          >
                            {t(`wordle:rarity.${achievement.rarity}`)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-5 text-marquinhos-text-dim">
                          {achievement.description}
                        </p>
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
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </MenuPanel>
      </ViewTransition>
    </MenuScreen>
  );
}
