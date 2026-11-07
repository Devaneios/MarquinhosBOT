import { Module } from '@nestjs/common';
import { ConfigModule } from 'config/config.module';
import { DatabaseModule } from 'database/database.module';
import { GamificationModule } from 'modules/gamification/gamification.module';
import { StartupService } from 'startup/startup.service';

@Module({
  imports: [ConfigModule, DatabaseModule, GamificationModule],
  providers: [StartupService],
})
export class StartupModule {}
