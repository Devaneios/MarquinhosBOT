import '@/i18n';
import { render, screen } from '@testing-library/react';
import { expect, it } from 'bun:test';
import { WordleBingoPanel } from './WordleBingoPanel';

it('shows the fixed card, progress and action sharing rule', async () => {
  const cells = Array.from({ length: 9 }, (_, index) => ({
    id: String(index),
    condition: { kind: 'participation' as const, target: 1 },
  }));
  render(
    <WordleBingoPanel
      load={async () => [
        {
          id: 'card',
          guildId: 'a',
          version: 1,
          startsAt: 1,
          endsAt: 2,
          status: 'active',
          allowMulti: false,
          cells,
          progress: {
            counts: [1, 0, 0, 0, 0, 0, 0, 0, 0],
            filled: [
              true,
              false,
              false,
              false,
              false,
              false,
              false,
              false,
              false,
            ],
            lines: [],
            complete: false,
          },
        },
      ]}
    />,
  );
  expect(
    await screen.findByText('Uma ação preenche no máximo uma casa.'),
  ).toBeDefined();
  expect(screen.getAllByText('Participações: 1 / 1')).toHaveLength(1);
  expect(screen.getAllByText('Participações: 0 / 1')).toHaveLength(8);
});
