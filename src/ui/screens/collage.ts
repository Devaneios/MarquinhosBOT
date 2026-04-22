import { Column, Row, Style, Text } from '@meonode/canvas';
import { card, heroText, imageFrame, labelText, panel } from '../primitives';
import { render } from '../render';
import { defaultTheme, type Theme } from '../theme';
import type { CanvasNode } from '../types';

function parsePeriodMessage(period: string): string {
  switch (period) {
    case '7day':
      return 'Last Week';
    case '1month':
      return 'Last month';
    case '3month':
      return 'Last 3 months';
    case '6month':
      return 'Last 6 months';
    case '12month':
      return 'Last year';
    case 'overall':
      return 'All time';
    default:
      return 'All time';
  }
}

function gridCell(
  imageBuffer: Buffer,
  label: string,
  counter: number,
  theme: Theme,
): CanvasNode {
  const countStr = counter < 10 ? `0${counter}` : `${counter}`;
  return Column({
    gap: theme.spacing.sm,
    alignItems: Style.Align.FlexStart,
    children: [
      imageFrame(
        imageBuffer,
        { width: 150, height: 150, radius: theme.radii.md },
        theme,
      ),
      Text(`#${countStr} ${label}`, {
        fontFamily: theme.fontFamilies.body,
        fontWeight: '500',
        fontSize: theme.fontSizes.sm,
        color: theme.colors.textPrimary,
      }),
    ],
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export async function createCollage(
  images: Buffer[],
  chartNames: string[],
  name: string,
  type: string,
  period: string = 'overall',
  options?: { theme?: Theme },
): Promise<Buffer> {
  const theme = options?.theme ?? defaultTheme;

  if (images.length === 0 || chartNames.length === 0) {
    throw new Error('createCollage requires at least one image and name');
  }

  const [firstImage, ...restImages] = images;
  const [firstName, ...restNames] = chartNames;

  const gridCells = restImages.map((buf, i) =>
    gridCell(buf, restNames[i] ?? '', i + 2, theme),
  );
  const gridRows = chunk(gridCells, 3).map((cells) =>
    Row({ gap: theme.spacing.md, children: cells }),
  );

  return render(
    [
      card(
        [
          Column({
            gap: theme.spacing.xs,
            alignItems: Style.Align.FlexStart,
            children: [
              heroText(name.toUpperCase(), undefined, theme),
              heroText(`TOP ${type.toUpperCase()}`, { size: 'xl' }, theme),
              labelText(
                parsePeriodMessage(period),
                { letterSpacing: 1.5 },
                theme,
              ),
            ],
          }),
          Column({
            gap: theme.spacing.sm,
            alignItems: Style.Align.Center,
            children: [
              imageFrame(
                firstImage,
                { width: 320, height: 320, radius: theme.radii.lg },
                theme,
              ),
              Text(`#01 ${firstName}`, {
                fontFamily: theme.fontFamilies.body,
                fontWeight: '600',
                fontSize: theme.fontSizes.lg,
                color: theme.colors.textPrimary,
              }),
            ],
          }),
          panel(
            gridRows,
            { padding: theme.spacing.md, gap: theme.spacing.md },
            theme,
          ),
        ],
        theme,
      ),
    ],
    { width: 520 },
  );
}
