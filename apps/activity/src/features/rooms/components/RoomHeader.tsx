import { GAME_REGISTRY } from '@/games/registry';
import { getParticipantDisplayNames } from '@/platform/discord/participants';
import { useRoomConnectionContext } from '@/platform/realtime/colyseus/RoomConnectionContext';
import {
  ACTION_REJECTED,
  parseMessage,
} from '@marquinhos/contracts/activity/protocol';
import {
  isQueueEligible,
  roomServerMessageSchema,
  type RoomClientMessage,
} from '@marquinhos/contracts/activity/room';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface RoomHeaderProps {
  onLeave: () => void;
}

export function RoomHeader({ onLeave }: RoomHeaderProps) {
  const { t } = useTranslation(['common', 'games', 'rooms']);
  const ctx = useRoomConnectionContext();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [rejection, setRejection] = useState<string | null>(null);

  useEffect(() => {
    getParticipantDisplayNames().then(setNames);
  }, []);

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((message) => {
      if (message.type !== ACTION_REJECTED) return;
      const parsed = parseMessage(roomServerMessageSchema, message);
      setRejection(
        parsed?.type === ACTION_REJECTED
          ? parsed.payload.error
          : t('rooms:actionRejected'),
      );
      const timer = setTimeout(() => setRejection(null), 3000);
      return () => clearTimeout(timer);
    });
  }, [ctx, t]);

  const roomState = ctx?.roomState ?? null;
  const isHost = ctx?.isHost ?? false;
  const role = ctx?.role ?? null;
  const queueEligible = roomState ? isQueueEligible(roomState.game) : false;
  const queueHasWaiters =
    roomState?.members.some((m) => m.role === 'queued') ?? false;
  const matchInProgress = roomState?.matchInProgress ?? false;

  function send(message: RoomClientMessage) {
    ctx?.send(message);
  }

  return (
    <header className="flex flex-col gap-2 border-b border-marquinhos-border bg-black/10 px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="font-pixel text-sm tracking-[0.28em] text-marquinhos-accent sm:text-base">
            {roomState ? t(`games:${roomState.game}.name`) : t('rooms:title')}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isHost && queueEligible && (
            <label className="flex items-center gap-2 text-xs text-marquinhos-text-dim">
              <input
                type="checkbox"
                checked={roomState?.queueEnabled ?? false}
                onChange={(event) =>
                  send({
                    type: 'toggle_queue',
                    payload: { enabled: event.target.checked },
                  })
                }
              />
              {t('rooms:enableQueue')}
            </label>
          )}
          {isHost && (
            <button
              type="button"
              disabled={matchInProgress}
              className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-4 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim transition disabled:opacity-50"
              onClick={() => setPickerOpen((open) => !open)}
            >
              {t('rooms:switchGame')}
            </button>
          )}
          {role === 'player' && !matchInProgress && queueHasWaiters && (
            <button
              type="button"
              className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-4 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim transition"
              onClick={() => send({ type: 'rotate_seat' })}
            >
              {t('rooms:giveUpSeat')}
            </button>
          )}
          <button
            type="button"
            className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-4 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim transition"
            onClick={onLeave}
          >
            {t('rooms:leaveRoom')}
          </button>
        </div>
      </div>

      {pickerOpen && (
        <div className="flex flex-wrap gap-2">
          {GAME_REGISTRY.filter((g) => g.status === 'PLAY').map((g) => (
            <button
              key={g.id}
              type="button"
              className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-3 py-1.5 text-xs text-marquinhos-text transition hover:border-marquinhos-border-hover"
              onClick={() => {
                send({ type: 'switch_game', payload: { game: g.id } });
                setPickerOpen(false);
              }}
            >
              {t(`games:${g.id}.name`)}
            </button>
          ))}
        </div>
      )}

      {roomState && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-marquinhos-text-dim">
          {roomState.members.map((member) => (
            <span key={member.userId}>
              {names[member.userId] ?? member.userId.slice(0, 8)}
              {member.userId === roomState.hostUserId
                ? ` (${t('rooms:hostBadge')})`
                : ''}{' '}
              — {t(`rooms:${member.role}Role`)}
            </span>
          ))}
        </div>
      )}

      {rejection && (
        <div className="text-xs text-marquinhos-danger" role="alert">
          {rejection}
        </div>
      )}
    </header>
  );
}
