import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MenuAction, MenuPanel } from '../../../components/game-shell';
import type { PlayerScore } from '../types';

interface LeaderboardScreenProps {
  leaderboard: PlayerScore[];
}

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  leaderboard,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation(['trivia-quiz', 'common']);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <MenuPanel className="w-full max-w-130 px-6 py-10 sm:px-8">
        <h1 className="mb-6 text-center font-pixel text-lg tracking-[0.24em] text-marquinhos-accent">
          {t('trivia-quiz:leaderboardTitle')}
        </h1>

        <div className="mb-6 space-y-3">
          {leaderboard.map((entry, index) => (
            <div
              key={entry.userId}
              className="notch-4 flex items-center gap-4 border border-marquinhos-border bg-marquinhos-bg px-4 py-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-marquinhos-accent text-sm font-bold text-black">
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-marquinhos-text">
                  {entry.userId}
                </div>
              </div>
              <div className="text-lg font-bold text-marquinhos-accent">
                {entry.score}
              </div>
            </div>
          ))}
        </div>

        <MenuAction
          variant="primary"
          label={t('common:backToHub')}
          onSelect={() => navigate('/')}
        />
      </MenuPanel>
    </div>
  );
};
