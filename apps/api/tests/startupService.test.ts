import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it } from 'bun:test';
import { AppConfig } from 'config/app.config';
import { DB } from 'database/database.tokens';
import { BoggleWordBankService } from 'modules/activity/games/boggle/boggle-word-bank.service';
import {
  AI_AGENT_DAILY_QUOTA_SERVICE,
  AI_RESEARCH_DAILY_QUOTA_SERVICE,
} from 'modules/ai-chat/ai-chat.tokens';
import { RateLimitService } from 'modules/ai-chat/rate-limit.service';
import { ResearchOrchestrator } from 'modules/ai-chat/research/research-orchestrator.service';
import { GamificationService } from 'modules/gamification/gamification.service';
import { WordBankService } from 'modules/wordle/services/word-bank.service';
import { WordleService } from 'modules/wordle/wordle.service';
import 'reflect-metadata';
import { StartupService } from 'startup/startup.service';
import {
  STARTUP_IMPORT_SQLITE,
  STARTUP_RUN_MIGRATIONS,
  STARTUP_START_MAINTENANCE,
} from 'startup/startup.tokens';

describe('StartupService', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function createApp(failAt?: string) {
    const events: string[] = [];
    const step = (name: string) => async () => {
      events.push(name);
      if (failAt === name) throw new Error(`${name} failed`);
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        StartupService,
        { provide: DB, useValue: {} },
        { provide: AppConfig, useValue: { sqlitePath: '/legacy.sqlite' } },
        {
          provide: GamificationService,
          useValue: { initializeDefaults: step('gamification') },
        },
        {
          provide: RateLimitService,
          useValue: { seedDefaults: step('rate-limits') },
        },
        {
          provide: AI_AGENT_DAILY_QUOTA_SERVICE,
          useValue: { seedDefaults: step('agent-quota') },
        },
        {
          provide: AI_RESEARCH_DAILY_QUOTA_SERVICE,
          useValue: { seedDefaults: step('research-quota') },
        },
        {
          provide: ResearchOrchestrator,
          useValue: { reapStaleJobs: step('research-reap') },
        },
        {
          provide: WordBankService,
          useValue: {
            loadBannedWords: step('banned-words'),
            warm: () => events.push('word-bank'),
          },
        },
        {
          provide: BoggleWordBankService,
          useValue: { getWordSet: () => events.push('boggle-word-bank') },
        },
        {
          provide: WordleService,
          useValue: { finalizeExpiredDrafts: step('expired-drafts') },
        },
        { provide: STARTUP_RUN_MIGRATIONS, useValue: step('migrations') },
        {
          provide: STARTUP_IMPORT_SQLITE,
          useValue: async () => {
            events.push('sqlite-import');
            return { status: 'no-source' };
          },
        },
        {
          provide: STARTUP_START_MAINTENANCE,
          useValue: () => {
            events.push('maintenance-start');
            return () => events.push('maintenance-stop');
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    return { app, events };
  }

  it('awaits each startup step in order and stops maintenance on shutdown', async () => {
    const state = await createApp();
    await state.app.init();

    expect(state.events).toEqual([
      'migrations',
      'sqlite-import',
      'gamification',
      'rate-limits',
      'agent-quota',
      'research-quota',
      'research-reap',
      'banned-words',
      'expired-drafts',
      'boggle-word-bank',
      'word-bank',
      'maintenance-start',
    ]);

    await state.app.close();
    app = undefined;
    expect(state.events.at(-1)).toBe('maintenance-stop');
  });

  it('rejects application initialization when a startup step fails', async () => {
    const state = await createApp('migrations');

    await expect(state.app.init()).rejects.toThrow('migrations failed');
    expect(state.events).toEqual(['migrations']);
  });
});
