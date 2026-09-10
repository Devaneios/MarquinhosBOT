import { useEffect, useMemo, useRef } from 'react';
import { SimpleKeyboard } from 'simple-keyboard';
import { cn } from '../../lib/cn';
import './keycap.css';
import type { KeyboardKeyStyle, KeyboardProps } from './types';

const DEFAULT_STYLE: KeyboardKeyStyle = {
  bg: '#818384',
  text: '#1C1C1E',
  base: ['#6e6e6e', '#5a5a5a'],
  cap: ['#6e6e6e', '#5a5a5a'],
  surface: ['#555555', '#6e6e6e'],
};

const SPECIAL_TOKENS: Record<string, string> = {
  Backspace: '{bksp}',
  Enter: '{enter}',
};

function tokenForKeyId(id: string): string {
  const token = SPECIAL_TOKENS[id];
  if (token) return token;
  if (id.length !== 1) {
    throw new Error(`Keyboard: no layout token mapped for key id "${id}"`);
  }
  return id;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function styleToCssVars(colors: KeyboardKeyStyle): string {
  return [
    `--base-from:${colors.base[0]}`,
    `--base-to:${colors.base[1]}`,
    `--cap-from:${colors.cap[0]}`,
    `--cap-to:${colors.cap[1]}`,
    `--surface-from:${colors.surface[0]}`,
    `--surface-to:${colors.surface[1]}`,
    `--key-text:${colors.text}`,
  ].join(';');
}

export function Keyboard({
  rows,
  pressedKeys,
  disabled,
  onKey,
}: KeyboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<SimpleKeyboard | null>(null);

  const tokenToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      for (const key of row) {
        map.set(tokenForKeyId(key.id), key.id);
      }
    }
    return map;
  }, [rows]);

  const layout = useMemo(
    () => ({
      default: rows.map((row) =>
        row.map((key) => tokenForKeyId(key.id)).join(' '),
      ),
    }),
    [rows],
  );

  const display = useMemo(() => {
    const result: Record<string, string> = {};
    for (const row of rows) {
      for (const key of row) {
        result[tokenForKeyId(key.id)] =
          `<span class="keycap-cap"><span class="keycap-text">${escapeHtml(key.label)}</span></span>`;
      }
    }
    return result;
  }, [rows]);

  const buttonTheme = useMemo(() => {
    const base: string[] = [];
    const medium: string[] = [];
    const wide: string[] = [];
    const pressed: string[] = [];
    for (const row of rows) {
      for (const key of row) {
        const token = tokenForKeyId(key.id);
        base.push(token);
        if (key.variant === 'medium') medium.push(token);
        if (key.variant === 'wide') wide.push(token);
        if (pressedKeys.has(key.id)) pressed.push(token);
      }
    }
    return [
      { class: 'keycap', buttons: base.join(' ') },
      medium.length > 0 && {
        class: 'keycap-medium',
        buttons: medium.join(' '),
      },
      wide.length > 0 && { class: 'keycap-wide', buttons: wide.join(' ') },
      pressed.length > 0 && {
        class: 'keycap-pressed',
        buttons: pressed.join(' '),
      },
    ].filter((entry): entry is { class: string; buttons: string } =>
      Boolean(entry),
    );
  }, [rows, pressedKeys]);

  const buttonAttributes = useMemo(
    () => [
      ...rows.flatMap((row) =>
        row.map((key) => ({
          attribute: 'style',
          value: styleToCssVars(key.style ?? DEFAULT_STYLE),
          buttons: tokenForKeyId(key.id),
        })),
      ),
      ...rows.flatMap((row) =>
        row
          .filter((key) => !key.variant)
          .map((key) => ({
            attribute: 'data-preview',
            value: key.label,
            buttons: tokenForKeyId(key.id),
          })),
      ),
    ],
    [rows],
  );

  const onKeyPress = useMemo(
    () => (button: string) => {
      if (disabled) return;
      onKey(tokenToId.get(button) ?? button);
    },
    [disabled, onKey, tokenToId],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const instance = new SimpleKeyboard(containerRef.current, {
      useButtonTag: true,
      preventMouseDownDefault: true,
      disableButtonHold: true,
    });
    keyboardRef.current = instance;
    return () => {
      instance.destroy();
      keyboardRef.current = null;
    };
  }, []);

  useEffect(() => {
    keyboardRef.current?.setOptions({
      layout,
      display,
      buttonTheme,
      buttonAttributes,
      onKeyPress,
    });
  }, [layout, display, buttonTheme, buttonAttributes, onKeyPress]);

  return (
    <div className={cn('termo-keyboard', disabled && 'keyboard-disabled')}>
      <div ref={containerRef} className="simple-keyboard" />
    </div>
  );
}
