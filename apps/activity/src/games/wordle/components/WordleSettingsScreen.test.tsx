import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, mock } from 'bun:test';
import '../../../i18n';
import { WordleSettingsScreen } from './WordleSettingsScreen';

describe('WordleSettingsScreen', () => {
  it('saves both edited settings before returning to the game', async () => {
    const onSave = mock(async () => {});
    const onBack = mock(() => {});

    render(
      <WordleSettingsScreen
        config={{ invertActionKeys: false, enableSounds: false }}
        onSave={onSave}
        onBack={onBack}
      />,
    );

    fireEvent.click(screen.getByRole('switch', { name: /sons do teclado/i }));
    fireEvent.click(
      screen.getByRole('switch', { name: /inverter teclas de ação/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        invertActionKeys: true,
        enableSounds: true,
      }),
    );
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('goes back without saving draft changes', () => {
    const onSave = mock(async () => {});
    const onBack = mock(() => {});

    render(
      <WordleSettingsScreen
        config={{ invertActionKeys: false, enableSounds: false }}
        onSave={onSave}
        onBack={onBack}
      />,
    );

    fireEvent.click(screen.getByRole('switch', { name: /sons do teclado/i }));
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
        config={{ invertActionKeys: false, enableSounds: false }}
        onSave={onSave}
        onBack={onBack}
      />,
    );

    const soundsToggle = screen.getByRole('switch', {
      name: /sons do teclado/i,
    });
    fireEvent.click(soundsToggle);
    fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/não foi possível salvar as configurações/i),
      ).toBeTruthy(),
    );
    expect(soundsToggle.getAttribute('aria-checked')).toBe('true');
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
        config={{ invertActionKeys: false, enableSounds: false }}
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
