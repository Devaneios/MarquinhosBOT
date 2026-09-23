export type RpsChoice = 'rock' | 'paper' | 'scissors';

const choices: Record<RpsChoice, RpsChoice> = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper',
};

export function determineRoundWinners(
  playerChoices: Record<string, RpsChoice>,
): string[] {
  const choiceGroups: Record<RpsChoice, string[]> = {
    rock: [],
    paper: [],
    scissors: [],
  };

  Object.entries(playerChoices).forEach(([userId, choice]) => {
    choiceGroups[choice].push(userId);
  });

  const nonEmptyChoices = (['rock', 'paper', 'scissors'] as const)
    .map((choice) => [choice, choiceGroups[choice]] as const)
    .filter(([, players]) => players.length > 0);

  if (nonEmptyChoices.length === 1 || nonEmptyChoices.length === 3) {
    return [];
  }

  if (nonEmptyChoices.length === 2) {
    const [choice1, players1] = nonEmptyChoices[0];
    const [choice2, players2] = nonEmptyChoices[1];

    return choices[choice1] === choice2 ? players1 : players2;
  }

  return [];
}
