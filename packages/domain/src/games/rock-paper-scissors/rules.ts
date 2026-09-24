import type { RpsPick } from '@marquinhos/contracts/activity/games/rockPaperScissors';

const BEATS: Record<RpsPick, RpsPick> = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper',
};

export function beats(pick: RpsPick, other: RpsPick): boolean {
  return BEATS[pick] === other;
}
