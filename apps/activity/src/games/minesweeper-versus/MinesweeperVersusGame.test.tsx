import { render } from '@testing-library/react';
import { expect, it, mock } from 'bun:test';
import * as realRouterDom from 'react-router-dom';

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

it('MinesweeperVersusGame redirects to /rooms?create=minesweeper-versus', async () => {
  const { MinesweeperVersusGame } = await import('./MinesweeperVersusGame');
  render(
    <MinesweeperVersusGame
      identity={{
        userId: 'u1',
        guildId: 'g1',
        instanceId: 'i1',
        accessToken: 'acc',
      }}
      onAuthInvalid={() => {}}
    />,
  );
  expect(captured.to as string | null).toBe('/rooms?create=minesweeper-versus');
});
