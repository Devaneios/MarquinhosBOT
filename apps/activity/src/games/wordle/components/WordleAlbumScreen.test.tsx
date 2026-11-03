import '@/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'bun:test';
import { WordleAlbumScreen } from './WordleAlbumScreen';

it('shows community progress, a pattern, and the first recorded contributor', async () => {
  render(
    <WordleAlbumScreen
      load={async () => [
        {
          patternId: 'a',
          family: 'letters',
          name: 'Letra A',
          icon: '🔤',
          mask: ['.#.', '###'],
          contributorCount: 1,
          contributors: ['123'],
          firstContribution: {
            occurrenceId: 'event',
            patternId: 'a',
            userId: '123',
            occurredAt: 1,
          },
        },
      ]}
      onBack={() => {}}
    />,
  );
  await screen.findByRole('button', { name: /Letra A/ });
  expect(screen.getByText('1 de 1 figuras')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: /Letra A/ }));
  expect(screen.getByText(/Primeira contribuição registrada/)).toBeDefined();
  expect(screen.getByRole('img', { name: /Letra A/ })).toBeDefined();
});
