import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'bun:test';
import { MemoryRouter, useLocation } from 'react-router-dom';
import {
  prefersReducedMotion,
  useNavigateForward,
  useNavigateHome,
} from './transitions';

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

function Probe() {
  const navigateHome = useNavigateHome();
  const navigateForward = useNavigateForward();
  const location = useLocation();
  return (
    <>
      <output>{location.pathname}</output>
      <button type="button" onClick={() => navigateForward('/games/wordle')}>
        forward
      </button>
      <button type="button" onClick={navigateHome}>
        home
      </button>
    </>
  );
}

describe('screen transitions', () => {
  it('navigates forward to a game and back home', () => {
    render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'forward' }));
    expect(screen.getByRole('status').textContent).toBe('/games/wordle');

    fireEvent.click(screen.getByRole('button', { name: 'home' }));
    expect(screen.getByRole('status').textContent).toBe('/');
  });

  it('reports the reduced motion preference', () => {
    window.matchMedia = (query: string) =>
      ({
        matches: query === '(prefers-reduced-motion: reduce)',
      }) as MediaQueryList;
    expect(prefersReducedMotion()).toBe(true);

    window.matchMedia = () => ({ matches: false }) as MediaQueryList;
    expect(prefersReducedMotion()).toBe(false);
  });
});
