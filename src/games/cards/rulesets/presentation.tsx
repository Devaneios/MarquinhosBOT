import type { ReactNode } from 'react';
import { HUDStat } from '../components/HUDStat';
import type { TableView, TrucoView } from '../core/types';

// A minimal stand-in for react-i18next's TFunction: presentation.tsx is not a
// component (its hud/statusLine closures get called from inside CardTable's
// render, not as hooks themselves), so it takes whatever `t` its caller
// already resolved via useTranslation() rather than calling the hook itself.
export type Translate = (
  key: string,
  options?: Record<string, unknown>,
) => string;

// Everything about a card game that is *presentation* rather than rules: what to
// call its moves, what to put in the HUD, how to label its seats.
//
// This is what makes "a new card game is a new GameDefinition on the server, not
// a new client screen" true. Without it, the generic table had truco's
// Portuguese move labels and Team A/Team B score HUD hardcoded into it, so a
// second ruleset would have rendered a truco HUD over its own state.
//
// Every field is optional and falls back to something sensible, so a ruleset
// with no entry here still plays — it just shows raw move ids.
export interface RulesetPresentation {
  title: string;
  // move id → button label.
  moveLabels?: Record<string, string>;
  // Seat position labels, indexed by seatIndex.
  seatLabels?: string[];
  // Ruleset-specific HUD. The cast to the ruleset's own view type happens here
  // and nowhere else, which is the point of keeping it in one module per game.
  hud?: (view: TableView) => ReactNode;
  // Ruleset-specific status line while a decision is pending.
  statusLine?: (view: TableView) => string | null;
}

// Ruleset id → the cards.json key holding its (unresolved) title. Exposed so
// screens that only need the key — not the fully resolved string — such as
// ConnectingScreen's subtitleKey prop, can look it up themselves.
const TITLE_KEYS: Record<string, string> = {
  truco: 'trucoTitle',
  'truco-1v1': 'truco1v1Title',
};

export function titleKeyFor(ruleset: string): string {
  return TITLE_KEYS[ruleset] ?? 'genericTitle';
}

// Shared by every Truco variant: the move ladder, HUD and status line read
// off TrucoView regardless of seat count, so only the title and seat labels
// actually differ between the 4-player (dupla) and 2-player (1v1) tables.
function trucoPresentation(
  t: Translate,
  titleKey: string,
  seatLabels: string[],
): RulesetPresentation {
  return {
    title: t(`cards:${titleKey}`),
    moveLabels: {
      call_truco: t('cards:moveCallTruco'),
      accept: t('cards:moveAccept'),
      raise: t('cards:moveRaise'),
      fold: t('cards:moveFold'),
    },
    seatLabels,
    hud: (view) => {
      const truco = view as TrucoView;
      return (
        <>
          <HUDStat
            label={t('cards:teamA')}
            value={String(truco.matchScore?.A ?? 0)}
          />
          <HUDStat
            label={t('cards:teamB')}
            value={String(truco.matchScore?.B ?? 0)}
          />
          <HUDStat
            label={t('cards:handValue')}
            value={String(truco.currentStake ?? 1)}
          />
          {truco.vira?.rank && (
            <HUDStat
              label={t('cards:viraLabel')}
              value={t('cards:viraValue', {
                rank: truco.vira.rank,
                suit: truco.vira.suit ? ` ${truco.vira.suit}` : '',
              })}
            />
          )}
        </>
      );
    },
    statusLine: (view) => {
      const truco = view as TrucoView;
      if (
        truco.pendingCallLevel === null ||
        truco.pendingCallLevel === undefined
      ) {
        return null;
      }
      const caller = truco.callingTeam
        ? t(`cards:team${truco.callingTeam}`)
        : t('cards:theOtherTeam');
      return t('cards:pendingCall', {
        caller,
        level: truco.pendingCallLevel,
      });
    },
  };
}

export function presentationFor(
  ruleset: string,
  t: Translate,
): RulesetPresentation {
  if (ruleset === 'truco') {
    return trucoPresentation(t, TITLE_KEYS.truco, [
      t('common:you'),
      t('cards:seatLeft'),
      t('cards:seatPartner'),
      t('cards:seatRight'),
    ]);
  }
  if (ruleset === 'truco-1v1') {
    return trucoPresentation(t, TITLE_KEYS['truco-1v1'], [
      t('common:you'),
      t('cards:seatOpponent'),
    ]);
  }
  return { title: t('cards:genericTitle') };
}

export function isKnownRuleset(ruleset: string): boolean {
  return ruleset in TITLE_KEYS;
}

export function moveLabel(
  presentation: RulesetPresentation,
  move: string,
): string {
  // Falls back to the raw move id, so a ruleset with no labels still renders a
  // usable button rather than an empty one.
  return presentation.moveLabels?.[move] ?? move;
}

export function seatLabel(
  presentation: RulesetPresentation,
  seatIndex: number,
  t: Translate,
): string {
  return (
    presentation.seatLabels?.[seatIndex] ??
    t('cards:seatFallback', { n: seatIndex + 1 })
  );
}
