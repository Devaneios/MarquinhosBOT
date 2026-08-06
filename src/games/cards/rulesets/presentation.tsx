import type { ReactNode } from 'react';
import { HUDStat } from '../components/HUDStat';
import type { TableView, TrucoView } from '../core/types';

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

const TRUCO_TEAM_LABEL: Record<string, string> = { A: 'Time A', B: 'Time B' };

// Shared by every Truco variant: the move ladder, HUD and status line read
// off TrucoView regardless of seat count, so only the title and seat labels
// actually differ between the 4-player (dupla) and 2-player (1v1) tables.
function trucoPresentation(
  title: string,
  seatLabels: string[],
): RulesetPresentation {
  return {
    title,
    moveLabels: {
      call_truco: 'Pedir truco',
      accept: 'Aceitar',
      raise: 'Aumentar',
      fold: 'Correr',
    },
    seatLabels,
    hud: (view) => {
      const truco = view as TrucoView;
      return (
        <>
          <HUDStat label="Time A" value={String(truco.matchScore?.A ?? 0)} />
          <HUDStat label="Time B" value={String(truco.matchScore?.B ?? 0)} />
          <HUDStat
            label="Valor da mão"
            value={String(truco.currentStake ?? 1)}
          />
          {truco.vira?.rank && (
            <HUDStat
              label="Vira"
              value={`${truco.vira.rank}${truco.vira.suit ? ` ${truco.vira.suit}` : ''}`}
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
        ? (TRUCO_TEAM_LABEL[truco.callingTeam] ?? truco.callingTeam)
        : 'A outra equipe';
      return `${caller} pediu ${truco.pendingCallLevel}. Aceitar, aumentar ou correr?`;
    },
  };
}

const truco = trucoPresentation('TRUCO', [
  'Você',
  'Esquerda',
  'Parceiro',
  'Direita',
]);
const truco1v1 = trucoPresentation('TRUCO 1X1', ['Você', 'Adversário']);

const PRESENTATIONS: Record<string, RulesetPresentation> = {
  truco,
  'truco-1v1': truco1v1,
};

const GENERIC: RulesetPresentation = { title: 'CARD TABLE' };

export function presentationFor(ruleset: string): RulesetPresentation {
  return PRESENTATIONS[ruleset] ?? GENERIC;
}

export function isKnownRuleset(ruleset: string): boolean {
  return ruleset in PRESENTATIONS;
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
): string {
  return presentation.seatLabels?.[seatIndex] ?? `Lugar ${seatIndex + 1}`;
}
