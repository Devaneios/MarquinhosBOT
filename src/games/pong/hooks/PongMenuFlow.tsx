import { useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import type { BotDifficulty, GameMode, WinScore } from '../types';

const STORAGE_KEY = 'pong-menu-settings';

interface StoredSettings {
  difficulty: BotDifficulty;
  winScore: WinScore;
  sound: boolean;
}

const DEFAULT_SETTINGS: StoredSettings = {
  difficulty: 'normal',
  winScore: 11,
  sound: true,
};

function loadStoredSettings(): StoredSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    return {
      difficulty: parsed.difficulty ?? DEFAULT_SETTINGS.difficulty,
      winScore: parsed.winScore ?? DEFAULT_SETTINGS.winScore,
      sound: parsed.sound ?? DEFAULT_SETTINGS.sound,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveStoredSettings(settings: StoredSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage unavailable (e.g. private mode) — settings just won't persist.
  }
}

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
  const [stored] = useState(loadStoredSettings);
  const [difficulty, setDifficultyState] = useState<BotDifficulty>(
    stored.difficulty,
  );
  const [winScore, setWinScoreState] = useState<WinScore>(stored.winScore);
  const [sound, setSoundState] = useState(stored.sound);

  const setDifficulty = (value: BotDifficulty) => {
    setDifficultyState(value);
    saveStoredSettings({ difficulty: value, winScore, sound });
  };
  const setWinScore = (value: WinScore) => {
    setWinScoreState(value);
    saveStoredSettings({ difficulty, winScore: value, sound });
  };
  const setSound = (value: boolean) => {
    setSoundState(value);
    saveStoredSettings({ difficulty, winScore, sound: value });
  };

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
