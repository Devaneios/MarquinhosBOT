import customEmojisData from 'data/customEmojis.json';
import standardEmojisData from 'data/standardEmojis.json';

export interface StandardEmojiEntry {
  name: string;
  char: string;
}

export interface CustomEmojiEntry {
  id: string;
  name: string;
  animated: boolean;
}

export const STANDARD_EMOJIS: StandardEmojiEntry[] = standardEmojisData;
export const CUSTOM_EMOJIS: CustomEmojiEntry[] = customEmojisData;

const STANDARD_BY_NAME = new Map(
  STANDARD_EMOJIS.map((entry) => [entry.name, entry]),
);
const CUSTOM_BY_NAME = new Map(
  CUSTOM_EMOJIS.map((entry) => [entry.name, entry]),
);

export const DEFAULT_FALLBACK_REACTABLE = '👍';

/**
 * Resolves an LLM-returned catalog name to what Discord's
 * `Message.react()` expects: a raw unicode char for standard emojis,
 * or `name:id` / `a:name:id` for custom guild emojis.
 */
export function resolveReactable(name: string): string | undefined {
  const custom = CUSTOM_BY_NAME.get(name);
  if (custom)
    return `${custom.animated ? 'a:' : ''}${custom.name}:${custom.id}`;

  const standard = STANDARD_BY_NAME.get(name);
  if (standard) return standard.char;

  return undefined;
}
