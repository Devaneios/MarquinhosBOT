import { readFileSync } from 'fs';
import { join } from 'path';
import { buildBoggleWordSet } from 'services/activity/boggle/dictionary';

const WORDLIST_PATH = join(__dirname, '../../../../wordlist.txt');
let cache: Set<string> | null = null;

export function getBoggleWordSet(): Set<string> {
  if (cache) return cache;
  cache = buildBoggleWordSet(readFileSync(WORDLIST_PATH, 'utf-8'));
  return cache;
}
