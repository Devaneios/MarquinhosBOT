import { importLegacySqliteOnce } from '@marquinhos/database/etl';
import { startMaintenance } from '@marquinhos/database/maintenance';
import { runMigrations } from '@marquinhos/database/migrate';
import { Module } from '@nestjs/common';
import { ConfigModule } from 'config/config.module';
import { DatabaseModule } from 'database/database.module';
import { ActivityModule } from 'modules/activity/activity.module';
import { AiChatModule } from 'modules/ai-chat/ai-chat.module';
import { GamificationModule } from 'modules/gamification/gamification.module';
import { assertGlobalWordleReady } from 'modules/wordle/wordle-readiness';
import { WordleModule } from 'modules/wordle/wordle.module';
import { StartupService } from 'startup/startup.service';
import {
  STARTUP_ASSERT_WORDLE_READY,
  STARTUP_IMPORT_SQLITE,
  STARTUP_RUN_MIGRATIONS,
  STARTUP_START_MAINTENANCE,
} from 'startup/startup.tokens';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    GamificationModule,
    WordleModule,
    AiChatModule,
    ActivityModule,
  ],
  providers: [
    StartupService,
    { provide: STARTUP_RUN_MIGRATIONS, useValue: runMigrations },
    { provide: STARTUP_IMPORT_SQLITE, useValue: importLegacySqliteOnce },
    { provide: STARTUP_ASSERT_WORDLE_READY, useValue: assertGlobalWordleReady },
    { provide: STARTUP_START_MAINTENANCE, useValue: startMaintenance },
  ],
})
export class StartupModule {}
