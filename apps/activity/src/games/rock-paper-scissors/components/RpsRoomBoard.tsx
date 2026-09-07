import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoomConnectionContext } from '../../shared/RoomConnectionProvider';
import type {
  GamePhase,
  RoundResult,
  RpsErrorPayload,
  RpsPick,
  RpsState,
} from '../types';
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
  const [phase, setPhase] = useState<GamePhase>('waiting');
  const [roundState, setRoundState] = useState<RpsState | null>(null);
  const [myPick, setMyPick] = useState<RpsPick | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((message) => {
      // 'init' carries a playerId, but role gating below already comes from
      // RoomConnectionContext (kept live across rotate_seat) — no need to
      // track a second, message-derived copy of the same fact.
      if (message.type === 'game_start') {
        setPhase('playing');
      } else if (message.type === 'round_state') {
        setRoundState(message.payload as RpsState);
      } else if (message.type === 'round_result') {
        const payload = message.payload as RoundResult;
        setPhase('round_result');
        setMyPick(null);
        setTimeout(() => {
          setRoundState((prev) =>
            prev && prev.round < Math.ceil(payload.round + 1)
              ? { ...prev, round: payload.round + 1 }
              : prev,
          );
          setPhase('playing');
        }, 2000);
      } else if (message.type === 'match_end') {
        setPhase('match_end');
      } else if (message.type === 'error') {
        const payload = message.payload as RpsErrorPayload;
        setError(payload.message);
      }
    });
  }, [ctx]);

  const role = ctx?.role ?? null;
  const canPick = role !== 'spectator' && role !== 'queued';

  const handlePick = (pick: RpsPick) => {
    if (!canPick || myPick || !roundState) return;
    setMyPick(pick);
    ctx?.send({ type: 'pick', payload: { pick } });
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
