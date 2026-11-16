import { db, type Db } from '@marquinhos/database/client';
import { LevelingService } from '../../src/modules/gamification/leveling.service';
import { WordleAlbumMilestoneService } from '../../src/modules/wordle/community/wordle-album-milestone.service';
import { WordleAlbumService } from '../../src/modules/wordle/community/wordle-album.service';
import { recordWordlePresence } from '../../src/modules/wordle/community/wordle-community.service';
import { WordleGalleryService } from '../../src/modules/wordle/community/wordle-gallery.service';
import { WordleGoalsService } from '../../src/modules/wordle/community/wordle-goals.service';
import { WordleParticipationService } from '../../src/modules/wordle/community/wordle-participation.service';
import { WordleGlobalAnnouncementService } from '../../src/modules/wordle/gameplay/wordle-global-announcement.service';
import { WordleGlobalDayService } from '../../src/modules/wordle/gameplay/wordle-global-day.service';
import { WordleGlobalDraftService } from '../../src/modules/wordle/gameplay/wordle-global-draft.service';
import { WordleGlobalGameCoordinator } from '../../src/modules/wordle/gameplay/wordle-global-game-coordinator';
import { WordleGlobalGameplayService } from '../../src/modules/wordle/gameplay/wordle-global-gameplay.service';
import { WordleGlobalLeaderboardService } from '../../src/modules/wordle/gameplay/wordle-global-leaderboard.service';
import { WordleNotificationService } from '../../src/modules/wordle/notifications/wordle-notification.service';
import { WordleGlobalAchievementService } from '../../src/modules/wordle/progression/wordle-global-achievement.service';
import { WordleHistoryService } from '../../src/modules/wordle/progression/wordle-history.service';
import { WordleRewardsService } from '../../src/modules/wordle/progression/wordle-rewards.service';
import { WordleShowcaseService } from '../../src/modules/wordle/progression/wordle-showcase.service';
import { WordleUserConfigService } from '../../src/modules/wordle/progression/wordle-user-config.service';
import { getRecifeDate } from '../../src/modules/wordle/wordle-date';
import { WordleService } from '../../src/modules/wordle/wordle.service';
import { WordBankService } from '../../src/modules/wordle/words/word-bank.service';
import { WordleWordlistReviewService } from '../../src/modules/wordle/words/wordle-wordlist-review.service';

export function createWordleTestServices(
  database: Db = db,
  options: { now?: () => number; today?: () => string } = {},
) {
  const now = options.now ?? Date.now;
  const today = options.today ?? getRecifeDate;
  const wordBank = new WordBankService(database);
  const leveling = new LevelingService(database);
  const notifications = new WordleNotificationService(database, now);
  const albumMilestones = new WordleAlbumMilestoneService(database, now);
  const album = new WordleAlbumService(
    database,
    albumMilestones,
    notifications,
    now,
  );
  const globalAchievements = new WordleGlobalAchievementService(
    database,
    leveling,
    album,
    new WordleHistoryService(database),
    now,
  );
  const globalDrafts = new WordleGlobalDraftService(
    database,
    globalAchievements,
    now,
  );
  const globalGameplay = new WordleGlobalGameplayService(
    database,
    (guess) => wordBank.resolveCanonical(guess),
    now,
  );
  const globalCoordinator = new WordleGlobalGameCoordinator(
    globalGameplay,
    globalAchievements,
  );
  const globalDay = new WordleGlobalDayService(
    database,
    () => wordBank.getAnswerWordlist(),
    () => wordBank.getDevaneiosWordlist(),
    Math.random,
    now,
  );
  const globalAnnouncements = new WordleGlobalAnnouncementService(
    database,
    now,
  );
  const globalLeaderboard = new WordleGlobalLeaderboardService(database);
  const goals = new WordleGoalsService(database, notifications, now);
  const gallery = new WordleGalleryService(database, notifications, now);
  const rewards = new WordleRewardsService(database, now);
  const showcase = new WordleShowcaseService(database);
  const userConfig = new WordleUserConfigService(database);
  const wordlistReview = new WordleWordlistReviewService(database, wordBank);
  const participation = new WordleParticipationService(
    database,
    album,
    today,
    now,
  );
  const wordle = new WordleService(
    database,
    globalAchievements,
    globalAnnouncements,
    globalDay,
    globalDrafts,
    globalCoordinator,
    globalLeaderboard,
    participation,
    wordBank,
    new WordleHistoryService(database),
    today,
    now,
  );

  return {
    wordBank,
    leveling,
    notifications,
    albumMilestones,
    album,
    globalAchievements,
    globalDrafts,
    globalGameplay,
    globalCoordinator,
    globalDay,
    globalAnnouncements,
    globalLeaderboard,
    goals,
    gallery,
    rewards,
    showcase,
    userConfig,
    wordlistReview,
    participation,
    wordle,
  };
}

export function createWordleTestWordBankService(database: Db = db) {
  return new WordBankService(database);
}

export function createWordleTestService(
  today?: () => string,
  database: Db = db,
) {
  return createWordleTestServices(database, { today }).wordle;
}

export function createWordleTestAchievementService(database: Db = db) {
  return createWordleTestServices(database).globalAchievements;
}

export function createWordleTestAlbumService(database: Db = db) {
  return createWordleTestServices(database).album;
}

export function createWordleTestGoalsService(
  now: () => number = Date.now,
  database: Db = db,
) {
  return createWordleTestServices(database, { now }).goals;
}

export function createWordleTestGalleryService(
  now: () => number = Date.now,
  database: Db = db,
) {
  return createWordleTestServices(database, { now }).gallery;
}

export function createWordleTestGlobalAchievementService(
  now: () => number = Date.now,
  database: Db = db,
) {
  return createWordleTestServices(database, { now }).globalAchievements;
}

export function createWordleTestGlobalDraftService(
  now: () => number = Date.now,
  database: Db = db,
) {
  return createWordleTestServices(database, { now }).globalDrafts;
}

export function createWordleTestGlobalDraftServiceWithAward(
  now: () => number,
  award: (userId: string, guildId: string) => Promise<unknown>,
  database: Db = db,
) {
  return new WordleGlobalDraftService(
    database,
    {
      checkAndAward: async (userId, guildId) => {
        await award(userId, guildId);
        return { unlockedIds: [] };
      },
    },
    now,
  );
}

export function createWordleTestPresence(
  database: Db,
  userId: string,
  guildId: string,
  date: string,
  timestamp: number,
) {
  return recordWordlePresence(
    database,
    createWordleTestServices(database).album,
    userId,
    guildId,
    date,
    timestamp,
  );
}
