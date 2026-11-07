import { Module } from '@nestjs/common';
import { BotAuthGuard } from 'common/guards/bot-auth.guard';
import { ConfigModule } from 'config/config.module';
import { DatabaseModule } from 'database/database.module';
import { AchievementService } from 'modules/gamification/achievement.service';
import { EvolutiveAchievementsController } from 'modules/gamification/evolutive-achievements.controller';
import { EvolutiveAchievementsService } from 'modules/gamification/evolutive-achievements.service';
import { GamificationController } from 'modules/gamification/gamification.controller';
import { GamificationService } from 'modules/gamification/gamification.service';
import { LevelingService } from 'modules/gamification/leveling.service';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [GamificationController, EvolutiveAchievementsController],
  providers: [
    BotAuthGuard,
    GamificationService,
    AchievementService,
    LevelingService,
    EvolutiveAchievementsService,
  ],
  exports: [
    GamificationService,
    AchievementService,
    LevelingService,
    EvolutiveAchievementsService,
  ],
})
export class GamificationModule {}
