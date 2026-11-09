import { Module } from '@nestjs/common';
import { ActivityAuthGuard } from 'common/guards/activity-auth.guard';
import { BotAuthGuard } from 'common/guards/bot-auth.guard';
import { GuildMemberGuard } from 'common/guards/guild-member.guard';
import { DatabaseModule } from 'database/database.module';
import { DiscordModule } from 'integrations/discord/discord.module';
import { GamificationModule } from 'modules/gamification/gamification.module';
import { WordleAlbumController } from 'modules/wordle/controllers/wordle-album.controller';
import { WordleBingoController } from 'modules/wordle/controllers/wordle-bingo.controller';
import { WordleChallengesController } from 'modules/wordle/controllers/wordle-challenges.controller';
import { WordleGalleryController } from 'modules/wordle/controllers/wordle-gallery.controller';
import { WordleGoalsController } from 'modules/wordle/controllers/wordle-goals.controller';
import { WordleNotificationsController } from 'modules/wordle/controllers/wordle-notifications.controller';
import { WordleRewardsController } from 'modules/wordle/controllers/wordle-rewards.controller';
import { WordleShowcaseController } from 'modules/wordle/controllers/wordle-showcase.controller';
import { WordleUserConfigController } from 'modules/wordle/controllers/wordle-user-config.controller';
import { WordleController } from 'modules/wordle/controllers/wordle.controller';
import { WordBankService } from 'modules/wordle/services/word-bank.service';
import { WordleAchievementService } from 'modules/wordle/services/wordle-achievement.service';
import { WordleAlbumMilestoneService } from 'modules/wordle/services/wordle-album-milestone.service';
import { WordleAlbumService } from 'modules/wordle/services/wordle-album.service';
import { WordleBingoService } from 'modules/wordle/services/wordle-bingo.service';
import { WordleChallengeService } from 'modules/wordle/services/wordle-challenge.service';
import { getRecifeDate } from 'modules/wordle/services/wordle-date';
import { WordleDraftService } from 'modules/wordle/services/wordle-draft.service';
import { WordleGalleryService } from 'modules/wordle/services/wordle-gallery.service';
import { WordleGlobalAchievementService } from 'modules/wordle/services/wordle-global-achievement.service';
import { WordleGlobalAnnouncementService } from 'modules/wordle/services/wordle-global-announcement.service';
import { WordleGlobalDayService } from 'modules/wordle/services/wordle-global-day.service';
import { WordleGlobalDraftService } from 'modules/wordle/services/wordle-global-draft.service';
import { WordleGlobalGameCoordinator } from 'modules/wordle/services/wordle-global-game-coordinator';
import { WordleGlobalGameplayService } from 'modules/wordle/services/wordle-global-gameplay.service';
import { WordleGlobalLeaderboardService } from 'modules/wordle/services/wordle-global-leaderboard.service';
import { WordleGoalsService } from 'modules/wordle/services/wordle-goals.service';
import { WordleNotificationService } from 'modules/wordle/services/wordle-notification.service';
import { WordlePlayerOverviewService } from 'modules/wordle/services/wordle-player-overview.service';
import { WordleRewardsService } from 'modules/wordle/services/wordle-rewards.service';
import { WordleShowcaseService } from 'modules/wordle/services/wordle-showcase.service';
import { WordleUserConfigService } from 'modules/wordle/wordle-user-config.service';
import { WordleService } from 'modules/wordle/wordle.service';
import {
  WORDLE_ANSWER_WORDS,
  WORDLE_DEVANEIOS_WORDS,
  WORDLE_GUESS_RESOLVER,
  WORDLE_NOW,
  WORDLE_RANDOM,
  WORDLE_TODAY,
} from 'modules/wordle/wordle.tokens';

@Module({
  imports: [DatabaseModule, DiscordModule, GamificationModule],
  controllers: [
    WordleController,
    WordleAlbumController,
    WordleBingoController,
    WordleChallengesController,
    WordleGalleryController,
    WordleGoalsController,
    WordleNotificationsController,
    WordleRewardsController,
    WordleShowcaseController,
    WordleUserConfigController,
  ],
  providers: [
    ActivityAuthGuard,
    BotAuthGuard,
    GuildMemberGuard,
    WordBankService,
    WordleAchievementService,
    WordleAlbumMilestoneService,
    WordleAlbumService,
    WordleBingoService,
    WordleChallengeService,
    WordleDraftService,
    WordleGalleryService,
    WordleGlobalAchievementService,
    WordleGlobalAnnouncementService,
    WordleGlobalDayService,
    WordleGlobalDraftService,
    WordleGlobalGameCoordinator,
    WordleGlobalGameplayService,
    WordleGlobalLeaderboardService,
    WordleGoalsService,
    WordleNotificationService,
    WordlePlayerOverviewService,
    WordleRewardsService,
    WordleShowcaseService,
    WordleUserConfigService,
    WordleService,
    { provide: WORDLE_NOW, useValue: Date.now },
    { provide: WORDLE_TODAY, useValue: getRecifeDate },
    { provide: WORDLE_RANDOM, useValue: Math.random },
    {
      provide: WORDLE_ANSWER_WORDS,
      useFactory: (words: WordBankService) => words.getAnswerWordlist(),
      inject: [WordBankService],
    },
    {
      provide: WORDLE_DEVANEIOS_WORDS,
      useFactory: (words: WordBankService) => words.getDevaneiosWordlist(),
      inject: [WordBankService],
    },
    {
      provide: WORDLE_GUESS_RESOLVER,
      useFactory: (words: WordBankService) =>
        words.resolveCanonical.bind(words),
      inject: [WordBankService],
    },
  ],
  exports: [
    WordBankService,
    WordleGalleryService,
    WordleGoalsService,
    WordleNotificationService,
    WordleService,
  ],
})
export class WordleModule {}
