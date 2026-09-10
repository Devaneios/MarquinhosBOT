import { Route, useNavigate } from 'react-router-dom';
import { GameMenu } from '../../components/game-shell';
import type { DiscordIdentity } from '../../discordAuth.ts';
import { CheckersGame } from './CheckersGame';
import { HowToPlay } from './components';
import {
  CheckersMenuFlow,
  useCheckersMenuContext,
} from './hooks/CheckersMenuFlow';

function MainMenuRoute() {
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

function ModeMenuRoute() {
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

function HowToPlayRoute() {
  const navigate = useNavigate();
  return <HowToPlay onBack={() => navigate('..')} />;
}

export function checkersRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="checkers"
      element={
        <CheckersGame identity={identity} onAuthInvalid={onAuthInvalid} />
      }
    >
      <Route element={<CheckersMenuFlow />}>
        <Route index element={<MainMenuRoute />} />
        <Route path="mode" element={<ModeMenuRoute />} />
        <Route path="how-to" element={<HowToPlayRoute />} />
      </Route>
    </Route>
  );
}
