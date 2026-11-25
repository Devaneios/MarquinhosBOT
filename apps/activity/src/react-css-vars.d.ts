import 'react';

declare module 'react' {
  interface CSSProperties {
    '--banner-exit-time'?: string;
    '--orbit-radius'?: string;
    '--order'?: number;
    '--tile-bg'?: string;
    '--tile-fg'?: string;
  }
}
