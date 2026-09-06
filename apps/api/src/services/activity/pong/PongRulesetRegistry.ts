import type {
  PongMatchConfig,
  PongRulesetDefinition,
  PongRulesetId,
} from 'services/activity/pong/PongTypes';

const baseConfig = (ruleset: PongRulesetId): PongMatchConfig => ({
  ruleset,
  targetScore: 11,
  bestOf: 1,
  ranked: false,
  lives: 5,
  maxBalls: ruleset === 'multiball' ? 3 : 1,
  powerUps:
    ruleset === 'powerup-battle'
      ? [
          'grow',
          'shrink',
          'speed-boost',
          'slow',
          'sticky',
          'extra-paddle',
          'reverse-controls',
          'shield',
          'extra-life',
        ]
      : [],
  disconnectReplacement: 'wall',
  seed: 1,
});

const definitions: PongRulesetDefinition[] = (
  [
    ['classic-1v1', 'rectangular', 2, 2, 'classic-1v1', true],
    ['doubles-2v2', 'rectangular', 4, 4, null, true],
    ['quad-elimination', 'square', 3, 4, 'quad-elimination', true],
    ['superpong', 'rectangular', 2, 2, null, true],
    ['rebound', 'volleyball', 2, 2, null, true],
    ['breakout', 'breakout', 1, 1, null, false],
    ['brick-battle', 'rectangular', 2, 2, null, true],
    ['multiball', 'rectangular', 2, 2, null, true],
    ['powerup-battle', 'rectangular', 2, 2, null, true],
    ['radial-solo', 'circular', 1, 1, null, false],
    ['radial-duel', 'circular', 2, 2, null, true],
    ['pong-tennis', 'rectangular', 2, 2, null, true],
    ['air-hockey', 'air-hockey', 2, 4, null, true],
    ['coop-keep-alive', 'square', 1, 4, null, false],
  ] satisfies readonly [
    PongRulesetId,
    PongRulesetDefinition['arena'],
    number,
    number,
    PongRulesetDefinition['rankedPool'],
    boolean,
  ][]
).map(([id, arena, minPlayers, maxPlayers, rankedPool, supportsBot]) => ({
  id,
  arena,
  minPlayers,
  maxPlayers,
  rankedPool,
  supportsBot,
  defaultConfig: baseConfig(id),
}));

const byId = new Map(
  definitions.map((definition) => [definition.id, definition]),
);

export const PONG_RULESETS = definitions as readonly PongRulesetDefinition[];

export function isPongRulesetId(value: unknown): value is PongRulesetId {
  return typeof value === 'string' && byId.has(value as PongRulesetId);
}

export function getPongRuleset(id: PongRulesetId): PongRulesetDefinition {
  return byId.get(id)!;
}

export function normalizePongMatchConfig(
  input: Partial<PongMatchConfig> & { ruleset: PongRulesetId },
): PongMatchConfig {
  const definition = getPongRuleset(input.ruleset);
  const next = { ...definition.defaultConfig, ...input };
  if (
    !Number.isInteger(next.targetScore) ||
    next.targetScore < 1 ||
    next.targetScore > 99
  ) {
    throw new Error('Invalid Pong target score');
  }
  if (![1, 3, 5].includes(next.bestOf)) {
    throw new Error('Invalid Pong best-of value');
  }
  if (next.ranked && definition.rankedPool === null) {
    throw new Error('Ruleset does not support ranked play');
  }
  if (next.ranked && next.powerUps.length > 0) {
    throw new Error('Ranked Pong cannot enable power-ups');
  }
  return next;
}
