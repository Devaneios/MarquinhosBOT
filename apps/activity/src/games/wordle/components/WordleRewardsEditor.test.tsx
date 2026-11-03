import '@/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, mock } from 'bun:test';
import { WordleRewardsEditor } from './WordleRewardsEditor';

it('equips and removes an owned title', async () => {
  const equip = mock(
    async (_kind: 'title' | 'frame', rewardId: string | null) => ({
      owned: ['title_alphabetist'],
      title: rewardId,
      frame: null,
      badges: [],
    }),
  );
  render(
    <WordleRewardsEditor
      load={async () => ({
        owned: ['title_alphabetist'],
        title: null,
        frame: null,
        badges: [],
      })}
      equip={equip}
    />,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Equipar Alfabetista' }),
  );
  await waitFor(() =>
    expect(equip).toHaveBeenCalledWith('title', 'title_alphabetist'),
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Remover Alfabetista' }),
  );
  await waitFor(() => expect(equip).toHaveBeenCalledWith('title', null));
});

it('shows badges earned in another community', async () => {
  render(
    <WordleRewardsEditor
      load={async () => ({
        owned: [],
        title: null,
        frame: null,
        badges: [
          {
            goalId: 'goal',
            guildId: '123',
            grantedAt: 20,
            startsAt: 10,
            endsAt: 20,
          },
        ],
      })}
      equip={async () => {
        throw new Error('unexpected');
      }}
    />,
  );
  expect(await screen.findByText(/Comunidade 123/)).toBeTruthy();
});
