import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/cn';
import type { CurrentRowProps } from '../types';

export function CurrentRow({
  letters,
  activeIndex,
  wordLength,
  shake,
  disabled,
  inputRefs,
  onFocusCell,
  onKeyDownCell,
}: CurrentRowProps) {
  const { t } = useTranslation('wordle');
  return (
    <div
      className={cn('flex gap-1.5 sm:gap-2', shake && 'animate-termo-shake')}
    >
      {Array.from({ length: wordLength }, (_, index) => (
        <input
          key={index}
          ref={(element) => {
            inputRefs.current[index] = element;
          }}
          value={(letters[index] ?? '').toUpperCase()}
          readOnly
          disabled={disabled}
          onFocus={() => onFocusCell(index)}
          onKeyDown={(event) => onKeyDownCell(index, event)}
          onClick={() => onFocusCell(index)}
          inputMode="text"
          autoComplete="off"
          aria-label={t('letterAriaLabel', { position: index + 1 })}
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-md border bg-transparent text-center font-pixel text-lg font-bold uppercase caret-transparent sm:h-12 sm:w-12',
            'cursor-default appearance-none outline-none',
            letters[index]
              ? 'border-marquinhos-border-hover'
              : 'border-marquinhos-border/60',
            index === activeIndex &&
              !disabled &&
              'border-marquinhos-blue ring-2 ring-inset ring-marquinhos-blue',
          )}
        />
      ))}
    </div>
  );
}
