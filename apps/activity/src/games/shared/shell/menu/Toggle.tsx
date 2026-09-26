import { cn } from '@/shared/utils/cn';

export interface ToggleProps {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export function Toggle({
  id,
  checked,
  disabled = false,
  onChange,
}: ToggleProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'notch-4 relative h-9 w-[90px] cursor-pointer border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent disabled:cursor-not-allowed disabled:opacity-40',
        checked
          ? 'border-marquinhos-green bg-marquinhos-green/20'
          : 'border-marquinhos-border bg-marquinhos-bg',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-[26px] w-[26px] transition-[left] duration-150',
          checked
            ? 'left-[54px] bg-marquinhos-green'
            : 'left-0.5 bg-marquinhos-text-disabled',
        )}
      />
    </button>
  );
}
