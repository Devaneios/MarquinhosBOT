import { useState } from 'react';
import { HowToPlay } from './HowToPlay';
import { MainMenu } from './MainMenu';
import { ModeMenu } from './ModeMenu';
import { SettingsScreen } from './SettingsScreen';
import type { BotDifficulty, GameMode } from './types';

type MenuScreen = 'menu' | 'modeSelect' | 'settings' | 'howTo';

export function PongMenuFlow({
  onSelectMode,
  onExitToHub,
}: {
  onSelectMode: (mode: GameMode, difficulty: BotDifficulty) => void;
  onExitToHub: () => void;
}) {
  const [screen, setScreen] = useState<MenuScreen>('menu');
  const [difficulty, setDifficulty] = useState<BotDifficulty>('normal');

  function goTo(next: MenuScreen) {
    console.log('[menu] screen change', screen, '->', next);
    setScreen(next);
  }

  if (screen === 'modeSelect') {
    return (
      <ModeMenu
        onSelect={(mode) => onSelectMode(mode, difficulty)}
        onBack={() => goTo('menu')}
      />
    );
  }
  if (screen === 'settings') {
    return (
      <SettingsScreen
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
        onBack={() => goTo('menu')}
      />
    );
  }
  if (screen === 'howTo') {
    return <HowToPlay onBack={() => goTo('menu')} />;
  }
  return (
    <MainMenu
      onPlay={() => goTo('modeSelect')}
      onSettings={() => goTo('settings')}
      onHowTo={() => goTo('howTo')}
      onExitToHub={() => {
        console.log('[menu] exiting to hub');
        onExitToHub();
      }}
    />
  );
}
