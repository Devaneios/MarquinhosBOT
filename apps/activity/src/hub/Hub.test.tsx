import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'bun:test';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GAME_REGISTRY } from '../games/registry';
import '../i18n';
import { Hub } from './Hub';
import { HUB_GAME_IDS } from './hubGames';

const publishedIds = [...HUB_GAME_IDS];
const gameStatuses = GAME_REGISTRY.map((game) => game.status);

afterEach(() => {
  HUB_GAME_IDS.splice(0, HUB_GAME_IDS.length, ...publishedIds);
  GAME_REGISTRY.forEach((game, index) => {
    game.status = gameStatuses[index];
  });
});

function renderHub() {
  return render(
    <MemoryRouter>
      <Hub />
    </MemoryRouter>,
  );
}

describe('Hub', () => {
  it('publishes only Terminhos even when other games are playable', () => {
    renderHub();

    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(
      screen
        .getByRole('link', { name: 'Jogar Terminhos' })
        .getAttribute('href'),
    ).toBe('/games/wordle');
    expect(screen.queryByRole('heading', { name: 'Mais jogos' })).toBeNull();
    expect(screen.queryByText('Ponguinhos')).toBeNull();
    expect(screen.queryByText('Terminhos multiplayer')).toBeNull();
  });

  it('navigates to Terminhos from the play link', () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<Hub />} />
          <Route path="/games/wordle" element={<h1>Partida de Terminhos</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Jogar Terminhos' }));

    expect(
      screen.getByRole('heading', { name: 'Partida de Terminhos' }),
    ).toBeTruthy();
  });

  it('features the first published game and lists the others in publication order', () => {
    HUB_GAME_IDS.splice(0, HUB_GAME_IDS.length, 'hangman', 'wordle', 'pong');
    renderHub();

    expect(screen.getByRole('region', { name: 'Forca' })).toBeTruthy();
    const catalog = screen.getByRole('region', { name: 'Mais jogos' });
    expect(
      within(catalog)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Terminhos', 'Ponguinhos']);
    expect(
      screen.getAllByRole('link').map((link) => link.getAttribute('href')),
    ).toEqual(['/games/hangman', '/games/wordle', '/games/pong']);
    expect(within(catalog).queryByText('Forca')).toBeNull();
  });

  it('does not publish a game that is not playable and promotes the next eligible game', () => {
    HUB_GAME_IDS.splice(0, HUB_GAME_IDS.length, 'pong', 'wordle');
    const pong = GAME_REGISTRY.find((game) => game.id === 'pong')!;
    pong.status = 'COMING SOON';
    renderHub();

    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Terminhos' })).toBeTruthy();
    expect(screen.queryByText('Ponguinhos')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Mais jogos' })).toBeNull();
  });

  it('keeps the page usable when no published game is playable', () => {
    GAME_REGISTRY.find((game) => game.id === 'wordle')!.status = 'COMING SOON';
    renderHub();

    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Mais jogos' })).toBeNull();
  });

  it('explains the game with semantic headings and keeps its preview decorative', () => {
    const { container } = renderHub();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Sua próxima partida começa aqui.',
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Terminhos' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Descubra a palavra usando as pistas de cada tentativa.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Verde: posição certa.')).toBeTruthy();
    expect(screen.getByText('Amarelo: outra posição.')).toBeTruthy();
    expect(screen.getByText('Cinza: letra ausente.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('a a, a button')).toBeNull();
    const preview = screen
      .getByText('T', { selector: '[aria-hidden="true"] span' })
      .closest('[aria-hidden="true"]');
    expect(preview).toBeTruthy();
    expect(preview?.querySelector('a, button, input, [tabindex]')).toBeNull();
  });
});
