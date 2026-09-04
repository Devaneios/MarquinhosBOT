import { Route, useNavigate, useOutletContext } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import {
  BingoSpeedGame,
  type BingoSpeedMenuOutletContext,
} from './BingoSpeedGame';
import { MainMenu } from './components/MainMenu';
import { ModeMenu } from './components/ModeMenu';

function MainMenuRoute() {
  const navigate = useNavigate();
  const { onExitToHub } = useOutletContext<BingoSpeedMenuOutletContext>();
  return <MainMenu onPlay={() => navigate('mode')} onExitToHub={onExitToHub} />;
}

function ModeMenuRoute() {
  const navigate = useNavigate();
  const { onSelectMode: selectMode } =
    useOutletContext<BingoSpeedMenuOutletContext>();
  return (
    <ModeMenu
      onSelect={(mode) => {
        if (mode === 'multi') {
          navigate('/rooms?create=bingo-speed');
          return;
        }
        selectMode(mode);
      }}
      onBack={() => navigate('..')}
    />
  );
}

export function bingoSpeedRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="bingo-speed"
      element={
        <BingoSpeedGame identity={identity} onAuthInvalid={onAuthInvalid} />
      }
    >
      <Route index element={<MainMenuRoute />} />
      <Route path="mode" element={<ModeMenuRoute />} />
    </Route>
  );
}
