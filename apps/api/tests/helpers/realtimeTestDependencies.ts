import { db, type Db } from '@marquinhos/database/client';
import { BoggleWordBankService } from '../../src/modules/activity/games/boggle/boggle-word-bank.service';
import { PongCompetitionService } from '../../src/modules/activity/games/pong/pong-competition.service';
import { AchievementService } from '../../src/modules/gamification/achievement.service';
import { GamificationService } from '../../src/modules/gamification/gamification.service';
import { LevelingService } from '../../src/modules/gamification/leveling.service';
import { WordBankService } from '../../src/modules/wordle/words/word-bank.service';
import type { RoomDependencies } from '../../src/realtime/room-dependencies';
import { createWordleTestService } from './wordleServices';
import { testWsSessionTokens } from './wsSessionTokens';

export function createRealtimeTestDependencies(
  database: Db = db,
): RoomDependencies {
  const leveling = new LevelingService(database);
  const achievements = new AchievementService(leveling, database);

  return {
    gamification: new GamificationService(leveling, achievements, database),
    wordle: createWordleTestService(undefined, database),
    wordBank: new WordBankService(database),
    boggleWordBank: new BoggleWordBankService(),
    pongCompetition: new PongCompetitionService(database),
    wsSessionTokens: testWsSessionTokens,
  };
}

export const testRoomDependencies = createRealtimeTestDependencies();
