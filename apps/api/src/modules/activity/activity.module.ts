import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { matchMaker } from 'colyseus';
import { BotAuthGuard } from 'common/guards/bot-auth.guard';
import { SharedBucketThrottlerGuard } from 'common/guards/shared-bucket-throttler.guard';
import { DatabaseModule } from 'database/database.module';
import { DiscordModule } from 'integrations/discord/discord.module';
import { ActivityDeepLinkService } from 'modules/activity/activity-deep-link.service';
import { ActivityController } from 'modules/activity/activity.controller';
import { ACTIVITY_ROOM_QUERY } from 'modules/activity/activity.tokens';
import { BoggleWordBankService } from 'modules/activity/games/boggle/boggle-word-bank.service';
import { PongCompetitionService } from 'modules/activity/games/pong/pong-competition.service';
import { PongTournamentService } from 'modules/activity/games/pong/pong-tournament.service';
import { GamificationModule } from 'modules/gamification/gamification.module';

@Module({
  imports: [
    DatabaseModule,
    DiscordModule,
    GamificationModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 20 }]),
  ],
  controllers: [ActivityController],
  providers: [
    BotAuthGuard,
    SharedBucketThrottlerGuard,
    BoggleWordBankService,
    ActivityDeepLinkService,
    PongCompetitionService,
    PongTournamentService,
    {
      provide: ACTIVITY_ROOM_QUERY,
      useValue: matchMaker.query.bind(matchMaker),
    },
  ],
  exports: [
    BoggleWordBankService,
    ActivityDeepLinkService,
    PongCompetitionService,
    PongTournamentService,
  ],
})
export class ActivityModule {}
