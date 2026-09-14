import { cn } from '../../../lib/cn';
import { FEEDBACK_COLORS } from '../constants';

export function WordleToggleTile({
  id,
  checked,
  disabled = false,
  onChange,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const off = FEEDBACK_COLORS.unused;
  const on = FEEDBACK_COLORS.correct;

  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-11 w-11 shrink-0 cursor-pointer border-none bg-transparent p-0 outline-none [perspective:400px]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'sm:h-12 sm:w-12',
      )}
    >
      <span
        aria-hidden="true"
        className="relative block h-full w-full [transform-style:preserve-3d] transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ transform: `rotateY(${checked ? 180 : 0}deg)` }}
      >
        <span
          className="absolute inset-0 flex items-center justify-center rounded-md border font-pixel text-lg font-bold [backface-visibility:hidden]"
          style={{
            backgroundColor: off.bg,
            color: off.text,
            borderColor: off.bg,
          }}
        >
          N
        </span>
        <span
          className="absolute inset-0 flex items-center justify-center rounded-md border font-pixel text-lg font-bold [backface-visibility:hidden] [transform:rotateY(180deg)]"
          style={{
            backgroundColor: on.bg,
            color: on.text,
            borderColor: on.bg,
          }}
        >
          S
        </span>
      </span>
    </button>
  );
}
