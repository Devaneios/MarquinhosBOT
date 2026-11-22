import {
  evolutionEventSchema,
  type EvolutionEvent,
  type evolutionResultSchema,
  type evolutiveAchievementSchema,
} from '@marquinhos/contracts/http/routes/evolutiveAchievements';
import type { Db } from '@marquinhos/database/client';
import { evolutiveAchievements, userStats } from '@marquinhos/database/schema';
import { Inject, Injectable } from '@nestjs/common';
import { DB } from 'database/database.tokens';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';

type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythical';
type StatKey =
  'total_scrobbles' | 'total_commands' | 'total_voice_joins' | 'games_won';

interface StageDef {
  name: string;
  rarity: Rarity;
  icon: string;
}

interface BaseDef {
  name: string;
  description: string;
  statKey: StatKey;
  // threshold[rarity] = stat value needed to evolve FROM that rarity to the next
  thresholds: Partial<Record<Rarity, number>>;
  evolutionPath: StageDef[];
  reasons: string[];
}

const BASE_ACHIEVEMENTS: Record<string, BaseDef> = {
  'musical-explorer': {
    name: 'Explorador Musical',
    description: 'Descubra o universo musical através de suas músicas',
    statKey: 'total_scrobbles',
    thresholds: { common: 10, rare: 50, epic: 200, legendary: 500 },
    evolutionPath: [
      { name: 'Primeiro Ouvinte', rarity: 'common', icon: '🎵' },
      { name: 'Descobridor Curioso', rarity: 'rare', icon: '🎶' },
      { name: 'Curador de Raridades', rarity: 'epic', icon: '🎼' },
      {
        name: 'Descobridor de Talentos',
        rarity: 'legendary',
        icon: '🎹',
      },
      { name: 'Visionário Musical', rarity: 'mythical', icon: '🌟' },
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
    thresholds: { common: 10, rare: 50, epic: 200, legendary: 500 },
    evolutionPath: [
      { name: 'Novo Amigo', rarity: 'common', icon: '🤝' },
      { name: 'Facilitador', rarity: 'rare', icon: '👥' },
      { name: 'Influenciador Musical', rarity: 'epic', icon: '🌐' },
      { name: 'Ponte entre Mundos', rarity: 'legendary', icon: '🌍' },
      { name: 'Unificador Universal', rarity: 'mythical', icon: '💫' },
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
    thresholds: { common: 1, rare: 5, epic: 20, legendary: 50 },
    evolutionPath: [
      { name: 'Batida Básica', rarity: 'common', icon: '🥁' },
      { name: 'Groove Intermediário', rarity: 'rare', icon: '🎺' },
      { name: 'Ritmo Avançado', rarity: 'epic', icon: '🎸' },
      { name: 'Metrônomo Humano', rarity: 'legendary', icon: '🎻' },
      { name: 'Senhor do Tempo', rarity: 'mythical', icon: '🎭' },
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
    thresholds: { common: 5, rare: 20, epic: 50, legendary: 100 },
    evolutionPath: [
      { name: 'Ouvinte de Verão', rarity: 'common', icon: '🌱' },
      { name: 'Guardião do Outono', rarity: 'rare', icon: '🌸' },
      { name: 'Espírito do Inverno', rarity: 'epic', icon: '☀️' },
      {
        name: 'Florescer da Primavera',
        rarity: 'legendary',
        icon: '🍂',
      },
      { name: 'Senhor das Estações', rarity: 'mythical', icon: '❄️' },
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
  current_rarity: Rarity;
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

const evolutionLogSchema = z.array(evolutionEventSchema);

type EvolutiveAchievement = z.input<typeof evolutiveAchievementSchema>;
type EvolutionResult = z.input<typeof evolutionResultSchema>;

const byUser = (userId: string, guildId: string) =>
  and(
    eq(evolutiveAchievements.user_id, userId),
    eq(evolutiveAchievements.guild_id, guildId),
  );

async function getStats(
  database: Db,
  userId: string,
  guildId: string,
): Promise<UserStatsRow | undefined> {
  const [row] = await database
    .select({
      total_commands: userStats.total_commands,
      total_scrobbles: userStats.total_scrobbles,
      total_voice_joins: userStats.total_voice_joins,
      total_games: userStats.total_games,
      games_won: userStats.games_won,
    })
    .from(userStats)
    .where(and(eq(userStats.user_id, userId), eq(userStats.guild_id, guildId)));
  return row;
}

async function getRow(
  database: Db,
  userId: string,
  guildId: string,
  baseId: string,
): Promise<EvolutiveRow | undefined> {
  const [row] = await database
    .select()
    .from(evolutiveAchievements)
    .where(
      and(byUser(userId, guildId), eq(evolutiveAchievements.base_id, baseId)),
    );
  return row;
}

@Injectable()
export class EvolutiveAchievementsService {
  constructor(@Inject(DB) private readonly database: Db) {}

  async checkAndEvolveAll(
    userId: string,
    guildId: string,
  ): Promise<EvolutionResult[]> {
    const stats = await getStats(this.database, userId, guildId);

    if (!stats) return [];

    const evolutions: EvolutionResult[] = [];

    for (const [baseId, def] of Object.entries(BASE_ACHIEVEMENTS)) {
      const statValue = stats[def.statKey];

      let row = await getRow(this.database, userId, guildId, baseId);

      // Auto-initialize at common rarity when the user first qualifies
      if (!row && statValue >= 1) {
        const now = Date.now();
        const initialLog: EvolutionEvent[] = [
          {
            rarity: 'common',
            evolvedAt: new Date(now).toISOString(),
            reason: 'Primeiro passo desbloqueado!',
          },
        ];
        await this.database
          .insert(evolutiveAchievements)
          .values({
            user_id: userId,
            guild_id: guildId,
            base_id: baseId,
            current_rarity: 'common',
            unlocked_at: now,
            last_evolved: null,
            evolution_log: JSON.stringify(initialLog),
          })
          .onConflictDoNothing();

        row = await getRow(this.database, userId, guildId, baseId);
        if (def.thresholds.common !== undefined && def.thresholds.common <= 1) {
          continue;
        }
      }

      if (!row) continue;
      const currentIndex = def.evolutionPath.findIndex(
        (stage) => stage.rarity === row.current_rarity,
      );
      if (currentIndex < 0 || currentIndex >= def.evolutionPath.length - 1)
        continue;

      const threshold = def.thresholds[row.current_rarity];
      if (threshold === undefined || statValue < threshold) continue;

      const nextStage = def.evolutionPath[currentIndex + 1];
      if (!nextStage) continue;
      const log = evolutionLogSchema.parse(JSON.parse(row.evolution_log));
      const now = Date.now();
      log.push({
        rarity: nextStage.rarity,
        evolvedAt: new Date(now).toISOString(),
        reason:
          def.reasons[Math.min(currentIndex, def.reasons.length - 1)] ?? '',
      });

      const evolved = await this.database
        .update(evolutiveAchievements)
        .set({
          current_rarity: nextStage.rarity,
          last_evolved: now,
          evolution_log: JSON.stringify(log),
        })
        .where(
          and(
            byUser(userId, guildId),
            eq(evolutiveAchievements.base_id, baseId),
            eq(evolutiveAchievements.current_rarity, row.current_rarity),
          ),
        )
        .returning({ rarity: evolutiveAchievements.current_rarity });
      if (evolved.length === 0) continue;

      evolutions.push({
        baseId,
        newRarity: nextStage.rarity,
        newName: nextStage.name,
        icon: nextStage.icon,
      });
    }

    return evolutions;
  }

  async getUserEvolutiveAchievements(
    userId: string,
    guildId: string,
  ): Promise<EvolutiveAchievement[]> {
    const rows = await this.database
      .select()
      .from(evolutiveAchievements)
      .where(byUser(userId, guildId));

    const stats = await getStats(this.database, userId, guildId);

    return rows.flatMap((row: EvolutiveRow) => {
      const def = BASE_ACHIEVEMENTS[row.base_id];
      const stage = def?.evolutionPath.find(
        (item) => item.rarity === row.current_rarity,
      );
      if (!def || !stage) return [];
      const stageIndex = def.evolutionPath.indexOf(stage);
      const nextThreshold =
        stageIndex < def.evolutionPath.length - 1
          ? (def.thresholds[row.current_rarity] ?? null)
          : null;

      return [
        {
          baseId: row.base_id,
          name: def.name,
          currentName: stage.name,
          icon: stage.icon,
          rarity: stage.rarity,
          description: def.description,
          unlockedAt: new Date(row.unlocked_at),
          lastEvolved: row.last_evolved ? new Date(row.last_evolved) : null,
          evolutionLog: evolutionLogSchema.parse(JSON.parse(row.evolution_log)),
          nextThreshold,
          currentStatValue: stats ? stats[def.statKey] : 0,
        },
      ];
    });
  }

  async getEvolutionTimeline(
    userId: string,
    guildId: string,
  ): Promise<{ baseId: string; name: string; events: EvolutionEvent[] }[]> {
    const rows = await this.database
      .select()
      .from(evolutiveAchievements)
      .where(byUser(userId, guildId))
      .orderBy(asc(evolutiveAchievements.unlocked_at));

    return rows.map((row: EvolutiveRow) => ({
      baseId: row.base_id,
      name: BASE_ACHIEVEMENTS[row.base_id]?.name ?? row.base_id,
      events: evolutionLogSchema.parse(JSON.parse(row.evolution_log)),
    }));
  }
}
