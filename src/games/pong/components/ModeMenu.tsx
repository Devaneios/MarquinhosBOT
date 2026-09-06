import { ModeSelectScreen } from '../../../components/game-shell';
import type { GameMode } from '../types';

export function ModeMenu({
  onSelect,
  onBack,
}: {
  onSelect: (mode: GameMode) => void;
  onBack: () => void;
}) {
  return (
    <ModeSelectScreen
      onBack={onBack}
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
        {
          key: 'local',
          labelKey: 'vsLocal',
          labelNs: 'pong',
          onSelect: () => onSelect('local'),
        },
      ]}
    />
  );
}
