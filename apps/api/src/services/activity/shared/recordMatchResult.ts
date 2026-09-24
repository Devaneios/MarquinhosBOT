import { randomUUID } from 'crypto';
import type { GameResultInput } from 'services/gamification/types';
import { logger } from 'utils/logger';

interface GameResultRecorder {
  recordGameResult(input: GameResultInput): void | Promise<void>;
}

// Sessions call this once per finished match (each guards with its own
// resultRecorded flag), so every call is a new match and gets its own id.
// A failure is logged, not thrown: results are often recorded from timers
// (bot moves, disconnect forfeits), where a throw or an unhandled rejection
// would crash the process. Callers don't wait for the write.
export function recordMatchResult(
  recorder: GameResultRecorder,
  input: Omit<GameResultInput, 'sessionId'>,
): void {
  const logFailure = (error: unknown) =>
    logger.error('activity.record_match_result_failed', {
      error,
      gameType: input.gameType,
      guildId: input.guildId,
    });
  try {
    Promise.resolve(
      recorder.recordGameResult({ ...input, sessionId: randomUUID() }),
    ).catch(logFailure);
  } catch (error) {
    logFailure(error);
  }
}
