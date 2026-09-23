import {
  serverMessageSchema,
  type RpsClientMessage,
  type RpsPick,
} from '@marquinhos/contracts/activity/games/rockPaperScissors';
import { parseMessage } from '@marquinhos/contracts/activity/protocol';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoomConnectionContext } from '../../shared/RoomConnectionProvider';
import {
  advanceAfterRoundResult,
  applyRpsMessage,
  initialRpsView,
  ROUND_RESULT_DISPLAY_MS,
} from '../rpsMessages';
import { PickButton } from './RpsBoard';

// Renders Rock-Paper-Scissors inside a multiplayer Room view — driven by
// RoomConnectionContext instead of RpsBoard's own useColyseusRoom call.
// Unlike RpsBoard, gates picking on `role` explicitly: the server already
// assigns a spectator playerId: null, but RpsBoard's own disabled condition
// (`roundState.submitted.includes(playerId)`) never matches null, so a
// spectator could optimistically "pick" client-side before the server's
// rejection came back — a real UX gap this room path fixes rather than
// carries over.
export function RpsRoomBoard() {
  const ctx = useRoomConnectionContext();
  const { t } = useTranslation(['rock-paper-scissors', 'common']);
  const [view, setView] = useState(initialRpsView);
  const { phase, roundState, myPick, error } = view;

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((raw) => {
      const message = parseMessage(serverMessageSchema, raw);
      if (message) setView((current) => applyRpsMessage(current, message));
    });
  }, [ctx]);

  useEffect(() => {
    if (phase !== 'round_result') return;
    const timer = setTimeout(
      () => setView(advanceAfterRoundResult),
      ROUND_RESULT_DISPLAY_MS,
    );
    return () => clearTimeout(timer);
  }, [phase]);

  const role = ctx?.role ?? null;
  const canPick = role !== 'spectator' && role !== 'queued';

  const handlePick = (pick: RpsPick) => {
    if (!canPick || myPick || !roundState) return;
    setView((current) => ({ ...current, myPick: pick }));
    ctx?.send({ type: 'pick', payload: { pick } } satisfies RpsClientMessage);
  };

  if (!roundState) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-sm text-marquinhos-text-dim">
        {t('common:connecting')}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4 sm:p-6">
      {phase === 'playing' && (
        <div className="flex flex-col gap-4">
          <div className="text-center text-sm uppercase tracking-[0.2em] text-marquinhos-text-dim">
            {t('chooseMove')}
          </div>
          <div className="flex justify-center gap-3">
            {(['rock', 'paper', 'scissors'] as const).map((pick) => (
              <PickButton
                key={pick}
                pick={pick}
                onClick={() => handlePick(pick)}
                disabled={!canPick || myPick !== null}
                isMyPick={myPick === pick}
                isOtherPick={false}
                isWinner={false}
              />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="notch-6 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-3 text-center text-sm text-marquinhos-danger">
          {error}
        </div>
      )}
    </div>
  );
}
