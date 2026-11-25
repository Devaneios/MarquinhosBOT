import '@/i18n';
import { AchievementBanners } from '@/shared/achievements/AchievementBanners';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { expect, it, mock } from 'bun:test';
import { request } from 'node:http';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';

let endpoint = '';
mock.module('@/platform/api/apiBase', () => ({
  colyseusUrl: () => endpoint,
  apiBase: () => 'http://127.0.0.1:1/api',
  apiUrl: (path: string) => `http://127.0.0.1:1/api${path}`,
}));

const integrationTest = process.env.TEST_DATABASE_URL ? it : it.skip;

async function playGame({
  dropFirst = false,
  remount = false,
  failAward = false,
  backgroundAward = false,
  dropTransport = false,
  terminalDrop = false,
  botSolve = false,
  botWrong = false,
  legacyReward = false,
  checkCollection = false,
}: {
  dropFirst?: boolean;
  remount?: boolean;
  failAward?: boolean;
  backgroundAward?: boolean;
  dropTransport?: boolean;
  terminalDrop?: boolean;
  botSolve?: boolean;
  botWrong?: boolean;
  legacyReward?: boolean;
  checkCollection?: boolean;
} = {}) {
  const child = Bun.spawn(
    [
      process.execPath,
      '--no-env-file',
      'tests/helpers/wordleActivityHarness.ts',
    ],
    {
      cwd: `${import.meta.dir}/../../../../api`,
      env: {
        PATH: process.env.PATH,
        TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
        MARQUINHOS_SECRET_KEY: 'test',
        OPENAI_API_KEY: 'test',
        NODE_ENV: 'test',
        WORDLE_E2E_DROP_FIRST: dropFirst ? '1' : '0',
        WORDLE_E2E_FAIL_AWARD: failAward ? '1' : '0',
        WORDLE_E2E_BACKGROUND_AWARD: backgroundAward ? '1' : '0',
        WORDLE_E2E_DROP_TRANSPORT: dropTransport ? '1' : '0',
        WORDLE_E2E_TERMINAL_DROP: terminalDrop ? '1' : '0',
        WORDLE_E2E_BOT_SOLVE: botSolve ? '1' : '0',
        WORDLE_E2E_BOT_WRONG: botWrong ? '1' : '0',
        WORDLE_E2E_LEGACY_REWARD: legacyReward ? '1' : '0',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const originalMatchMedia = window.matchMedia;
  let readinessTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const ready = await Promise.race([
      (async () => {
        const reader = child.stdout.getReader();
        const decoder = new TextDecoder();
        let text = '';
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done)
            throw new Error('Wordle test server exited before it was ready');
          text += decoder.decode(chunk.value, { stream: true });
          const line = text
            .split('\n')
            .find((part) => part.startsWith('WORDLE_E2E_READY '));
          if (line)
            return JSON.parse(line.slice('WORDLE_E2E_READY '.length)) as {
              url: string;
              token: string;
              roomKey: string;
              botOrigin?: string;
            };
        }
      })(),
      new Promise<never>((_, reject) => {
        readinessTimer = setTimeout(
          () => reject(new Error('Wordle test server did not start')),
          15_000,
        );
      }),
    ]);
    endpoint = ready.url;
    window.matchMedia = (() => ({
      matches: true,
    })) as unknown as typeof window.matchMedia;
    const { WordleBoard } = await import('./components/WordleBoard');
    const mountBoard = () =>
      render(
        <StrictMode>
          <AchievementBanners>
            <MemoryRouter>
              <WordleBoard
                session={{ token: ready.token, roomKey: ready.roomKey }}
                config={{
                  invertActionKeys: false,
                  enableSounds: false,
                  enableSpaceKey: false,
                  enableArrowKeys: false,
                }}
                onSaveConfig={async () => {}}
              />
            </MemoryRouter>
          </AchievementBanners>
        </StrictMode>,
      );
    let rendered = mountBoard();
    if (remount) {
      await screen.findByRole(
        'textbox',
        { name: /letra 1/i },
        { timeout: 10_000 },
      );
      rendered.unmount();
      rendered = mountBoard();
    }
    const input = await screen.findByRole(
      'textbox',
      { name: /letra 1/i },
      { timeout: 10_000 },
    );
    await waitFor(() => expect(document.activeElement).toBe(input));
    if (botSolve || botWrong) {
      if (!ready.botOrigin) throw new Error('Missing bot API endpoint');
      const response = await act(
        () =>
          new Promise<{ status: number; body: string }>((resolve, reject) => {
            const req = request(
              `${ready.botOrigin}/api/wordle/guess`,
              {
                method: 'POST',
                headers: {
                  authorization: 'Bearer test-bot-key',
                  'content-type': 'application/json',
                },
              },
              (res) => {
                let body = '';
                res.on('data', (chunk) => {
                  body += chunk;
                });
                res.on('end', () =>
                  resolve({ status: res.statusCode ?? 0, body }),
                );
              },
            );
            req.on('error', reject);
            req.end(
              JSON.stringify({
                userId: 'activity-e2e-user',
                guildId: 'activity-e2e-guild',
                guess: botWrong ? 'carro' : 'termo',
                requestId: crypto.randomUUID(),
              }),
            );
          }),
      );
      expect(response.status).toBe(200);
      expect(JSON.parse(response.body).data.solved).toBe(!botWrong);
    }
    if (botWrong) {
      for (const letter of 'carro')
        fireEvent.keyDown(document.activeElement!, { key: letter });
      fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
      await screen.findByText(/tentativa 2/i, {}, { timeout: 10_000 });
      await waitFor(() =>
        expect(
          (screen.getAllByRole('textbox')[0] as HTMLInputElement).value,
        ).toBe(''),
      );
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getAllByRole('textbox')[0]),
      );
    }
    if (dropTransport) window.dispatchEvent(new Event('offline'));
    for (const [index, letter] of [...'termo'].entries()) {
      fireEvent.keyDown(document.activeElement!, { key: letter });
      expect(
        (
          screen.getAllByRole('textbox')[index] as HTMLInputElement
        ).value.toLowerCase(),
      ).toBe(letter);
    }
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    if (terminalDrop) {
      await screen.findByText(/conexão perdida/i, {}, { timeout: 10_000 });
      rendered.unmount();
      rendered = mountBoard();
    }
    const earned = await screen.findByText(
      botWrong ? 'Segunda é a certa' : 'Palpite certeiro',
      {},
      { timeout: 20_000 },
    );
    const announcement = within(earned.closest('[role="status"]')!);
    expect(announcement.getByText(botWrong ? '+25 XP' : '+75 XP')).toBeTruthy();
    expect(announcement.getByText(/conquista desbloqueada/i)).toBeTruthy();
    if (checkCollection) {
      fireEvent.click(screen.getByRole('button', { name: /ver conquistas/i }));
      expect(screen.getByRole('heading', { name: /conquistas/i })).toBeTruthy();
      expect(screen.getByText(/1 de \d+ desbloqueadas/i)).toBeTruthy();
      expect(screen.getAllByText('Palpite certeiro')).toHaveLength(2);
      expect(screen.getByText('Desbloqueada')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
      expect(screen.queryByRole('heading', { name: /conquistas/i })).toBeNull();
    }
    await act(async () => rendered.unmount());
  } finally {
    clearTimeout(readinessTimer);
    window.matchMedia = originalMatchMedia;
    window.sessionStorage.clear();
    child.kill('SIGTERM');
    const exitCode = await child.exited;
    const stderr =
      exitCode === 0 ? '' : await new Response(child.stderr).text();
    expect(exitCode, stderr).toBe(0);
  }
}

integrationTest(
  'plays a real Wordle over WebSocket and shows the earned achievement',
  async () => {
    await playGame({ checkCollection: true });
  },
  30_000,
);

integrationTest(
  'restores a quickly remounted Wordle and awards the win',
  async () => {
    await playGame({ remount: true });
  },
  30_000,
);

integrationTest(
  'recovers an achievement after award processing fails',
  async () => {
    await playGame({ failAward: true });
  },
  35_000,
);

integrationTest(
  'shows an achievement recovered by the background job',
  async () => {
    await playGame({ failAward: true, backgroundAward: true });
  },
  35_000,
);

integrationTest(
  'reconnects a dropped WebSocket and awards a buffered winning guess',
  async () => {
    await playGame({ dropTransport: true });
  },
  35_000,
);

integrationTest(
  'recovers an unanswered winning guess after a terminal disconnect and remount',
  async () => {
    await playGame({ terminalDrop: true });
  },
  35_000,
);

integrationTest(
  'updates an open Activity when the bot already solved the shared game',
  async () => {
    await playGame({ botSolve: true });
  },
  35_000,
);

integrationTest(
  'restores a bot guess before winning from the open Activity',
  async () => {
    await playGame({ botWrong: true });
  },
  35_000,
);

integrationTest(
  'recovers a lost guess response without duplicating the win or XP',
  async () => {
    await playGame({ dropFirst: true });
  },
  30_000,
);

integrationTest(
  'shows and awards the current XP when a legacy definition has a different reward',
  async () => {
    await playGame({ legacyReward: true });
  },
  30_000,
);
