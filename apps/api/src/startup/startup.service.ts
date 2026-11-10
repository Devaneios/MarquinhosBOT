import type { Db } from '@marquinhos/database/client';
import {
  Inject,
  Injectable,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { logger } from 'common/logging/logger';
import { AppConfig } from 'config/app.config';
import { DB } from 'database/database.tokens';
import { BoggleWordBankService } from 'modules/activity/games/boggle/boggle-word-bank.service';
import {
  AI_AGENT_DAILY_QUOTA_SERVICE,
  AI_RESEARCH_DAILY_QUOTA_SERVICE,
} from 'modules/ai-chat/ai-chat.tokens';
import { DailyQuotaService } from 'modules/ai-chat/daily-quota.service';
import { describeStaticPrompts } from 'modules/ai-chat/prompt-registry';
import { RateLimitService } from 'modules/ai-chat/rate-limit.service';
import { ResearchOrchestrator } from 'modules/ai-chat/research/research-orchestrator.service';
import { GamificationService } from 'modules/gamification/index';
import { WordBankService } from 'modules/wordle/services/word-bank.service';
import { WordleService } from 'modules/wordle/wordle.service';
import {
  STARTUP_IMPORT_SQLITE,
  STARTUP_RUN_MIGRATIONS,
  STARTUP_START_MAINTENANCE,
  type StartupImportSqlite,
  type StartupRunMigrations,
  type StartupStartMaintenance,
} from 'startup/startup.tokens';

@Injectable()
export class StartupService implements OnModuleInit, OnApplicationShutdown {
  private stopMaintenance?: () => void;

  constructor(
    @Inject(DB) private readonly database: Db,
    @Inject(STARTUP_RUN_MIGRATIONS)
    private readonly runMigrations: StartupRunMigrations,
    @Inject(STARTUP_IMPORT_SQLITE)
    private readonly importSqlite: StartupImportSqlite,
    @Inject(STARTUP_START_MAINTENANCE)
    private readonly startMaintenance: StartupStartMaintenance,
    private readonly config: AppConfig,
    private readonly gamificationService: GamificationService,
    private readonly rateLimitService: RateLimitService,
    @Inject(AI_AGENT_DAILY_QUOTA_SERVICE)
    private readonly agentQuota: DailyQuotaService,
    @Inject(AI_RESEARCH_DAILY_QUOTA_SERVICE)
    private readonly researchQuota: DailyQuotaService,
    private readonly research: ResearchOrchestrator,
    private readonly wordBank: WordBankService,
    private readonly boggleWordBank: BoggleWordBankService,
    private readonly wordleService: WordleService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.runMigrations(this.database);

    if (this.config.sqlitePath) {
      const outcome = await this.importSqlite(
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

    await this.gamificationService.initializeDefaults();
    await this.rateLimitService.seedDefaults();
    await this.agentQuota.seedDefaults();
    await this.researchQuota.seedDefaults();
    await this.research.reapStaleJobs();
    await this.wordBank.loadBannedWords();
    await this.wordleService.finalizeExpiredDrafts();
    logger.info('ai.prompts.loaded', { prompts: describeStaticPrompts() });
    this.boggleWordBank.getWordSet();
    this.wordBank.warm();

    this.stopMaintenance = this.startMaintenance(this.database);
  }

  onApplicationShutdown(): void {
    this.stopMaintenance?.();
  }
}
