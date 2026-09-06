import type { GameDefinition } from 'services/activity/cards/core/GameDefinition';

// Map<rulesetId, GameDefinition> populated at module load from each
// concrete ruleset file. This is the single place a new game gets
// "plugged in" — wsSessionToken.ts's ruleset validation and
// CardTableRoom's onCreate both read from the same table.
export class GameDefinitionRegistry {
  private definitions = new Map<string, GameDefinition<unknown>>();

  register(definition: GameDefinition<unknown>): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(
        `A GameDefinition with id "${definition.id}" is already registered`,
      );
    }
    this.definitions.set(definition.id, definition);
  }

  get(id: string): GameDefinition<unknown> | undefined {
    return this.definitions.get(id);
  }

  list(): string[] {
    return [...this.definitions.keys()];
  }

  isKnownRuleset(id: string): boolean {
    return this.definitions.has(id);
  }
}
