import { useTranslation } from 'react-i18next';
import type { GameId } from '../../games/gameId';
import { GameEmblem } from './GameEmblem';
import { MenuAction } from './MenuAction';
import { MenuPanel } from './MenuPanel';
import { MenuScreen } from './MenuScreen';

export interface GameMenuAction {
  key: string;
  labelKey: string;
  labelNs: string;
  descriptionKey?: string;
  descriptionNs?: string;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  onSelect: () => void;
}

export interface GameMenuProps {
  gameId: GameId;
  headingKey?: string;
  headingNs?: string;
  actions: GameMenuAction[];
  onBack: () => void;
  backLabelKey?: string;
  backLabelNs?: string;
}

// Every game menu — root menu or mode picker — is the Hub's featured card
// scoped to one game: identity on the left, choices stacked under it, the
// emblem on the right. The first action is the recommended one unless a
// caller says otherwise.
export function GameMenu({
  gameId,
  headingKey = 'selectMode',
  headingNs = 'common',
  actions,
  onBack,
  backLabelKey = 'backToHub',
  backLabelNs = 'common',
}: GameMenuProps) {
  const { t } = useTranslation(['common', 'games']);

  return (
    <MenuScreen
      titleKey={`${gameId}.name`}
      titleNs="games"
      headingKey={headingKey}
      headingNs={headingNs}
      onBack={onBack}
      backLabel={t(`${backLabelNs}:${backLabelKey}`)}
    >
      <MenuPanel
        labelledBy={`menu-${gameId}`}
        className="grid md:grid-cols-[1.1fr_1fr]"
      >
        <div className="flex min-w-0 flex-col gap-6 p-5 sm:p-8 lg:p-10 [@media(max-height:600px)]:gap-4 [@media(max-height:600px)]:py-5">
          <div className="space-y-4">
            <h2
              id={`menu-${gameId}`}
              className="font-pixel text-xl leading-relaxed break-words lg:text-[28px]"
            >
              {t(`games:${gameId}.name`)}
            </h2>
            <p className="max-w-96 text-sm leading-7 text-marquinhos-text-dim sm:text-base">
              {t(`games:${gameId}.blurb`)}
            </p>
          </div>

          <div className="mt-auto flex flex-col gap-3 pt-1">
            {actions.map((action, index) => (
              <MenuAction
                key={action.key}
                label={t(`${action.labelNs}:${action.labelKey}`)}
                description={
                  action.descriptionKey
                    ? t(
                        `${action.descriptionNs ?? action.labelNs}:${action.descriptionKey}`,
                      )
                    : undefined
                }
                variant={
                  action.variant ?? (index === 0 ? 'primary' : 'secondary')
                }
                disabled={action.disabled}
                onSelect={action.onSelect}
              />
            ))}
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-center px-5 pb-6 sm:px-8 md:py-8 lg:p-10 [@media(max-height:600px)]:py-5">
          <GameEmblem gameId={gameId} />
        </div>
      </MenuPanel>
    </MenuScreen>
  );
}
