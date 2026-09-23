import { GameDefinitionRegistry } from '@marquinhos/domain/activity/cards/core/GameDefinitionRegistry';
import {
  truco1v1Definition,
  trucoDefinition,
} from '@marquinhos/domain/activity/cards/rulesets/truco/TrucoDefinition';

// The single populated registry: wsSessionToken.ts's ruleset validation and
// cardTableAdapter's setup both read from this same instance. Adding a new
// card game means a new ruleset file plus one more `.register(...)` call
// here — nothing else in the stack changes.
export const cardGameRegistry = new GameDefinitionRegistry();
cardGameRegistry.register(trucoDefinition);
cardGameRegistry.register(truco1v1Definition);
