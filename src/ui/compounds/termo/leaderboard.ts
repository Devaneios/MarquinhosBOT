import { resourcePath } from '@marquinhos/utils/resources';
import { Box, Column, Image, Row, Style, Text } from '@meonode/canvas';
import { readFileSync } from 'fs';
import { defaultTheme, type Theme } from '../../theme';
import type { CanvasNode } from '../../types';

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all-time';

export type DailyEntry = {
  rank: number;
  displayName: string;
  attempts: number;
  solved: boolean;
  avatar?: Buffer;
};

export type RankedEntry = {
  rank: number;
  displayName: string;
  avgScore: number;
  totalDays: number;
  avatar?: Buffer;
};

type Entry = DailyEntry | RankedEntry;

type PodiumGroup = {
  rank: number;
  members: Entry[];
};

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  daily: 'Hoje',
  weekly: 'Esta Semana',
  monthly: 'Este Mês',
  'all-time': 'Histórico',
};

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'] as const;
const STREAK_COLOR = '#FFA94D';
const RETRO_PURPLE = '#C77DFF';
const RETRO_FONT = 'Press Start 2P';

const PODIUM_STYLES = [
  {
    avatarSize: 56,
    pedestalHeight: 72,
    rankSize: 20,
  },
  {
    avatarSize: 44,
    pedestalHeight: 48,
    rankSize: 14,
  },
  {
    avatarSize: 44,
    pedestalHeight: 34,
    rankSize: 14,
  },
] as const;

const LOGO_DATA_URL = `data:image/jpeg;base64,${readFileSync(
  resourcePath('images', 'marquinhoshead.jpg'),
).toString('base64')}`;

const FIRE_SVG_DATA_URL = `data:image/svg+xml;base64,${readFileSync(
  resourcePath('images', 'Fogo.svg'),
).toString('base64')}`;

export function denseRanks(keys: string[]): number[] {
  const ranks: number[] = [];
  keys.forEach((key, i) => {
    if (i === 0) {
      ranks.push(1);
    } else {
      ranks.push(key === keys[i - 1] ? ranks[i - 1] : ranks[i - 1] + 1);
    }
  });
  return ranks;
}

function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexChannels(hex: string): [number, number, number] {
  const cleanHex = hex.replace('#', '');
  return [
    parseInt(cleanHex.slice(0, 2), 16),
    parseInt(cleanHex.slice(2, 4), 16),
    parseInt(cleanHex.slice(4, 6), 16),
  ];
}

function shade(hex: string, factor: number): string {
  const [r, g, b] = hexChannels(hex).map((v) =>
    Math.round(Math.min(v * factor, 255)),
  );
  return `rgb(${r}, ${g}, ${b})`;
}

function tint(hex: string, factor: number): string {
  const [r, g, b] = hexChannels(hex).map((v) =>
    Math.round(v + (255 - v) * factor),
  );
  return `rgb(${r}, ${g}, ${b})`;
}

function isDailyEntry(e: Entry): e is DailyEntry {
  return 'solved' in e;
}

function entryValue(entry: Entry): { value: string; days?: string } {
  if (isDailyEntry(entry)) {
    return { value: entry.solved ? String(entry.attempts) : '—' };
  }
  return { value: String(entry.avgScore), days: `${entry.totalDays}d` };
}

function truncateName(name: string, max: number = 12): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function groupLabel(members: Entry[]): string {
  if (members.length === 1) {
    return truncateName(members[0].displayName);
  }
  if (members.length === 2) {
    return `${truncateName(members[0].displayName, 7)} & ${truncateName(
      members[1].displayName,
      7,
    )}`;
  }
  return `${truncateName(members[0].displayName, 9)} +${members.length - 1}`;
}

function splitPodium(entries: Entry[]): {
  groups: PodiumGroup[];
  rest: Entry[];
} {
  const groups: PodiumGroup[] = [];
  const rest: Entry[] = [];
  for (const entry of entries) {
    const group = groups.find((g) => g.rank === entry.rank);
    if (group) {
      group.members.push(entry);
    } else if (groups.length < 3) {
      groups.push({ rank: entry.rank, members: [entry] });
    } else {
      rest.push(entry);
    }
  }
  return { groups, rest };
}

function pixelSafe(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/—/g, '-');
}

function pixelText(
  text: string,
  size: number,
  color: string,
  extra?: Record<string, unknown>,
): CanvasNode {
  return Text(pixelSafe(text), {
    fontFamily: RETRO_FONT,
    fontSize: size,
    color,
    ...extra,
  });
}

function avatarSquare(
  name: string,
  buffer: Buffer | undefined,
  options: {
    size: number;
    ringWidth: number;
    ringColor: string;
    glow?: boolean;
    label?: string;
  },
  theme: Theme,
): CanvasNode {
  const { size, ringWidth, ringColor, glow, label } = options;
  const outer = size + ringWidth * 2;
  const fallback = label ?? (name.charAt(0).toUpperCase() || '?');

  return Box({
    width: outer,
    height: outer,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.card,
    border: ringWidth,
    borderColor: ringColor,
    ...(glow
      ? { boxShadow: { blur: 14, color: hexToRgba(ringColor, 0.45) } }
      : {}),
    justifyContent: Style.Justify.Center,
    alignItems: Style.Align.Center,
    children: [
      buffer
        ? Image({
            src: `data:image/png;base64,${buffer.toString('base64')}`,
            width: size,
            height: size,
            borderRadius: Math.max(theme.radii.sm - ringWidth, 0),
            objectFit: 'cover',
          })
        : pixelText(fallback, Math.max(Math.floor(size * 0.3), 8), ringColor),
    ],
  });
}

type AvatarStack = { node: CanvasNode; width: number; height: number };

const TIE_BADGE_SIZE = 20;
const TIE_BADGE_HEADROOM = 8;

function groupAvatars(
  members: Entry[],
  metal: string,
  baseSize: number,
  theme: Theme,
): AvatarStack {
  const frame = baseSize + 6;
  const width = frame + TIE_BADGE_HEADROOM;
  const height = frame + TIE_BADGE_HEADROOM;

  const children: CanvasNode[] = [
    Box({
      positionType: Style.PositionType.Absolute,
      position: { Bottom: 0, Left: 0 },
      children: [
        avatarSquare(
          members[0].displayName,
          members[0].avatar,
          { size: baseSize, ringWidth: 3, ringColor: metal, glow: true },
          theme,
        ),
      ],
    }),
  ];

  if (members.length > 1) {
    children.push(
      Box({
        positionType: Style.PositionType.Absolute,
        position: { Top: 0, Right: 0 },
        minWidth: TIE_BADGE_SIZE,
        height: TIE_BADGE_SIZE,
        borderRadius: TIE_BADGE_SIZE / 2,
        backgroundColor: metal,
        border: 2,
        borderColor: '#0a0a0b',
        padding: { Horizontal: 4 },
        justifyContent: Style.Justify.Center,
        alignItems: Style.Align.Center,
        zIndex: 1,
        children: [pixelText(`+${members.length - 1}`, 7, '#0a0a0b')],
      }),
    );
  }

  return { node: Box({ width, height, children }), width, height };
}

function retroDivider(): CanvasNode {
  return Box({
    width: '100%',
    border: { Top: 2 },
    borderColor: hexToRgba(RETRO_PURPLE, 0.25),
    borderStyle: Style.Border.Dashed,
  });
}

function retroHeader(period: LeaderboardPeriod, theme: Theme): CanvasNode {
  return Column({
    width: '100%',
    gap: theme.spacing.sm,
    children: [
      Row({
        width: '100%',
        justifyContent: Style.Justify.SpaceBetween,
        alignItems: Style.Align.Center,
        children: [
          pixelText('> TERMINHOS', 16, theme.colors.accent),
          Box({
            border: 1,
            borderColor: hexToRgba(RETRO_PURPLE, 0.6),
            backgroundColor: hexToRgba(RETRO_PURPLE, 0.08),
            padding: {
              Horizontal: theme.spacing.sm,
              Vertical: theme.spacing.xs,
            },
            children: [
              pixelText(PERIOD_LABELS[period].toUpperCase(), 8, RETRO_PURPLE),
            ],
          }),
        ],
      }),
      retroDivider(),
    ],
  });
}

function nameText(name: string, muted: boolean, theme: Theme): CanvasNode {
  return Text(name, {
    fontFamily: theme.fontFamilies.body,
    fontWeight: '500',
    fontSize: theme.fontSizes.md,
    color: muted ? theme.colors.textMuted : theme.colors.textPrimary,
  });
}

function listRow(entry: Entry, theme: Theme): CanvasNode {
  const { value, days } = entryValue(entry);
  const muted = isDailyEntry(entry) && !entry.solved;

  return Row({
    width: '100%',
    justifyContent: Style.Justify.SpaceBetween,
    alignItems: Style.Align.Center,
    gap: theme.spacing.sm,
    children: [
      Box({
        width: 32,
        children: [pixelText(`#${entry.rank}`, 9, theme.colors.textMuted)],
      }),
      avatarSquare(
        entry.displayName,
        entry.avatar,
        { size: 22, ringWidth: 1, ringColor: theme.colors.border },
        theme,
      ),
      Box({
        flexGrow: 1,
        marginLeft: theme.spacing.xs,
        children: [nameText(entry.displayName, muted, theme)],
      }),
      Row({
        gap: theme.spacing.sm,
        alignItems: Style.Align.Center,
        children: [
          pixelText(value, 10, theme.colors.accent),
          ...(days !== undefined
            ? [
                Text(days, {
                  fontFamily: theme.fontFamilies.body,
                  fontSize: theme.fontSizes.sm,
                  color: theme.colors.textMuted,
                }),
              ]
            : []),
        ],
      }),
    ],
  });
}

function streakBanner(streak: number, theme: Theme): CanvasNode {
  const daysText = streak === 1 ? 'DIA' : 'DIAS';

  return Row({
    width: '100%',
    gradient: {
      type: 'linear',
      colors: [hexToRgba(STREAK_COLOR, 0.16), hexToRgba(STREAK_COLOR, 0.02)],
      direction: 'to-right',
    },
    border: 2,
    borderColor: hexToRgba(STREAK_COLOR, 0.45),
    boxShadow: { offsetX: 3, offsetY: 3, blur: 0, color: 'rgba(0,0,0,0.45)' },
    padding: { Horizontal: theme.spacing.lg, Vertical: theme.spacing.md },
    justifyContent: Style.Justify.SpaceBetween,
    alignItems: Style.Align.Center,
    children: [
      Column({
        alignItems: Style.Align.FlexStart,
        gap: 4,
        children: [
          pixelText('STREAK', 12, hexToRgba(STREAK_COLOR, 1)),
          pixelText('DO SERVIDOR', 12, hexToRgba(STREAK_COLOR, 0.7)),
        ],
      }),
      Row({
        alignItems: Style.Align.FlexStart,
        gap: theme.spacing.sm,
        children: [
          Image({
            src: FIRE_SVG_DATA_URL,
            width: 26,
            height: 26,
          }),
          pixelText(`${streak}`, 26, STREAK_COLOR),
          pixelText(`${daysText}`, 12, theme.colors.textMuted),
        ],
      }),
    ],
  });
}

function valuePill(entry: Entry, metal: string, theme: Theme): CanvasNode {
  const muted = theme.colors.textMuted;
  let content: string;
  if (isDailyEntry(entry)) {
    content = entry.solved
      ? `<size="7"><color="${muted}">EM </color></size>${entry.attempts}`
      : `<color="${muted}">ERROU</color>`;
  } else {
    content = `${entry.avgScore}<size="7"><color="${muted}"> · ${entry.totalDays}D</color></size>`;
  }

  return Box({
    backgroundColor: theme.colors.surface,
    border: 1,
    borderColor: hexToRgba(metal, 0.45),
    padding: { Horizontal: theme.spacing.sm, Vertical: 3 },
    children: [pixelText(content, 9, theme.colors.accent)],
  });
}

const PEDESTAL_WIDTH = 140;
const PEDESTAL_SHADOW = 4;

function pedestalSvg(extrudeHeight: number, metal: string): string {
  const w = PEDESTAL_WIDTH;
  const half = w / 2;
  const quarter = w / 4;
  const sh = PEDESTAL_SHADOW;
  const h = extrudeHeight;

  const point = (x: number, y: number) => `${x},${y}`;
  const drop = (x: number, y: number) => point(x, y + h);

  const topDiamond = [
    point(half, 0),
    point(w, quarter),
    point(half, half),
    point(0, quarter),
  ].join(' ');
  const leftFace = [
    point(0, quarter),
    point(half, half),
    drop(half, half),
    drop(0, quarter),
  ].join(' ');
  const rightFace = [
    point(half, half),
    point(w, quarter),
    drop(w, quarter),
    drop(half, half),
  ].join(' ');
  const silhouette = [
    point(half, 0),
    point(w, quarter),
    drop(w, quarter),
    drop(half, half),
    drop(0, quarter),
    point(0, quarter),
  ].join(' ');

  const totalW = w + sh;
  const totalH = half + h + sh;

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}">`,
    `<polygon points="${silhouette}" transform="translate(${sh},${sh})" fill="rgba(0,0,0,0.45)"/>`,
    `<polygon points="${leftFace}" fill="${shade(metal, 0.55)}" stroke="#0a0a0b" stroke-width="2"/>`,
    `<polygon points="${rightFace}" fill="${shade(metal, 0.35)}" stroke="#0a0a0b" stroke-width="2"/>`,
    `<polygon points="${topDiamond}" fill="${tint(metal, 0.4)}" stroke="#0a0a0b" stroke-width="2"/>`,
    '</svg>',
  ].join('');
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function pedestal(
  rank: number,
  position: number,
  avatars: AvatarStack,
  theme: Theme,
): CanvasNode {
  const metal = RANK_COLORS[position];
  const style = PODIUM_STYLES[position];
  const w = PEDESTAL_WIDTH;
  const half = w / 2;
  const sh = PEDESTAL_SHADOW;
  const blockWidth = w + sh;
  const blockHeight = half + style.pedestalHeight + sh;
  const labelHeight = style.rankSize + 4;

  const lift = Math.max(0, avatars.height - w / 4);
  const containerHeight = lift + blockHeight;

  // The rank number goes on whichever front face stays clear of the gold
  // block: the right block (bronze) tucks behind on its left, so use its right
  // face; the others use the lighter left face.
  const labelOnRight = position === 2;

  return Box({
    width: blockWidth,
    height: containerHeight,
    marginTop: theme.spacing.sm,
    children: [
      Box({
        positionType: Style.PositionType.Absolute,
        position: { Top: lift, Left: 0 },
        width: blockWidth,
        height: blockHeight,
        zIndex: 0,
        children: [
          Image({
            src: pedestalSvg(style.pedestalHeight, metal),
            width: blockWidth,
            height: blockHeight,
          }),
          Box({
            positionType: Style.PositionType.Absolute,
            position: {
              Top: Math.round(
                (3 * w) / 8 + style.pedestalHeight / 2 - labelHeight / 2,
              ),
              Left: labelOnRight ? half : 0,
            },
            width: half,
            height: labelHeight,
            justifyContent: Style.Justify.Center,
            alignItems: Style.Align.Center,
          }),
        ],
      }),
      Box({
        positionType: Style.PositionType.Absolute,
        position: {
          Top: 0,
          Left: Math.round((w - (avatars.width - TIE_BADGE_HEADROOM)) / 2),
        },
        zIndex: 1,
        children: [avatars.node],
      }),
    ],
  });
}

const PODIUM_COL_WIDTH = PEDESTAL_WIDTH + PEDESTAL_SHADOW;
const PODIUM_OVERLAP = 32;
const PODIUM_ADVANCE = PODIUM_COL_WIDTH - PODIUM_OVERLAP;
const PODIUM_DEPTH_OFFSET = 32;

function podiumColumnChildren(
  group: PodiumGroup,
  position: number,
  theme: Theme,
): CanvasNode[] {
  const metal = RANK_COLORS[position];
  const style = PODIUM_STYLES[position];
  const avatars = groupAvatars(group.members, metal, style.avatarSize, theme);

  return [
    pedestal(group.rank, position, avatars, theme),
    Column({
      alignSelf: Style.Align.FlexStart,
      width: PEDESTAL_WIDTH,
      alignItems: Style.Align.Center,
      gap: theme.spacing.xs,
      children: [
        Text(groupLabel(group.members), {
          fontFamily: theme.fontFamilies.body,
          fontWeight: '600',
          fontSize: theme.fontSizes.md,
          color: theme.colors.textPrimary,
          marginTop: 2,
          maxWidth: PODIUM_ADVANCE - PEDESTAL_SHADOW,
          maxLines: 1,
          ellipsis: true,
        }),
        valuePill(group.members[0], metal, theme),
      ],
    }),
  ];
}

function sidePodiumColumn(
  group: PodiumGroup | undefined,
  position: number,
  theme: Theme,
  leftOffset: number,
): CanvasNode | null {
  if (!group) {
    return null;
  }
  return Column({
    positionType: Style.PositionType.Absolute,
    position: { Left: leftOffset, Bottom: PODIUM_DEPTH_OFFSET },
    zIndex: -1,
    width: PODIUM_COL_WIDTH,
    alignItems: Style.Align.Center,
    gap: theme.spacing.xs,
    children: podiumColumnChildren(group, position, theme),
  });
}

function podium(groups: PodiumGroup[], theme: Theme): CanvasNode {
  const sides: CanvasNode[] = [];
  const silver = sidePodiumColumn(groups[1], 1, theme, -PODIUM_ADVANCE);
  const bronze = sidePodiumColumn(groups[2], 2, theme, PODIUM_ADVANCE);
  if (silver) sides.push(silver);
  if (bronze) sides.push(bronze);

  const goldColumn = Column({
    width: PODIUM_COL_WIDTH,
    alignItems: Style.Align.Center,
    gap: theme.spacing.xs,
    children: [...sides, ...podiumColumnChildren(groups[0], 0, theme)],
  });

  return Row({
    width: '100%',
    justifyContent: Style.Justify.Center,
    children: [goldColumn],
  });
}

function footer(theme: Theme): CanvasNode {
  return Row({
    width: '100%',
    justifyContent: Style.Justify.Center,
    alignItems: Style.Align.Center,
    gap: theme.spacing.sm,
    children: [
      Image({
        src: LOGO_DATA_URL,
        width: 18,
        height: 18,
        borderRadius: theme.radii.sm,
        objectFit: 'cover',
      }),
      pixelText('MARQUINHOS BOT', 8, hexToRgba(RETRO_PURPLE, 0.7)),
    ],
  });
}

export function termoLeaderboardCard(
  entries: Entry[],
  period: LeaderboardPeriod,
  groupStreak: number,
  theme: Theme = defaultTheme,
): CanvasNode {
  const showPodium = entries.length >= 2;
  let podiumGroups: PodiumGroup[] = [];
  let listEntries: Entry[] = entries;
  if (showPodium) {
    ({ groups: podiumGroups, rest: listEntries } = splitPodium(entries));
  }

  const headerChildren: CanvasNode[] = [retroHeader(period, theme)];

  if (groupStreak > 0) {
    headerChildren.push(streakBanner(groupStreak, theme));
  }

  if (showPodium) {
    headerChildren.push(podium(podiumGroups, theme));
  }

  if (entries.length === 0) {
    headerChildren.push(
      Box({
        width: '100%',
        padding: { Vertical: theme.spacing.lg },
        justifyContent: Style.Justify.Center,
        alignItems: Style.Align.Center,
        children: [
          pixelText('SEM REGISTROS AINDA', 10, theme.colors.textMuted),
        ],
      }),
    );
  }

  const rows: CanvasNode[] = [];
  if (listEntries.length > 0) {
    const legend = isDailyEntry(listEntries[0]) ? 'TENTATIVAS' : 'MEDIA · DIAS';
    rows.push(
      Row({
        width: '100%',
        justifyContent: Style.Justify.FlexEnd,
        children: [pixelText(legend, 7, theme.colors.textMuted)],
      }),
    );
  }
  for (const entry of listEntries) {
    if (rows.length > 1) {
      rows.push(retroDivider());
    }
    rows.push(listRow(entry, theme));
  }

  const cardContent: CanvasNode[] = [
    Column({
      width: '100%',
      gap: theme.spacing.md,
      children: headerChildren,
    }),
  ];

  if (rows.length > 0) {
    cardContent.push(retroDivider());
    cardContent.push(
      Column({ width: '100%', gap: theme.spacing.sm, children: rows }),
    );
  }

  cardContent.push(retroDivider());
  cardContent.push(footer(theme));

  return Column({
    width: '100%',
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radii.sm,
    border: 2,
    borderColor: hexToRgba(RETRO_PURPLE, 0.35),
    boxShadow: { offsetX: 5, offsetY: 5, blur: 0, color: 'rgba(0,0,0,0.55)' },
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    children: cardContent,
  });
}
