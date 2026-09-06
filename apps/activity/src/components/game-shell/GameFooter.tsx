import type { ReactNode } from 'react';

export interface GameFooterProps {
  children?: ReactNode;
}

export function GameFooter({ children }: GameFooterProps) {
  if (!children) return null;

  return (
    <footer className="flex items-center justify-between gap-4 border-t border-marquinhos-border bg-black/10 px-4 py-3 sm:px-6">
      {children}
    </footer>
  );
}
