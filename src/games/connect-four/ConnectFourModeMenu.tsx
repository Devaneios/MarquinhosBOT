import { ModeSelectScreen } from '../../components/game-shell';
import type { GameMode } from './types';

export function ConnectFourModeMenu({
  onSelect,
  onExitToHub,
}: {
  onSelect: (mode: GameMode) => void;
  onExitToHub: () => void;
}) {
  return (
    <ModeSelectScreen
      onBack={onExitToHub}
      options={[
        {
          key: 'single',
          labelKey: 'vsCpu',
          labelNs: 'common',
          onSelect: () => onSelect('single'),
        },
        {
          key: 'multi',
          labelKey: 'vsFriend',
          labelNs: 'common',
          onSelect: () => onSelect('multi'),
        },
      ]}
    />
  );
}
