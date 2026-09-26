import { GameMenu } from '@/components/game-shell';
import type { DiscordIdentity } from '@/discord/auth';
import { useNavigate } from 'react-router-dom';
import { CompetitiveScreen } from './components/CompetitiveScreen';
import { HowToPlay, SettingsScreen } from './components/index';
import { usePongMenuContext } from './hooks/usePongMenuContext';

export function MainMenuRoute() {
  const navigate = useNavigate();
  const { onExitToHub } = usePongMenuContext();
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

export function ModeMenuRoute() {
  const navigate = useNavigate();
  const { difficulty, winScore, sound, ruleset, bestOf, ranked, onSelectMode } =
    usePongMenuContext();
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

export function SettingsScreenRoute() {
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

export function HowToPlayRoute() {
  const navigate = useNavigate();
  return <HowToPlay onBack={() => navigate('..')} />;
}

export function CompetitiveScreenRoute({
  identity,
}: {
  identity: DiscordIdentity;
}) {
  const navigate = useNavigate();
  return (
    <CompetitiveScreen identity={identity} onBack={() => navigate('..')} />
  );
}
