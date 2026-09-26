import 'react';

declare module 'react' {
  interface CSSProperties {
    '--orbit-radius'?: string;
    '--order'?: number;
    '--tile-bg'?: string;
    '--tile-fg'?: string;
  }
}
