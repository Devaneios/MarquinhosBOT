import { cn } from '../../lib/cn';

export function ActionArrow() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      className="shrink-0"
    >
      <path
        d="M3 10h13m-5-5 5 5-5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export interface MenuActionProps {
  label: string;
  description?: string;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  onSelect: () => void;
}

// The Hub's play link as a button: one row, one job, the arrow marking it as
// a way forward. Every choice on every menu is one of these.
export function MenuAction({
  label,
  description,
  variant = 'secondary',
  disabled = false,
  onSelect,
}: MenuActionProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'inline-flex min-h-12 w-full cursor-pointer items-center justify-between gap-4 rounded-sm border px-5 py-3 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marquinhos-accent motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary'
          ? 'border-marquinhos-accent bg-marquinhos-accent text-marquinhos-bg hover:border-marquinhos-accent-hover hover:bg-marquinhos-accent-hover'
          : 'border-marquinhos-border text-marquinhos-text hover:border-marquinhos-accent hover:text-marquinhos-accent',
      )}
    >
      <span className="min-w-0">
        {label}
        {description && (
          <span
            className={cn(
              'mt-1 block text-xs font-normal leading-5',
              variant === 'primary'
                ? 'text-marquinhos-bg/75'
                : 'text-marquinhos-text-dim',
            )}
          >
            {description}
          </span>
        )}
      </span>
      <ActionArrow />
    </button>
  );
}
