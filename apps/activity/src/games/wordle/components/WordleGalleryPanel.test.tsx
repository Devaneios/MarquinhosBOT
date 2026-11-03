import '@/i18n';
import { render, screen } from '@testing-library/react';
import { expect, it } from 'bun:test';
import { WordleGalleryPanel } from './WordleGalleryPanel';

it('shows a closed-day weekly gallery entry and its attribution', async () => {
  const evidence = {
    patternId: 'tetromino_i',
    color: 'correct' as const,
    origin: [0, 0] as [number, number],
    rotation: 0 as const,
    cells: [[0, 0] as [number, number]],
    feedback: [['correct' as const]],
    date: '2026-11-01',
  };
  render(
    <WordleGalleryPanel
      load={async () => ({
        weekKey: '2026-10-26',
        entries: [
          {
            userId: 'user',
            family: 'tetrominoes',
            date: '2026-11-01',
            sourceAt: 1,
            patternId: 'tetromino_i',
            name: 'Peça I',
            evidence,
          },
        ],
      })}
    />,
  );
  expect(await screen.findByText('Peça I')).toBeDefined();
  expect(screen.getByText('Participante: user')).toBeDefined();
  expect(screen.getByRole('img', { name: /Desenho da galeria/ })).toBeDefined();
});
