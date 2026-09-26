# Wordle Motion & Screen Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Terminhos (Wordle) a continuous hub → loading → board motion story, a staged entrance, flip/pop/bounce gameplay feedback and animated settings transitions, with hub ↔ game slides for every game.

**Architecture:** React 19.3 `<ViewTransition>` drives the browser View Transitions API for screen changes (router navigations already run in `startTransition`; local swaps opt in via a `transitionTo` helper that tags direction with `addTransitionType`). Shared-element morphs use the names `game-title` and `game-panel`. In-board motion is CSS keyframes in `global.css`; the flip-reveal timing lives in `useWordleBoard` state (`revealedCount`, `celebrateRow`).

**Tech Stack:** React 19.3, react-router-dom 7.18 (`MemoryRouter`), Tailwind v4, bun:test + happy-dom + @testing-library/react, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-25-wordle-motion-design.md`

## Global Constraints

- `react`, `react-dom`, `@types/react`, `@types/react-dom` specifiers → `^19.3.0` in `apps/activity/package.json` (lockfile already resolves 19.3.0).
- New module path: `apps/activity/src/shared/motion/transitions.ts` (foundation layer; `architecture.test.ts` must stay green).
- All CSS in `apps/activity/src/styles/global.css`.
- No code comments.
- Run commands from `apps/activity`: tests `pnpm test`, single file `VITE_DISCORD_CLIENT_ID=test bun test --isolate <path>`, `pnpm typecheck`, `pnpm lint`, `pnpm format`.
- Timing constants are the single source of truth in `games/wordle/constants.ts`; CSS never hardcodes flip/bounce stagger or duration (they're set inline).

## Review Focus

1. **Duplicate `view-transition-name` in one snapshot** — a screen rendering two `GameHeader`s or two `game-panel` elements makes the browser skip the transition (instant swap, console error). Expected: exactly one of each per screen. Pinned by Task 2's test asserting a single named title in the hub.
2. **Room never connects before `init`** — expected an error screen with a way back, not an infinite "Conectando". Pinned in Task 5.
3. **Reduced motion** — expected no reveal delay and no input lock. Pinned in Task 4.
4. **Reload mid-game / already solved** — expected no flip and no bounce for restored rows, keyboard colors shown immediately. Pinned in Task 4.
5. **Typing during a reveal** — expected input ignored until the flip ends so a second guess can't be submitted blind. Pinned in Task 4.

---

### Task 1: React 19.3 + `shared/motion` transitions module + view-transition CSS

**Files:**
- Modify: `apps/activity/package.json`
- Create: `apps/activity/src/shared/motion/transitions.ts`
- Create: `apps/activity/src/shared/motion/transitions.test.tsx`
- Modify: `apps/activity/src/styles/global.css` (append)

**Interfaces:**
- Produces:
  - `type TransitionDirection = 'nav-forward' | 'nav-back'`
  - `transitionTo(direction: TransitionDirection, update: () => void): void`
  - `useNavigateHome(): () => void`
  - `useNavigateForward(): (to: string) => void`
  - `prefersReducedMotion(): boolean`

- [ ] **Step 1: Bump React specifiers**

In `apps/activity/package.json` set `"react": "^19.3.0"`, `"react-dom": "^19.3.0"`, `"@types/react": "^19.3.0"`, `"@types/react-dom": "^19.3.0"`. Run `pnpm install` from the repo root; lockfile specifiers update, resolved versions stay 19.3.0.

- [ ] **Step 2: Write the failing test**

```tsx
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
    window.matchMedia = ((query: string) =>
      ({ matches: query === '(prefers-reduced-motion: reduce)' }) as MediaQueryList);
    expect(prefersReducedMotion()).toBe(true);

    window.matchMedia = (() => ({ matches: false }) as MediaQueryList);
    expect(prefersReducedMotion()).toBe(false);
  });
});
```

- [ ] **Step 3: Run it — expect FAIL (module not found)**

`VITE_DISCORD_CLIENT_ID=test bun test --isolate src/shared/motion`

- [ ] **Step 4: Implement**

```ts
import { addTransitionType, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';

export type TransitionDirection = 'nav-forward' | 'nav-back';

export function transitionTo(
  direction: TransitionDirection,
  update: () => void,
): void {
  startTransition(() => {
    addTransitionType(direction);
    update();
  });
}

export function useNavigateHome(): () => void {
  const navigate = useNavigate();
  return () => transitionTo('nav-back', () => navigate('/'));
}

export function useNavigateForward(): (to: string) => void {
  const navigate = useNavigate();
  return (to) => transitionTo('nav-forward', () => navigate(to));
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
```

- [ ] **Step 5: Append view-transition CSS to `global.css`**

```css
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 180ms;
}

::view-transition-group(game-title),
::view-transition-group(game-panel) {
  animation-duration: 280ms;
  animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
}

html:active-view-transition-type(nav-forward)::view-transition-old(root) {
  animation: 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both vt-out-left;
}

html:active-view-transition-type(nav-forward)::view-transition-new(root) {
  animation: 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both vt-in-right;
}

html:active-view-transition-type(nav-back)::view-transition-old(root) {
  animation: 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both vt-out-right;
}

html:active-view-transition-type(nav-back)::view-transition-new(root) {
  animation: 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both vt-in-left;
}

@keyframes vt-out-left {
  to { opacity: 0; transform: translateX(-24px); }
}
@keyframes vt-in-right {
  from { opacity: 0; transform: translateX(24px); }
}
@keyframes vt-out-right {
  to { opacity: 0; transform: translateX(24px); }
}
@keyframes vt-in-left {
  from { opacity: 0; transform: translateX(-24px); }
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

- [ ] **Step 6: Run test — PASS; run `pnpm typecheck` and `pnpm build`** (build proves Tailwind/lightningcss accepts `:active-view-transition-type`).

- [ ] **Step 7: Commit** — `feat(activity): add view transition helpers and upgrade React to 19.3`

---

### Task 2: Shared-element names, hub → game forward navigation, boot phase transition

**Files:**
- Modify: `apps/activity/src/games/shared/shell/GameHeader.tsx`
- Modify: `apps/activity/src/games/shared/shell/ConnectingScreen.tsx`
- Modify: `apps/activity/src/features/hub/FeaturedGame.tsx`
- Modify: `apps/activity/src/features/hub/PlayGameLink.tsx`
- Modify: `apps/activity/src/app/App.tsx`
- Test: `apps/activity/src/features/hub/HubScreen.test.tsx` (existing "navigates to Terminhos from the play link" pins the click path)

**Interfaces:** Consumes `useNavigateForward` (Task 1). Produces view-transition names `game-title`, `game-panel`.

- [ ] **Step 1:** `GameHeader`: wrap the title div in `<ViewTransition name="game-title">` (import `ViewTransition` from `react`).
- [ ] **Step 2:** `ConnectingScreen`: wrap the `<MenuPanel>` in `<ViewTransition name="game-panel">`.
- [ ] **Step 3:** `FeaturedGame`: wrap `<GamePreview gameId={game.id} />` in `<ViewTransition name="game-panel">`.
- [ ] **Step 4:** `PlayGameLink`:

```tsx
const navigateForward = useNavigateForward();
const to = `/games/${gameId}`;
// <Link to={to} onClick={(event) => { event.preventDefault(); navigateForward(to); }} …>
```

- [ ] **Step 5:** `App.tsx`: derive and defer the phase.

```tsx
const phase =
  identity.status === 'error'
    ? 'error'
    : identity.status === 'ready' && initialPath !== null
      ? 'ready'
      : 'loading';
const deferredPhase = useDeferredValue(phase);
const shownPhase = phase === 'ready' ? deferredPhase : phase;
```

Render the boot `ConnectingScreen` when `shownPhase === 'loading'`, `ErrorScreen` when `shownPhase === 'error' && identity.status === 'error'`, the router when `shownPhase === 'ready' && identity.status === 'ready' && initialPath !== null`.

- [ ] **Step 6:** `pnpm test` (hub + deep-link suites green), `pnpm typecheck`.
- [ ] **Step 7: Commit** — `feat(activity): morph shared title and panel across screens`

---

### Task 3: Every "back to hub" slides back

**Files:** the 23 files from `grep -rl "navigate('/')" apps/activity/src --include=*.tsx | grep -v test`.

**Interfaces:** Consumes `useNavigateHome` (Task 1).

- [ ] **Step 1:** Codemod (scratchpad script): per file replace `navigate('/')` → `navigateHome()`; if `navigate(` still appears, insert `const navigateHome = useNavigateHome();` after each `const navigate = useNavigate();`, else replace that declaration and drop `useNavigate` from the `react-router-dom` import (remove the import if empty); add `import { useNavigateHome } from '@/shared/motion/transitions';`. Run `pnpm format`.
- [ ] **Step 2:** `pnpm lint && pnpm typecheck` — fix any component where an inserted `navigateHome` is unused.
- [ ] **Step 3:** `pnpm test`.
- [ ] **Step 4: Commit** — `feat(activity): slide back to the hub from every game`

---

### Task 4: Flip-reveal state in `useWordleBoard`

**Files:**
- Modify: `apps/activity/src/games/wordle/constants.ts`
- Modify: `apps/activity/src/games/wordle/state/useWordleBoard.ts`
- Test: `apps/activity/src/games/wordle/state/useWordleBoard.test.tsx`

**Interfaces:**
- Produces constants: `FLIP_STAGGER_MS = 250`, `FLIP_DURATION_MS = 500`, `BOUNCE_STAGGER_MS = 80`, `BOUNCE_DURATION_MS = 400`, `ENTRANCE_MS = 600`, `revealDurationMs(wordLength: number): number` = `(wordLength - 1) * FLIP_STAGGER_MS + FLIP_DURATION_MS`.
- Produces hook fields: `revealingRow: number | null`, `celebrateRow: number | null`.

- [ ] **Step 1: Write failing tests** (append to the test file)

```tsx
const miss = (guess: string) => ({
  guess,
  feedback: Array(guess.length).fill('absent'),
});
const hit = (guess: string) => ({
  guess,
  feedback: Array(guess.length).fill('correct'),
});

async function renderRevealHook(guesses = [] as ReturnType<typeof miss>[], solved = false) {
  const { useWordleBoard } = await import(`./useWordleBoard.ts?${Math.random()}`);
  const rendered = renderHook(() =>
    useWordleBoard(
      { token: 'token-1', roomKey: 'wordle-user-1' },
      { enabled: true, enableSpaceKey: false, enableArrowKeys: false },
    ),
  );
  act(() => {
    deliverMessage({
      type: 'init',
      payload: { wordLength: 5, guesses, solved, attempts: guesses.length },
    });
  });
  return rendered;
}

function deliverGuessResult(guesses: ReturnType<typeof miss>[], solved = false) {
  const last = guesses[guesses.length - 1];
  act(() => {
    deliverMessage({
      type: 'guess_result',
      payload: {
        guess: last.guess,
        feedback: last.feedback,
        guesses,
        solved,
        attempts: guesses.length,
        wordLength: 5,
      },
    });
  });
}

describe('useWordleBoard reveal', () => {
  afterEach(() => {
    jest.useRealTimers();
    window.matchMedia = originalMatchMedia;
  });

  it('shows restored guesses without flipping them', async () => {
    const { result } = await renderRevealHook([miss('carro')]);
    expect(result.current.revealingRow).toBeNull();
    expect(result.current.letterStates.c).toBe('absent');
  });

  it('holds keyboard colors until the new row finishes flipping', async () => {
    jest.useFakeTimers();
    const { result } = await renderRevealHook();
    deliverGuessResult([miss('carro')]);
    expect(result.current.revealingRow).toBe(0);
    expect(result.current.letterStates.c).toBeUndefined();

    act(() => jest.advanceTimersByTime(revealDurationMs(5) - 1));
    expect(result.current.revealingRow).toBe(0);

    act(() => jest.advanceTimersByTime(1));
    expect(result.current.revealingRow).toBeNull();
    expect(result.current.letterStates.c).toBe('absent');
  });

  it('ignores typing while a row is revealing', async () => {
    jest.useFakeTimers();
    const { result } = await renderRevealHook();
    deliverGuessResult([miss('carro')]);
    act(() => result.current.typeLetter('a'));
    expect(result.current.currentLetters[0]).toBe('');

    act(() => jest.advanceTimersByTime(revealDurationMs(5)));
    act(() => result.current.typeLetter('a'));
    expect(result.current.currentLetters[0]).toBe('a');
  });

  it('celebrates the winning row after it is revealed', async () => {
    jest.useFakeTimers();
    const { result } = await renderRevealHook();
    deliverGuessResult([hit('termo')], true);
    expect(result.current.celebrateRow).toBeNull();
    act(() => jest.advanceTimersByTime(revealDurationMs(5)));
    expect(result.current.celebrateRow).toBe(0);
  });

  it('does not celebrate a game restored as already solved', async () => {
    const { result } = await renderRevealHook([hit('termo')], true);
    expect(result.current.celebrateRow).toBeNull();
  });

  it('reveals instantly when reduced motion is requested', async () => {
    window.matchMedia = ((query: string) =>
      ({ matches: query === '(prefers-reduced-motion: reduce)' }) as MediaQueryList);
    const { result } = await renderRevealHook();
    deliverGuessResult([miss('carro')]);
    expect(result.current.revealingRow).toBeNull();
    expect(result.current.letterStates.c).toBe('absent');
  });
});
```

(Top of file: add `afterEach, jest` to the `bun:test` import, `import { revealDurationMs } from '../constants';`, `const originalMatchMedia = window.matchMedia;`.)

- [ ] **Step 2: Run — expect FAIL** (`revealDurationMs` not exported / `revealingRow` undefined).

- [ ] **Step 3: Implement**

`constants.ts` — add the constants and `revealDurationMs` above.

`useWordleBoard.ts`:
- state: `const [revealedCount, setRevealedCount] = useState(0);`, `const [celebrateRow, setCelebrateRow] = useState<number | null>(null);`, `const revealTimeout = useRef<number | undefined>(undefined);`
- `init`: `window.clearTimeout(revealTimeout.current);` then wrap all state setters in `startTransition(() => { …existing setters…; setRevealedCount(message.payload.guesses.length); setCelebrateRow(null); })`.
- `guess_result`: after existing setters:

```ts
const { guesses: nextGuesses, solved: nextSolved, wordLength: length } = message.payload;
const finishReveal = () => {
  setRevealedCount(nextGuesses.length);
  if (nextSolved) setCelebrateRow(nextGuesses.length - 1);
};
window.clearTimeout(revealTimeout.current);
if (prefersReducedMotion()) finishReveal();
else revealTimeout.current = window.setTimeout(finishReveal, revealDurationMs(length));
```

- `letterStates`: `buildLetterStates(guesses.slice(0, revealedCount), KB_LETTERS)` with deps `[guesses, revealedCount]`.
- `const revealingRow = guesses.length > revealedCount ? guesses.length - 1 : null;`
- `typeLetter`, `backspace`, `submitGuess`: add `revealingRow !== null ||` to the early-return guard.
- unmount cleanup: also `window.clearTimeout(revealTimeout.current)`.
- return `revealingRow`, `celebrateRow`.

- [ ] **Step 4: Run — PASS**; also the existing focus-control tests.
- [ ] **Step 5: Commit** — `feat(activity): stage wordle guess reveals before exposing feedback`

---

### Task 5: `WordleBoard` screens — loading hold, pre-init error, settings transitions

**Files:**
- Modify: `apps/activity/src/games/wordle/components/WordleBoard.tsx`
- Modify: `apps/activity/src/games/wordle/components/WordleSettingsScreen.tsx`
- Test: `apps/activity/src/games/wordle/components/WordleBoard.test.tsx`

**Interfaces:** Consumes `transitionTo`, `useNavigateHome`, `ENTRANCE_MS`, `revealingRow`, `celebrateRow`.

- [ ] **Step 1: Failing tests** — make the mocked `useColyseusRoom` read a mutable `let connectionState = 'connected'` (reset in `afterEach`), then:

```tsx
function renderBoard() {
  return render(
    <MemoryRouter>
      <WordleBoard session={{ token: 'token-1', roomKey: 'wordle-user-1' }} config={keyboardConfig} onSaveConfig={async () => {}} />
    </MemoryRouter>,
  );
}

it('keeps the connecting screen until the room sends the board', async () => {
  const { WordleBoard } = await import(`./WordleBoard.tsx?${Math.random()}`);
  renderBoard(WordleBoard);
  expect(screen.getByText('CONECTANDO')).toBeTruthy();
  expect(screen.queryByRole('textbox')).toBeNull();
  act(() => deliverMessage({ type: 'init', payload: { wordLength: 5, guesses: [], solved: false, attempts: 0 } }));
  expect(screen.getAllByRole('textbox')).toHaveLength(5);
});

it('shows a way back when the room fails before sending the board', async () => {
  connectionState = 'error';
  …render…
  expect(screen.getByText(/conexão perdida/i)).toBeTruthy();
  expect(screen.getByRole('button', { name: /voltar/i })).toBeTruthy();
});

it('opens settings and returns to the board', async () => {
  …render + init…
  fireEvent.click(screen.getByRole('button', { name: /configurações/i }));
  expect(screen.getByRole('switch', { name: /inverter ações/i })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
  expect(screen.getAllByRole('textbox')).toHaveLength(5);
});
```

(`renderBoard` takes the dynamically imported component. Confirm exact copy for "CONECTANDO", settings aria label and back label from `i18n/locales/pt-BR/common.json` / `games/wordle.json` before asserting.)

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** in `WordleBoard`:
  - `const navigateHome = useNavigateHome();` replaces `useNavigate`.
  - `const screen = wordLength === null ? 'loading' : showSettings ? 'settings' : 'playing';`
  - entrance: `const [entered, setEntered] = useState(false);` + effect: when `screen === 'playing' && !entered`, `setTimeout(() => setEntered(true), ENTRANCE_MS)` with cleanup.
  - `screen === 'loading'`: connection `'error' | 'disconnected'` → `<ErrorScreen message={t('common:connectionLost')} onBack={navigateHome} />`, else `<ConnectingScreen subtitleKey="connectingSubtitle" subtitleNs="wordle" />`.
  - settings open: `suspendInput(); transitionTo('nav-forward', () => setShowSettings(true));` / back: `transitionTo('nav-back', () => setShowSettings(false))`.
  - root class adds `!entered && 'wordle-entering'`; card wrapped in `<ViewTransition name="game-panel">`.
  - solved banner: `solved && revealingRow === null`, add `animate-termo-toast-in`.
  - progress chip gains class `termo-progress`.
  - `GuessRow` gets `rowIndex={index}` and `motion={index === revealingRow ? 'flip' : index === celebrateRow ? 'bounce' : undefined}`; `CurrentRow` gets `orderOffset={guesses.length * wordLength}` (props land in Task 6 — do Task 6 Step 3 in the same commit if typecheck blocks).
  - `WordleSettingsScreen`: wrap `<MenuPanel>` in `<ViewTransition name="game-panel">`.
- [ ] **Step 4: Run — PASS**, plus settings-screen tests.
- [ ] **Step 5: Commit** — `feat(activity): hold wordle loading until the board is ready and animate settings`

---

### Task 6: Tile entrance, letter pop, flip and bounce

**Files:**
- Modify: `apps/activity/src/games/wordle/components/Tile.tsx`
- Modify: `apps/activity/src/games/wordle/components/GuessRow.tsx`
- Modify: `apps/activity/src/games/wordle/components/CurrentRow.tsx`
- Modify: `apps/activity/src/games/wordle/types.ts` (`CurrentRowProps.orderOffset: number`)
- Modify: `apps/activity/src/react-css-vars.d.ts` (`'--order'?: number; '--tile-bg'?: string; '--tile-fg'?: string;`)
- Modify: `apps/activity/src/styles/global.css`
- Test: `apps/activity/src/games/wordle/components/GuessRow.test.tsx` (new)

**Interfaces:** Produces `type TileMotion = { kind: 'flip' | 'bounce'; delayMs: number; durationMs: number }`; `GuessRow({ row, rowIndex, motion?: 'flip' | 'bounce' })`.

- [ ] **Step 1: Failing test**

```tsx
import '@/i18n';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';
import { FLIP_DURATION_MS, FLIP_STAGGER_MS } from '../constants';
import { GuessRow } from './GuessRow';

const row = { guess: 'termo', feedback: Array(5).fill('correct') as ('correct')[] };

describe('GuessRow', () => {
  it('staggers the flip of a revealing row one tile at a time', () => {
    const { container } = render(<GuessRow row={row} rowIndex={0} motion="flip" />);
    const tiles = Array.from(container.querySelectorAll<HTMLElement>('.termo-flip'));
    expect(tiles.map((tile) => tile.style.animationDelay)).toEqual(
      [0, 1, 2, 3, 4].map((index) => `${index * FLIP_STAGGER_MS}ms`),
    );
    expect(tiles[0].style.animationDuration).toBe(`${FLIP_DURATION_MS}ms`);
  });

  it('renders settled rows without motion', () => {
    const { container } = render(<GuessRow row={row} rowIndex={2} />);
    expect(container.querySelectorAll('.termo-flip, .termo-bounce')).toHaveLength(0);
    expect(container.querySelector<HTMLElement>('.termo-tile')?.style.getPropertyValue('--order')).toBe('10');
  });
});
```

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement**

`Tile.tsx` adds `order: number` and `motion?: TileMotion`; className adds `'termo-tile'`, `motion?.kind === 'flip' && 'termo-flip'`, `motion?.kind === 'bounce' && 'termo-bounce'`; style:

```ts
{
  '--order': order,
  ...(colors && { '--tile-bg': colors.bg, '--tile-fg': colors.text, backgroundColor: colors.bg, color: colors.text }),
  ...(motion && { animationDelay: `${motion.delayMs}ms`, animationDuration: `${motion.durationMs}ms` }),
}
```

`GuessRow.tsx`:

```tsx
function tileMotion(motion: 'flip' | 'bounce' | undefined, index: number): TileMotion | undefined {
  if (motion === 'flip') return { kind: 'flip', delayMs: index * FLIP_STAGGER_MS, durationMs: FLIP_DURATION_MS };
  if (motion === 'bounce') return { kind: 'bounce', delayMs: index * BOUNCE_STAGGER_MS, durationMs: BOUNCE_DURATION_MS };
  return undefined;
}
```

Tile `order={rowIndex * row.guess.length + index}`.

`CurrentRow.tsx`: each input gets `'termo-tile'`, `letters[index] && 'termo-pop'`, `style={{ '--order': orderOffset + index }}`.

`global.css` (after the termo toast block):

```css
.termo-pop { animation: termo-pop 120ms ease-out; }
.termo-flip { animation-name: termo-flip; animation-timing-function: ease-in-out; animation-fill-mode: both; }
.termo-bounce { animation-name: termo-bounce; animation-timing-function: ease-out; animation-fill-mode: both; }
.wordle-entering .termo-tile { animation: termo-tile-in 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both; animation-delay: calc(min(var(--order, 0), 12) * 30ms); }
.wordle-entering .termo-keyboard .hg-row { animation: termo-kb-row-in 280ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.wordle-entering .termo-keyboard .hg-row:nth-child(1) { animation-delay: 150ms; }
.wordle-entering .termo-keyboard .hg-row:nth-child(2) { animation-delay: 210ms; }
.wordle-entering .termo-keyboard .hg-row:nth-child(3) { animation-delay: 270ms; }
.wordle-entering .termo-progress { animation: termo-fade-in 200ms ease-out 200ms both; }

@keyframes termo-pop { 50% { transform: scale(1.12); } }
@keyframes termo-flip {
  0%, 49.99% { background-color: transparent; color: var(--color-marquinhos-text); border-color: var(--color-marquinhos-border-hover); }
  0% { transform: rotateX(0); }
  50% { transform: rotateX(90deg); background-color: var(--tile-bg); color: var(--tile-fg); border-color: transparent; }
  100% { transform: rotateX(0); background-color: var(--tile-bg); color: var(--tile-fg); border-color: transparent; }
}
@keyframes termo-bounce { 0%, 100% { transform: translateY(0); } 45% { transform: translateY(-14px); } 70% { transform: translateY(2px); } }
@keyframes termo-tile-in { from { opacity: 0; transform: scale(0.6); } }
@keyframes termo-kb-row-in { from { opacity: 0; transform: translateY(12px); } }
@keyframes termo-fade-in { from { opacity: 0; } }
```

- [ ] **Step 4: Run — PASS**; `pnpm test`, `pnpm typecheck`, `pnpm lint`.
- [ ] **Step 5: Commit** — `feat(activity): animate wordle tiles, keyboard entrance, flip and win bounce`

---

### Task 7: Verify in the real app

- [ ] `pnpm build` in `apps/activity`.
- [ ] Run the activity dev server (`pnpm dev` in `apps/activity`, or the repo `dev` skill), open in Chrome, DevTools → Animations at 10%:
  hub → Terminhos (title + panel morph, forward slide), connecting → board (panel morph, tile stagger, keyboard rows), typing pop, guess flip with keyboard colors after the flip, win bounce + banner, settings slide forward/back, back to hub slide. Console: no duplicate `view-transition-name` errors.
- [ ] Emulate `prefers-reduced-motion: reduce`: instant swaps, no flip lock.
