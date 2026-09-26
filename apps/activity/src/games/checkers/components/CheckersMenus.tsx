import { GameMenu } from '@/games/shared/shell';
import { Route, Routes, useNavigate } from 'react-router-dom';
import type { GameMode } from '../types';
import { HowToPlay } from './HowToPlay';

export function CheckersMenus({
  onSelectMode,
  onExitToHub,
}: {
  onSelectMode: (mode: GameMode) => void;
  onExitToHub: () => void;
}) {
  return (
    <Routes>
      <Route index element={<MainMenu onExitToHub={onExitToHub} />} />
      <Route path="mode" element={<ModeMenu onSelectMode={onSelectMode} />} />
      <Route path="how-to" element={<HowToPlayMenu />} />
    </Routes>
  );
}

function MainMenu({ onExitToHub }: { onExitToHub: () => void }) {
  const navigate = useNavigate();
  return (
    <GameMenu
      gameId="checkers"
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
  onSelectMode,
}: {
  onSelectMode: (mode: GameMode) => void;
}) {
  const navigate = useNavigate();
  return (
    <GameMenu
      gameId="checkers"
      onBack={() => navigate('..')}
      backLabelKey="back"
      actions={[
        {
          key: 'single',
          labelKey: 'vsBot',
          labelNs: 'common',
          descriptionKey: 'vsBotDescription',
          onSelect: () => onSelectMode('single'),
        },
        {
          key: 'multi',
          labelKey: 'vsPlayer',
          labelNs: 'common',
          descriptionKey: 'vsPlayerDescription',
          onSelect: () => navigate('/rooms?create=checkers'),
        },
      ]}
    />
  );
}

function HowToPlayMenu() {
  const navigate = useNavigate();
  return <HowToPlay onBack={() => navigate('..')} />;
}
