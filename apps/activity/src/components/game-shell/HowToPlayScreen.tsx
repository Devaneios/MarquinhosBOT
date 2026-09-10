import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameId } from '../../games/gameId';
import { MenuPanel } from './MenuPanel';
import { MenuScreen } from './MenuScreen';

export interface HowToPlaySection {
  headingKey: string;
  headingNs: string;
  body: ReactNode;
}

export interface HowToPlayScreenProps {
  gameId: GameId;
  titleKey?: string;
  titleNs?: string;
  sections: HowToPlaySection[];
  footnoteKey?: string;
  footnoteNs?: string;
  onBack: () => void;
}

export function HowToPlayScreen({
  gameId,
  titleKey = 'howToPlay',
  titleNs = 'common',
  sections,
  footnoteKey,
  footnoteNs,
  onBack,
}: HowToPlayScreenProps) {
  const { t } = useTranslation(['common', titleNs, footnoteNs ?? 'common']);

  return (
    <MenuScreen
      titleKey={`${gameId}.name`}
      titleNs="games"
      headingKey={titleKey}
      headingNs={titleNs}
      onBack={onBack}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section, index) => (
          <MenuPanel key={index} className="p-5 sm:p-6">
            <h2 className="font-pixel text-sm leading-relaxed text-marquinhos-accent">
              {t(`${section.headingNs}:${section.headingKey}`)}
            </h2>
            <div className="mt-4 text-sm leading-6 text-marquinhos-text-dim">
              {section.body}
            </div>
          </MenuPanel>
        ))}
      </div>

      {footnoteKey && (
        <MenuPanel className="p-5 sm:p-6">
          <p className="text-sm leading-6 text-marquinhos-accent">
            {t(`${footnoteNs ?? titleNs}:${footnoteKey}`)}
          </p>
        </MenuPanel>
      )}
    </MenuScreen>
  );
}
