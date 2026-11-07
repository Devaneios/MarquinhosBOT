import type { Db } from '@marquinhos/database/client';
import { importLegacySqliteOnce } from '@marquinhos/database/etl';
import { startMaintenance } from '@marquinhos/database/maintenance';
import { runMigrations } from '@marquinhos/database/migrate';
import {
  Inject,
  Injectable,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { AppConfig } from 'config/app.config';
import { DB } from 'database/database.tokens';
import { GamificationService } from 'modules/gamification/index';
import {
  AGENT_DAILY_QUOTA,
  DailyQuotaService,
  RESEARCH_DAILY_QUOTA,
} from 'services/aiChat/DailyQuotaService';
import { describeStaticPrompts } from 'services/aiChat/promptRegistry';
import { RateLimitService } from 'services/aiChat/RateLimitService';
import { ResearchOrchestrator } from 'services/aiChat/research/ResearchOrchestrator';
import {
  getValidationSet,
  loadBannedWords,
  WordleService,
} from 'services/wordle';
import { logger } from 'utils/logger';

@Injectable()
export class StartupService implements OnModuleInit, OnApplicationShutdown {
  private stopMaintenance?: () => void;

  constructor(
    @Inject(DB) private readonly database: Db,
    private readonly config: AppConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    await runMigrations(this.database);

    if (this.config.sqlitePath) {
      const outcome = await importLegacySqliteOnce(
        this.config.sqlitePath,
        this.database,
      );
      if (outcome.status === 'imported') {
        logger.info('db.legacy_sqlite_imported', {
          snapshotPath: outcome.snapshotPath,
          tables: outcome.reports,
        });
      }
    }

    await new GamificationService().initializeDefaults();
    await new RateLimitService().seedDefaults();
    await new DailyQuotaService(AGENT_DAILY_QUOTA).seedDefaults();
    await new DailyQuotaService(RESEARCH_DAILY_QUOTA).seedDefaults();
    await new ResearchOrchestrator().reapStaleJobs();
    await loadBannedWords();
    await new WordleService().finalizeExpiredDrafts();
    logger.info('ai.prompts.loaded', { prompts: describeStaticPrompts() });
    getValidationSet();

    this.stopMaintenance = startMaintenance(this.database);
  }

  onApplicationShutdown(): void {
    this.stopMaintenance?.();
  }
}
