export type KeyboardKeyVariant = 'medium' | 'wide' | 'space';

export interface KeyboardKeyStyle {
  bg: string;
  text: string;
  base: [string, string];
  cap: [string, string];
  surface: [string, string];
}

export interface KeyboardKey {
  id: string;
  label: string;
  variant?: KeyboardKeyVariant;
  style?: KeyboardKeyStyle;
  sound?: string;
}

export interface KeyboardProps {
  rows: KeyboardKey[][];
  pressedKeys: ReadonlySet<string>;
  disabled: boolean;
  onKey: (key: string) => void;
}
