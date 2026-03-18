import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
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
  isCompleted?: boolean;
}

interface MazeAction {
  type: 'setup_size' | 'setup_mode' | 'move';
  size?: number;
  mode?: 'open' | 'foggy';
  direction?: string;
}

export class MazeGame extends BaseGame {
  constructor(session: GameSession) {
    super(session);
    this.session.data = { phase: 'setup_size' } as MazeData;
  }

  async start(): Promise<void> {
    this.session.players[0].status = PlayerStatus.ACTIVE;
  }

  async handlePlayerAction(_userId: string, action: MazeAction): Promise<void> {
    const data = this.session.data as MazeData;

    if (action.type === 'setup_size') {
      data.selectedSize = action.size;
      data.phase = 'setup_mode';
      return;
    }

    if (action.type === 'setup_mode') {
      const size = data.selectedSize!;
      const grid = generateMaze(size);
      data.grid = grid;
      data.playerRow = 1;
      data.playerCol = 1;
      data.goalRow = size - 2;
      data.goalCol = size - 2;
      data.mode = action.mode;
      data.moves = 0;
      data.isCompleted = false;
      // Track visited cells for foggy mode
      data.visited = Array.from({ length: size }, () =>
        new Array(size).fill(false),
      );
      data.visited[1][1] = true;
      data.phase = 'playing';
      return;
    }

    if (
      action.type === 'move' &&
      data.phase === 'playing' &&
      !data.isCompleted
    ) {
      const dirMap: Record<string, [number, number]> = {
        up: [-1, 0],
        down: [1, 0],
        left: [0, -1],
        right: [0, 1],
      };
      const delta = dirMap[action.direction ?? ''];
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
        }
      }
    }
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as MazeData;
    const player = this.session.players[0];

    if (data.phase === 'setup_size') {
      return GameUtils.createGameEmbed(
        '🏃 Labirinto',
        `👤 **${player.username}**\n\nEscolha o tamanho do labirinto:\n\n🟫 **Pequeno** — 15×15\n🟧 **Médio** — 31×31\n🟥 **Grande** — 51×51\n⬛ **Enorme** — 99×99`,
        0x3498db,
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
      );
    }

    // Playing phase
    const moves = data.moves ?? 0;
    const header = data.isCompleted
      ? `👤 **${player.username}**\n\n🎉 **PARABÉNS! Você escapou do labirinto!**\n🚶 **Movimentos:** ${moves}\n\n`
      : `👤 **${player.username}** | 🚶 **Movimentos:** ${moves}\n\n`;
    const fogLegend =
      data.isCompleted || data.mode === 'open' ? '' : ' | ⬛ Névoa';
    const legend = `\n\n**Legenda:** 👤 Você | 🏆 Saída | 🧱 Parede | ⬜ Caminho | 🟩 Borda${fogLegend}`;
    const description = `${header}${renderViewport(data)}${legend}`;

    const color = data.isCompleted ? 0x00ff00 : 0x3498db;
    return GameUtils.createGameEmbed('🏃 Labirinto', description, color);
  }

  getMovementButtons(): ActionRowBuilder<ButtonBuilder>[] {
    const data = this.session.data as MazeData;

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

    if (data.phase === 'playing' && !data.isCompleted) {
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
    const data = this.session.data as MazeData;
    return data.isCompleted ?? false;
  }

  async finish(): Promise<GameResult> {
    const data = this.session.data as MazeData;
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
 * Generates a perfect maze using iterative depth-first search (recursive backtracker).
 * Grid size must be odd. Cells at odd (row, col) are path nodes; even cells are walls.
 * Returns a 2D boolean array: true = walkable, false = wall.
 */
function generateMaze(size: number): boolean[][] {
  const grid: boolean[][] = Array.from({ length: size }, () =>
    new Array(size).fill(false),
  );

  // Carve starting cell
  grid[1][1] = true;

  const stack: [number, number][] = [[1, 1]];
  const directions: [number, number][] = [
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
  ];

  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1];

    // Shuffle neighbors
    const shuffled = [...directions].sort(() => Math.random() - 0.5);
    let moved = false;

    for (const [dr, dc] of shuffled) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr > 0 && nr < size - 1 && nc > 0 && nc < size - 1 && !grid[nr][nc]) {
        // Carve wall between current and neighbor
        grid[r + dr / 2][c + dc / 2] = true;
        grid[nr][nc] = true;
        stack.push([nr, nc]);
        moved = true;
        break;
      }
    }

    if (!moved) {
      stack.pop();
    }
  }

  // Ensure goal cell is always reachable
  grid[size - 2][size - 2] = true;

  return grid;
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
