import { API_ROOT } from 'common/api-root';
import { readFileSync } from 'fs';
import { join } from 'node:path';

export function loadWordChainWords(wordlistPath?: string): Set<string> {
  const path = wordlistPath || join(API_ROOT, 'wordlist.txt');
  return new Set(readFileSync(path, 'utf-8').split('\n'));
}
