import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import './keycap.css';
import type { KeyboardKey, KeyboardKeyStyle, KeyboardProps } from './types';

const DEFAULT_STYLE: KeyboardKeyStyle = {
  bg: '#818384',
  text: '#1C1C1E',
  base: ['#6e6e6e', '#5a5a5a'],
  cap: ['#6e6e6e', '#5a5a5a'],
  surface: ['#555555', '#6e6e6e'],
};

function KeyButton({
  keyData,
  disabled,
  pressed,
  onClick,
}: {
  keyData: KeyboardKey;
  disabled: boolean;
  pressed: boolean;
  onClick: () => void;
}) {
  const colors = keyData.style ?? DEFAULT_STYLE;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseDown={(event) => event.preventDefault()}
      style={
        {
          '--base-from': colors.base[0],
          '--base-to': colors.base[1],
          '--cap-from': colors.cap[0],
          '--cap-to': colors.cap[1],
          '--surface-from': colors.surface[0],
          '--surface-to': colors.surface[1],
          '--key-text': colors.text,
        } as CSSProperties
      }
      className={cn(
        'keycap border-none transition-[scale] duration-100 ease-in-out disabled:opacity-50',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        keyData.variant === 'medium' && 'keycap-medium',
        keyData.variant === 'wide' && 'keycap-wide',
        pressed && 'keycap-pressed',
      )}
    >
      <span className="keycap-cap border-none transition-[scale] duration-100 ease-in-out">
        <span className="keycap-text rounded-[50px] font-bold uppercase">
          {keyData.label}
        </span>
      </span>
    </button>
  );
}

export function Keyboard({
  rows,
  pressedKeys,
  disabled,
  onKey,
}: KeyboardProps) {
  return (
    <div className="termo-keyboard">
      {rows.map((row, index) => (
        <div
          key={row.map(({ id }) => id).join('-')}
          className={cn(
            'termo-keyboard-row',
            index === rows.length - 2 && 'termo-keyboard-row-home',
            index === rows.length - 1 && 'termo-keyboard-row-bottom',
          )}
        >
          {row.map((keyData) => (
            <KeyButton
              key={keyData.id}
              keyData={keyData}
              pressed={pressedKeys.has(keyData.id)}
              disabled={disabled}
              onClick={() => onKey(keyData.id)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
