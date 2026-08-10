import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/cn';
import type { Card } from '../core/types';

const RED_SUITS = new Set(['♥', '♦', 'copas', 'ouros']);

const SHELL =
  'notch-6 flex h-[118px] w-[82px] flex-col justify-between border px-2.5 py-2 shadow-[0_12px_30px_rgba(0,0,0,0.28)] transition-transform duration-150';

export function CardFace({
  card,
  selected,
}: {
  card: Card;
  selected?: boolean;
}) {
  const red = card.suit ? RED_SUITS.has(card.suit) : false;
  return (
    <div
      className={cn(
        SHELL,
        red
          ? 'border-rose-400/40 bg-rose-950 text-rose-100'
          : 'border-slate-400/30 bg-slate-950 text-slate-100',
        selected
          ? 'scale-[1.04] ring-2 ring-marquinhos-accent ring-offset-2 ring-offset-marquinhos-bg'
          : 'hover:-translate-y-1',
      )}
    >
      <div className="flex items-start justify-between text-left">
        <div className="leading-none">
          <div className="text-[14px] font-bold">{card.rank}</div>
          <div className="text-[11px] opacity-80">{card.suit}</div>
        </div>
      </div>
      <div
        className={cn(
          'text-center text-[30px] leading-none',
          red ? 'text-rose-200' : 'text-slate-200',
        )}
      >
        {card.suit}
      </div>
      <div className="flex items-end justify-between text-right text-[10px] opacity-70">
        <div>{card.suit}</div>
        <div>{card.rank}</div>
      </div>
    </div>
  );
}

// What a card the server refused to reveal looks like. Hidden cards keep their
// position in a zone, so rendering a back in place preserves the real shape of
// the pile (how many cards, and where the face-up ones sit among them).
export function CardBack({ small }: { small?: boolean }) {
  const { t } = useTranslation('cards');
  return (
    <div
      className={cn(
        small
          ? 'notch-6 h-[64px] w-[44px] border shadow-[0_8px_18px_rgba(0,0,0,0.24)]'
          : SHELL,
        'border-marquinhos-border bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.06)_0_6px,transparent_6px_12px)] bg-marquinhos-panel',
      )}
      aria-label={t('cards:hiddenCardAriaLabel')}
    />
  );
}
