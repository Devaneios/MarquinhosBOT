import type { WordChainState } from 'services/activity/word-chain/WordChainEngine';

// Sentinel seat id for the bot — never a real Discord snowflake, so it
// can't collide with an actual player.
export const WORD_CHAIN_BOT_USER_ID = '__word_chain_bot__';

export class WordChainBot {
  constructor(private wordlist: ReadonlySet<string>) {}

  // Picks uniformly among every still-unused word starting with the
  // required letter. Returns null when nothing qualifies — the caller
  // leaves the existing turn timer to eliminate the bot, the same fate a
  // stuck human player faces.
  chooseWord(state: WordChainState): string | null {
    const lastLetter = state.currentWord
      ? state.currentWord[state.currentWord.length - 1]
      : undefined;

    const candidates: string[] = [];
    for (const word of this.wordlist) {
      if (lastLetter && !word.startsWith(lastLetter)) continue;
      if (state.usedWords.has(word)) continue;
      candidates.push(word);
    }
    if (candidates.length === 0) return null;

    return candidates[Math.floor(Math.random() * candidates.length)]!;
  }
}
