import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoomConnectionContext } from '../../shared/RoomConnectionProvider';
import type {
  BingoCard,
  BingoGameEndPayload,
  BingoInitPayload,
  BingoNumberDrawnPayload,
} from '../types';
import { BingoSpeedBoardCanvas } from './BingoSpeedBoardCanvas';

// Renders Bingo Speed inside a multiplayer Room view — driven by
// RoomConnectionContext instead of BingoSpeedCanvas's own useColyseusRoom
// call, reusing the extracted BingoSpeedBoardCanvas presentational
// component. The Claim Bingo button is gated on `ctx.role`, not just
// `cardLoaded` the way the standalone BingoSpeedCanvas is: the server sends
// `init { card: null }` for a non-player, but the standalone code sets
// `cardLoaded = true` unconditionally on any 'init', so a spectator there
// would see an enabled Claim Bingo button — a real client-side gap this
// room path fixes (the standalone path itself is unaffected in practice
// now, since 'multi' mode is redirected to the Rooms lobby and 'single'
// mode never has spectators).
export function BingoSpeedRoomBoard() {
  const ctx = useRoomConnectionContext();
  const { t } = useTranslation(['bingo-speed', 'common']);
  const [card, setCard] = useState<BingoCard | null>(null);
  const [drawnNumbers, setDrawnNumbers] = useState<Set<number>>(new Set());
  const [cardLoaded, setCardLoaded] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((message) => {
      if (message.type === 'init') {
        const payload = message.payload as BingoInitPayload;
        setCard(payload.card);
        setDrawnNumbers(new Set(payload.state?.drawnNumbers ?? []));
        setCardLoaded(true);
      } else if (message.type === 'number_drawn') {
        const payload = message.payload as BingoNumberDrawnPayload;
        setDrawnNumbers((prev) => new Set(prev).add(payload.number));
      } else if (message.type === 'game_end') {
        setWinner((message.payload as BingoGameEndPayload).winner ?? null);
      }
    });
  }, [ctx]);

  const role = ctx?.role ?? null;
  const canClaim = cardLoaded && role !== 'spectator' && role !== 'queued';

  const claimBingo = useCallback(() => {
    ctx?.send({ type: 'claim_bingo' });
  }, [ctx]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-4 sm:p-6">
      <div className="relative flex items-center justify-center overflow-hidden border border-marquinhos-border bg-marquinhos-bg">
        <BingoSpeedBoardCanvas card={card} drawnNumbers={drawnNumbers} />
        {!cardLoaded && (
          <div className="font-pixel animate-pong-blink absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-marquinhos-text">
            {t('bingo-speed:loadingCard')}
          </div>
        )}
        {winner !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-marquinhos-bg/90">
            <div className="font-pixel text-2xl tracking-[0.24em] text-marquinhos-accent">
              {t('bingo-speed:bingoBanner')}
            </div>
            <div className="text-lg font-semibold text-marquinhos-text">
              {winner === ctx?.currentUserId
                ? t('bingo-speed:youWon')
                : t('bingo-speed:gameOver')}
            </div>
          </div>
        )}
      </div>

      {winner === null && (
        <button
          type="button"
          className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-6 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover disabled:cursor-not-allowed disabled:bg-marquinhos-panel disabled:text-marquinhos-text-disabled"
          disabled={!canClaim}
          onClick={claimBingo}
        >
          {t('bingo-speed:claimBingo')}
        </button>
      )}
    </div>
  );
}
