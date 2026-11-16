import {
  achievements,
  userLevels,
  wordleGlobalAchievements,
  wordleGlobalDays,
} from '@marquinhos/database/schema';
import { createTestDb } from '@marquinhos/database/testing';
import { Server } from 'colyseus';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { roomKey } from '../../src/modules/activity/room-key';
import { getRecifeDate } from '../../src/modules/wordle/wordle-date';
import { createMatchRoom } from '../../src/realtime/MatchRoom';
import { createRealtimeTestDependencies } from './realtimeTestDependencies';
import { mintWsSessionToken } from './wsSessionTokens';

export async function startWordleGatewayFixture() {
  const database = await createTestDb();
  const server = new Server({ greet: false });
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
    await database.db
      .insert(wordleGlobalDays)
      .values({
        word_date: date,
        word: 'termo',
        word_length: 5,
        created_at: 1,
      });
    await database.db
      .insert(achievements)
      .values({
        id: 'wordle_v2_solved_exactly_1',
        name: 'Palpite certeiro',
        description: 'Acerte de primeira',
        category: 'wordle',
        rarity: 'rare',
        icon: '🏅',
        reward_xp: 75,
      });
    server
      .define(
        'match',
        createMatchRoom(createRealtimeTestDependencies(database.db)),
      )
      .filterBy(['roomKey']);
    await server.listen(0);
    const address = server.transport.server?.address();
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
        await server.gracefullyShutdown(false);
        await database.drop();
      },
    };
  } catch (error) {
    await server.gracefullyShutdown(false);
    await database.drop();
    throw error;
  }
}
