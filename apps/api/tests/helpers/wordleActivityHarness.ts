import { WebSocketTransport } from '@colyseus/ws-transport';
import {
  achievements,
  userLevels,
  wordleGlobalAcceptedGuesses,
  wordleGlobalAchievements,
  wordleGlobalDays,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { createTestDb } from '@marquinhos/database/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Server } from 'colyseus';
import { eq } from 'drizzle-orm';
import { AsyncLocalStorage } from 'node:async_hooks';
import { configureHttp } from '../../src/common/http/configure-http';
import { HttpInfrastructureModule } from '../../src/common/http/http-infrastructure.module';
import { NEST_APP_OPTIONS } from '../../src/common/http/nest-app.options';
import { AppConfig } from '../../src/config/app.config';
import { DB } from '../../src/database/database.tokens';
import { WordleReconcileJob } from '../../src/jobs/wordle-reconcile.job';
import { roomKey } from '../../src/modules/activity/room-key';
import { getRecifeDate } from '../../src/modules/wordle/wordle-date';
import { WordleModule } from '../../src/modules/wordle/wordle.module';
import { createMatchRoom } from '../../src/realtime/MatchRoom';
import { createRealtimeTestDependencies } from './realtimeTestDependencies';
import { createTestAppConfig } from './testAppConfig';
import { createWordleTestServices } from './wordleServices';
import { mintWsSessionToken } from './wsSessionTokens';

const fixture = await createTestDb();
process.env.DATABASE_URL = fixture.url;
let server: Server | undefined;
let httpApp: NestExpressApplication | undefined;
let realtimeApp: NestExpressApplication | undefined;
let ready = false;
let simulatedAwardFailure = false;
let backgroundAwardGranted = false;
let reconnected = false;
let joinedCount = 0;
let activeClient:
  | Parameters<
      InstanceType<ReturnType<typeof createMatchRoom>>['onReconnect']
    >[0]
  | undefined;
const backgroundContext = new AsyncLocalStorage<boolean>();
try {
  const date = getRecifeDate();
  await fixture.db
    .insert(wordleGlobalDays)
    .values({ word_date: date, word: 'termo', word_length: 5, created_at: 1 });
  const botWrong = process.env.WORDLE_E2E_BOT_WRONG === '1';
  const legacyReward = process.env.WORDLE_E2E_LEGACY_REWARD === '1';
  await fixture.db.insert(achievements).values({
    id: botWrong ? 'wordle_v2_solved_exactly_2' : 'wordle_v2_solved_exactly_1',
    name: botWrong ? 'Segunda é a certa' : 'Palpite certeiro',
    description: botWrong
      ? 'Acerte na segunda tentativa.'
      : 'Acerte de primeira.',
    category: 'wordle',
    rarity: 'rare',
    icon: '🏅',
    condition: legacyReward ? JSON.stringify({ legacy: true }) : null,
    reward_xp: legacyReward ? 999 : botWrong ? 25 : 75,
  });
  const identity = {
    userId: 'activity-e2e-user',
    instanceId: 'activity-e2e',
    guildId: 'activity-e2e-guild',
    guildMembershipVerified: true,
    mode: 'single',
    game: 'wordle',
  } as const;
  const services = createWordleTestServices(fixture.db);
  let botOrigin: string | undefined;
  if (process.env.WORDLE_E2E_BOT_SOLVE === '1' || botWrong) {
    const moduleRef = await Test.createTestingModule({
      imports: [HttpInfrastructureModule, WordleModule],
    })
      .overrideProvider(DB)
      .useValue(fixture.db)
      .overrideProvider(AppConfig)
      .useValue(createTestAppConfig({ MARQUINHOS_API_KEY: 'test-bot-key' }))
      .compile();
    httpApp =
      moduleRef.createNestApplication<NestExpressApplication>(NEST_APP_OPTIONS);
    configureHttp(httpApp, { silent: true });
    const httpServer = await httpApp.listen(0, '127.0.0.1');
    const httpAddress = httpServer.address();
    if (!httpAddress || typeof httpAddress === 'string')
      throw new Error('Missing bot API address');
    botOrigin = `http://127.0.0.1:${httpAddress.port}`;
  }
  const backgroundJob = new WordleReconcileJob(
    services.notifications,
    services.goals,
    services.gallery,
    services.globalCoordinator,
    services.album,
  );
  if (process.env.WORDLE_E2E_FAIL_AWARD === '1') {
    const award = services.globalAchievements.checkAndAward.bind(
      services.globalAchievements,
    );
    services.globalAchievements.checkAndAward = async (userId, guildId) => {
      if (!simulatedAwardFailure) {
        const [session] = await fixture.db
          .select()
          .from(wordleGlobalSessions)
          .where(eq(wordleGlobalSessions.user_id, userId));
        if (session?.solved && !simulatedAwardFailure) {
          simulatedAwardFailure = true;
          if (process.env.WORDLE_E2E_BACKGROUND_AWARD === '1') {
            setTimeout(() => {
              backgroundContext.run(true, () => {
                void backgroundJob.reconcileOnInterval();
              });
            }, 100);
          }
          throw new Error('Simulated temporary achievement failure');
        }
      }
      const result = await award(userId, guildId);
      if (
        backgroundContext.getStore() &&
        result.unlockedIds.includes('wordle_v2_solved_exactly_1')
      ) {
        backgroundAwardGranted = true;
      }
      return result;
    };
  }
  if (
    process.env.WORDLE_E2E_DROP_FIRST === '1' ||
    process.env.WORDLE_E2E_TERMINAL_DROP === '1'
  ) {
    const submit = services.wordle.submitGuess.bind(services.wordle);
    let drop = true;
    services.wordle.submitGuess = async (...args) => {
      const result = await submit(...args);
      if (drop && !('error' in result)) {
        drop = false;
        if (process.env.WORDLE_E2E_TERMINAL_DROP === '1')
          activeClient?.leave(4000);
        throw new Error('Simulated lost response');
      }
      return result;
    };
  }
  const realtimeModule = await Test.createTestingModule({
    imports: [HttpInfrastructureModule],
  })
    .overrideProvider(AppConfig)
    .useValue(createTestAppConfig())
    .compile();
  realtimeApp =
    realtimeModule.createNestApplication<NestExpressApplication>(
      NEST_APP_OPTIONS,
    );
  configureHttp(realtimeApp, { silent: true });
  await realtimeApp.init();
  server = new Server({
    greet: false,
    transport: new WebSocketTransport({ server: realtimeApp.getHttpServer() }),
  });
  const dependencies = {
    ...createRealtimeTestDependencies(fixture.db),
    wordle: services.wordle,
  };
  const MatchRoom = createMatchRoom(dependencies);
  class TestMatchRoom extends MatchRoom {
    override onJoin(
      ...args: Parameters<InstanceType<typeof MatchRoom>['onJoin']>
    ) {
      joinedCount++;
      activeClient = args[0];
      return super.onJoin(...args);
    }
    override onReconnect(
      client: Parameters<InstanceType<typeof MatchRoom>['onReconnect']>[0],
    ) {
      reconnected = true;
      super.onReconnect(client);
    }
  }
  server.define('match', TestMatchRoom).filterBy(['roomKey']);
  await server.listen(0);
  const address = server.transport.server?.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing test server address');
  ready = true;
  console.log(
    `WORDLE_E2E_READY ${JSON.stringify({ url: `ws://127.0.0.1:${address.port}`, token: mintWsSessionToken(identity), roomKey: roomKey(identity), botOrigin })}`,
  );
  await new Promise<void>((resolve) => process.once('SIGTERM', resolve));
} finally {
  await server?.gracefullyShutdown(false);
  await realtimeApp?.close();
  await httpApp?.close();
  if (ready) {
    const botWrong = process.env.WORDLE_E2E_BOT_WRONG === '1';
    const legacyReward = process.env.WORDLE_E2E_LEGACY_REWARD === '1';
    const [events, unlocks, levels] = await Promise.all([
      fixture.db
        .select()
        .from(wordleGlobalAcceptedGuesses)
        .where(eq(wordleGlobalAcceptedGuesses.user_id, 'activity-e2e-user')),
      fixture.db
        .select()
        .from(wordleGlobalAchievements)
        .where(eq(wordleGlobalAchievements.user_id, 'activity-e2e-user')),
      fixture.db
        .select()
        .from(userLevels)
        .where(eq(userLevels.user_id, 'activity-e2e-user')),
    ]);
    if (
      events.length !== (botWrong ? 2 : 1) ||
      events
        .map((event) => event.attempt)
        .sort((a, b) => a - b)
        .join(',') !== (botWrong ? '1,2' : '1') ||
      events.some((event) => !event.achievement_reconciled) ||
      unlocks.length !== 1 ||
      levels[0]?.total_xp !== (botWrong ? 75 : 150) ||
      (process.env.WORDLE_E2E_FAIL_AWARD === '1' && !simulatedAwardFailure) ||
      (process.env.WORDLE_E2E_BACKGROUND_AWARD === '1' &&
        !backgroundAwardGranted) ||
      (process.env.WORDLE_E2E_DROP_TRANSPORT === '1' && !reconnected) ||
      (process.env.WORDLE_E2E_TERMINAL_DROP === '1' && joinedCount < 2)
    ) {
      console.error('Wordle integration persistence check failed');
      process.exitCode = 1;
    }
    if (legacyReward) {
      const [definition] = await fixture.db
        .select()
        .from(achievements)
        .where(eq(achievements.id, 'wordle_v2_solved_exactly_1'));
      if (definition?.reward_xp !== 999) {
        console.error('Legacy Wordle definition was changed');
        process.exitCode = 1;
      }
    }
  }
  await fixture.drop();
}
