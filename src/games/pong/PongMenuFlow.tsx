import { useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import type { BotDifficulty, GameMode, WinScore } from './types';

export interface PongMenuOutletContext {
  onSelectMode: (
    mode: GameMode,
    difficulty: BotDifficulty,
    winScore: WinScore,
    sound: boolean,
  ) => void;
  onExitToHub: () => void;
}

interface PongMenuScreenContext extends PongMenuOutletContext {
  difficulty: BotDifficulty;
  setDifficulty: (difficulty: BotDifficulty) => void;
  winScore: WinScore;
  setWinScore: (winScore: WinScore) => void;
  sound: boolean;
  setSound: (sound: boolean) => void;
}

export function usePongMenuContext() {
  return useOutletContext<PongMenuScreenContext>();
}

export function PongMenuFlow() {
  const { onSelectMode, onExitToHub } =
    useOutletContext<PongMenuOutletContext>();
  const [difficulty, setDifficulty] = useState<BotDifficulty>('normal');
  const [winScore, setWinScore] = useState<WinScore>(11);
  const [sound, setSound] = useState(true);

  return (
    <Outlet
      context={
        {
          difficulty,
          setDifficulty,
          winScore,
          setWinScore,
          sound,
          setSound,
          onSelectMode,
          onExitToHub,
        } satisfies PongMenuScreenContext
      }
    />
  );
}
