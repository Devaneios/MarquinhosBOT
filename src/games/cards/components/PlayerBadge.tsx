import { cn } from '../../../lib/cn';

export function PlayerBadge({
  name,
  subtitle,
  meta,
  isLocal,
  active,
}: {
  name: string;
  subtitle: string;
  meta?: string;
  isLocal?: boolean;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        'notch-6 min-w-0 border px-3 py-2 text-left shadow-[0_10px_24px_rgba(0,0,0,0.18)]',
        isLocal
          ? 'border-marquinhos-accent/50 bg-marquinhos-accent/10'
          : 'border-marquinhos-border bg-marquinhos-panel',
        active && 'border-marquinhos-green/70 ring-2 ring-marquinhos-green/40',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-marquinhos-text">
            {name}
          </div>
          <div className="text-[11px] text-marquinhos-text-dim">{subtitle}</div>
        </div>
        {meta && (
          <div className="text-right text-[11px] text-marquinhos-text-dim">
            {meta}
          </div>
        )}
      </div>
    </div>
  );
}
