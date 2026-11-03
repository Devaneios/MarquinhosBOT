import '@/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, mock } from 'bun:test';
import { WordleShowcaseEditor } from './WordleShowcaseEditor';

it('selects, reorders and saves unlocked achievements', async () => {
  const save = mock(async (ids: string[]) => ids);
  render(
    <WordleShowcaseEditor
      achievements={[
        { id: 'a', name: 'Alfa', icon: 'A', unlockedAt: '2026-01-01' },
        { id: 'b', name: 'Beta', icon: 'B', unlockedAt: '2026-01-01' },
        { id: 'c', name: 'Bloqueada', icon: 'C', unlockedAt: null },
      ]}
      load={async () => ['a']}
      save={save}
    />,
  );
  await screen.findByRole('button', { name: 'Remover Alfa' });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar Beta' }));
  fireEvent.click(screen.getByRole('button', { name: 'Mover Beta para cima' }));
  expect(
    screen.queryByRole('button', { name: 'Adicionar Bloqueada' }),
  ).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Salvar vitrine' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(['b', 'a']));
});

it('keeps edits available when saving fails', async () => {
  const save = mock(async () => {
    throw new Error('offline');
  });
  render(
    <WordleShowcaseEditor
      achievements={[
        { id: 'a', name: 'Alfa', icon: 'A', unlockedAt: '2026-01-01' },
      ]}
      load={async () => []}
      save={save}
    />,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Adicionar Alfa' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Salvar vitrine' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Remover Alfa' })).toBeDefined();
});
