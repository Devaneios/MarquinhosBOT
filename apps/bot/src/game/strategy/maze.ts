import { generateMaze } from '@marquinhos/domain/games/maze/botGenerator';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { z } from 'zod';
import {
  BaseGame,
  GameResult,
  GameSession,
  PlayerStatus,
} from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

// Cell type constants — must match renderViewport expectations
const WALL = 0;
const PATH = 1;
const PLAYER = 2;
const GOAL = 3;
const FOG = 5;

const CELL_EMOJI = ['🧱', '⬜', '👤', '🏆', '🟩', '⬛'] as const;
const BORDER_ROW = '🟩'.repeat(10);

// Viewport half-size: 4 cells in each direction → 9×9 window
const VIEWPORT_HALF = 4;

interface MazeData {
  phase: 'setup_size' | 'setup_mode' | 'playing';
  selectedSize?: number;
  grid?: boolean[][];
  playerRow?: number;
  playerCol?: number;
  goalRow?: number;
  goalCol?: number;
  mode?: 'open' | 'foggy';
  visited?: boolean[][];
  moves?: number;
  moveLimit?: number;
  isCompleted?: boolean;
  isExhausted?: boolean;
}

const MazeActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('setup_size'), size: z.number() }),
  z.object({ type: z.literal('setup_mode'), mode: z.enum(['open', 'foggy']) }),
  z.object({
    type: z.literal('move'),
    direction: z.enum(['up', 'down', 'left', 'right']),
  }),
]);

type MazeAction = z.infer<typeof MazeActionSchema>;

export class MazeGame extends BaseGame<MazeData, MazeAction> {
  constructor(session: GameSession) {
    super(session);
    this.data = { phase: 'setup_size' };
  }

  async start(): Promise<void> {
    this.session.players[0].status = PlayerStatus.ACTIVE;
  }

  async handlePlayerAction(_userId: string, action: MazeAction): Promise<void> {
    const mazeAction = MazeActionSchema.parse(action);
    const data = this.data;

    if (mazeAction.type === 'setup_size') {
      data.selectedSize = mazeAction.size;
      data.phase = 'setup_mode';
      return;
    }

    if (mazeAction.type === 'setup_mode') {
      const size = data.selectedSize!;
      const grid = generateMaze(size);
      data.grid = grid;
      data.playerRow = 1;
      data.playerCol = 1;
      data.goalRow = size - 2;
      data.goalCol = size - 2;
      data.mode = mazeAction.mode;
      data.moves = 0;
      data.moveLimit = Math.floor((size * size) / 2);
      data.isCompleted = false;
      data.isExhausted = false;
      // Track visited cells for foggy mode
      data.visited = Array.from({ length: size }, () =>
        new Array(size).fill(false),
      );
      data.visited[1][1] = true;
      data.phase = 'playing';
      return;
    }

    if (
      mazeAction.type === 'move' &&
      data.phase === 'playing' &&
      !data.isCompleted
    ) {
      const dirMap: Record<string, [number, number]> = {
        up: [-1, 0],
        down: [1, 0],
        left: [0, -1],
        right: [0, 1],
      };
      const delta = dirMap[mazeAction.direction];
      if (!delta) return;

      const newRow = data.playerRow! + delta[0];
      const newCol = data.playerCol! + delta[1];
      const grid = data.grid!;

      if (
        newRow >= 0 &&
        newRow < grid.length &&
        newCol >= 0 &&
        newCol < grid[0].length &&
        grid[newRow][newCol]
      ) {
        data.playerRow = newRow;
        data.playerCol = newCol;
        data.moves = (data.moves ?? 0) + 1;
        if (data.visited) data.visited[newRow][newCol] = true;

        if (newRow === data.goalRow && newCol === data.goalCol) {
          data.isCompleted = true;
        } else if (data.moveLimit && data.moves! >= data.moveLimit) {
          data.isExhausted = true;
        }
      }
    }
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.data;
    const player = this.session.players[0];

    if (data.phase === 'setup_size') {
      return GameUtils.createGameEmbed(
        '🏃 Labirinto',
        `👤 **${player.username}**\n\nEscolha o tamanho do labirinto:\n\n🟫 **Pequeno** — 15×15\n🟧 **Médio** — 31×31\n🟥 **Grande** — 51×51\n⬛ **Enorme** — 99×99`,
        0x3498db,
        this.session.expiresAt,
      );
    }

    if (data.phase === 'setup_mode') {
      const sizeLabel: Record<number, string> = {
        15: 'Pequeno (15×15)',
        31: 'Médio (31×31)',
        51: 'Grande (51×51)',
        99: 'Enorme (99×99)',
      };
      return GameUtils.createGameEmbed(
        '🏃 Labirinto',
        `👤 **${player.username}**\n\n📐 **Tamanho:** ${sizeLabel[data.selectedSize!]}\n\nEscolha o modo de jogo:\n\n🌅 **Aberto** — todos os caminhos visíveis\n🌫️ **Nebuloso** — só vê o corredor atual`,
        0x3498db,
        this.session.expiresAt,
      );
    }

    // Playing phase
    const moves = data.moves ?? 0;
    const limit = data.moveLimit ?? 0;
    const header = data.isCompleted
      ? `👤 **${player.username}**\n\n🎉 **PARABÉNS! Você escapou do labirinto!**\n🚶 **Movimentos:** ${moves}/${limit}\n\n`
      : data.isExhausted
        ? `👤 **${player.username}**\n\n❌ **Limite de movimentos atingido!** (${moves}/${limit})\n\n`
        : `👤 **${player.username}** | 🚶 **Movimentos:** ${moves}/${limit}\n\n`;
    const fogLegend =
      data.isCompleted || data.mode === 'open' ? '' : ' | ⬛ Névoa';
    const legend = `\n\n**Legenda:** 👤 Você | 🏆 Saída | 🧱 Parede | ⬜ Caminho | 🟩 Borda${fogLegend}`;
    const description = `${header}${renderViewport(data)}${legend}`;

    const color = data.isCompleted
      ? 0x00ff00
      : data.isExhausted
        ? 0xff0000
        : 0x3498db;
    return GameUtils.createGameEmbed(
      '🏃 Labirinto',
      description,
      color,
      data.isCompleted || data.isExhausted ? undefined : this.session.expiresAt,
    );
  }

  getMovementButtons(): ActionRowBuilder<ButtonBuilder>[] {
    const data = this.data;

    if (data.phase === 'setup_size') {
      return [
        GameUtils.createGameButtons({
          labels: ['🟫 Pequeno', '🟧 Médio', '🟥 Grande', '⬛ Enorme'],
          customIds: [
            'maze_setup_size_15',
            'maze_setup_size_31',
            'maze_setup_size_51',
            'maze_setup_size_99',
          ],
          styles: [
            ButtonStyle.Secondary,
            ButtonStyle.Secondary,
            ButtonStyle.Secondary,
            ButtonStyle.Secondary,
          ],
        }),
      ];
    }

    if (data.phase === 'setup_mode') {
      return [
        GameUtils.createGameButtons({
          labels: ['🌅 Aberto', '🌫️ Nebuloso'],
          customIds: ['maze_setup_mode_open', 'maze_setup_mode_foggy'],
          styles: [ButtonStyle.Primary, ButtonStyle.Primary],
        }),
      ];
    }

    if (data.phase === 'playing' && !data.isCompleted && !data.isExhausted) {
      return [
        GameUtils.createGameButtons({
          labels: ['⬜', '⬆️', '⬜'],
          customIds: ['maze_noop_1', 'maze_up', 'maze_noop_2'],
          styles: [
            ButtonStyle.Secondary,
            ButtonStyle.Primary,
            ButtonStyle.Secondary,
          ],
          disabled: [true, false, true],
        }),
        GameUtils.createGameButtons({
          labels: ['⬅️', '⬜', '➡️'],
          customIds: ['maze_left', 'maze_noop_3', 'maze_right'],
          styles: [
            ButtonStyle.Primary,
            ButtonStyle.Secondary,
            ButtonStyle.Primary,
          ],
          disabled: [false, true, false],
        }),
        GameUtils.createGameButtons({
          labels: ['⬜', '⬇️', '⬜'],
          customIds: ['maze_noop_4', 'maze_down', 'maze_noop_5'],
          styles: [
            ButtonStyle.Secondary,
            ButtonStyle.Primary,
            ButtonStyle.Secondary,
          ],
          disabled: [true, false, true],
        }),
      ];
    }

    return [];
  }

  public isFinished(): boolean {
    const data = this.data;
    return (data.isCompleted ?? false) || (data.isExhausted ?? false);
  }

  async finish(): Promise<GameResult> {
    const data = this.data;
    const player = this.session.players[0];
    const won = data.isCompleted ?? false;
    const rewards = this.calculateRewards(player, 1);

    if (won) {
      rewards.xp += 30;
      const moves = data.moves ?? 0;
      if (moves < 20) {
        rewards.xp += 20;
      } else if (moves < 30) {
        rewards.xp += 10;
      }
    }

    return {
      sessionId: this.session.id,
      winners: won ? [player.userId] : [],
      losers: !won ? [player.userId] : [],
      rewards: { [player.userId]: rewards },
      stats: {
        won,
        moves: data.moves ?? 0,
      },
      duration: Date.now() - this.session.startedAt.getTime(),
    };
  }

  protected getBaseXpForGame(): number {
    return 30;
  }
}

/**
 * Renders a 9×9 viewport centered on the player.
 * In foggy mode, unvisited cells appear as FOG.
 */
function renderViewport(data: MazeData): string {
  const grid = data.grid!;
  const pr = data.playerRow!;
  const pc = data.playerCol!;
  const gr = data.goalRow!;
  const gc = data.goalCol!;
  const size = grid.length;
  const foggy = data.mode === 'foggy' && !data.isCompleted;
  const visited = data.visited;

  const viewSize = VIEWPORT_HALF * 2 + 1;
  const viewport: number[][] = [];

  for (let i = 0; i < viewSize; i++) {
    const row: number[] = [];
    for (let j = 0; j < viewSize; j++) {
      const r = pr - VIEWPORT_HALF + i;
      const c = pc - VIEWPORT_HALF + j;

      if (r < 0 || r >= size || c < 0 || c >= size) {
        row.push(WALL);
        continue;
      }
      if (r === pr && c === pc) {
        row.push(PLAYER);
        continue;
      }
      if (r === gr && c === gc) {
        row.push(foggy && visited && !visited[gr][gc] ? FOG : GOAL);
        continue;
      }
      if (foggy && visited && !visited[r][c]) {
        row.push(FOG);
        continue;
      }
      row.push(grid[r][c] ? PATH : WALL);
    }
    viewport.push(row);
  }

  const rows = viewport.map(
    (row) => `🟩${row.map((c) => CELL_EMOJI[c]).join('')}🟩`,
  );
  return `${BORDER_ROW}\n${rows.join('\n')}\n${BORDER_ROW}`;
}
