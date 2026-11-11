import { closeDefaultDb, db } from '@marquinhos/database/client';
import {
  wordleCommunityDailyPresence,
  wordleGlobalDays,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { prepareGlobalWordleCutover } from '../../src/modules/wordle/migration/global-cutover';
import { auditWordlePreservation } from '../../src/modules/wordle/migration/wordle-preservation';
import { getRecifeDate } from '../../src/modules/wordle/services/wordle-date';
import { createWordleTestService } from './wordleServices';

try {
  const date = getRecifeDate();
  const inventory = await auditWordlePreservation(db);
  await prepareGlobalWordleCutover(db, {
    sourceTag: 'fresh',
    cutoverDate: date,
    before: inventory,
  });
  await db
    .insert(wordleGlobalDays)
    .values({ word_date: date, word: 'termo', word_length: 5, created_at: 1 });
  const service = createWordleTestService();
  const dayA = await service.getDailyWord('community-a');
  const dayB = await service.getDailyWord('community-b');
  const played = await service.submitGuess(
    'global-player',
    'community-a',
    'porta',
  );
  await service.recordParticipation('global-player', 'community-b');
  const rankA = await service.getLeaderboard('community-a', 10, 'daily', date);
  const rankB = await service.getLeaderboard('community-b', 10, 'daily', date);
  const rankOther = await service.getLeaderboard(
    'community-c',
    10,
    'daily',
    date,
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
  const won = await service.submitGuess(
    'global-player',
    'community-a',
    'termo',
  );
  await db.insert(wordleCommunityDailyPresence).values({
    guild_id: 'community-late',
    user_id: 'global-player',
    word_date: date,
    first_seen_at: Math.floor(Date.now() / 1000) + 60,
  });
  const unannouncedA = await service.getUnannouncedWins('community-a');
  const unannouncedB = await service.getUnannouncedWins('community-b');
  const unannouncedLate = await service.getUnannouncedWins('community-late');
  const claims = [
    await service.markAnnounced('global-player', 'community-a'),
    await service.markAnnounced('global-player', 'community-a'),
    await service.markAnnounced('global-player', 'community-late'),
  ];
  const announcedA = await service.getUnannouncedWins('community-a');
  const streak = await service.getStreak('global-player', 'community-b');
  const yesterday = new Date(`${date}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const previousDate = yesterday.toISOString().slice(0, 10);
  await db.insert(wordleGlobalDays).values({
    word_date: previousDate,
    word: 'carta',
    word_length: 5,
    created_at: 1,
  });
  await db.insert(wordleGlobalSessions).values({
    id: 'previous-session',
    user_id: 'previous-player',
    word_date: previousDate,
    attempts: 1,
    created_at: 1,
    guesses: JSON.stringify([
      {
        guess: 'porta',
        feedback: ['absent', 'absent', 'correct', 'absent', 'correct'],
      },
    ]),
  });
  await db.insert(wordleCommunityDailyPresence).values({
    guild_id: 'community-a',
    user_id: 'previous-player',
    word_date: previousDate,
    first_seen_at: 1,
  });
  const closedDay = await service.getDayGuesses('community-a', previousDate);
  const unrelatedDay = await service.getDayGuesses('community-c', previousDate);
  let forced = false;
  try {
    await service.forceNewWord('community-a');
    forced = true;
  } catch {}
  const rotatedA = await service.rotateDailyWord('community-a');
  const rotatedB = await service.rotateDailyWord('community-b');
  console.log(
    JSON.stringify({
      dayA: dayA.word,
      dayB: dayB.word,
      played,
      rankA,
      rankB,
      rankOther,
      session,
      before,
      saved,
      after,
      won,
      unannouncedA,
      unannouncedB,
      unannouncedLate,
      claims,
      announcedA,
      streak,
      closedDay,
      unrelatedDay,
      forced,
      rotatedA,
      rotatedB,
    }),
  );
} finally {
  await closeDefaultDb();
}
