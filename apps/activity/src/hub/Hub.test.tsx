import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';
import { MemoryRouter } from 'react-router-dom';
import '../i18n';
import { Hub } from './Hub';

describe('Hub', () => {
  it('shows only the Termo game tile', () => {
    render(
      <MemoryRouter>
        <Hub />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /terminhos/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /salas/i })).toBeNull();
    expect(
      screen.queryByRole('button', { name: /termos multiplayer/i }),
    ).toBeNull();
  });
});
