import { useNavigate } from 'react-router-dom';
import { GameMenu } from '../../../components/game-shell';

export function CardModeSelect() {
  const navigate = useNavigate();

  return (
    <GameMenu
      gameId="cards"
      onBack={() => navigate('/')}
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
