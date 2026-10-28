import type {
  WordleAchievementStatus,
  WordleAchievementsOverview,
} from '@marquinhos/contracts/wordle';
import { WORDLE_ACHIEVEMENT_FAMILIES } from '@marquinhos/domain/games/wordle/achievements/families';
import { baseEmbed, type BaseEmbedClient } from '@marquinhos/utils/discord';
import type { EmbedBuilder } from 'discord.js';

export const TERMO_FAMILY_LABELS: Record<string, string> = {
  wins: 'Vitórias',
  streak: 'Sequência',
  played: 'Presença',
  precision: 'Precisão',
  persistence: 'Persistência',
  speed: 'Velocidade',
  timing: 'Horário',
  style: 'Estilo',
  comeback: 'Retorno',
  letters: 'Letras',
  digits: 'Dígitos',
  tetrominoes: 'Tetraminós',
  shapes: 'Formas',
  collections: 'Coleções',
  participation_streak: 'Constância',
  calendar: 'Calendário',
  feedback: 'Pistas',
  variety: 'Variedade',
  vocabulary: 'Vocabulário',
};

const RECENT_LIMIT = 5;
const NEXT_GOALS_LIMIT = 3;
const BAR_WIDTH = 10;

export interface TermoFamilySummary {
  family: string;
  label: string;
  unlocked: number;
  total: number;
}

export interface TermoAchievementsSummary {
  unlocked: number;
  total: number;
  earnedXp: number;
  lockedSecrets: number;
  families: TermoFamilySummary[];
  recent: WordleAchievementStatus[];
  nextGoals: WordleAchievementStatus[];
}

function familyRank(family: string): number {
  const index = (WORDLE_ACHIEVEMENT_FAMILIES as readonly string[]).indexOf(
    family,
  );
  return index === -1 ? WORDLE_ACHIEVEMENT_FAMILIES.length : index;
}

function ratio(achievement: WordleAchievementStatus): number {
  const progress = achievement.progress;
  return progress === null ? 0 : progress.current / progress.target;
}

export function familyLabel(family: string): string {
  return TERMO_FAMILY_LABELS[family] ?? family;
}

export function summarizeTermoAchievements(
  achievements: readonly WordleAchievementStatus[],
): TermoAchievementsSummary {
  const unlocked = achievements.filter((a) => a.unlockedAt !== null);
  const byFamily = new Map<string, TermoFamilySummary>();
  for (const achievement of achievements) {
    const entry = byFamily.get(achievement.family) ?? {
      family: achievement.family,
      label: familyLabel(achievement.family),
      unlocked: 0,
      total: 0,
    };
    entry.total += 1;
    if (achievement.unlockedAt !== null) entry.unlocked += 1;
    byFamily.set(achievement.family, entry);
  }

  return {
    unlocked: unlocked.length,
    total: achievements.length,
    earnedXp: unlocked.reduce((sum, a) => sum + a.rewardXp, 0),
    lockedSecrets: achievements.filter((a) => a.hidden && a.unlockedAt === null)
      .length,
    families: [...byFamily.values()].sort(
      (a, b) =>
        familyRank(a.family) - familyRank(b.family) ||
        a.family.localeCompare(b.family),
    ),
    recent: [...unlocked]
      .sort((a, b) => b.unlockedAt!.localeCompare(a.unlockedAt!))
      .slice(0, RECENT_LIMIT),
    nextGoals: achievements
      .filter(
        (a) =>
          a.unlockedAt === null &&
          !a.hidden &&
          a.progress !== null &&
          a.progress.current > 0,
      )
      .sort((a, b) => ratio(b) - ratio(a) || a.rewardXp - b.rewardXp)
      .slice(0, NEXT_GOALS_LIMIT),
  };
}

export function textProgressBar(
  current: number,
  target: number,
  width = BAR_WIDTH,
): string {
  const filled =
    target <= 0
      ? 0
      : Math.max(0, Math.min(width, Math.floor((current / target) * width)));
  return `${'▰'.repeat(filled)}${'▱'.repeat(width - filled)}`;
}

function unixSeconds(iso: string): number {
  return Math.floor(Date.parse(iso) / 1000);
}

function recentLine(achievement: WordleAchievementStatus): string {
  const holders =
    achievement.holdersPercent === null
      ? ''
      : ` · ${Math.round(achievement.holdersPercent)}% do servidor`;
  return `${achievement.icon} **${achievement.name}** · <t:${unixSeconds(
    achievement.unlockedAt!,
  )}:R>${holders}`;
}

function goalLine(achievement: WordleAchievementStatus): string {
  const { current, target } = achievement.progress!;
  return `${achievement.icon} **${achievement.name}**\n${textProgressBar(
    current,
    target,
  )} ${current}/${target} · +${achievement.rewardXp} XP`;
}

export function buildTermoAchievementsEmbed(
  client: BaseEmbedClient,
  target: { displayName: string; avatarUrl: string },
  overview: WordleAchievementsOverview,
  imageName?: string,
): EmbedBuilder {
  const summary = summarizeTermoAchievements(overview.achievements);
  const embed = baseEmbed(client)
    .setTitle(`🏆 Conquistas do Terminhos · ${target.displayName}`)
    .setThumbnail(target.avatarUrl)
    .setDescription(
      `**${summary.unlocked}/${summary.total}** desbloqueadas · **${summary.earnedXp} XP** ganhos`,
    );

  embed.addFields({
    name: 'Desbloqueadas recentemente',
    value:
      summary.recent.length === 0
        ? 'Nenhuma ainda. Acerte a palavra do dia com `/termo` para começar!'
        : summary.recent.map(recentLine).join('\n'),
  });

  if (summary.nextGoals.length > 0) {
    embed.addFields({
      name: 'Próximas metas',
      value: summary.nextGoals.map(goalLine).join('\n'),
    });
  }

  if (summary.lockedSecrets > 0) {
    embed.addFields({
      name: '🔒 Secretas',
      value:
        summary.lockedSecrets === 1
          ? 'Ainda existe 1 conquista secreta para descobrir.'
          : `Ainda existem ${summary.lockedSecrets} conquistas secretas para descobrir.`,
    });
  }

  if (imageName !== undefined) embed.setImage(`attachment://${imageName}`);
  embed.setFooter({
    text: 'Use /termo-conquistas conquista:Nome ou ID para ver os detalhes.',
  });
  return embed;
}

export function buildTermoAchievementDetailEmbed(
  client: BaseEmbedClient,
  target: { displayName: string; avatarUrl: string },
  achievement: WordleAchievementStatus,
  imageName?: string,
): EmbedBuilder {
  const secret = achievement.hidden && achievement.unlockedAt === null;
  const embed = baseEmbed(client)
    .setTitle(
      secret
        ? '🔒 Conquista secreta'
        : `${achievement.icon} ${achievement.name}`,
    )
    .setThumbnail(target.avatarUrl)
    .setDescription(
      secret
        ? 'Continue jogando para descobrir esta conquista.'
        : achievement.description,
    );
  if (secret) return embed;

  embed.addFields({
    name: `${familyLabel(achievement.family)} · +${achievement.rewardXp} XP`,
    value:
      achievement.unlockedAt === null
        ? 'Ainda não desbloqueada.'
        : `Desbloqueada por ${target.displayName} em <t:${unixSeconds(achievement.unlockedAt)}:d>.`,
  });
  if (achievement.progress !== null) {
    const { current, target: goal } = achievement.progress;
    embed.addFields({
      name: 'Progresso',
      value: `${textProgressBar(current, goal)} ${current}/${goal}`,
    });
  }
  if (achievement.patternPreview !== undefined) {
    embed.addFields({
      name: 'Como desenhar',
      value:
        'Use verde ou amarelo, uma cor por desenho. Os pontos aceitam qualquer cor e células extras são permitidas. A linha da vitória também conta.',
    });
    if (achievement.patternPreview.rotations.length > 1) {
      embed.addFields({
        name: 'Orientação',
        value: 'Pode girar o desenho. Espelhamentos não contam.',
      });
    }
  }
  if (achievement.unlockedAt !== null && achievement.matchEvidence) {
    embed.addFields({
      name: 'Desenho encontrado',
      value: `Partida de ${achievement.matchEvidence.date}. As células contornadas formam o desenho.`,
    });
  }
  if (imageName !== undefined) embed.setImage(`attachment://${imageName}`);
  return embed;
}
