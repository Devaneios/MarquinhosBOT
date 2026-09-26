# Wordle motion & screen transitions — design

Date: 2026-09-25
App: `apps/activity` (Discord Activity client)

## Goal

Make Terminhos (Wordle) present itself well: one continuous motion story from
hub → loading → board, a staged entrance for tiles and keyboard, Wordle-style
gameplay feedback (letter pop, flip reveal, win bounce), and animated
transitions between the board and its settings. Screen transitions are shared
infrastructure so every game gets hub ↔ game motion; the rich animations are
Wordle-only.

## Current problems

Opening Wordle from the hub today shows four hard-cut states:

1. Router `Suspense` fallback (`ConnectingScreen`, common subtitle) while the
   lazy chunk loads (`app/router.tsx`).
2. `WordleGame`'s own `ConnectingScreen` while the WS session token and user
   config load (`games/wordle/WordleGame.tsx`).
3. `WordleBoard` with an empty card and a 50%-opacity disabled keyboard,
   because `wordLength` stays `null` until the Colyseus `init` message
   (`games/wordle/state/useWordleBoard.ts`).
4. Rows pop in. Guess tiles never flip; keyboard colors update instantly.

`wordLength` varies per day (server picks a length bucket), so a length-exact
skeleton before `init` is impossible — the loading screen must persist until
`init`, then transition once.

## Decisions

- **Mechanism: React 19.3 `<ViewTransition>`** (stable since 19.3.0, exports
  `ViewTransition` and `addTransitionType`). React drives
  `document.startViewTransition`; unsupported WebViews get an instant swap.
- View Transitions only fire for `startTransition` / `useDeferredValue` /
  Suspense reveals. Synchronous updates (typing, guess results) never trigger
  them. Screen boundaries opt in explicitly.
- `MemoryRouter` (react-router 7.18) already wraps navigations in
  `React.startTransition` (its `useTransitions` default), so no router change
  is needed. react-router's own `viewTransition` prop is data-router-only and
  is **not** used.
- In-board animations are CSS keyframes in `styles/global.css` under the
  existing `termo-*` prefix. No animation library.
- Reduced motion: the existing `.app-shell * { animation: none !important }`
  rule covers keyframes; a new rule disables view-transition pseudo-element
  animations; the flip-reveal JS timer uses duration 0.

## Global constraints

- `react`, `react-dom`, `@types/react`, `@types/react-dom` → `^19.3.0` in
  `apps/activity/package.json` (the only React workspace).
- New module lives in `apps/activity/src/shared/motion/` (foundation layer —
  importable from `games/*`, `features/*`, `app/`; enforced by
  `architecture.test.ts`).
- All CSS goes in `apps/activity/src/styles/global.css`.
- No code comments (repo owner rule).
- Game display name comes from `games:wordle.name` ("Terminhos"); no copy
  changes.

## Section 1 — Shared screen transitions

### `shared/motion/transitions.ts`

```ts
export type TransitionDirection = 'nav-forward' | 'nav-back';

export function transitionTo(
  direction: TransitionDirection,
  update: () => void,
): void;
// startTransition(() => { addTransitionType(direction); update(); })

export function useNavigateHome(): () => void;
// navigate('/') inside transitionTo('nav-back', …)

export function useNavigateForward(): (to: string) => void;
// navigate(to) inside transitionTo('nav-forward', …)
```

### CSS (global.css)

- Default (no type): 180ms crossfade on `root`.
- `nav-forward`: old root fades + drifts left 24px, new root fades in from
  right 24px. `nav-back`: mirrored. 240ms, `cubic-bezier(.2,.8,.2,1)`.
  Implemented with `:active-view-transition-type(nav-forward)` /
  `(nav-back)` selectors on `::view-transition-old(root)` /
  `::view-transition-new(root)`.
- Shared groups (`game-title`, `game-panel`): 280ms same easing, default
  morph.
- `@media (prefers-reduced-motion: reduce)`:
  `::view-transition-group(*), ::view-transition-old(*),
  ::view-transition-new(*) { animation: none !important; }`

### Shared-element names

| Name | Elements carrying it |
|---|---|
| `game-title` | `GameHeader` title text (hub brand ↔ game name) |
| `game-panel` | hub `FeaturedGame`'s `GamePreview`; `ConnectingScreen`'s `MenuPanel`; Wordle board card; `WordleSettingsScreen`'s `MenuPanel` |

Names are applied with `<ViewTransition name="…">` wrappers. `GameCard`
previews get no name (a name must be unique per snapshot). The hub features
only Wordle (`HUB_GAME_IDS = ['wordle']`), so `game-panel` on the featured
preview is unambiguous.

### Trigger points

| Transition | Trigger | Why it animates |
|---|---|---|
| Boot loading → hub / deep-linked game | `App.tsx` | `identity` ready → rendered in `startTransition` (see below) |
| Hub → game | `PlayGameLink` click → `useNavigateForward()` | transition + type |
| Chunk fallback → game | router `Suspense` | Suspense reveal |
| Wordle loading → board | `init` handler | `startTransition` (Section 2) |
| Game ↔ settings | settings button / back / save | `transitionTo` |
| Any game → hub | every `navigate('/')` in `games/**` and `features/rooms/**` | `useNavigateHome()` |

`App.tsx`: identity is produced by `useDiscordIdentity`; the switch from the
boot `ConnectingScreen` to `MemoryRouter` animates by deferring the rendered
phase with `useDeferredValue` on the computed phase
(`'loading' | 'error' | 'ready'`), which React treats as a transition.

`PlayGameLink` keeps rendering a `<Link>` (semantics, focus, a11y) and
intercepts `onClick` (`preventDefault` + `useNavigateForward()(to)`).

All ~40 `navigate('/')` call sites (list: `grep -rn "navigate('/')"
apps/activity/src --include=*.tsx`) are replaced by `useNavigateHome()`
mechanically; `useNavigate` imports that become unused are removed.

## Section 2 — Wordle screen states

`WordleBoard` derives one screen:

```ts
type WordleScreen = 'loading' | 'playing' | 'settings';
// wordLength === null → 'loading'; showSettings → 'settings'; else 'playing'
```

- `'loading'` renders `<ConnectingScreen subtitleKey="connectingSubtitle"
  subtitleNs="wordle" />` — identical to `WordleGame`'s pre-session screen, so
  the handoff is invisible (both carry `game-panel`).
- `init` handler: its state updates run inside `startTransition`, so the
  loading panel morphs into the board card. `guess_result` / `guess_error`
  stay synchronous.
- Settings toggles use `transitionTo('nav-forward' | 'nav-back', …)`.
  `WordleSettingsScreen` already calls `onBack` after a successful save, so
  Save and Back both slide back.
- `useWordleBoard`'s `enabled` stays `!showSettings`.
- **Connection failure before `init`**: if `connectionState` is `'error'` or
  `'disconnected'` while screen is `'loading'`, render `ErrorScreen` with
  `message = t('common:connectionLost')` and `onBack = useNavigateHome()`
  only (`onRetryAuth` is optional in `ErrorScreenProps`; `WordleBoard` gets
  no new props). After `init`, the existing inline banner is unchanged.

## Section 3 — In-board animations

All keyframes in `global.css`, registered as Tailwind `--animate-*` theme
tokens like the existing `termo-shake`.

### 3.1 Entrance

- Board root gets class `wordle-entering` on mount; removed after
  `ENTRANCE_MS = 600` via timer (cleared on unmount).
- Tiles (guess tiles and current-row inputs) under `.wordle-entering`:
  `termo-tile-in` (scale .6→1, opacity 0→1, 260ms), delay
  `calc(min(var(--i), 12) * 30ms)`; `--i` = flat tile index set inline.
- Keyboard rows under `.wordle-entering .termo-keyboard .hg-row:nth-child(n)`:
  `termo-kb-row-in` (translateY 12px→0, opacity 0→1, 280ms), delays
  150/210/270ms. Shared `Keyboard` component is not modified.
- Progress chip under `.wordle-entering`: fade-in, 200ms delay.
- `animation-fill-mode: both` so elements are hidden before their delay.

### 3.2 Letter pop

`CurrentRow` input gets `animate-termo-pop` (scale 1→1.12→1, 120ms) while
its letter is non-empty. The class is added on empty→filled, so overwriting a
letter does not re-pop (matches Wordle).

### 3.3 Flip reveal

- `Tile` gains `reveal?: { index: number }`. When set, it renders with CSS
  variables `--tile-bg`, `--tile-fg`, `--flip-delay: index * 250ms` and class
  `animate-termo-flip`: rotateX 0→90deg (unrevealed look: transparent bg,
  `border-marquinhos-border-hover`, text color default) → at 50% switch to
  `--tile-bg`/`--tile-fg`/transparent border → 90→0deg. 500ms, fill both.
- `GuessRow` gains `revealing?: boolean` and `celebrate?: boolean`, forwarded
  per tile.
- Constants in `games/wordle/constants.ts`:
  `FLIP_STAGGER_MS = 250`, `FLIP_DURATION_MS = 500`,
  `BOUNCE_STAGGER_MS = 80`, `ENTRANCE_MS = 600`.
- `useWordleBoard` state:
  - `revealedCount: number` — `init` sets `guesses.length` (reload never
    flips).
  - On `guess_result` where `guesses.length` grew: schedule one reveal timer
    of `revealDurationMs(wordLength)` =
    `(wordLength - 1) * FLIP_STAGGER_MS + FLIP_DURATION_MS`, or `0` under
    `prefers-reduced-motion: reduce`; on fire set
    `revealedCount = guesses.length`, and if `solved` set
    `celebrateRow = guesses.length - 1`.
  - Derived and returned: `revealingRow: number | null`
    (`guesses.length > revealedCount ? guesses.length - 1 : null`),
    `celebrateRow: number | null`.
  - `letterStates = buildLetterStates(guesses.slice(0, revealedCount), …)`.
  - `typeLetter`, `backspace`, `submitGuess` are no-ops while
    `revealingRow !== null`.
  - Only one reveal timer pending; cleared on `init` and unmount.

### 3.4 Win celebration

- Row at `celebrateRow`: tiles run `termo-bounce` (translateY 0→-14px→0,
  400ms), delay `index * BOUNCE_STAGGER_MS`.
- Solved banner renders when `solved && revealingRow === null`, with the
  existing `animate-termo-toast-in`.
- Reloading an already-solved game shows the banner, no bounce
  (`celebrateRow` stays `null` on `init`).

## Testing

bun:test + happy-dom (`jest.useFakeTimers` pattern from
`app/navigation/useDeepLinkIntent.test.tsx`). happy-dom has no
`startViewTransition`; React falls back to a plain commit, so behavior is
testable, visuals are not.

- `useWordleBoard`: reload with guesses → `revealingRow === null`, keyboard
  states present; `guess_result` → `revealingRow` set, letter states held
  back, input ignored; after `revealDurationMs` → unlocked, states updated;
  solved result → `celebrateRow`; reduced motion → reveal completes with a
  0ms timer.
- `WordleBoard`: loading screen until `init`; connection error before `init`
  → error screen with back; settings open/close still work.
- `shared/motion`: `useNavigateHome` / `useNavigateForward` change the
  `MemoryRouter` location.
- `PlayGameLink`: click navigates to `/games/<id>`.
- Existing suites (architecture, WordleBoard focus keyboard, settings screen)
  stay green.
- Manual: run the activity in Chrome, DevTools Animations panel at 10% speed:
  hub → Wordle morph, loading → board morph + entrance, typing pop, flip,
  win bounce, settings slide both ways, back to hub slide; toggle
  `prefers-reduced-motion` emulation and confirm instant swaps.

## Out of scope

- Rich entrance animations for games other than Wordle.
- Wordle Race (`games/wordle-race`) animations.
- Keycap color transitions (gradient vars don't interpolate without
  `@property`).
