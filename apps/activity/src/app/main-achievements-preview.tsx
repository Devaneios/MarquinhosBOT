import { WordleAchievementsScreen } from '@/games/wordle/components/WordleAchievementsScreen';
import '@/i18n';
import '@/styles/global.css';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import { achievementXpForRarity } from '@marquinhos/domain/games/wordle/achievements/rewards';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

const achievements = WORDLE_ACHIEVEMENT_CATALOG.map((a, i) => ({
  id: a.id,
  family: a.family,
  name: a.name,
  description: a.description,
  icon: a.icon,
  rarity: a.rarity,
  rewardXp: achievementXpForRarity(a.rarity),
  hidden: a.hidden,
  unlockedAt: i % 2 === 0 ? '2026-10-24T04:00:00.000Z' : null,
  progress: null,
  holdersPercent: 20,
})) as never;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter>
      <div className="app-shell flex min-h-0 flex-1 flex-col">
        <WordleAchievementsScreen
          achievements={achievements}
          onBack={() => {}}
        />
      </div>
    </MemoryRouter>
  </StrictMode>,
);
