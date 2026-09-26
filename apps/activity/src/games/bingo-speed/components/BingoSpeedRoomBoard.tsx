import { useRoomConnectionContext } from '@/platform/realtime/colyseus/RoomConnectionContext';
import {
  serverMessageSchema,
  type BingoSpeedClientMessage,
} from '@marquinhos/contracts/activity/games/bingoSpeed';
import { parseMessage } from '@marquinhos/contracts/activity/protocol';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  applyBingoSpeedMessage,
  initialBingoSpeedView,
} from '../bingoSpeedMessages';
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
  const [view, setView] = useState(initialBingoSpeedView);
  const { card, drawnNumbers, cardLoaded, winner } = view;

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((raw) => {
      const message = parseMessage(serverMessageSchema, raw);
      if (message)
        setView((current) => applyBingoSpeedMessage(current, message));
    });
  }, [ctx]);

  const role = ctx?.role ?? null;
  const canClaim = cardLoaded && role !== 'spectator' && role !== 'queued';

  const claimBingo = useCallback(() => {
    ctx?.send({ type: 'claim_bingo' } satisfies BingoSpeedClientMessage);
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
