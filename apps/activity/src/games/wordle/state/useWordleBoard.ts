import type { WsSession } from '@/games/shared/session/gameSession';
import { colyseusUrl } from '@/platform/api/apiBase';
import type { ActivityMessage } from '@/platform/realtime/colyseus/connection';
import { useColyseusRoom } from '@/platform/realtime/colyseus/useColyseusRoom';
import { prefersReducedMotion } from '@/shared/motion/transitions';
import {
  serverMessageSchema,
  type WordleClientMessage,
} from '@marquinhos/contracts/activity/games/wordle';
import { parseMessage } from '@marquinhos/contracts/activity/protocol';
import {
  type GuessRow,
  type WordleAchievementStatus,
  type WordleAchievementUpdate,
  type WordlePlayerStats,
  type WordleUnlockedAchievement,
} from '@marquinhos/contracts/wordle';
import {
  buildLetterStates,
  normalizeKey,
} from '@marquinhos/domain/games/wordle/keyboardState';
import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { KB_LETTERS, MIN_KEY_PRESS_MS, revealDurationMs } from '../constants';

interface AchievementState {
  achievements: WordleAchievementStatus[];
  unlockedAchievements: WordleUnlockedAchievement[];
  hasUnlockedInSession: boolean;
}

type AchievementAction =
  | {
      type: 'init';
      overview: WordleAchievementUpdate['overview'] | undefined;
    }
  | { type: 'guess'; update: WordleAchievementUpdate | undefined }
  | { type: 'dismiss_current' | 'dismiss_all' };

function unlockedFromUpdate(
  update: WordleAchievementUpdate,
): WordleUnlockedAchievement[] {
  const statuses = new Map(
    update.overview.achievements.map((achievement) => [
      achievement.id,
      achievement,
    ]),
  );
  return update.unlockedIds.flatMap((id) => {
    const status = statuses.get(id);
    return status?.unlockedAt
      ? [{ ...status, unlockedAt: status.unlockedAt }]
      : [];
  });
}

function achievementReducer(
  state: AchievementState,
  action: AchievementAction,
): AchievementState {
  switch (action.type) {
    case 'init':
      if (!action.overview) return state;
      return {
        achievements: action.overview.achievements,
        unlockedAchievements: [],
        hasUnlockedInSession: false,
      };
    case 'guess': {
      if (!action.update) return state;
      const unlocked = unlockedFromUpdate(action.update);
      const pending = state.unlockedAchievements;
      const existing = new Set(pending.map((item) => item.id));
      return {
        achievements: action.update.overview.achievements,
        unlockedAchievements: [
          ...pending,
          ...unlocked.filter((item) => !existing.has(item.id)),
        ],
        hasUnlockedInSession: state.hasUnlockedInSession || unlocked.length > 0,
      };
    }
    case 'dismiss_current':
      return {
        ...state,
        unlockedAchievements: state.unlockedAchievements.slice(1),
      };
    case 'dismiss_all':
      return { ...state, unlockedAchievements: [] };
  }
}

interface WordleBoardOptions {
  enabled: boolean;
  enableSpaceKey: boolean;
  enableArrowKeys: boolean;
}

type WordleFocusCommand = 'first' | 'left' | 'space' | 'right' | 'last';
const DRAFT_ACK_TIMEOUT_MS = 5_000;

export function useWordleBoard(
  session: WsSession,
  {
    enabled = true,
    enableSpaceKey = false,
    enableArrowKeys = false,
  }: WordleBoardOptions,
) {
  const [wordLength, setWordLength] = useState<number | null>(null);
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [celebrateRow, setCelebrateRow] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const [
    { achievements, unlockedAchievements, hasUnlockedInSession },
    dispatchAchievements,
  ] = useReducer(achievementReducer, {
    achievements: [],
    unlockedAchievements: [],
    hasUnlockedInSession: false,
  });
  const [stats, setStats] = useState<WordlePlayerStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentLetters, setCurrentLetters] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [shake, setShake] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const shakeTimeout = useRef<number | undefined>(undefined);
  const errorTimeout = useRef<number | undefined>(undefined);
  const revealTimeout = useRef<number | undefined>(undefined);
  const [pressedKeys, setPressedKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const pressTimers = useRef<Map<string, number>>(new Map());
  const draftDateRef = useRef<string | null>(null);
  const draftRevisionRef = useRef(0);
  const draftReadyRef = useRef(false);
  const draftInFlightRef = useRef(false);
  const draftPendingRef = useRef<{
    rowIndex: number;
    cells: string[];
    activeIndex: number;
  } | null>(null);
  const draftLatestRef = useRef<{
    rowIndex: number;
    cells: string[];
    activeIndex: number;
  } | null>(null);
  const draftSavedSnapshotRef = useRef<string | null>(null);
  const drainDraftQueueRef = useRef<() => void>(() => undefined);
  const draftRequestRef = useRef<{
    rowIndex: number;
    cells: string[];
    activeIndex: number;
  } | null>(null);
  const draftRequestIdRef = useRef(0);
  const draftInFlightRequestIdRef = useRef<number | null>(null);
  const draftAckTimeoutRef = useRef<number | undefined>(undefined);

  function triggerShake() {
    setShake(true);
    window.clearTimeout(shakeTimeout.current);
    shakeTimeout.current = window.setTimeout(() => setShake(false), 380);
  }

  const { send, connectionState } = useColyseusRoom(
    'wordle',
    session,
    colyseusUrl(),
    (raw: ActivityMessage) => {
      const message = parseMessage(serverMessageSchema, raw);
      if (!message) return;
      switch (message.type) {
        case 'init':
          window.clearTimeout(draftAckTimeoutRef.current);
          draftInFlightRequestIdRef.current = null;
          draftDateRef.current = message.payload.date;
          draftRevisionRef.current = message.payload.draft?.revision ?? 0;
          draftReadyRef.current = true;
          draftInFlightRef.current = false;
          draftPendingRef.current = null;
          draftRequestRef.current = null;
          draftLatestRef.current = {
            rowIndex: message.payload.guesses.length,
            cells:
              message.payload.draft?.cells ??
              Array(message.payload.wordLength).fill(''),
            activeIndex: message.payload.draft?.activeIndex ?? 0,
          };
          draftSavedSnapshotRef.current = JSON.stringify(
            draftLatestRef.current,
          );
          window.clearTimeout(revealTimeout.current);
          startTransition(() => {
            setWordLength(message.payload.wordLength);
            setGuesses(message.payload.guesses);
            setSolved(message.payload.solved);
            dispatchAchievements({
              type: 'init',
              overview: message.payload.achievementOverview,
            });
            if (message.payload.achievementOverview) {
              setStats(message.payload.achievementOverview.stats);
            }
            setRevealedCount(message.payload.guesses.length);
            setCelebrateRow(null);
            window.clearTimeout(errorTimeout.current);
            setError(null);
            setCurrentLetters(
              message.payload.draft?.cells ??
                Array(message.payload.wordLength).fill(''),
            );
            setActiveIndex(message.payload.draft?.activeIndex ?? 0);
          });
          return;
        case 'guess_result': {
          setGuesses(message.payload.guesses);
          setSolved(message.payload.solved);
          if (message.payload.achievementUpdate !== undefined) {
            setStats(message.payload.achievementUpdate.overview.stats);
          }
          dispatchAchievements({
            type: 'guess',
            update: message.payload.achievementUpdate,
          });
          window.clearTimeout(errorTimeout.current);
          setError(null);
          setCurrentLetters((prev) => prev.map(() => ''));
          setActiveIndex(0);
          window.clearTimeout(revealTimeout.current);
          const {
            guesses: nextGuesses,
            solved: nextSolved,
            wordLength: length,
          } = message.payload;
          const finishReveal = () => {
            setRevealedCount(nextGuesses.length);
            if (nextSolved) setCelebrateRow(nextGuesses.length - 1);
          };
          if (prefersReducedMotion()) finishReveal();
          else
            revealTimeout.current = window.setTimeout(
              finishReveal,
              revealDurationMs(length),
            );
          return;
        }
        case 'guess_error':
          setError(message.payload.message);
          window.clearTimeout(errorTimeout.current);
          errorTimeout.current = window.setTimeout(() => setError(null), 2500);
          triggerShake();
          return;
        case 'draft_result': {
          if (
            message.payload.requestId === undefined ||
            message.payload.requestId !== draftInFlightRequestIdRef.current
          )
            return;
          window.clearTimeout(draftAckTimeoutRef.current);
          draftInFlightRequestIdRef.current = null;
          draftInFlightRef.current = false;
          const request = draftRequestRef.current;
          draftRequestRef.current = null;
          if (message.payload.status === 'saved') {
            draftRevisionRef.current = message.payload.draft.revision;
            draftSavedSnapshotRef.current = JSON.stringify(request);
          } else if (message.payload.status === 'conflict') {
            draftRevisionRef.current = message.payload.draft?.revision ?? 0;
            draftSavedSnapshotRef.current = message.payload.draft
              ? JSON.stringify({
                  rowIndex: message.payload.draft.rowIndex,
                  cells: message.payload.draft.cells,
                  activeIndex: message.payload.draft.activeIndex,
                })
              : null;
            const latest = draftLatestRef.current;
            if (
              latest &&
              JSON.stringify(latest) !== draftSavedSnapshotRef.current
            )
              draftPendingRef.current = latest;
          } else {
            const latest = draftLatestRef.current;
            if (latest && request && latest.rowIndex !== request.rowIndex) {
              draftRevisionRef.current = 0;
              draftSavedSnapshotRef.current = null;
              draftPendingRef.current = latest;
            } else {
              draftPendingRef.current = null;
            }
          }
          queueMicrotask(() => drainDraftQueueRef.current());
          return;
        }
      }
    },
  );

  const letterStates = useMemo(
    () => buildLetterStates(guesses.slice(0, revealedCount), KB_LETTERS),
    [guesses, revealedCount],
  );
  const revealingRow =
    guesses.length > revealedCount ? guesses.length - 1 : null;

  useEffect(() => {
    const drainDraftQueue = () => {
      if (draftInFlightRef.current || !draftReadyRef.current) return;
      const next = draftPendingRef.current;
      const date = draftDateRef.current;
      if (!next || !date) return;
      draftPendingRef.current = null;
      draftInFlightRef.current = true;
      draftRequestRef.current = next;
      const requestId = ++draftRequestIdRef.current;
      draftInFlightRequestIdRef.current = requestId;
      window.clearTimeout(draftAckTimeoutRef.current);
      draftAckTimeoutRef.current = window.setTimeout(() => {
        if (draftInFlightRequestIdRef.current !== requestId) return;
        draftInFlightRequestIdRef.current = null;
        draftInFlightRef.current = false;
        draftRequestRef.current = null;
        const latest = draftLatestRef.current;
        if (latest) draftPendingRef.current = latest;
        queueMicrotask(() => drainDraftQueueRef.current());
      }, DRAFT_ACK_TIMEOUT_MS);
      send({
        type: 'draft_update',
        payload: {
          ...next,
          date,
          expectedRevision: draftRevisionRef.current,
          requestId,
        },
      } satisfies WordleClientMessage);
    };
    drainDraftQueueRef.current = drainDraftQueue;
    return () => {
      if (drainDraftQueueRef.current === drainDraftQueue) {
        drainDraftQueueRef.current = () => undefined;
      }
    };
  }, [send]);

  useEffect(() => {
    if (!draftReadyRef.current || solved || wordLength === null) return;
    const latest = {
      rowIndex: guesses.length,
      cells: [...currentLetters],
      activeIndex,
    };
    draftLatestRef.current = latest;
    if (JSON.stringify(latest) === draftSavedSnapshotRef.current) return;
    draftPendingRef.current = latest;
    drainDraftQueueRef.current();
  }, [activeIndex, currentLetters, guesses.length, solved, wordLength]);

  useEffect(() => {
    const element = gridRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [guesses.length]);

  useEffect(() => {
    return () => {
      window.clearTimeout(shakeTimeout.current);
      window.clearTimeout(errorTimeout.current);
      window.clearTimeout(revealTimeout.current);
      window.clearTimeout(draftAckTimeoutRef.current);
    };
  }, []);

  const registerGrid = useCallback((element: HTMLDivElement | null) => {
    gridRef.current = element;
  }, []);

  const registerInput = useCallback(
    (index: number, element: HTMLInputElement | null) => {
      inputRefs.current[index] = element;
    },
    [],
  );

  function typeLetter(letter: string) {
    if (!enabled || solved || wordLength === null || revealingRow !== null)
      return;
    window.clearTimeout(errorTimeout.current);
    setError(null);
    setCurrentLetters((prev) => {
      const next = [...prev];
      next[activeIndex] = letter;
      return next;
    });
    setActiveIndex((prev) => Math.min(prev + 1, wordLength - 1));
  }

  function backspace() {
    if (!enabled || solved || wordLength === null || revealingRow !== null)
      return;
    window.clearTimeout(errorTimeout.current);
    setError(null);
    const hasLetter = currentLetters[activeIndex] !== '';
    setCurrentLetters((prev) => {
      const next = [...prev];
      const index = hasLetter ? activeIndex : Math.max(activeIndex - 1, 0);
      next[index] = '';
      return next;
    });
    if (!hasLetter) setActiveIndex((prev) => Math.max(prev - 1, 0));
  }

  function pasteLetters(index: number, text: string) {
    if (!enabled || solved || wordLength === null || revealingRow !== null)
      return;
    const pasted = [...text.toLocaleLowerCase('pt-BR')]
      .map((letter) => normalizeKey(letter, KB_LETTERS))
      .filter((letter) => KB_LETTERS.has(letter));
    if (pasted.length === 0) return;
    setCurrentLetters((previous) => {
      const next = [...previous];
      pasted.slice(0, wordLength - index).forEach((letter, offset) => {
        next[index + offset] = letter;
      });
      return next;
    });
    setActiveIndex(Math.min(index + pasted.length, wordLength - 1));
  }

  function onPasteCell(
    index: number,
    event: React.ClipboardEvent<HTMLInputElement>,
  ) {
    event.preventDefault();
    pasteLetters(index, event.clipboardData.getData('text'));
  }

  function moveFocus(command: WordleFocusCommand) {
    if (
      !enabled ||
      solved ||
      wordLength === null ||
      (command === 'space' ? !enableSpaceKey : !enableArrowKeys)
    ) {
      return;
    }
    const lastIndex = wordLength - 1;
    setActiveIndex((prev) => {
      switch (command) {
        case 'first':
          return 0;
        case 'left':
          return Math.max(prev - 1, 0);
        case 'space':
          return Math.min(prev + 1, lastIndex);
        case 'right':
          return Math.min(prev + 1, lastIndex);
        case 'last':
          return lastIndex;
        default: {
          return command;
        }
      }
    });
  }

  function submitGuess() {
    if (!enabled || solved || wordLength === null || revealingRow !== null)
      return;
    if (currentLetters.some((letter) => letter === '')) {
      triggerShake();
      return;
    }
    send({
      type: 'guess',
      payload: { guess: currentLetters.join('') },
    } satisfies WordleClientMessage);
  }

  const pressKey = useCallback((key: string) => {
    const timer = pressTimers.current.get(key);
    if (timer !== undefined) window.clearTimeout(timer);
    pressTimers.current.delete(key);
    setPressedKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const releaseKey = useCallback((key: string) => {
    const timer = pressTimers.current.get(key);
    if (timer !== undefined) window.clearTimeout(timer);
    pressTimers.current.set(
      key,
      window.setTimeout(() => {
        pressTimers.current.delete(key);
        setPressedKeys((prev) => {
          if (!prev.has(key)) return prev;
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, MIN_KEY_PRESS_MS),
    );
  }, []);

  const suspendInput = useCallback(() => {
    for (const timer of pressTimers.current.values()) {
      window.clearTimeout(timer);
    }
    pressTimers.current.clear();
    setPressedKeys(new Set());
  }, []);

  useEffect(() => {
    const timers = pressTimers.current;
    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    function resolveVirtualKey(event: KeyboardEvent): string | null {
      if (event.key === 'Enter') return 'Enter';
      if (event.key === 'Backspace') return 'Backspace';
      if (event.key.length !== 1) return null;
      const key = normalizeKey(event.key, KB_LETTERS);
      return KB_LETTERS.has(key) ? key : null;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = resolveVirtualKey(event);
      if (key !== null) pressKey(key);
    }

    function onKeyUp(event: KeyboardEvent) {
      const key = resolveVirtualKey(event);
      if (key !== null) releaseKey(key);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [enabled, pressKey, releaseKey]);

  useEffect(() => {
    if (!enabled || solved || wordLength === null) return;
    inputRefs.current[activeIndex]?.focus();
  }, [activeIndex, enabled, guesses.length, wordLength, solved]);

  function onKeyDownCell(
    _index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (!enabled || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      submitGuess();
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      backspace();
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveFocus('left');
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveFocus('right');
      return;
    }
    if (event.key === ' ') {
      event.preventDefault();
      moveFocus('space');
      return;
    }
    if (event.key.length !== 1) return;
    const key = normalizeKey(event.key, KB_LETTERS);
    if (KB_LETTERS.has(key)) {
      event.preventDefault();
      typeLetter(key);
    }
  }

  const dismissCurrentAchievement = useCallback(() => {
    dispatchAchievements({ type: 'dismiss_current' });
  }, []);

  const dismissUnlockedAchievements = useCallback(() => {
    dispatchAchievements({ type: 'dismiss_all' });
  }, []);

  return {
    wordLength,
    guesses,
    revealingRow,
    celebrateRow,
    solved,
    achievements,
    stats,
    unlockedAchievements,
    hasUnlockedInSession,
    dismissCurrentAchievement,
    dismissUnlockedAchievements,
    error,
    currentLetters,
    activeIndex,
    registerInput,
    shake,
    registerGrid,
    pressedKeys,
    letterStates,
    connectionState,
    typeLetter,
    backspace,
    submitGuess,
    moveFocus,
    suspendInput,
    onKeyDownCell,
    onPasteCell,
    setActiveIndex,
  };
}
