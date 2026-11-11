import type { Db } from '@marquinhos/database/client';
import { wordlistReview } from '@marquinhos/database/schema';
import { stripDiacritics } from '@marquinhos/domain/shared/text/stripDiacritics';
import { Inject, Injectable } from '@nestjs/common';
import { API_ROOT } from 'common/api-root';
import { DB } from 'database/database.tokens';
import { eq } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ANSWER_WORDLIST_PATH = join(API_ROOT, 'wordlist.txt');
const DEVANEIOS_WORDLIST_PATH = join(API_ROOT, 'devaneios-wordlist.txt');
const VALID_GUESSES_PATH = join(API_ROOT, 'valid-guesses.txt');
const RACE_WORD_LENGTH = 5;

export const DEVANEIOS_WEIGHT = 0.75;

@Injectable()
export class WordBankService {
  private wordlistCache: string[] | null = null;
  private devaneiosWordlistCache: string[] | null = null;
  private validationSetCache: Set<string> | null = null;
  private validationByStrippedCache: Map<string, string> | null = null;
  private bannedWordsCache = new Set<string>();

  constructor(@Inject(DB) private readonly database: Db) {}

  warm(): void {
    this.getAnswerWordlist();
    this.getDevaneiosWordlist();
    this.getValidationSet();
  }

  getAnswerWordlist(): string[] {
    if (this.wordlistCache) return this.wordlistCache;
    const raw = readFileSync(ANSWER_WORDLIST_PATH, 'utf-8');
    this.wordlistCache = raw
      .split('\n')
      .map((word) => word.trim().toLowerCase())
      .filter((word) => word.length > 0);
    return this.wordlistCache;
  }

  getDevaneiosWordlist(): string[] {
    if (this.devaneiosWordlistCache) return this.devaneiosWordlistCache;
    const raw = readFileSync(DEVANEIOS_WORDLIST_PATH, 'utf-8');
    this.devaneiosWordlistCache = raw
      .split('\n')
      .map((word) => word.trim().toLowerCase())
      .filter((word) => word.length > 0);
    return this.devaneiosWordlistCache;
  }

  getValidationSet(): Set<string> {
    if (!this.validationSetCache || !this.validationByStrippedCache) {
      this.loadValidationBank();
    }
    return this.validationSetCache!;
  }

  resolveCanonical(guess: string): string | null {
    this.getValidationSet();
    const normalized = guess.trim().toLowerCase();
    if (!normalized) return null;
    if (this.validationSetCache!.has(normalized)) return normalized;
    return (
      this.validationByStrippedCache!.get(stripDiacritics(normalized)) ?? null
    );
  }

  async loadBannedWords(): Promise<void> {
    this.bannedWordsCache = await this.getBannedWords();
  }

  async getBannedWords(): Promise<Set<string>> {
    const rows = await this.database
      .select({ word: wordlistReview.word })
      .from(wordlistReview)
      .where(eq(wordlistReview.is_banned, true));
    return new Set(rows.map((row) => row.word));
  }

  setBanned(word: string, isBanned: boolean): void {
    if (isBanned) this.bannedWordsCache.add(word);
    else this.bannedWordsCache.delete(word);
  }

  pickRaceWord(): string {
    const candidates = this.getDevaneiosWordlist().flatMap((word) => {
      if (word.length !== RACE_WORD_LENGTH || this.bannedWordsCache.has(word)) {
        return [];
      }
      const canonical = this.resolveCanonical(word);
      return canonical ? [canonical] : [];
    });
    if (candidates.length === 0) throw new Error('No Wordle Race words left');
    return candidates[Math.floor(Math.random() * candidates.length)]!;
  }

  private loadValidationBank(): void {
    const raw = readFileSync(VALID_GUESSES_PATH, 'utf-8');
    const words = raw
      .split('\n')
      .map((word) => word.trim())
      .filter((word) => word.length > 0);
    const validationSet = new Set(words);
    const byStripped = new Map<string, string>();

    for (const word of words) {
      const key = stripDiacritics(word);
      const existing = byStripped.get(key);
      if (!existing || (!hasDiacritics(existing) && hasDiacritics(word))) {
        byStripped.set(key, word);
      }
    }

    this.validationSetCache = validationSet;
    this.validationByStrippedCache = byStripped;
  }
}

function hasDiacritics(value: string): boolean {
  return stripDiacritics(value) !== value;
}
