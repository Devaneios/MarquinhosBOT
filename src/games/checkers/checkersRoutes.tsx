import { Route, useNavigate } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { CheckersGame } from './CheckersGame';
import { HowToPlay } from './components/HowToPlay';
import { MainMenu } from './components/MainMenu';
import { ModeMenu } from './components/ModeMenu';
import {
  CheckersMenuFlow,
  useCheckersMenuContext,
} from './hooks/CheckersMenuFlow';

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
    <ModeMenu
      onSelect={(mode) => {
        if (mode === 'multi') {
          navigate('/rooms?create=checkers');
          return;
        }
        onSelectMode(mode);
      }}
      onBack={() => navigate('..')}
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
