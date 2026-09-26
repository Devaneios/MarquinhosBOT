import { GameMenu } from '@/games/shared/shell';
import { useNavigateHome } from '@/shared/motion/transitions';
import { useNavigate } from 'react-router-dom';

export function CardModeSelect() {
  const navigate = useNavigate();
  const navigateHome = useNavigateHome();

  return (
    <GameMenu
      gameId="cards"
      onBack={() => navigateHome()}
      actions={[
        {
          key: 'truco',
          labelKey: 'modeTrucoLabel',
          labelNs: 'cards',
          descriptionKey: 'modeTrucoDescription',
          onSelect: () => navigate('/games/cards/truco'),
        },
        {
          key: 'truco-1v1',
          labelKey: 'modeTruco1v1Label',
          labelNs: 'cards',
          descriptionKey: 'modeTruco1v1Description',
          onSelect: () => navigate('/games/cards/truco-1v1'),
        },
      ]}
    />
  );
}
