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
import { GameEmblem } from './GameEmblem';
import { MenuAction } from './MenuAction';
import { MenuPanel } from './MenuPanel';
import { MenuScreen } from './MenuScreen';

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
    <MenuScreen
      titleKey="brand"
      titleNs="common"
      headingKey="title"
      headingNs="rooms"
      onBack={onBack}
      backLabel={t('common:backToHub')}
    >
      <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
        <MenuPanel
          labelledBy="rooms-open-title"
          className="flex flex-col gap-4 p-5 sm:p-6"
        >
          <div className="flex items-center gap-4">
            <h2
              id="rooms-open-title"
              className="shrink-0 font-pixel text-xs leading-relaxed sm:text-sm"
            >
              {t('rooms:joinRoom')}
            </h2>
            <div
              aria-hidden="true"
              className="h-px flex-1 bg-marquinhos-border"
            />
          </div>

          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {rooms && rooms.length === 0 && (
              <p className="text-sm leading-6 text-marquinhos-text-dim">
                {t('rooms:noRoomsOpen')}
              </p>
            )}
            {rooms?.map((room) => (
              <button
                key={room.roomId}
                type="button"
                disabled={busy}
                className="flex w-full cursor-pointer flex-col items-start gap-1 rounded-sm border border-marquinhos-border px-4 py-3 text-left text-sm text-marquinhos-text hover:border-marquinhos-accent hover:text-marquinhos-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marquinhos-accent motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => handleJoin(room)}
              >
                <span className="font-semibold">
                  {t(`games:${room.game}.name`)} — {room.roomId} ·{' '}
                  {names[room.hostUserId] ?? room.hostUserId.slice(0, 8)}
                </span>
                <span className="text-xs leading-5 text-marquinhos-text-dim">
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
        </MenuPanel>

        <MenuPanel
          labelledBy="rooms-create-title"
          className="flex flex-col gap-4 p-5 sm:p-6"
        >
          <div className="flex items-center gap-4">
            <h2
              id="rooms-create-title"
              className="shrink-0 font-pixel text-xs leading-relaxed sm:text-sm"
            >
              {t('rooms:createRoom')}
            </h2>
            <div
              aria-hidden="true"
              className="h-px flex-1 bg-marquinhos-border"
            />
          </div>

          {selectedGame ? (
            <>
              <GameEmblem gameId={selectedGame} compact />
              <span className="min-w-0 font-pixel text-sm leading-relaxed break-words">
                {t(`games:${selectedGame}.name`)}
              </span>
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
              <MenuAction
                variant="primary"
                disabled={busy}
                label={t('rooms:createRoom')}
                onSelect={() => void handleCreate()}
              />
            </>
          ) : pickerOpen ? (
            <div className="flex flex-col gap-2">
              {GAME_REGISTRY.filter((g) => g.status === 'PLAY').map((g) => (
                <MenuAction
                  key={g.id}
                  label={t(`games:${g.id}.name`)}
                  onSelect={() => setSelectedGame(g.id)}
                />
              ))}
            </div>
          ) : (
            <MenuAction
              variant="primary"
              label={t('rooms:selectGame')}
              description={t('common:roomsHint')}
              onSelect={() => setPickerOpen(true)}
            />
          )}

          {actionRejected && (
            <p className="text-xs leading-5 text-marquinhos-danger">
              {t('rooms:actionRejected')}
            </p>
          )}
        </MenuPanel>
      </div>
    </MenuScreen>
  );
}
