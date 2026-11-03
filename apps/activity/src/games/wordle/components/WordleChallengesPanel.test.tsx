import '@/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, mock } from 'bun:test';
import { WordleChallengesPanel } from './WordleChallengesPanel';

it('lets a member join an open challenge without ordering by speed', async () => {
  const join = mock(async (_id: string) => {});
  render(
    <WordleChallengesPanel
      achievements={[]}
      load={async () => [
        {
          id: 'one',
          guildId: 'guild',
          creatorId: 'owner',
          patternId: 'letter_a',
          opensAt: 1,
          closesAt: 9999999999999,
          status: 'open',
          participants: ['guest'],
          joined: false,
        },
      ]}
      create={async () => {
        throw new Error();
      }}
      join={join}
    />,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: /Entrar no desafio/ }),
  );
  await waitFor(() => expect(join).toHaveBeenCalledWith('one'));
  expect(screen.getByText(/1 participante concluiu/)).toBeDefined();
});

it('creates a challenge only from a figure the player unlocked', async () => {
  const create = mock(async (patternId: string, closesAt: number) => ({
    id: 'created',
    guildId: 'guild',
    creatorId: 'owner',
    patternId,
    opensAt: 1,
    closesAt,
    status: 'open' as const,
    participants: [],
    joined: true,
  }));
  const achievement = {
    id: 'a',
    family: 'letters',
    tier: 1,
    name: 'Letra A',
    description: '',
    icon: '🔤',
    rarity: 'rare' as const,
    rewardXp: 0,
    hidden: false,
    unlockedAt: '2026-01-01T00:00:00Z',
    progress: null,
    holdersPercent: null,
    patternPreview: {
      patternId: 'letter_a',
      mask: ['#'],
      variants: [],
      colors: ['correct' as const],
      rotations: [0 as const],
    },
  };
  render(
    <WordleChallengesPanel
      achievements={[achievement]}
      load={async () => []}
      create={create}
      join={async () => {}}
    />,
  );
  fireEvent.change(await screen.findByLabelText('Figura desbloqueada'), {
    target: { value: 'letter_a' },
  });
  fireEvent.change(screen.getByLabelText('Prazo (horário do dispositivo)'), {
    target: { value: '2099-01-01T12:00' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Criar desafio' }));
  await waitFor(() =>
    expect(create).toHaveBeenCalledWith('letter_a', expect.any(Number)),
  );
});
