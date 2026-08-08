import { Outlet, useOutletContext } from 'react-router-dom';
import type { GameMode } from './types';

export interface CheckersMenuOutletContext {
  onSelectMode: (mode: GameMode) => void;
  onExitToHub: () => void;
}

export function useCheckersMenuContext() {
  return useOutletContext<CheckersMenuOutletContext>();
}

export function CheckersMenuFlow() {
  const context = useOutletContext<CheckersMenuOutletContext>();
  return <Outlet context={context} />;
}
