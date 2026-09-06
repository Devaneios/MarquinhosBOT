import { useTranslation } from 'react-i18next';
import { HowToPlayScreen } from '../../../components/game-shell';

export function HowToPlay({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation('checkers');

  return (
    <HowToPlayScreen
      onBack={onBack}
      footnoteKey="footnote"
      footnoteNs="checkers"
      sections={[
        {
          headingKey: 'movesHeading',
          headingNs: 'checkers',
          body: t('movesBody'),
        },
        {
          headingKey: 'jumpsHeading',
          headingNs: 'checkers',
          body: t('jumpsBody'),
        },
      ]}
    />
  );
}
