import { isQueueEligible } from '@marquinhos/contracts/activity/room';
import { describe, expect, it } from 'bun:test';
import { createAdapterRegistry } from '../src/realtime/adapters/registry';
import { testRoomDependencies } from './helpers/realtimeTestDependencies';

describe('queue eligibility', () => {
  it('matches every adapter that supports a queue', () => {
    for (const [game, adapter] of Object.entries(
      createAdapterRegistry(testRoomDependencies),
    )) {
      expect({ game, queue: isQueueEligible(game as never) }).toEqual({
        game,
        queue: adapter!.supportsQueue,
      });
    }
  });
});
