import type { WordlePatternFamily } from '../families';
import type {
  DrawingDefinition,
  WordleAchievementFacts,
  WordleAchievementResult,
} from '../types';
import {
  bestParticipationStreak,
  elapsedSeconds,
  hasCalendarCoverage,
} from './history';

const DEVANEIOS = 'DEVANEIOS';

export function counter(
  current: number,
  target: number,
): WordleAchievementResult {
  return {
    met: current >= target,
    progress: { current: Math.min(current, target), target },
  };
}

export function flag(met: boolean): WordleAchievementResult {
  return { met, progress: null };
}

export function winsWithin(
  facts: WordleAchievementFacts,
  maxAttempts: number,
  target: number,
): WordleAchievementResult {
  return counter(
    facts.solved.filter(
      (day) => !day.solvedFromDraft && day.attempts <= maxAttempts,
    ).length,
    target,
  );
}

export function fastSolve(
  facts: WordleAchievementFacts,
  seconds: number,
  minAttempts: number,
): WordleAchievementResult {
  return flag(
    facts.solved.some((day) => {
      const elapsed = elapsedSeconds(day);
      return (
        day.attempts >= minAttempts && elapsed !== null && elapsed <= seconds
      );
    }),
  );
}

export function firstSolverWins(
  facts: WordleAchievementFacts,
  target: number,
): WordleAchievementResult {
  return counter(
    facts.solved.filter((day) => day.firstSolverInGuild).length,
    target,
  );
}

export function solvedAtHours(
  facts: WordleAchievementFacts,
  fromHour: number,
  toHour: number,
): WordleAchievementResult {
  return flag(
    facts.solvedHours.some((hour) => hour >= fromHour && hour < toHour),
  );
}

export function blankOpeningSolve(
  facts: WordleAchievementFacts,
): WordleAchievementResult {
  return flag(
    facts.solvedBoards.some(
      ({ day, feedback }) =>
        day.attempts >= 2 && feedback[0]?.every((cell) => cell === 'absent'),
    ),
  );
}

export function staircase(
  facts: WordleAchievementFacts,
  minAttempts: number,
): WordleAchievementResult {
  return flag(
    facts.solvedBoards.some(({ day, feedback }) => {
      if (day.attempts < minAttempts) return false;
      const counts = feedback.map(
        (row) => row.filter((cell) => cell === 'correct').length,
      );
      return counts.every((current, index) => {
        const previous = counts[index - 1];
        return previous === undefined || current > previous;
      });
    }),
  );
}

export function discoveredDrawing(
  facts: WordleAchievementFacts,
  drawing: DrawingDefinition,
): WordleAchievementResult {
  return flag(facts.discoveredPatternIds.has(drawing.patternId));
}

export function drawingCollection(
  facts: WordleAchievementFacts,
  family: WordlePatternFamily,
  target: number,
): WordleAchievementResult {
  return counter(facts.discoveredPatternCounts[family], target);
}

export function calendarCoverage(
  facts: WordleAchievementFacts,
  period: 'week' | 'month',
): WordleAchievementResult {
  return flag(hasCalendarCoverage(facts.participated, facts.today, period));
}

export function solvedExactly(
  facts: WordleAchievementFacts,
  attempts: number,
): WordleAchievementResult {
  return flag(facts.solved.some((day) => day.attempts === attempts));
}

export function zeroGuessWin(
  facts: WordleAchievementFacts,
): WordleAchievementResult {
  return flag(
    facts.solved.some(
      (day) =>
        day.solvedFromDraft && day.attempts === 0 && day.guesses.length === 0,
    ),
  );
}

export function allYellowGuess(
  facts: WordleAchievementFacts,
): WordleAchievementResult {
  return flag(
    facts.boards.some(({ feedback }) =>
      feedback.some((row) => row.every((cell) => cell === 'present')),
    ),
  );
}

export function mixedRows(
  facts: WordleAchievementFacts,
  target: number,
): WordleAchievementResult {
  return flag(
    facts.boards.some(({ day, feedback }) => {
      let consecutive = 0;
      for (const row of day.solved ? feedback.slice(0, -1) : feedback) {
        consecutive = new Set(row).size === 3 ? consecutive + 1 : 0;
        if (consecutive >= target) return true;
      }
      return false;
    }),
  );
}

export function nearMiss(
  facts: WordleAchievementFacts,
): WordleAchievementResult {
  return flag(
    facts.solvedBoards.some(({ feedback }) =>
      feedback
        .slice(0, -1)
        .some(
          (row) =>
            row.filter((cell) => cell === 'correct').length === row.length - 1,
        ),
    ),
  );
}

export function blankTwiceThenSolve(
  facts: WordleAchievementFacts,
): WordleAchievementResult {
  return flag(
    facts.solvedBoards.some(({ feedback }) => {
      const guessesBeforeSolve = feedback.slice(0, -1);
      return guessesBeforeSolve.some(
        (row, index) =>
          row.every((cell) => cell === 'absent') &&
          guessesBeforeSolve[index + 1]?.every((cell) => cell === 'absent'),
      );
    }),
  );
}

export function nearMissTwice(
  facts: WordleAchievementFacts,
): WordleAchievementResult {
  return flag(
    facts.boards.some(
      ({ feedback }) =>
        feedback.filter(
          (row) => row.filter((cell) => cell !== 'correct').length === 1,
        ).length >= 2,
    ),
  );
}

export function yellowOnlyBeforeSolve(
  facts: WordleAchievementFacts,
): WordleAchievementResult {
  return flag(
    facts.solvedBoards.some(({ feedback }) => {
      const guessesBeforeSolve = feedback.slice(0, -1);
      return (
        guessesBeforeSolve.length > 0 &&
        guessesBeforeSolve.every((row) =>
          row.every((cell) => cell === 'present'),
        )
      );
    }),
  );
}

export function anagramsOnlyBeforeSolve(
  facts: WordleAchievementFacts,
): WordleAchievementResult {
  return flag(
    facts.solvedBoards.some(({ feedback }) => {
      const guessesBeforeSolve = feedback.slice(0, -1);
      return (
        guessesBeforeSolve.length > 0 &&
        guessesBeforeSolve.every((row) =>
          row.every((cell) => cell !== 'absent'),
        )
      );
    }),
  );
}

export function answerLengths(
  facts: WordleAchievementFacts,
): WordleAchievementResult {
  return counter(
    new Set(
      facts.solved
        .map((day) => day.wordLength)
        .filter((length) => length === 5 || length === 6),
    ).size,
    2,
  );
}

export function answerFeature(
  facts: WordleAchievementFacts,
  feature: 'accent' | 'repeated_letters',
): WordleAchievementResult {
  return flag(
    facts.solved.some(
      (day) =>
        (feature === 'accent'
          ? day.answerHasAccent
          : day.answerHasRepeatedLetters) === true,
    ),
  );
}

function consumeDevaneiosLetters(
  prefix: string,
  greenLetters: readonly string[],
): { prefix: string; advanced: number } {
  let nextPrefix = prefix;
  let advanced = 0;
  for (const letter of greenLetters) {
    if (letter !== DEVANEIOS[nextPrefix.length]) continue;
    nextPrefix += letter;
    advanced += 1;
  }
  return { prefix: nextPrefix, advanced };
}

export function devaneiosRows(
  facts: WordleAchievementFacts,
): WordleAchievementResult {
  const prefixes = new Map<number, string>();
  let completed = false;

  for (const { day, feedback } of facts.boards) {
    for (let rowIndex = 0; rowIndex < feedback.length; rowIndex += 1) {
      const guess = day.guesses[rowIndex];
      const rowFeedback = feedback[rowIndex];
      if (guess === undefined || rowFeedback === undefined) continue;

      const greenLetters = [...guess.guess]
        .filter((_, column) => rowFeedback[column] === 'correct')
        .map((letter) => letter.toUpperCase());
      const currentPrefix = prefixes.get(rowIndex) ?? '';
      const continued = consumeDevaneiosLetters(currentPrefix, greenLetters);
      const nextPrefix =
        continued.advanced > 0
          ? continued.prefix
          : consumeDevaneiosLetters('', greenLetters).prefix;

      prefixes.set(rowIndex, nextPrefix);
      if (nextPrefix === DEVANEIOS) completed = true;
    }
  }

  let longestPrefix = completed ? DEVANEIOS.length : 0;
  for (const prefix of prefixes.values())
    longestPrefix = Math.max(longestPrefix, prefix.length);
  return counter(longestPrefix, DEVANEIOS.length);
}

export function participationStreak(
  facts: WordleAchievementFacts,
  days: number,
): WordleAchievementResult {
  return counter(bestParticipationStreak(facts.participated), days);
}
