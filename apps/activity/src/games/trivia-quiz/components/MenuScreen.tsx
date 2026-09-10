import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  GameEmblem,
  MenuAction,
  MenuPanel,
  MenuScreen as MenuShell,
} from '../../../components/game-shell';

interface MenuScreenProps {
  playerCount: number;
  onReady: () => void;
  onExit: () => void;
}

export const MenuScreen: React.FC<MenuScreenProps> = ({
  playerCount,
  onReady,
  onExit,
}) => {
  const { t } = useTranslation(['trivia-quiz', 'common', 'games']);

  return (
    <MenuShell
      titleKey="trivia-quiz.name"
      titleNs="games"
      headingKey="mainMenu"
      headingNs="common"
      onBack={onExit}
      backLabel={t('common:backToHub')}
    >
      <MenuPanel
        labelledBy="menu-trivia-quiz"
        className="grid md:grid-cols-[1.1fr_1fr]"
      >
        <div className="flex min-w-0 flex-col gap-6 p-5 sm:p-8 lg:p-10">
          <div className="space-y-4">
            <h2
              id="menu-trivia-quiz"
              className="font-pixel text-xl leading-relaxed break-words lg:text-[28px]"
            >
              {t('games:trivia-quiz.name')}
            </h2>
            <p className="max-w-96 text-sm leading-7 text-marquinhos-text-dim sm:text-base">
              {t('trivia-quiz:menuWaitingHint')}
            </p>
            <p className="text-sm text-marquinhos-text-dim">
              {t('trivia-quiz:menuPlayersLabel')}:{' '}
              <span className="font-semibold text-marquinhos-text">
                {playerCount} / 8
              </span>
            </p>
          </div>

          <div className="mt-auto flex flex-col gap-3 pt-1">
            <MenuAction
              variant="primary"
              disabled={playerCount < 2}
              label={t('trivia-quiz:menuStartGame')}
              onSelect={onReady}
            />
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-center px-5 pb-6 sm:px-8 md:py-8 lg:p-10">
          <GameEmblem gameId="trivia-quiz" />
        </div>
      </MenuPanel>
    </MenuShell>
  );
};
