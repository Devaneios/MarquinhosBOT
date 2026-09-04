import { Route, useNavigate } from 'react-router-dom';
import type { DiscordIdentity } from '../../discordAuth.ts';
import { CompetitiveScreen } from './components/CompetitiveScreen';
import { HowToPlay } from './components';
import { MainMenu } from './components';
import { ModeMenu } from './components';
import { SettingsScreen } from './components';
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
      onCompetitive={() => navigate('competitive')}
      onExitToHub={onExitToHub}
    />
  );
}

function ModeMenuRoute() {
  const navigate = useNavigate();
  const { difficulty, winScore, sound, ruleset, bestOf, ranked, onSelectMode } =
    usePongMenuContext();
  return (
    <ModeMenu
      onSelect={(mode) =>
        onSelectMode(mode, difficulty, winScore, sound, ruleset, bestOf, ranked)
      }
      onBack={() => navigate('..')}
    />
  );
}

function SettingsScreenRoute() {
  const navigate = useNavigate();
  const {
    difficulty,
    setDifficulty,
    sound,
    setSound,
    winScore,
    setWinScore,
    ruleset,
    setRuleset,
    bestOf,
    setBestOf,
    ranked,
    setRanked,
  } = usePongMenuContext();
  return (
    <SettingsScreen
      difficulty={difficulty}
      onDifficultyChange={setDifficulty}
      sound={sound}
      onSoundChange={setSound}
      winScore={winScore}
      onWinScoreChange={setWinScore}
      ruleset={ruleset}
      onRulesetChange={setRuleset}
      bestOf={bestOf}
      onBestOfChange={setBestOf}
      ranked={ranked}
      onRankedChange={setRanked}
      onBack={() => navigate('..')}
    />
  );
}

function HowToPlayRoute() {
  const navigate = useNavigate();
  return <HowToPlay onBack={() => navigate('..')} />;
}

function CompetitiveScreenRoute({ identity }: { identity: DiscordIdentity }) {
  const navigate = useNavigate();
  return (
    <CompetitiveScreen identity={identity} onBack={() => navigate('..')} />
  );
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
        <Route
          path="competitive"
          element={<CompetitiveScreenRoute identity={identity} />}
        />
      </Route>
    </Route>
  );
}
