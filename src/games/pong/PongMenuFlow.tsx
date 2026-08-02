import { useState } from 'react';
import type { GameMode } from '../../hooks/useDiscordAuth';
import { HowToPlay } from './HowToPlay';
import { MainMenu } from './MainMenu';
import { ModeMenu } from './ModeMenu';
import { SettingsScreen } from './SettingsScreen';

type MenuScreen = 'menu' | 'modeSelect' | 'settings' | 'howTo';

export function PongMenuFlow({
  onSelectMode,
}: {
  onSelectMode: (mode: GameMode) => void;
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
    />
  );
}
