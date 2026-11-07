import { Module } from '@nestjs/common';
import { ConfigModule } from 'config/config.module';
import { DatabaseModule } from 'database/database.module';
import { StartupService } from 'startup/startup.service';

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [StartupService],
})
export class StartupModule {}
