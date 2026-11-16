import {
  achievements,
  userLevels,
  wordleGlobalAchievements,
  wordleGlobalDays,
} from '@marquinhos/database/schema';
import { createTestDb } from '@marquinhos/database/testing';
import { HttpAdapterHost } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { configureHttp } from '../../src/common/http/configure-http';
import { HttpInfrastructureModule } from '../../src/common/http/http-infrastructure.module';
import { NEST_APP_OPTIONS } from '../../src/common/http/nest-app.options';
import { AppConfig } from '../../src/config/app.config';
import { roomKey } from '../../src/modules/activity/room-key';
import { getRecifeDate } from '../../src/modules/wordle/wordle-date';
import { GameServer } from '../../src/realtime/game-server.service';
import { createRealtimeTestDependencies } from './realtimeTestDependencies';
import { createTestAppConfig } from './testAppConfig';
import { mintWsSessionToken } from './wsSessionTokens';

export async function startWordleGatewayFixture() {
  const database = await createTestDb();
  let app: NestExpressApplication | undefined;
  let server: GameServer | undefined;
  try {
    const date = getRecifeDate();
    const identity = {
      userId: `gateway-${randomUUID()}`,
      guildId: `gateway-${randomUUID()}`,
      instanceId: 'gateway-wordle',
      guildMembershipVerified: true,
      mode: 'single',
      game: 'wordle',
    } as const;
    await database.db.insert(wordleGlobalDays).values({
      word_date: date,
      word: 'termo',
      word_length: 5,
      created_at: 1,
    });
    await database.db.insert(achievements).values({
      id: 'wordle_v2_solved_exactly_1',
      name: 'Palpite certeiro',
      description: 'Acerte de primeira',
      category: 'wordle',
      rarity: 'rare',
      icon: '🏅',
      reward_xp: 75,
    });
    const module = await Test.createTestingModule({
      imports: [HttpInfrastructureModule],
    })
      .overrideProvider(AppConfig)
      .useValue(createTestAppConfig())
      .compile();
    app =
      module.createNestApplication<NestExpressApplication>(NEST_APP_OPTIONS);
    configureHttp(app, { silent: true });
    await app.init();
    server = new GameServer(
      app.get(HttpAdapterHost),
      createRealtimeTestDependencies(database.db),
    );
    await server.listen(0);
    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string')
      throw new Error('No Wordle API port');
    return {
      origin: `http://127.0.0.1:${address.port}`,
      date,
      token: mintWsSessionToken(identity),
      key: roomKey(identity),
      async persistence() {
        const [unlocks, levels] = await Promise.all([
          database.db
            .select()
            .from(wordleGlobalAchievements)
            .where(eq(wordleGlobalAchievements.user_id, identity.userId)),
          database.db
            .select()
            .from(userLevels)
            .where(eq(userLevels.user_id, identity.userId)),
        ]);
        return { unlocks: unlocks.length, xp: levels[0]?.total_xp };
      },
      async close() {
        await server?.beforeApplicationShutdown();
        await app?.close();
        await database.drop();
      },
    };
  } catch (error) {
    await server?.beforeApplicationShutdown();
    await app?.close();
    await database.drop();
    throw error;
  }
}
