import '@/i18n';
import { render, screen } from '@testing-library/react';
import { expect, it } from 'bun:test';
import { WordleGoalsPanel } from './WordleGoalsPanel';

it('shows community goal progress and the personal badge after completion', async () => {
  render(
    <WordleGoalsPanel
      userId="user"
      load={async () => [
        {
          id: 'g',
          guildId: 'guild',
          target: 5,
          startsAt: Date.parse('2026-11-01T03:00:00Z'),
          endsAt: Date.parse('2026-11-03T03:00:00Z'),
          status: 'completed',
          progress: { count: 5, contributors: ['user'] },
        },
      ]}
    />,
  );
  expect(await screen.findByText('5 / 5 participações')).toBeDefined();
  expect(screen.getByText('Concluída')).toBeDefined();
  expect(
    screen.getByText('Você contribuiu e recebeu o emblema desta meta.'),
  ).toBeDefined();
});
