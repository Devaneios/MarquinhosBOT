import '@/i18n';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';
import { FLIP_DURATION_MS, FLIP_STAGGER_MS } from '../constants';
import { GuessRow } from './GuessRow';

const row = {
  guess: 'termo',
  feedback: Array(5).fill('correct') as 'correct'[],
};

describe('GuessRow', () => {
  it('staggers the flip of a revealing row one tile at a time', () => {
    const { container } = render(
      <GuessRow row={row} rowIndex={0} motion="flip" />,
    );
    const tiles = Array.from(
      container.querySelectorAll<HTMLElement>('.termo-flip'),
    );
    expect(tiles.map((tile) => tile.style.animationDelay)).toEqual(
      [0, 1, 2, 3, 4].map((index) => `${index * FLIP_STAGGER_MS}ms`),
    );
    expect(tiles[0].style.animationDuration).toBe(`${FLIP_DURATION_MS}ms`);
  });

  it('renders settled rows without motion', () => {
    const { container } = render(<GuessRow row={row} rowIndex={2} />);
    expect(
      container.querySelectorAll('.termo-flip, .termo-bounce'),
    ).toHaveLength(0);
    expect(
      container
        .querySelector<HTMLElement>('.termo-tile')
        ?.style.getPropertyValue('--order'),
    ).toBe('10');
  });
});
