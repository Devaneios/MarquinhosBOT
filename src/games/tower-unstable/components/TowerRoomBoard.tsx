import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoomConnectionContext } from '../../shared/RoomConnectionProvider';
import type { TowerState } from '../types';
import { TowerBoardCanvas } from './TowerBoardCanvas';

// Renders Tower Unstable inside a multiplayer Room view — driven by
// RoomConnectionContext instead of TowerCanvas's own useColyseusRoom call,
// reusing the extracted TowerBoardCanvas presentational component.
export function TowerRoomBoard() {
  const ctx = useRoomConnectionContext();
  const { t } = useTranslation(['tower-unstable', 'common']);
  const [state, setState] = useState<TowerState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((message) => {
      if (message.type === 'game_ready' || message.type === 'state_update') {
        setState((message.payload as { state: TowerState }).state);
      } else if (message.type === 'action_rejected') {
        setError((message.payload as { error: string }).error);
      }
    });
  }, [ctx]);

  const userId = ctx?.currentUserId ?? '';

  return (
    <div className="flex flex-1 flex-col items-center gap-4 p-4">
      <div className="relative border border-marquinhos-border bg-marquinhos-bg">
        <TowerBoardCanvas
          state={state}
          userId={userId}
          role={ctx?.role ?? null}
          onPull={(level, position) =>
            ctx?.send({ type: 'pull', payload: { level, position } })
          }
        />
        {!state && (
          <div className="font-pixel animate-pong-blink absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-marquinhos-text">
            {t('tower-unstable:waitingOpponent')}
          </div>
        )}
      </div>

      {state?.lastPull && (
        <div className="text-xs text-marquinhos-text-dim">
          {t('tower-unstable:lastPullInstability', {
            percent: (state.lastPull.instability * 100).toFixed(1),
          })}
        </div>
      )}

      {error && <div className="text-sm text-marquinhos-danger">{error}</div>}
    </div>
  );
}
