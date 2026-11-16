import type { WsSession } from '@/games/shared/session/gameSession';
import { colyseusUrl } from '@/platform/api/apiBase';
import type { ActivityMessage } from '@/platform/realtime/colyseus/connection';
import { useColyseusRoom } from '@/platform/realtime/colyseus/useColyseusRoom';
import { prefersReducedMotion } from '@/shared/motion/transitions';
import {
  clientMessageSchema,
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
  announcedIds: string[];
  hasOverview: boolean;
  baselineUnlockedIds: string[] | null;
}

type AchievementAction =
  | {
      type: 'init';
      overview: WordleAchievementUpdate['overview'] | undefined;
      syncOnly?: boolean;
    }
  | {
      type: 'guess';
      update: WordleAchievementUpdate | undefined;
      baseline?: string[];
    }
  | { type: 'refresh'; overview: WordleAchievementUpdate['overview'] }
  | { type: 'reset' }
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
    case 'reset':
      return {
        achievements: [],
        unlockedAchievements: [],
        hasUnlockedInSession: false,
        announcedIds: [],
        hasOverview: false,
        baselineUnlockedIds: null,
      };
    case 'init':
      if (!action.overview) return state;
      if (
        state.baselineUnlockedIds !== null ||
        state.hasUnlockedInSession ||
        (action.syncOnly && state.hasOverview)
      )
        return achievementReducer(state, {
          type: 'refresh',
          overview: action.overview,
        });
      return {
        achievements: action.overview.achievements,
        unlockedAchievements: [],
        hasUnlockedInSession: false,
        announcedIds: [],
        hasOverview: true,
        baselineUnlockedIds: null,
      };
    case 'guess': {
      const baseline = state.baselineUnlockedIds ?? action.baseline ?? null;
      if (!action.update) {
        return baseline && !state.hasOverview
          ? { ...state, baselineUnlockedIds: baseline }
          : state;
      }
      const previous = new Map(
        state.achievements.map((item) => [item.id, item]),
      );
      const baselineSet =
        action.baseline !== undefined
          ? new Set(action.baseline)
          : !state.hasOverview && baseline
            ? new Set(baseline)
            : null;
      const inferred = action.update.overview.achievements
        .filter(
          (item) =>
            item.unlockedAt !== null &&
            (previous.get(item.id)?.unlockedAt === null ||
              (baselineSet !== null && !baselineSet.has(item.id))),
        )
        .map((item) => item.id);
      const unlocked = unlockedFromUpdate({
        ...action.update,
        unlockedIds: [...new Set([...action.update.unlockedIds, ...inferred])],
      });
      const pending = state.unlockedAchievements;
      const existing = new Set(state.announcedIds);
      const fresh = unlocked.filter((item) => !existing.has(item.id));
      return {
        achievements: action.update.overview.achievements,
        unlockedAchievements: [...pending, ...fresh],
        hasUnlockedInSession: state.hasUnlockedInSession || fresh.length > 0,
        announcedIds: [...state.announcedIds, ...fresh.map((item) => item.id)],
        hasOverview: true,
        baselineUnlockedIds: null,
      };
    }
    case 'refresh': {
      return achievementReducer(state, {
        type: 'guess',
        update: { overview: action.overview, unlockedIds: [] },
      });
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
const GUESS_ACK_TIMEOUT_MS = 5_000;
const ACHIEVEMENT_REFRESH_INTERVAL_MS = 10_000;
const GUESS_REFRESH_HOLD_MS = 30_000;
type PendingGuess = Extract<WordleClientMessage, { type: 'guess' }>;

function pendingGuessKey(roomKey: string): string {
  return `wordle:pending-guess:${roomKey}`;
}

function readPendingGuess(roomKey: string): PendingGuess | null {
  try {
    const raw = window.sessionStorage.getItem(pendingGuessKey(roomKey));
    if (!raw) return null;
    const parsed = clientMessageSchema.safeParse(JSON.parse(raw));
    if (
      parsed.success &&
      parsed.data.type === 'guess' &&
      parsed.data.payload.requestId &&
      parsed.data.payload.date
    )
      return parsed.data;
  } catch {
    // Storage can be unavailable or contain an outdated value.
  }
  return null;
}

function writePendingGuess(roomKey: string, guess: PendingGuess | null): void {
  try {
    if (guess)
      window.sessionStorage.setItem(
        pendingGuessKey(roomKey),
        JSON.stringify(guess),
      );
    else window.sessionStorage.removeItem(pendingGuessKey(roomKey));
  } catch {
    // The current connection can still retry without browser storage.
  }
}

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
    { achievements, unlockedAchievements, hasUnlockedInSession, hasOverview },
    dispatchAchievements,
  ] = useReducer(achievementReducer, {
    achievements: [],
    unlockedAchievements: [],
    hasUnlockedInSession: false,
    announcedIds: [],
    hasOverview: false,
    baselineUnlockedIds: null,
  });
  const [stats, setStats] = useState<WordlePlayerStats | null>(null);
  const [pendingGuess, setPendingGuess] = useState<PendingGuess | null>(() =>
    readPendingGuess(session.roomKey),
  );
  const pendingGuessRef = useRef<PendingGuess | null>(pendingGuess);
  const pendingRoomKeyRef = useRef(session.roomKey);
  const deferredOverviewRef = useRef(false);
  const [achievementRefreshNeeded, setAchievementRefreshNeeded] =
    useState(false);
  const achievementGenerationRef = useRef(0);
  const guessRefreshHoldUntilRef = useRef(0);
  const achievementRequestIdRef = useRef(0);
  const achievementRequestsRef = useRef(new Map<number, number>());
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
  const latestBoardRef = useRef<{
    date: string;
    attempts: number;
    solved: boolean;
  } | null>(null);
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
          if (message.payload.syncOnly && latestBoardRef.current) {
            const latest = latestBoardRef.current;
            const draft = message.payload.draft;
            if (
              message.payload.date === latest.date &&
              message.payload.attempts === latest.attempts &&
              message.payload.solved === latest.solved &&
              draft &&
              draft.revision > draftRevisionRef.current &&
              !draftInFlightRef.current &&
              !draftPendingRef.current &&
              !pendingGuessRef.current &&
              JSON.stringify(draftLatestRef.current) ===
                draftSavedSnapshotRef.current
            ) {
              const snapshot = {
                rowIndex: draft.rowIndex,
                cells: draft.cells,
                activeIndex: draft.activeIndex,
              };
              draftRevisionRef.current = draft.revision;
              draftLatestRef.current = snapshot;
              draftSavedSnapshotRef.current = JSON.stringify(snapshot);
              setCurrentLetters(draft.cells);
              setActiveIndex(draft.activeIndex);
            }
            if (
              message.payload.date < latest.date ||
              (message.payload.date === latest.date &&
                message.payload.attempts <= latest.attempts &&
                (!message.payload.solved || latest.solved))
            ) {
              if (pendingGuessRef.current) {
                deferredOverviewRef.current = true;
              } else {
                achievementGenerationRef.current++;
                achievementRequestsRef.current.clear();
                setAchievementRefreshNeeded(true);
              }
              return;
            }
          }
          latestBoardRef.current = {
            date: message.payload.date,
            attempts: message.payload.attempts,
            solved: message.payload.solved,
          };
          if (pendingGuessRef.current && message.payload.achievementOverview)
            deferredOverviewRef.current = true;
          guessRefreshHoldUntilRef.current = 0;
          achievementGenerationRef.current++;
          achievementRequestsRef.current.clear();
          setAchievementRefreshNeeded(
            !message.payload.achievementOverview ||
              message.payload.achievementPending === true,
          );
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
              overview: pendingGuessRef.current
                ? undefined
                : message.payload.achievementOverview,
              syncOnly: message.payload.syncOnly,
            });
            if (
              message.payload.achievementOverview &&
              !pendingGuessRef.current
            ) {
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
          if (
            message.payload.requestId &&
            message.payload.requestId !==
              pendingGuessRef.current?.payload.requestId
          )
            return;
          pendingGuessRef.current = null;
          setPendingGuess(null);
          writePendingGuess(session.roomKey, null);
          deferredOverviewRef.current = false;
          if (draftDateRef.current)
            latestBoardRef.current = {
              date: draftDateRef.current,
              attempts: message.payload.attempts,
              solved: message.payload.solved,
            };
          guessRefreshHoldUntilRef.current = 0;
          achievementGenerationRef.current++;
          achievementRequestsRef.current.clear();
          setAchievementRefreshNeeded(!message.payload.achievementUpdate);
          window.clearTimeout(draftAckTimeoutRef.current);
          draftInFlightRequestIdRef.current = null;
          draftInFlightRef.current = false;
          draftPendingRef.current = null;
          draftRequestRef.current = null;
          draftRevisionRef.current = 0;
          const emptyRow = {
            rowIndex: message.payload.guesses.length,
            cells: Array(message.payload.wordLength).fill(''),
            activeIndex: 0,
          };
          draftLatestRef.current = emptyRow;
          draftSavedSnapshotRef.current = JSON.stringify(emptyRow);
          setGuesses(message.payload.guesses);
          setSolved(message.payload.solved);
          if (message.payload.achievementUpdate !== undefined) {
            setStats(message.payload.achievementUpdate.overview.stats);
          }
          dispatchAchievements({
            type: 'guess',
            update: message.payload.achievementUpdate,
            baseline: message.payload.achievementBaseline,
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
        case 'achievement_refresh_result': {
          const requestGeneration = achievementRequestsRef.current.get(
            message.payload.requestId,
          );
          if (
            requestGeneration === undefined ||
            requestGeneration !== achievementGenerationRef.current
          )
            return;
          for (const id of achievementRequestsRef.current.keys()) {
            if (!message.payload.pending || id <= message.payload.requestId)
              achievementRequestsRef.current.delete(id);
          }
          dispatchAchievements({
            type: 'refresh',
            overview: message.payload.overview,
          });
          setStats(message.payload.overview.stats);
          setAchievementRefreshNeeded(message.payload.pending);
          return;
        }
        case 'guess_error':
          if (
            message.payload.requestId &&
            message.payload.requestId !==
              pendingGuessRef.current?.payload.requestId
          )
            return;
          pendingGuessRef.current = null;
          setPendingGuess(null);
          writePendingGuess(session.roomKey, null);
          if (!hasOverview || deferredOverviewRef.current)
            setAchievementRefreshNeeded(true);
          deferredOverviewRef.current = false;
          guessRefreshHoldUntilRef.current = 0;
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
    if (pendingRoomKeyRef.current === session.roomKey) return;
    pendingRoomKeyRef.current = session.roomKey;
    const restored = readPendingGuess(session.roomKey);
    pendingGuessRef.current = restored;
    deferredOverviewRef.current = false;
    setPendingGuess(restored);
    achievementGenerationRef.current++;
    achievementRequestsRef.current.clear();
    guessRefreshHoldUntilRef.current = 0;
    draftReadyRef.current = false;
    latestBoardRef.current = null;
    window.clearTimeout(draftAckTimeoutRef.current);
    setAchievementRefreshNeeded(false);
    setWordLength(null);
    setGuesses([]);
    setSolved(false);
    setStats(null);
    dispatchAchievements({ type: 'reset' });
  }, [session.roomKey]);

  useEffect(() => {
    if (
      !pendingGuess ||
      pendingGuessRef.current !== pendingGuess ||
      connectionState !== 'connected'
    )
      return;
    const timer = window.setInterval(
      () => send(pendingGuess),
      GUESS_ACK_TIMEOUT_MS,
    );
    return () => window.clearInterval(timer);
  }, [pendingGuess, connectionState, send]);

  useEffect(() => {
    if (!achievementRefreshNeeded || connectionState !== 'connected') return;
    const timer = window.setInterval(() => {
      if (Date.now() < guessRefreshHoldUntilRef.current) return;
      const requestId = ++achievementRequestIdRef.current;
      achievementRequestsRef.current.set(
        requestId,
        achievementGenerationRef.current,
      );
      if (achievementRequestsRef.current.size > 36) {
        const oldest = achievementRequestsRef.current.keys().next().value;
        if (oldest !== undefined) achievementRequestsRef.current.delete(oldest);
      }
      send({
        type: 'achievement_refresh',
        payload: { requestId },
      } satisfies WordleClientMessage);
    }, ACHIEVEMENT_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [achievementRefreshNeeded, connectionState, send]);

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
    if (
      !enabled ||
      solved ||
      wordLength === null ||
      revealingRow !== null ||
      pendingGuessRef.current
    )
      return;
    if (currentLetters.some((letter) => letter === '')) {
      triggerShake();
      return;
    }
    achievementGenerationRef.current++;
    achievementRequestsRef.current.clear();
    guessRefreshHoldUntilRef.current = Date.now() + GUESS_REFRESH_HOLD_MS;
    const request: PendingGuess = {
      type: 'guess',
      payload: {
        guess: currentLetters.join(''),
        requestId: crypto.randomUUID(),
        ...(draftDateRef.current ? { date: draftDateRef.current } : {}),
        captureAchievementBaseline: true,
      },
    };
    pendingGuessRef.current = request;
    setPendingGuess(request);
    writePendingGuess(session.roomKey, request);
    send(request);
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
