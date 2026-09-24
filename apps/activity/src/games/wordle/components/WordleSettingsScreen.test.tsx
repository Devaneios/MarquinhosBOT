import type { WordleUserConfig } from '@marquinhos/contracts/wordle';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, mock } from 'bun:test';
import '../../../i18n/index';
import { WordleSettingsScreen } from './WordleSettingsScreen';

describe('WordleSettingsScreen', () => {
  const disabledConfig = {
    invertActionKeys: false,
    enableSounds: false,
    enableSpaceKey: false,
    enableArrowKeys: false,
  } satisfies WordleUserConfig;

  it('saves the edited visible settings before returning to the game', async () => {
    const onSave = mock(async () => {});
    const onBack = mock(() => {});

    render(
      <WordleSettingsScreen
        config={disabledConfig}
        onSave={onSave}
        onBack={onBack}
      />,
    );

    fireEvent.click(screen.getByRole('switch', { name: /inverter ações/i }));
    fireEvent.click(screen.getByRole('switch', { name: /habilitar espaço/i }));
    fireEvent.click(screen.getByRole('switch', { name: /habilitar setas/i }));
    fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        invertActionKeys: true,
        enableSounds: false,
        enableSpaceKey: true,
        enableArrowKeys: true,
      }),
    );
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows arrow keys as a disabled sub-option until space is enabled', () => {
    render(
      <WordleSettingsScreen
        config={disabledConfig}
        onSave={async () => {}}
        onBack={() => {}}
      />,
    );

    const spaceToggle = screen.getByRole('switch', {
      name: /habilitar espaço/i,
    });
    const arrowsToggle = screen.getByRole('switch', {
      name: /habilitar setas/i,
    });

    expect(arrowsToggle.hasAttribute('disabled')).toBe(true);
    fireEvent.click(spaceToggle);
    expect(arrowsToggle.hasAttribute('disabled')).toBe(false);
  });

  it('turns arrow keys off when space is disabled', async () => {
    const onSave = mock(async () => {});

    render(
      <WordleSettingsScreen
        config={{
          ...disabledConfig,
          enableSpaceKey: true,
          enableArrowKeys: true,
        }}
        onSave={onSave}
        onBack={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('switch', { name: /habilitar espaço/i }));
    fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        ...disabledConfig,
        enableSpaceKey: false,
        enableArrowKeys: false,
      }),
    );
  });

  it('goes back without saving draft changes', () => {
    const onSave = mock(async () => {});
    const onBack = mock(() => {});

    render(
      <WordleSettingsScreen
        config={disabledConfig}
        onSave={onSave}
        onBack={onBack}
      />,
    );

    fireEvent.click(screen.getByRole('switch', { name: /inverter ações/i }));
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('keeps the draft open when saving fails', async () => {
    const onSave = mock(async () => {
      throw new Error('network down');
    });
    const onBack = mock(() => {});

    render(
      <WordleSettingsScreen
        config={disabledConfig}
        onSave={onSave}
        onBack={onBack}
      />,
    );

    const spaceToggle = screen.getByRole('switch', {
      name: /habilitar espaço/i,
    });
    fireEvent.click(spaceToggle);
    fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/não foi possível salvar as configurações/i),
      ).toBeTruthy(),
    );
    expect(spaceToggle.getAttribute('aria-checked')).toBe('true');
    expect(onBack).not.toHaveBeenCalled();
  });

  it('blocks duplicate saves and navigation while a save is pending', async () => {
    const pending: { resolve?: () => void } = {};
    const onSave = mock(
      () =>
        new Promise<void>((resolve) => {
          pending.resolve = resolve;
        }),
    );
    const onBack = mock(() => {});

    render(
      <WordleSettingsScreen
        config={disabledConfig}
        onSave={onSave}
        onBack={onBack}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }));
    const savingButton = await screen.findByRole('button', {
      name: /salvando/i,
    });
    fireEvent.click(savingButton);
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));

    expect(savingButton.hasAttribute('disabled')).toBe(true);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();

    const finishSave = pending.resolve;
    if (!finishSave) throw new Error('Expected Save to start');
    await act(async () => finishSave());

    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
  });
});
