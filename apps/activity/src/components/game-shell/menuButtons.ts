// The two button roles the whole app draws from, plus the one back
// affordance. MenuAction is the full-width menu-row form of the same design;
// these are the compact form for buttons that sit inside a board or an
// end-of-match row, where a full-width row with an arrow would not fit.
const menuButtonBase =
  'notch-6 cursor-pointer border px-5 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-50';

export const menuButtonPrimary = `${menuButtonBase} border-marquinhos-accent bg-marquinhos-accent text-marquinhos-bg hover:border-marquinhos-accent-hover hover:bg-marquinhos-accent-hover`;

export const menuButtonSecondary = `${menuButtonBase} border-marquinhos-border bg-marquinhos-panel text-marquinhos-text hover:border-marquinhos-accent hover:text-marquinhos-accent`;

// Leaving where you are: the header chip, and the same chip floating over a
// board. Quieter than a menu button — it never competes with the primary.
export const backChipClass =
  'notch-6 cursor-pointer border border-marquinhos-border bg-marquinhos-panel px-4 py-2 text-xs whitespace-nowrap uppercase tracking-[0.2em] text-marquinhos-text-dim hover:border-marquinhos-accent hover:text-marquinhos-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-50';
