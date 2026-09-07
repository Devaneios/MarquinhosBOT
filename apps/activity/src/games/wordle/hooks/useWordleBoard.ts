import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { colyseusUrl } from '../../../lib/apiBase';
import type { WsSession } from '../../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../../shared/useColyseusRoom';
import { KB_LETTERS, MIN_KEY_PRESS_MS } from '../constants';
import type {
  GuessRow,
  WordleGuessErrorPayload,
  WordleGuessResultPayload,
  WordleInitPayload,
} from '../types';
import { buildLetterStates, normalizeKey } from '../wordle.utils';

export function useWordleBoard(session: WsSession) {
  const [wordLength, setWordLength] = useState<number | null>(null);
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [solved, setSolved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentLetters, setCurrentLetters] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [shake, setShake] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const shakeTimeout = useRef<number | undefined>(undefined);
  const errorTimeout = useRef<number | undefined>(undefined);
  const [pressedKeys, setPressedKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const pressTimers = useRef<Map<string, number>>(new Map());

  function triggerShake() {
    setShake(true);
    window.clearTimeout(shakeTimeout.current);
    shakeTimeout.current = window.setTimeout(() => setShake(false), 380);
  }

  const { send, connectionState } = useColyseusRoom(
    'wordle',
    session,
    colyseusUrl(),
    (message: ActivityMessage) => {
      if (message.type === 'init') {
        const payload = message.payload as WordleInitPayload;
        setWordLength(payload.wordLength);
        setGuesses(payload.guesses);
        setSolved(payload.solved);
        window.clearTimeout(errorTimeout.current);
        setError(null);
        setCurrentLetters(Array(payload.wordLength).fill(''));
        setActiveIndex(0);
      } else if (message.type === 'guess_result') {
        const payload = message.payload as WordleGuessResultPayload;
        setGuesses(payload.guesses);
        setSolved(payload.solved);
        window.clearTimeout(errorTimeout.current);
        setError(null);
        setCurrentLetters((prev) => prev.map(() => ''));
        setActiveIndex(0);
      } else if (message.type === 'guess_error') {
        const payload = message.payload as WordleGuessErrorPayload;
        setError(payload.message);
        window.clearTimeout(errorTimeout.current);
        errorTimeout.current = window.setTimeout(() => setError(null), 2500);
        triggerShake();
      }
    },
  );

  const letterStates = useMemo(() => buildLetterStates(guesses), [guesses]);

  useEffect(() => {
    const element = gridRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [guesses.length]);

  useEffect(() => {
    return () => {
      window.clearTimeout(shakeTimeout.current);
      window.clearTimeout(errorTimeout.current);
    };
  }, []);

  function typeLetter(letter: string) {
    if (solved || wordLength === null) return;
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
    if (solved || wordLength === null) return;
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

  function moveActive(delta: number) {
    if (wordLength === null) return;
    setActiveIndex((prev) =>
      Math.min(Math.max(prev + delta, 0), wordLength - 1),
    );
  }

  function submitGuess() {
    if (solved || wordLength === null) return;
    if (currentLetters.some((letter) => letter === '')) {
      triggerShake();
      return;
    }
    send({ type: 'guess', payload: { guess: currentLetters.join('') } });
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

  useEffect(() => {
    const timers = pressTimers.current;
    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    function resolveVirtualKey(event: KeyboardEvent): string | null {
      if (event.key === 'Enter') return 'Enter';
      if (event.key === 'Backspace') return 'Backspace';
      if (event.key.length !== 1) return null;
      const key = normalizeKey(event.key);
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
  }, [pressKey, releaseKey]);

  useEffect(() => {
    if (solved || wordLength === null) return;
    inputRefs.current[activeIndex]?.focus();
  }, [activeIndex, guesses.length, wordLength, solved]);

  function onKeyDownCell(
    _index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
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
      moveActive(-1);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveActive(1);
      return;
    }
    if (event.key.length !== 1) return;
    const key = normalizeKey(event.key);
    if (KB_LETTERS.has(key)) {
      event.preventDefault();
      typeLetter(key);
    }
  }

  return {
    wordLength,
    guesses,
    solved,
    error,
    currentLetters,
    activeIndex,
    inputRefs,
    shake,
    gridRef,
    pressedKeys,
    letterStates,
    connectionState,
    typeLetter,
    backspace,
    submitGuess,
    onKeyDownCell,
    setActiveIndex,
  };
}
