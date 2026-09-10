import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface MenuPanelProps {
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}

// Hub card chrome: the notched border/background is an isolated -z-10 layer
// so padding lives on the content and the clip-path never eats a child.
export function MenuPanel({ children, className, labelledBy }: MenuPanelProps) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cn('relative isolate min-w-0', className)}
    >
      <div
        aria-hidden="true"
        className="notch-8 pointer-events-none absolute inset-0 -z-10 border border-marquinhos-border bg-marquinhos-panel"
      />
      {children}
    </section>
  );
}
