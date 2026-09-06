import { useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import type {
  BestOf,
  BotDifficulty,
  GameMode,
  PongRulesetId,
  WinScore,
} from '../types';

const STORAGE_KEY = 'pong-menu-settings';

interface StoredSettings {
  difficulty: BotDifficulty;
  winScore: WinScore;
  sound: boolean;
  ruleset: PongRulesetId;
  bestOf: BestOf;
  ranked: boolean;
}

const DEFAULT_SETTINGS: StoredSettings = {
  difficulty: 'normal',
  winScore: 11,
  sound: true,
  ruleset: 'classic-1v1',
  bestOf: 1,
  ranked: false,
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
      ruleset: parsed.ruleset ?? DEFAULT_SETTINGS.ruleset,
      bestOf: parsed.bestOf ?? DEFAULT_SETTINGS.bestOf,
      ranked: parsed.ranked ?? DEFAULT_SETTINGS.ranked,
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
    ruleset: PongRulesetId,
    bestOf: BestOf,
    ranked: boolean,
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
  ruleset: PongRulesetId;
  setRuleset: (ruleset: PongRulesetId) => void;
  bestOf: BestOf;
  setBestOf: (bestOf: BestOf) => void;
  ranked: boolean;
  setRanked: (ranked: boolean) => void;
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
  const [ruleset, setRulesetState] = useState(stored.ruleset);
  const [bestOf, setBestOfState] = useState(stored.bestOf);
  const [ranked, setRankedState] = useState(stored.ranked);

  const persist = (next: Partial<StoredSettings>) =>
    saveStoredSettings({
      difficulty,
      winScore,
      sound,
      ruleset,
      bestOf,
      ranked,
      ...next,
    });

  const setDifficulty = (value: BotDifficulty) => {
    setDifficultyState(value);
    persist({ difficulty: value });
  };
  const setWinScore = (value: WinScore) => {
    setWinScoreState(value);
    persist({ winScore: value });
  };
  const setSound = (value: boolean) => {
    setSoundState(value);
    persist({ sound: value });
  };
  const setRuleset = (value: PongRulesetId) => {
    setRulesetState(value);
    persist({ ruleset: value });
  };
  const setBestOf = (value: BestOf) => {
    setBestOfState(value);
    persist({ bestOf: value });
  };
  const setRanked = (value: boolean) => {
    setRankedState(value);
    persist({ ranked: value });
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
          ruleset,
          setRuleset,
          bestOf,
          setBestOf,
          ranked,
          setRanked,
          onSelectMode,
          onExitToHub,
        } satisfies PongMenuScreenContext
      }
    />
  );
}
