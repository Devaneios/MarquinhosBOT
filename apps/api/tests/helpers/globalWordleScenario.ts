import { closeDefaultDb, db } from '@marquinhos/database/client';
import { wordleGlobalDays } from '@marquinhos/database/schema';
import { WordleService } from '../../src/services/wordle';
import { getRecifeDate } from '../../src/services/wordle/wordleDate';
import { migrateGlobalWordle } from '../../src/services/wordle/WordleGlobalMigrationService';

try {
  const date = getRecifeDate();
  await migrateGlobalWordle(db);
  await db
    .insert(wordleGlobalDays)
    .values({ word_date: date, word: 'termo', word_length: 5, created_at: 1 });
  const service = new WordleService();
  const dayA = await service.getDailyWord('community-a');
  const dayB = await service.getDailyWord('community-b');
  const played = await service.submitGuess(
    'global-player',
    'community-a',
    'porta',
  );
  const session = await service.getUserSession('global-player', 'community-b');
  const before = await service.getUserDraft('global-player', 'community-b');
  const saved = await service.writeDraft('global-player', 'community-b', {
    date,
    rowIndex: 1,
    cells: ['t', '', '', '', ''],
    activeIndex: 1,
    expectedRevision: 1,
  });
  const after = await service.getUserDraft('global-player', 'community-a');
  console.log(
    JSON.stringify({
      dayA: dayA.word,
      dayB: dayB.word,
      played,
      session,
      before,
      saved,
      after,
    }),
  );
} finally {
  await closeDefaultDb();
}
