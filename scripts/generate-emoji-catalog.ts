import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const DISCORD_EMOJIS_PATH = join(ROOT, 'discord-emojis.json');
const DEVANEIOS_EMOJI_PATH = join(ROOT, 'devaneios-emoji.json');
const STANDARD_OUTPUT_PATH = join(ROOT, 'src', 'data', 'standardEmojis.json');
const CUSTOM_OUTPUT_PATH = join(ROOT, 'src', 'data', 'customEmojis.json');

const STANDARD_EMOJI_COUNT = 1655;

interface DiscordEmojiEntry {
  names: string[];
  surrogates: string;
}

interface DiscordEmojiDataset {
  emojis: DiscordEmojiEntry[];
}

interface DevaneiosEmojiEntry {
  id: string;
  name: string;
  animated: boolean;
}

interface StandardEmojiEntry {
  name: string;
  char: string;
}

interface CustomEmojiEntry {
  id: string;
  name: string;
  animated: boolean;
}

const dataset: DiscordEmojiDataset = JSON.parse(
  readFileSync(DISCORD_EMOJIS_PATH, 'utf-8'),
);
const devaneiosEmojis: DevaneiosEmojiEntry[] = JSON.parse(
  readFileSync(DEVANEIOS_EMOJI_PATH, 'utf-8'),
);

const standardEmojis: StandardEmojiEntry[] = dataset.emojis
  .slice(0, STANDARD_EMOJI_COUNT)
  .map((entry) => ({ name: entry.names[0] as string, char: entry.surrogates }));

const customEmojis: CustomEmojiEntry[] = devaneiosEmojis.map((entry) => ({
  id: entry.id,
  name: entry.name,
  animated: entry.animated,
}));

writeFileSync(
  STANDARD_OUTPUT_PATH,
  `${JSON.stringify(standardEmojis, null, 2)  }\n`,
);
writeFileSync(CUSTOM_OUTPUT_PATH, `${JSON.stringify(customEmojis, null, 2)  }\n`);

console.log(`standardEmojis: ${standardEmojis.length} entries`);
console.log(`customEmojis: ${customEmojis.length} entries`);
