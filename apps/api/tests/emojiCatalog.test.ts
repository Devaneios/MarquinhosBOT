import { describe, expect, it } from 'bun:test';
import {
  CUSTOM_EMOJIS,
  DEFAULT_FALLBACK_REACTABLE,
  resolveReactable,
  STANDARD_EMOJIS,
} from 'services/aiChat/emojiCatalog';

describe('emojiCatalog', () => {
  it('loads the expected number of standard emojis', () => {
    expect(STANDARD_EMOJIS.length).toBe(1655);
  });

  it('loads the expected number of custom emojis', () => {
    expect(CUSTOM_EMOJIS.length).toBe(135);
  });

  it('resolves a known standard emoji name to its unicode char', () => {
    expect(resolveReactable('grinning')).toBe('😀');
  });

  it('resolves a known custom emoji name to name:id format', () => {
    expect(resolveReactable('cavaloemoji')).toBe(
      'cavaloemoji:725868757779742787',
    );
  });

  it('resolves an animated custom emoji name to a:name:id format', () => {
    const animated = CUSTOM_EMOJIS.find((e) => e.animated);
    expect(animated).toBeDefined();
    expect(resolveReactable(animated!.name)).toBe(
      `a:${animated!.name}:${animated!.id}`,
    );
  });

  it('returns undefined for an unknown name', () => {
    expect(
      resolveReactable('definitely_not_a_real_emoji_name'),
    ).toBeUndefined();
  });

  it('exposes a sane default fallback reactable', () => {
    expect(DEFAULT_FALLBACK_REACTABLE).toBe('👍');
  });
});
