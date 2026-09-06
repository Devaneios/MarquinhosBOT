import { describe, expect, it } from 'bun:test';
import type { GameDefinition } from 'services/activity/cards/core/GameDefinition';
import { GameDefinitionRegistry } from 'services/activity/cards/core/GameDefinitionRegistry';

function stubDefinition(id: string): GameDefinition<unknown> {
  return {
    id,
    minPlayers: 2,
    maxPlayers: 2,
    setup: () => ({}),
    moves: {},
    legalMoves: () => [],
    isRoundOver: () => false,
    isMatchOver: () => false,
    scoreboard: () => [],
    maskStateFor: () => ({}),
  };
}

describe('GameDefinitionRegistry', () => {
  it('registers and retrieves a definition by id', () => {
    const registry = new GameDefinitionRegistry();
    const def = stubDefinition('war');
    registry.register(def);
    expect(registry.get('war')).toBe(def);
  });

  it('returns undefined for an unknown ruleset id', () => {
    const registry = new GameDefinitionRegistry();
    expect(registry.get('nope')).toBeUndefined();
  });

  it('lists all registered ids', () => {
    const registry = new GameDefinitionRegistry();
    registry.register(stubDefinition('war'));
    registry.register(stubDefinition('truco'));
    expect(registry.list().sort()).toEqual(['truco', 'war']);
  });

  it('rejects registering a duplicate id', () => {
    const registry = new GameDefinitionRegistry();
    registry.register(stubDefinition('war'));
    expect(() => registry.register(stubDefinition('war'))).toThrow();
  });

  it('isKnownRuleset reflects whether an id is registered', () => {
    const registry = new GameDefinitionRegistry();
    registry.register(stubDefinition('war'));
    expect(registry.isKnownRuleset('war')).toBe(true);
    expect(registry.isKnownRuleset('missing')).toBe(false);
  });
});
