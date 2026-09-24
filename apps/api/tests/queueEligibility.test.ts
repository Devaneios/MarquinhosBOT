import { isQueueEligible } from '@marquinhos/contracts/activity/room';
import { describe, expect, it } from 'bun:test';
import { ADAPTER_REGISTRY } from '../src/realtime/adapters/registry';

describe('queue eligibility', () => {
  it('matches every adapter that supports a queue', () => {
    for (const [game, adapter] of Object.entries(ADAPTER_REGISTRY)) {
      expect({ game, queue: isQueueEligible(game as never) }).toEqual({
        game,
        queue: adapter!.supportsQueue,
      });
    }
  });
});
