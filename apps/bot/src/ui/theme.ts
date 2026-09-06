export type TileColors = {
  bg: string;
  text: string;
  side: string;
  highlight: string;
};

export type Theme = {
  colors: {
    bg: string;
    surface: string;
    card: string;
    border: string;
    textPrimary: string;
    textMuted: string;
    accent: string;
    correct: TileColors;
    present: TileColors;
    absent: TileColors;
    unused: TileColors;
  };
  radii: { sm: number; md: number; lg: number };
  spacing: { xs: number; sm: number; md: number; lg: number };
  fontSizes: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    display: number;
  };
  fontFamilies: { body: string; heading: string };
};

export const defaultTheme: Theme = {
  colors: {
    bg: '#121213',
    surface: '#0e0e0f',
    card: '#1c1b1c',
    border: 'rgba(255,255,255,0.05)',
    textPrimary: '#E8E8E8',
    textMuted: '#818384',
    accent: '#98d68f',
    correct: {
      bg: '#588157',
      text: '#E8E8E8',
      side: '#3d5c3b',
      highlight: '#6a9b68',
    },
    present: {
      bg: '#C0A054',
      text: '#1C1C1E',
      side: '#8a7340',
      highlight: '#d4b86a',
    },
    absent: {
      bg: '#3A3A3C',
      text: '#E8E8E8',
      side: '#2a2a2c',
      highlight: '#4a4a4e',
    },
    unused: {
      bg: '#818384',
      text: '#1C1C1E',
      side: '#5c5d5e',
      highlight: '#969798',
    },
  },
  radii: { sm: 4, md: 8, lg: 12 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
  fontSizes: { xs: 9, sm: 10, md: 12, lg: 14, xl: 18, display: 24 },
  fontFamilies: { body: 'Inter', heading: 'Space Grotesk' },
};
