import { useState } from 'react';
import { HowToPlay } from './HowToPlay';
import { MainMenu } from './MainMenu';
import { ModeMenu } from './ModeMenu';
import { SettingsScreen } from './SettingsScreen';
import type { GameMode } from './types';

type MenuScreen = 'menu' | 'modeSelect' | 'settings' | 'howTo';

export function PongMenuFlow({
  onSelectMode,
  onExitToHub,
}: {
  onSelectMode: (mode: GameMode) => void;
  onExitToHub: () => void;
}) {
  const [screen, setScreen] = useState<MenuScreen>('menu');

  if (screen === 'modeSelect') {
    return (
      <ModeMenu onSelect={onSelectMode} onBack={() => setScreen('menu')} />
    );
  }
  if (screen === 'settings') {
    return <SettingsScreen onBack={() => setScreen('menu')} />;
  }
  if (screen === 'howTo') {
    return <HowToPlay onBack={() => setScreen('menu')} />;
  }
  return (
    <MainMenu
      onPlay={() => setScreen('modeSelect')}
      onSettings={() => setScreen('settings')}
      onHowTo={() => setScreen('howTo')}
      onExitToHub={onExitToHub}
    />
  );
}
