import { useNavigate } from 'react-router-dom';
import { ModeSelectScreen } from '../../../components/game-shell';

export function CardModeSelect() {
  const navigate = useNavigate();

  return (
    <ModeSelectScreen
      onBack={() => navigate('/')}
      options={[
        {
          key: 'truco',
          labelKey: 'modeTrucoLabel',
          labelNs: 'cards',
          onSelect: () => navigate('/games/cards/truco'),
        },
        {
          key: 'truco-1v1',
          labelKey: 'modeTruco1v1Label',
          labelNs: 'cards',
          onSelect: () => navigate('/games/cards/truco-1v1'),
        },
      ]}
    />
  );
}
