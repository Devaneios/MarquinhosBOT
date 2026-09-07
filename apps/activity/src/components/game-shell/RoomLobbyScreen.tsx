import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiscordIdentity } from '../../discordAuth.ts';
import type { GameId } from '../../games/gameId';
import { GAME_REGISTRY } from '../../games/registry';
import {
  createRoom,
  fetchWsSessionToken,
  getAvailableRooms,
  type RoomListing,
} from '../../games/shared/activitySession';
import { isQueueEligible } from '../../games/shared/queueEligibility';
import { getParticipantDisplayNames } from '../../lib/discordParticipants';

export interface RoomReadyInfo {
  roomId: string;
  token: string;
  roomKey: string;
  game: GameId;
  queueEnabled: boolean;
}

export interface RoomLobbyScreenProps {
  identity: DiscordIdentity;
  preselectedGame?: GameId;
  onRoomReady: (room: RoomReadyInfo) => void;
  onBack: () => void;
}

export function RoomLobbyScreen({
  identity,
  preselectedGame,
  onRoomReady,
  onBack,
}: RoomLobbyScreenProps) {
  const { t } = useTranslation(['common', 'games', 'rooms']);
  const [rooms, setRooms] = useState<RoomListing[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameId | null>(
    preselectedGame ?? null,
  );
  const [queueEnabled, setQueueEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionRejected, setActionRejected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getAvailableRooms(identity),
      getParticipantDisplayNames(),
    ]).then(([roomList, participantNames]) => {
      if (cancelled) return;
      setRooms(roomList);
      setNames(participantNames);
    });
    return () => {
      cancelled = true;
    };
  }, [identity]);

  async function handleJoin(room: RoomListing) {
    setBusy(true);
    setActionRejected(false);
    try {
      const session = await fetchWsSessionToken({
        game: room.game,
        mode: 'multi',
        identity,
        extra: { roomId: room.roomId },
      });
      onRoomReady({
        roomId: room.roomId,
        token: session.token,
        roomKey: session.roomKey,
        game: room.game,
        queueEnabled: room.queueEnabled,
      });
    } catch {
      setActionRejected(true);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    if (!selectedGame) return;
    setBusy(true);
    setActionRejected(false);
    try {
      const room = await createRoom({
        game: selectedGame,
        identity,
        queueEnabled,
      });
      onRoomReady({
        roomId: room.roomId,
        token: room.token,
        roomKey: room.roomKey,
        game: selectedGame,
        queueEnabled,
      });
    } catch {
      setActionRejected(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="notch-8 flex w-full max-w-2xl flex-col gap-5 border border-marquinhos-border bg-marquinhos-panel px-8 py-8 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
        <div className="font-pixel text-lg tracking-[0.24em] text-marquinhos-accent">
          {t('rooms:title')}
        </div>

        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto text-left">
          {rooms && rooms.length === 0 && (
            <div className="text-sm text-marquinhos-text-dim">
              {t('rooms:noRoomsOpen')}
            </div>
          )}
          {rooms?.map((room) => (
            <button
              key={room.roomId}
              type="button"
              disabled={busy}
              className="notch-6 flex items-center justify-between border border-marquinhos-border bg-marquinhos-bg px-4 py-3 text-left text-sm text-marquinhos-text transition hover:border-marquinhos-border-hover disabled:opacity-50"
              onClick={() => handleJoin(room)}
            >
              <span>
                <span className="font-semibold">
                  {t(`games:${room.game}.name`)}
                </span>
                {' — '}
                {room.roomId} ·{' '}
                {names[room.hostUserId] ?? room.hostUserId.slice(0, 8)}
              </span>
              <span className="text-xs text-marquinhos-text-dim">
                {t('rooms:playerCount', { count: room.playerCount })}
                {room.spectatorCount > 0
                  ? ` · ${t('rooms:spectatorCount', { count: room.spectatorCount })}`
                  : ''}
                {room.queueEnabled
                  ? ` · ${t('rooms:queueDepth', { count: room.queueDepth })}`
                  : ''}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3">
          {selectedGame ? (
            <>
              {isQueueEligible(selectedGame) && (
                <label className="flex items-center gap-2 text-sm text-marquinhos-text">
                  <input
                    type="checkbox"
                    checked={queueEnabled}
                    onChange={(event) => setQueueEnabled(event.target.checked)}
                  />
                  {t('rooms:enableQueue')}
                </label>
              )}
              <button
                type="button"
                disabled={busy}
                className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover disabled:opacity-50"
                onClick={handleCreate}
              >
                {t('rooms:createRoom')}
              </button>
            </>
          ) : pickerOpen ? (
            <div className="flex flex-wrap justify-center gap-2">
              {GAME_REGISTRY.filter((g) => g.status === 'PLAY').map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-4 py-2 text-sm text-marquinhos-text transition hover:border-marquinhos-border-hover"
                  onClick={() => setSelectedGame(g.id)}
                >
                  {t(`games:${g.id}.name`)}
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
              onClick={() => setPickerOpen(true)}
            >
              {t('rooms:createRoom')}
            </button>
          )}

          {actionRejected && (
            <div className="text-xs text-marquinhos-danger">
              {t('rooms:actionRejected')}
            </div>
          )}

          <button
            type="button"
            className="notch-6 border border-marquinhos-border bg-transparent px-5 py-3 text-sm font-semibold text-marquinhos-text transition hover:bg-marquinhos-panel"
            onClick={onBack}
          >
            {t('common:back')}
          </button>
        </div>
      </div>
    </div>
  );
}
