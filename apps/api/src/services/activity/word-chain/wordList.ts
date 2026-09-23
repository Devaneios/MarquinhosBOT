import { readFileSync } from 'fs';
import { resolve } from 'path';

export function loadWordChainWords(wordlistPath?: string): Set<string> {
  const path = wordlistPath || resolve(process.cwd(), 'wordlist.txt');
  return new Set(readFileSync(path, 'utf-8').split('\n'));
}
