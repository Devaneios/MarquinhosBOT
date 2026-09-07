import { db } from 'database/sqlite';

type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythical';
type StatKey =
  'total_scrobbles' | 'total_commands' | 'total_voice_joins' | 'games_won';

interface TierDef {
  tier: number;
  name: string;
  rarity: Rarity;
  icon: string;
}

interface BaseDef {
  name: string;
  description: string;
  statKey: StatKey;
  // threshold[tier] = stat value needed to evolve FROM that tier to the next
  thresholds: Record<number, number>;
  evolutionPath: TierDef[];
  reasons: string[];
}

const BASE_ACHIEVEMENTS: Record<string, BaseDef> = {
  'musical-explorer': {
    name: 'Explorador Musical',
    description: 'Descubra o universo musical através de suas músicas',
    statKey: 'total_scrobbles',
    thresholds: { 1: 10, 2: 50, 3: 200, 4: 500 },
    evolutionPath: [
      { tier: 1, name: 'Primeiro Ouvinte', rarity: 'common', icon: '🎵' },
      { tier: 2, name: 'Descobridor Curioso', rarity: 'rare', icon: '🎶' },
      { tier: 3, name: 'Curador de Raridades', rarity: 'epic', icon: '🎼' },
      {
        tier: 4,
        name: 'Descobridor de Talentos',
        rarity: 'legendary',
        icon: '🎹',
      },
      { tier: 5, name: 'Visionário Musical', rarity: 'mythical', icon: '🌟' },
    ],
    reasons: [
      'Explorou novos horizontes musicais',
      'Expandiu seu repertório musical',
      'Mergulhou fundo no universo musical',
      'Alcançou maestria musical',
    ],
  },
  'social-connector': {
    name: 'Conector Social',
    description: 'Una pessoas através da música e da comunidade',
    statKey: 'total_commands',
    thresholds: { 1: 10, 2: 50, 3: 200, 4: 500 },
    evolutionPath: [
      { tier: 1, name: 'Novo Amigo', rarity: 'common', icon: '🤝' },
      { tier: 2, name: 'Facilitador', rarity: 'rare', icon: '👥' },
      { tier: 3, name: 'Influenciador Musical', rarity: 'epic', icon: '🌐' },
      { tier: 4, name: 'Ponte entre Mundos', rarity: 'legendary', icon: '🌍' },
      { tier: 5, name: 'Unificador Universal', rarity: 'mythical', icon: '💫' },
    ],
    reasons: [
      'Engajou a comunidade ativamente',
      'Conectou pessoas com seus comandos',
      'Tornou-se um pilar da comunidade',
      'Alcançou influência universal',
    ],
  },
  'rhythm-master': {
    name: 'Mestre do Ritmo',
    description: 'Domine diferentes estilos rítmicos nos jogos',
    statKey: 'games_won',
    thresholds: { 1: 1, 2: 5, 3: 20, 4: 50 },
    evolutionPath: [
      { tier: 1, name: 'Batida Básica', rarity: 'common', icon: '🥁' },
      { tier: 2, name: 'Groove Intermediário', rarity: 'rare', icon: '🎺' },
      { tier: 3, name: 'Ritmo Avançado', rarity: 'epic', icon: '🎸' },
      { tier: 4, name: 'Metrônomo Humano', rarity: 'legendary', icon: '🎻' },
      { tier: 5, name: 'Senhor do Tempo', rarity: 'mythical', icon: '🎭' },
    ],
    reasons: [
      'Venceu batalhas rítmicas',
      'Dominou os jogos do servidor',
      'Alcançou maestria nos jogos',
      'Transcendeu os limites do ritmo',
    ],
  },
  'season-listener': {
    name: 'Ouvinte Sazonal',
    description:
      'Adapte sua música às estações participando da comunidade de voz',
    statKey: 'total_voice_joins',
    thresholds: { 1: 5, 2: 20, 3: 50, 4: 100 },
    evolutionPath: [
      { tier: 1, name: 'Ouvinte de Verão', rarity: 'common', icon: '🌱' },
      { tier: 2, name: 'Guardião do Outono', rarity: 'rare', icon: '🌸' },
      { tier: 3, name: 'Espírito do Inverno', rarity: 'epic', icon: '☀️' },
      {
        tier: 4,
        name: 'Florescer da Primavera',
        rarity: 'legendary',
        icon: '🍂',
      },
      { tier: 5, name: 'Senhor das Estações', rarity: 'mythical', icon: '❄️' },
    ],
    reasons: [
      'Frequentou canais de voz consistentemente',
      'Acompanhou todas as estações no voice',
      'Passou incontáveis horas em comunidade',
      'Tornou-se eterno no voice',
    ],
  },
};

interface EvolutiveRow {
  user_id: string;
  guild_id: string;
  base_id: string;
  current_tier: number;
  unlocked_at: number;
  last_evolved: number | null;
  evolution_log: string;
}

interface UserStatsRow {
  total_commands: number;
  total_scrobbles: number;
  total_voice_joins: number;
  total_games: number;
  games_won: number;
}

export interface EvolutionEvent {
  tier: number;
  evolvedAt: string;
  reason: string;
}

export interface EvolutiveAchievement {
  baseId: string;
  name: string;
  currentTier: number;
  currentTierName: string;
  icon: string;
  rarity: string;
  description: string;
  unlockedAt: Date;
  lastEvolved: Date | null;
  evolutionLog: EvolutionEvent[];
  nextTierThreshold: number | null;
  currentStatValue: number;
}

export interface EvolutionResult {
  baseId: string;
  newTier: number;
  newTierName: string;
  icon: string;
}

export class EvolutiveAchievementsService {
  checkAndEvolveAll(userId: string, guildId: string): EvolutionResult[] {
    const stats = db
      .query<UserStatsRow, { $userId: string; $guildId: string }>(
        'SELECT total_commands, total_scrobbles, total_voice_joins, total_games, games_won FROM user_stats WHERE user_id = $userId AND guild_id = $guildId',
      )
      .get({ $userId: userId, $guildId: guildId });

    if (!stats) return [];

    const evolutions: EvolutionResult[] = [];

    for (const [baseId, def] of Object.entries(BASE_ACHIEVEMENTS)) {
      const statValue = stats[def.statKey];

      let row = db
        .query<
          EvolutiveRow,
          { $userId: string; $guildId: string; $baseId: string }
        >(
          'SELECT * FROM evolutive_achievements WHERE user_id = $userId AND guild_id = $guildId AND base_id = $baseId',
        )
        .get({ $userId: userId, $guildId: guildId, $baseId: baseId });

      // Auto-initialize at tier 1 when the user first qualifies
      if (!row && statValue >= 1) {
        const now = Date.now();
        const initialLog: EvolutionEvent[] = [
          {
            tier: 1,
            evolvedAt: new Date(now).toISOString(),
            reason: 'Primeiro passo desbloqueado!',
          },
        ];
        db.query(
          'INSERT INTO evolutive_achievements (user_id, guild_id, base_id, current_tier, unlocked_at, last_evolved, evolution_log) VALUES ($userId, $guildId, $baseId, 1, $now, NULL, $log)',
        ).run({
          $userId: userId,
          $guildId: guildId,
          $baseId: baseId,
          $now: now,
          $log: JSON.stringify(initialLog),
        });

        row = db
          .query<
            EvolutiveRow,
            { $userId: string; $guildId: string; $baseId: string }
          >(
            'SELECT * FROM evolutive_achievements WHERE user_id = $userId AND guild_id = $guildId AND base_id = $baseId',
          )
          .get({ $userId: userId, $guildId: guildId, $baseId: baseId });
      }

      if (!row || row.current_tier >= 5) continue;

      const threshold = def.thresholds[row.current_tier];
      if (threshold === undefined || statValue < threshold) continue;

      // Evolve to next tier
      const nextTierDef = def.evolutionPath[row.current_tier]; // index = current_tier (0-based), which is next tier
      if (!nextTierDef) continue;
      const log: EvolutionEvent[] = JSON.parse(row.evolution_log);
      const now = Date.now();
      log.push({
        tier: nextTierDef.tier,
        evolvedAt: new Date(now).toISOString(),
        reason:
          def.reasons[Math.min(nextTierDef.tier - 2, def.reasons.length - 1)] ??
          '',
      });

      db.query(
        'UPDATE evolutive_achievements SET current_tier = $tier, last_evolved = $now, evolution_log = $log WHERE user_id = $userId AND guild_id = $guildId AND base_id = $baseId',
      ).run({
        $tier: nextTierDef.tier,
        $now: now,
        $log: JSON.stringify(log),
        $userId: userId,
        $guildId: guildId,
        $baseId: baseId,
      });

      evolutions.push({
        baseId,
        newTier: nextTierDef.tier,
        newTierName: nextTierDef.name,
        icon: nextTierDef.icon,
      });
    }

    return evolutions;
  }

  getUserEvolutiveAchievements(
    userId: string,
    guildId: string,
  ): EvolutiveAchievement[] {
    const rows = db
      .query<EvolutiveRow, { $userId: string; $guildId: string }>(
        'SELECT * FROM evolutive_achievements WHERE user_id = $userId AND guild_id = $guildId',
      )
      .all({ $userId: userId, $guildId: guildId });

    const stats = db
      .query<UserStatsRow, { $userId: string; $guildId: string }>(
        'SELECT total_commands, total_scrobbles, total_voice_joins, total_games, games_won FROM user_stats WHERE user_id = $userId AND guild_id = $guildId',
      )
      .get({ $userId: userId, $guildId: guildId });

    return rows.flatMap((row: EvolutiveRow) => {
      const def = BASE_ACHIEVEMENTS[row.base_id];
      const tierDef = def?.evolutionPath[row.current_tier - 1];
      if (!def || !tierDef) return [];
      const nextThreshold =
        row.current_tier < 5
          ? (def.thresholds[row.current_tier] ?? null)
          : null;

      return [
        {
          baseId: row.base_id,
          name: def.name,
          currentTier: row.current_tier,
          currentTierName: tierDef.name,
          icon: tierDef.icon,
          rarity: tierDef.rarity,
          description: def.description,
          unlockedAt: new Date(row.unlocked_at),
          lastEvolved: row.last_evolved ? new Date(row.last_evolved) : null,
          evolutionLog: JSON.parse(row.evolution_log) as EvolutionEvent[],
          nextTierThreshold: nextThreshold,
          currentStatValue: stats ? stats[def.statKey] : 0,
        },
      ];
    });
  }

  getEvolutionTimeline(
    userId: string,
    guildId: string,
  ): { baseId: string; name: string; events: EvolutionEvent[] }[] {
    const rows = db
      .query<EvolutiveRow, { $userId: string; $guildId: string }>(
        'SELECT * FROM evolutive_achievements WHERE user_id = $userId AND guild_id = $guildId ORDER BY unlocked_at ASC',
      )
      .all({ $userId: userId, $guildId: guildId });

    return rows.map((row: EvolutiveRow) => ({
      baseId: row.base_id,
      name: BASE_ACHIEVEMENTS[row.base_id]?.name ?? row.base_id,
      events: JSON.parse(row.evolution_log) as EvolutionEvent[],
    }));
  }
}
