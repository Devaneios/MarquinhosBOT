import { Module } from '@nestjs/common';
import { ActivityAuthGuard } from 'common/guards/activity-auth.guard';
import { BotAuthGuard } from 'common/guards/bot-auth.guard';
import { GuildMemberGuard } from 'common/guards/guild-member.guard';
import { DatabaseModule } from 'database/database.module';
import { DiscordModule } from 'integrations/discord/discord.module';
import { GamificationModule } from 'modules/gamification/gamification.module';
import { WordleAlbumMilestoneService } from 'modules/wordle/community/wordle-album-milestone.service';
import { WordleAlbumController } from 'modules/wordle/community/wordle-album.controller';
import { WordleAlbumService } from 'modules/wordle/community/wordle-album.service';
import { WordleBingoController } from 'modules/wordle/community/wordle-bingo.controller';
import { WordleBingoService } from 'modules/wordle/community/wordle-bingo.service';
import { WordleChallengeService } from 'modules/wordle/community/wordle-challenge.service';
import { WordleChallengesController } from 'modules/wordle/community/wordle-challenges.controller';
import { WordleGalleryController } from 'modules/wordle/community/wordle-gallery.controller';
import { WordleGalleryService } from 'modules/wordle/community/wordle-gallery.service';
import { WordleGoalsController } from 'modules/wordle/community/wordle-goals.controller';
import { WordleGoalsService } from 'modules/wordle/community/wordle-goals.service';
import { WordleParticipationService } from 'modules/wordle/community/wordle-participation.service';
import { WordleGlobalAnnouncementService } from 'modules/wordle/gameplay/wordle-global-announcement.service';
import { WordleGlobalDayService } from 'modules/wordle/gameplay/wordle-global-day.service';
import { WordleGlobalDraftService } from 'modules/wordle/gameplay/wordle-global-draft.service';
import { WordleGlobalGameCoordinator } from 'modules/wordle/gameplay/wordle-global-game-coordinator';
import { WordleGlobalGameplayService } from 'modules/wordle/gameplay/wordle-global-gameplay.service';
import { WordleGlobalLeaderboardService } from 'modules/wordle/gameplay/wordle-global-leaderboard.service';
import { WordleNotificationService } from 'modules/wordle/notifications/wordle-notification.service';
import { WordleNotificationsController } from 'modules/wordle/notifications/wordle-notifications.controller';
import { WordleGlobalAchievementService } from 'modules/wordle/progression/wordle-global-achievement.service';
import { WordleHistoryService } from 'modules/wordle/progression/wordle-history.service';
import { WordlePlayerOverviewService } from 'modules/wordle/progression/wordle-player-overview.service';
import { WordleRewardsController } from 'modules/wordle/progression/wordle-rewards.controller';
import { WordleRewardsService } from 'modules/wordle/progression/wordle-rewards.service';
import { WordleShowcaseController } from 'modules/wordle/progression/wordle-showcase.controller';
import { WordleShowcaseService } from 'modules/wordle/progression/wordle-showcase.service';
import { WordleUserConfigController } from 'modules/wordle/progression/wordle-user-config.controller';
import { WordleUserConfigService } from 'modules/wordle/progression/wordle-user-config.service';
import { getRecifeDate } from 'modules/wordle/wordle-date';
import { WordleController } from 'modules/wordle/wordle.controller';
import { WordleService } from 'modules/wordle/wordle.service';
import {
  type WordSource,
  WORDLE_ANSWER_WORDS,
  WORDLE_DEVANEIOS_WORDS,
  WORDLE_GUESS_RESOLVER,
  WORDLE_NOW,
  WORDLE_RANDOM,
  WORDLE_TODAY,
} from 'modules/wordle/wordle.tokens';
import { WordBankService } from 'modules/wordle/words/word-bank.service';
import { WordleWordlistReviewService } from 'modules/wordle/words/wordle-wordlist-review.service';

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
    WordleAlbumMilestoneService,
    WordleAlbumService,
    WordleBingoService,
    WordleChallengeService,
    WordleGalleryService,
    WordleGlobalAchievementService,
    WordleHistoryService,
    WordleGlobalAnnouncementService,
    WordleGlobalDayService,
    WordleGlobalDraftService,
    WordleGlobalGameCoordinator,
    WordleGlobalGameplayService,
    WordleGlobalLeaderboardService,
    WordleGoalsService,
    WordleNotificationService,
    WordlePlayerOverviewService,
    WordleParticipationService,
    WordleRewardsService,
    WordleShowcaseService,
    WordleUserConfigService,
    WordleWordlistReviewService,
    WordleService,
    { provide: WORDLE_NOW, useValue: Date.now },
    { provide: WORDLE_TODAY, useValue: getRecifeDate },
    { provide: WORDLE_RANDOM, useValue: Math.random },
    {
      provide: WORDLE_ANSWER_WORDS,
      useFactory:
        (words: WordBankService): WordSource =>
        () =>
          words.getAnswerWordlist(),
      inject: [WordBankService],
    },
    {
      provide: WORDLE_DEVANEIOS_WORDS,
      useFactory:
        (words: WordBankService): WordSource =>
        () =>
          words.getDevaneiosWordlist(),
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
    WordleAlbumService,
    WordleGlobalGameCoordinator,
    WordleGalleryService,
    WordleGoalsService,
    WordleNotificationService,
    WordleService,
  ],
})
export class WordleModule {}
