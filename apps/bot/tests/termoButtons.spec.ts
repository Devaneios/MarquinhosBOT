import { describe, expect, it, mock } from 'bun:test';
import { handleTermoPlayButton } from '../src/interaction-handlers/termoButtons';

function makeBtn(overrides: Partial<{ guildId: string | null }> = {}) {
  return {
    user: { id: 'user-1' },
    guildId: 'guildId' in overrides ? overrides.guildId : 'guild-1',
    launchActivity: mock(async () => {}),
  };
}

describe('handleTermoPlayButton', () => {
  it('records the deep-link intent before launching the activity', async () => {
    const btn = makeBtn();
    const recordActivityDeepLink = mock(async () => ({ data: { ok: true } }));

    await handleTermoPlayButton(btn as any, { recordActivityDeepLink } as any);

    expect(recordActivityDeepLink).toHaveBeenCalledWith(
      'user-1',
      'guild-1',
      'wordle',
    );
    expect(btn.launchActivity).toHaveBeenCalledTimes(1);
  });

  it('still launches the activity when recording the intent fails', async () => {
    const btn = makeBtn();
    const recordActivityDeepLink = mock(async () => {
      throw new Error('api down');
    });

    await handleTermoPlayButton(btn as any, { recordActivityDeepLink } as any);

    expect(btn.launchActivity).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the interaction has no guildId', async () => {
    const btn = makeBtn({ guildId: null });
    const recordActivityDeepLink = mock(async () => ({ data: { ok: true } }));

    await handleTermoPlayButton(btn as any, { recordActivityDeepLink } as any);

    expect(recordActivityDeepLink).not.toHaveBeenCalled();
    expect(btn.launchActivity).not.toHaveBeenCalled();
  });
});
