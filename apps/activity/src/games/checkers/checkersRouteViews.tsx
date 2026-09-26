import { GameMenu } from '@/games/shared/shell';
import { useNavigate } from 'react-router-dom';
import { HowToPlay } from './components/index';
import { useCheckersMenuContext } from './hooks/useCheckersMenuContext';

export function MainMenuRoute() {
  const navigate = useNavigate();
  const { onExitToHub } = useCheckersMenuContext();
  return (
    <GameMenu
      gameId="checkers"
      headingKey="mainMenu"
      onBack={onExitToHub}
      actions={[
        {
          key: 'play',
          labelKey: 'play',
          labelNs: 'common',
          descriptionKey: 'playDescription',
          onSelect: () => navigate('mode'),
        },
        {
          key: 'how-to',
          labelKey: 'howToPlay',
          labelNs: 'common',
          descriptionKey: 'howToPlayDescription',
          onSelect: () => navigate('how-to'),
        },
      ]}
    />
  );
}

export function ModeMenuRoute() {
  const navigate = useNavigate();
  const { onSelectMode } = useCheckersMenuContext();
  return (
    <GameMenu
      gameId="checkers"
      onBack={() => navigate('..')}
      backLabelKey="back"
      actions={[
        {
          key: 'single',
          labelKey: 'vsBot',
          labelNs: 'common',
          descriptionKey: 'vsBotDescription',
          onSelect: () => onSelectMode('single'),
        },
        {
          key: 'multi',
          labelKey: 'vsPlayer',
          labelNs: 'common',
          descriptionKey: 'vsPlayerDescription',
          onSelect: () => navigate('/rooms?create=checkers'),
        },
      ]}
    />
  );
}

export function HowToPlayRoute() {
  const navigate = useNavigate();
  return <HowToPlay onBack={() => navigate('..')} />;
}
