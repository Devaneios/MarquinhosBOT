import { GameMenu } from '../../../components/game-shell';
import type { GameMode } from '../types';

export function ConnectFourModeMenu({
  onSelect,
  onExitToHub,
}: {
  onSelect: (mode: GameMode) => void;
  onExitToHub: () => void;
}) {
  return (
    <GameMenu
      gameId="connect-four"
      onBack={onExitToHub}
      actions={[
        {
          key: 'single',
          labelKey: 'vsBot',
          labelNs: 'common',
          descriptionKey: 'vsBotDescription',
          onSelect: () => onSelect('single'),
        },
        {
          key: 'multi',
          labelKey: 'vsPlayer',
          labelNs: 'common',
          descriptionKey: 'vsPlayerDescription',
          onSelect: () => onSelect('multi'),
        },
      ]}
    />
  );
}
