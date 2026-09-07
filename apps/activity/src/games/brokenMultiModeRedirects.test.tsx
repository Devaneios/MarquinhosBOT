import { render } from '@testing-library/react';
import { describe, expect, it, mock } from 'bun:test';
import * as realRouterDom from 'react-router-dom';

// Regression coverage for a live bug found while investigating Task 16:
// these 6 games hardcoded mode: 'multi' with no roomId ever supplied,
// which crashes today (independent of the Rooms feature) at the server's
// roomKey() call — 'roomKey: roomId is required for mode "multi"'. Fixed
// by redirecting each game's entry route straight into the Rooms lobby
// instead of connecting directly. This test just locks in the redirect
// target for each — not a full behavior test of the (now bypassed)
// standalone connection code.
const captured: { to: string | null } = { to: null };

// Partial mock — spreads every real export so unrelated code elsewhere in
// the process (mock.module replaces this module globally, not per test
// file) keeps working normally; only Navigate is swapped out to observe its
// `to` prop without needing a real Router context.
mock.module('react-router-dom', () => ({
  ...realRouterDom,
  Navigate: ({ to }: { to: string }) => {
    captured.to = to;
    return null;
  },
}));

const identity = {
  userId: 'u1',
  guildId: 'g1',
  instanceId: 'i1',
  accessToken: 'acc',
};

describe('games with no mode selector redirect straight to the Rooms lobby', () => {
  it('WordleRaceGame redirects to /rooms?create=wordle-race', async () => {
    captured.to = null;
    const { WordleRaceGame } = await import(
      `./wordle-race/WordleRaceGame.tsx?${Math.random()}`
    );
    render(<WordleRaceGame identity={identity} onAuthInvalid={() => {}} />);
    expect(captured.to as string | null).toBe('/rooms?create=wordle-race');
  });

  it('HangmanGame redirects to /rooms?create=hangman', async () => {
    captured.to = null;
    const { HangmanGame } = await import(
      `./hangman/HangmanGame.tsx?${Math.random()}`
    );
    render(<HangmanGame identity={identity} onAuthInvalid={() => {}} />);
    expect(captured.to as string | null).toBe('/rooms?create=hangman');
  });

  it('MinesweeperVersusGame redirects to /rooms?create=minesweeper-versus', async () => {
    captured.to = null;
    const { MinesweeperVersusGame } = await import(
      `./minesweeper-versus/components/MinesweeperBoard.tsx?${Math.random()}`
    );
    render(
      <MinesweeperVersusGame identity={identity} onAuthInvalid={() => {}} />,
    );
    expect(captured.to as string | null).toBe(
      '/rooms?create=minesweeper-versus',
    );
  });

  it('WordSearchRaceGame redirects to /rooms?create=word-search-race', async () => {
    captured.to = null;
    const { WordSearchRaceGame } = await import(
      `./word-search-race/WordSearchRaceGame.tsx?${Math.random()}`
    );
    render(<WordSearchRaceGame identity={identity} onAuthInvalid={() => {}} />);
    expect(captured.to as string | null).toBe('/rooms?create=word-search-race');
  });

  it('BoggleGame redirects to /rooms?create=boggle-word-race', async () => {
    captured.to = null;
    const { BoggleGame } = await import(
      `./boggle-word-race/BoggleGame.tsx?${Math.random()}`
    );
    render(<BoggleGame identity={identity} onAuthInvalid={() => {}} />);
    expect(captured.to as string | null).toBe('/rooms?create=boggle-word-race');
  });

  it('TriviaQuizGame redirects to /rooms?create=trivia-quiz', async () => {
    captured.to = null;
    const { TriviaQuizGame } = await import(
      `./trivia-quiz/TriviaQuizGame.tsx?${Math.random()}`
    );
    render(<TriviaQuizGame identity={identity} onAuthInvalid={() => {}} />);
    expect(captured.to as string | null).toBe('/rooms?create=trivia-quiz');
  });
});
