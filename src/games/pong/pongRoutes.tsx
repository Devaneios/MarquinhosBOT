import { Route, useNavigate } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { HowToPlay } from './components/HowToPlay';
import { MainMenu } from './components/MainMenu';
import { ModeMenu } from './components/ModeMenu';
import { SettingsScreen } from './components/SettingsScreen';
import { PongMenuFlow, usePongMenuContext } from './hooks/PongMenuFlow';
import { PongGame } from './PongGame';

function MainMenuRoute() {
  const navigate = useNavigate();
  const { onExitToHub } = usePongMenuContext();
  return (
    <MainMenu
      onPlay={() => navigate('mode')}
      onSettings={() => navigate('settings')}
      onHowTo={() => navigate('how-to')}
      onExitToHub={onExitToHub}
    />
  );
}

function ModeMenuRoute() {
  const navigate = useNavigate();
  const { difficulty, winScore, sound, onSelectMode } = usePongMenuContext();
  return (
    <ModeMenu
      onSelect={(mode) => onSelectMode(mode, difficulty, winScore, sound)}
      onBack={() => navigate('..')}
    />
  );
}

function SettingsScreenRoute() {
  const navigate = useNavigate();
  const { difficulty, setDifficulty, sound, setSound, winScore, setWinScore } =
    usePongMenuContext();
  return (
    <SettingsScreen
      difficulty={difficulty}
      onDifficultyChange={setDifficulty}
      sound={sound}
      onSoundChange={setSound}
      winScore={winScore}
      onWinScoreChange={setWinScore}
      onBack={() => navigate('..')}
    />
  );
}

function HowToPlayRoute() {
  const navigate = useNavigate();
  return <HowToPlay onBack={() => navigate('..')} />;
}

export function pongRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <Route
      path="pong"
      element={<PongGame identity={identity} onAuthInvalid={onAuthInvalid} />}
    >
      <Route element={<PongMenuFlow />}>
        <Route index element={<MainMenuRoute />} />
        <Route path="mode" element={<ModeMenuRoute />} />
        <Route path="settings" element={<SettingsScreenRoute />} />
        <Route path="how-to" element={<HowToPlayRoute />} />
      </Route>
    </Route>
  );
}
