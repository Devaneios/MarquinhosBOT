import { describe, expect, it } from 'bun:test';
import { DisconnectGraceTimer } from 'services/activity/shared/DisconnectGraceTimer';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('DisconnectGraceTimer', () => {
  it('calls onExpire after the grace period elapses', async () => {
    const timer = new DisconnectGraceTimer<string>();
    let expired = false;

    timer.arm('user-a', 20, () => {
      expired = true;
    });

    expect(expired).toBe(false);
    await wait(35);
    expect(expired).toBe(true);
  });

  it('does not call onExpire if disarmed before the grace period elapses', async () => {
    const timer = new DisconnectGraceTimer<string>();
    let expired = false;

    timer.arm('user-a', 20, () => {
      expired = true;
    });
    timer.disarm('user-a');

    await wait(35);
    expect(expired).toBe(false);
  });

  it('reports armed/disarmed state via isArmed', () => {
    const timer = new DisconnectGraceTimer<string>();

    expect(timer.isArmed('user-a')).toBe(false);
    timer.arm('user-a', 1000, () => {});
    expect(timer.isArmed('user-a')).toBe(true);
    timer.disarm('user-a');
    expect(timer.isArmed('user-a')).toBe(false);
  });

  it('clears the armed state once the timer expires on its own', async () => {
    const timer = new DisconnectGraceTimer<string>();
    timer.arm('user-a', 20, () => {});

    await wait(35);
    expect(timer.isArmed('user-a')).toBe(false);
  });

  it('keeps different keys independent', async () => {
    const timer = new DisconnectGraceTimer<string>();
    let aExpired = false;
    let bExpired = false;

    timer.arm('user-a', 20, () => {
      aExpired = true;
    });
    timer.arm('user-b', 1000, () => {
      bExpired = true;
    });
    timer.disarm('user-a');

    await wait(35);
    expect(aExpired).toBe(false);
    expect(bExpired).toBe(false);
    expect(timer.isArmed('user-b')).toBe(true);
  });

  it('re-arming a key replaces the previous timer instead of stacking a second one', async () => {
    const timer = new DisconnectGraceTimer<string>();
    let expireCount = 0;

    timer.arm('user-a', 20, () => {
      expireCount += 1;
    });
    timer.arm('user-a', 20, () => {
      expireCount += 1;
    });

    await wait(35);
    expect(expireCount).toBe(1);
  });
});
