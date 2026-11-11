import { db, type Db } from '@marquinhos/database/client';
import { AchievementService } from '../../src/modules/gamification/achievement.service';
import { LevelingService } from '../../src/modules/gamification/leveling.service';
import { GlobalWordleMode } from '../../src/modules/wordle/modes/global-wordle.mode';
import { GuildWordleMode } from '../../src/modules/wordle/modes/guild-wordle.mode';
import { WordleHistoryService } from '../../src/modules/wordle/progression/wordle-history.service';
import { WordBankService } from '../../src/modules/wordle/services/word-bank.service';
import { WordleAchievementService } from '../../src/modules/wordle/services/wordle-achievement.service';
import { WordleAlbumMilestoneService } from '../../src/modules/wordle/services/wordle-album-milestone.service';
import { WordleAlbumService } from '../../src/modules/wordle/services/wordle-album.service';
import { recordWordlePresence } from '../../src/modules/wordle/services/wordle-community.service';
import { getRecifeDate } from '../../src/modules/wordle/services/wordle-date';
import { WordleDraftService } from '../../src/modules/wordle/services/wordle-draft.service';
import { WordleGalleryService } from '../../src/modules/wordle/services/wordle-gallery.service';
import { WordleGlobalAchievementService } from '../../src/modules/wordle/services/wordle-global-achievement.service';
import { WordleGlobalAnnouncementService } from '../../src/modules/wordle/services/wordle-global-announcement.service';
import { WordleGlobalDayService } from '../../src/modules/wordle/services/wordle-global-day.service';
import { WordleGlobalDraftService } from '../../src/modules/wordle/services/wordle-global-draft.service';
import { WordleGlobalGameCoordinator } from '../../src/modules/wordle/services/wordle-global-game-coordinator';
import { WordleGlobalGameplayService } from '../../src/modules/wordle/services/wordle-global-gameplay.service';
import { WordleGlobalLeaderboardService } from '../../src/modules/wordle/services/wordle-global-leaderboard.service';
import { WordleGoalsService } from '../../src/modules/wordle/services/wordle-goals.service';
import { WordleNotificationService } from '../../src/modules/wordle/services/wordle-notification.service';
import { WordleParticipationService } from '../../src/modules/wordle/services/wordle-participation.service';
import { WordleRewardsService } from '../../src/modules/wordle/services/wordle-rewards.service';
import { WordleShowcaseService } from '../../src/modules/wordle/services/wordle-showcase.service';
import { WordleWordlistReviewService } from '../../src/modules/wordle/services/wordle-wordlist-review.service';
import { WordleUserConfigService } from '../../src/modules/wordle/wordle-user-config.service';
import { WordleService } from '../../src/modules/wordle/wordle.service';

export function createWordleTestServices(
  database: Db = db,
  options: { now?: () => number; today?: () => string } = {},
) {
  const now = options.now ?? Date.now;
  const today = options.today ?? getRecifeDate;
  const wordBank = new WordBankService(database);
  const leveling = new LevelingService(database);
  const genericAchievements = new AchievementService(leveling, database);
  const achievements = new WordleAchievementService(
    database,
    genericAchievements,
  );
  const notifications = new WordleNotificationService(database, now);
  const albumMilestones = new WordleAlbumMilestoneService(database, now);
  const album = new WordleAlbumService(
    database,
    albumMilestones,
    notifications,
  );
  const globalAchievements = new WordleGlobalAchievementService(
    database,
    leveling,
    album,
    new WordleHistoryService(database),
    now,
  );
  const drafts = new WordleDraftService(database, achievements, now);
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
  const globalMode = new GlobalWordleMode(
    database,
    globalAchievements,
    globalAnnouncements,
    globalDay,
    globalDrafts,
    globalCoordinator,
    globalLeaderboard,
    participation,
    today,
  );
  const guildMode = new GuildWordleMode(
    database,
    wordBank,
    drafts,
    achievements,
    today,
    now,
  );
  const wordle = new WordleService(
    database,
    participation,
    wordBank,
    globalMode,
    guildMode,
    today,
    now,
  );

  return {
    wordBank,
    leveling,
    genericAchievements,
    achievements,
    notifications,
    albumMilestones,
    album,
    globalAchievements,
    drafts,
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
    globalMode,
    guildMode,
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
  return createWordleTestServices(database).achievements;
}

export function createWordleTestDraftService(
  now: () => number = Date.now,
  database: Db = db,
) {
  return createWordleTestServices(database, { now }).drafts;
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
