import { Route, useNavigate } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { CheckersGame } from './CheckersGame';
import { CheckersMenuFlow, useCheckersMenuContext } from './CheckersMenuFlow';
import { HowToPlay } from './HowToPlay';
import { MainMenu } from './MainMenu';
import { ModeMenu } from './ModeMenu';

function MainMenuRoute() {
  const navigate = useNavigate();
  const { onExitToHub } = useCheckersMenuContext();
  return (
    <MainMenu
      onPlay={() => navigate('mode')}
      onHowTo={() => navigate('how-to')}
      onExitToHub={onExitToHub}
    />
  );
}

function ModeMenuRoute() {
  const navigate = useNavigate();
  const { onSelectMode } = useCheckersMenuContext();
  return (
    <ModeMenu onSelect={onSelectMode} onBack={() => navigate('..')} />
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
