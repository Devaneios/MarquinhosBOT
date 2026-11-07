import { Injectable } from '@nestjs/common';
import { API_ROOT } from 'common/api-root';
import { buildBoggleWordSet } from 'modules/activity/games/boggle/dictionary';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WORDLIST_PATH = join(API_ROOT, 'wordlist.txt');

@Injectable()
export class BoggleWordBankService {
  private cache: Set<string> | null = null;

  getWordSet(): Set<string> {
    if (!this.cache) {
      this.cache = buildBoggleWordSet(readFileSync(WORDLIST_PATH, 'utf-8'));
    }
    return this.cache;
  }
}
