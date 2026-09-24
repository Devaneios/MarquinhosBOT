import {
  rpsPickSchema,
  type RpsPick,
} from '@marquinhos/contracts/activity/games/rockPaperScissors';
import { beats } from '@marquinhos/domain/games/rock-paper-scissors/rules';

export function determineRoundWinners(
  playerChoices: Record<string, RpsPick>,
): string[] {
  const choiceGroups: Record<RpsPick, string[]> = {
    rock: [],
    paper: [],
    scissors: [],
  };

  Object.entries(playerChoices).forEach(([userId, choice]) => {
    choiceGroups[choice].push(userId);
  });

  const nonEmptyChoices = rpsPickSchema.options
    .map((choice) => [choice, choiceGroups[choice]] as const)
    .filter(([, players]) => players.length > 0);

  if (nonEmptyChoices.length === 1 || nonEmptyChoices.length === 3) {
    return [];
  }

  if (nonEmptyChoices.length === 2) {
    const [choice1, players1] = nonEmptyChoices[0];
    const [choice2, players2] = nonEmptyChoices[1];

    return beats(choice1, choice2) ? players1 : players2;
  }

  return [];
}
