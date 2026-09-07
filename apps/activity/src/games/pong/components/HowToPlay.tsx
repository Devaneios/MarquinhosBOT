import { useTranslation } from 'react-i18next';
import { HowToPlayScreen } from '../../../components/game-shell';

const key =
  'font-pixel flex h-11 w-11 items-center justify-center border border-marquinhos-border bg-marquinhos-panel text-sm text-marquinhos-text';

export function HowToPlay({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation('pong');

  return (
    <HowToPlayScreen
      onBack={onBack}
      footnoteKey="howToPlayFootnote"
      footnoteNs="pong"
      sections={[
        {
          headingKey: 'player1',
          headingNs: 'pong',
          body: (
            <>
              <div className="flex flex-col items-center gap-1.5">
                <div className={key}>W</div>
                <div className={key}>S</div>
              </div>
              <div className="mt-4 text-center text-lg text-marquinhos-text-dim">
                {t('moveUpDown')}
              </div>
            </>
          ),
        },
        {
          headingKey: 'player2',
          headingNs: 'pong',
          body: (
            <>
              <div className="flex flex-col items-center gap-1.5">
                <div className={key}>▲</div>
                <div className={key}>▼</div>
              </div>
              <div className="mt-4 text-center text-lg text-marquinhos-text-dim">
                {t('moveUpDown')}
              </div>
            </>
          ),
        },
      ]}
    />
  );
}
