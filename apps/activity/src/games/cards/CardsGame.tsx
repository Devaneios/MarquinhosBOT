import type { GameProps } from '@/games/GameModule';
import { Route, Routes } from 'react-router-dom';
import { CardModeSelect } from './components/CardModeSelect';
import { CardTableRoute } from './components/CardTableRoute';

export function CardsGame({ identity, onAuthInvalid }: GameProps) {
  return (
    <Routes>
      <Route index element={<CardModeSelect />} />
      <Route
        path=":ruleset"
        element={
          <CardTableRoute identity={identity} onAuthInvalid={onAuthInvalid} />
        }
      />
    </Routes>
  );
}
