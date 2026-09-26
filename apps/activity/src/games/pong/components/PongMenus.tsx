import { GameMenu } from '@/games/shared/shell';
import type { DiscordIdentity } from '@/platform/discord/auth';
import { Route, Routes, useNavigate } from 'react-router-dom';
import {
  usePongMenuSettings,
  type PongMenuSettings,
} from '../flow/usePongMenuSettings';
import type { usePongSession } from '../hooks/usePongSession';
import { CompetitiveScreen } from './CompetitiveScreen';
import { HowToPlay } from './HowToPlay';
import { SettingsScreen } from './SettingsScreen';

type SelectMode = ReturnType<typeof usePongSession>['selectMode'];

export function PongMenus({
  identity,
  onSelectMode,
  onExitToHub,
}: {
  identity: DiscordIdentity;
  onSelectMode: SelectMode;
  onExitToHub: () => void;
}) {
  const settings = usePongMenuSettings();
  return (
    <Routes>
      <Route index element={<MainMenu onExitToHub={onExitToHub} />} />
      <Route
        path="mode"
        element={<ModeMenu settings={settings} onSelectMode={onSelectMode} />}
      />
      <Route path="settings" element={<SettingsMenu settings={settings} />} />
      <Route path="how-to" element={<HowToPlayMenu />} />
      <Route
        path="competitive"
        element={<CompetitiveMenu identity={identity} />}
      />
    </Routes>
  );
}

function MainMenu({ onExitToHub }: { onExitToHub: () => void }) {
  const navigate = useNavigate();
  return (
    <GameMenu
      gameId="pong"
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
          key: 'settings',
          labelKey: 'settings',
          labelNs: 'common',
          descriptionKey: 'settingsDescription',
          onSelect: () => navigate('settings'),
        },
        {
          key: 'competitive',
          labelKey: 'competitive',
          labelNs: 'pong',
          descriptionKey: 'competitiveDescription',
          onSelect: () => navigate('competitive'),
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

function ModeMenu({
  settings,
  onSelectMode,
}: {
  settings: PongMenuSettings;
  onSelectMode: SelectMode;
}) {
  const navigate = useNavigate();
  const { difficulty, winScore, sound, ruleset, bestOf, ranked } = settings;
  const start = (mode: 'single' | 'multi' | 'local') =>
    onSelectMode(mode, difficulty, winScore, sound, ruleset, bestOf, ranked);

  return (
    <GameMenu
      gameId="pong"
      onBack={() => navigate('..')}
      backLabelKey="back"
      actions={[
        {
          key: 'single',
          labelKey: 'vsBot',
          labelNs: 'common',
          descriptionKey: 'vsBotDescription',
          onSelect: () => start('single'),
        },
        {
          key: 'multi',
          labelKey: 'vsPlayer',
          labelNs: 'common',
          descriptionKey: 'vsPlayerDescription',
          onSelect: () => start('multi'),
        },
        {
          key: 'local',
          labelKey: 'vsLocal',
          labelNs: 'pong',
          descriptionKey: 'vsLocalDescription',
          onSelect: () => start('local'),
        },
      ]}
    />
  );
}

function SettingsMenu({ settings }: { settings: PongMenuSettings }) {
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
  } = settings;
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

function HowToPlayMenu() {
  const navigate = useNavigate();
  return <HowToPlay onBack={() => navigate('..')} />;
}

function CompetitiveMenu({ identity }: { identity: DiscordIdentity }) {
  const navigate = useNavigate();
  return (
    <CompetitiveScreen identity={identity} onBack={() => navigate('..')} />
  );
}
