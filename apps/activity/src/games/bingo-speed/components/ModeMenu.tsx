import { ModeSelectScreen } from '../../../components/game-shell';

export function ModeMenu({
  onSelect,
  onBack,
}: {
  onSelect: (mode: 'multi' | 'single') => void;
  onBack: () => void;
}) {
  return (
    <ModeSelectScreen
      onBack={onBack}
      options={[
        {
          key: 'multi',
          labelKey: 'vsPlayer',
          labelNs: 'common',
          onSelect: () => onSelect('multi'),
        },
        {
          key: 'single',
          labelKey: 'vsBot',
          labelNs: 'common',
          onSelect: () => onSelect('single'),
        },
      ]}
    />
  );
}
