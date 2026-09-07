import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EndScreen, GameHeader } from '../../../components/game-shell';
import { colyseusUrl } from '../../../lib/apiBase';
import { cn } from '../../../lib/cn';
import type { WsSession } from '../../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../../shared/useColyseusRoom';
import {
  legalEndsFor,
  type ChainEnd,
  type DominoesClientState,
  type Tile,
} from '../protocol';
import { DominoesBlockCanvas } from './DominoesBlockCanvas';

export function DominoesBlockBoard({
  session,
  selfId,
}: {
  session: WsSession;
  selfId: string;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation(['dominoes-block', 'common']);
  const [state, setState] = useState<DominoesClientState | null>(null);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [pendingEnds, setPendingEnds] = useState<ChainEnd[] | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [restartStatus, setRestartStatus] = useState<{
    votes: number;
    required: number;
  } | null>(null);
  const [restartRequested, setRestartRequested] = useState(false);
  const [disconnectedOpponent, setDisconnectedOpponent] = useState<{
    userId: string;
    timeoutMs: number;
  } | null>(null);

  const { send: roomSend, connectionState } = useColyseusRoom(
    'dominoes-block',
    session,
    colyseusUrl(),
    (message: ActivityMessage) => {
      if (message.type === 'state') {
        const payload = message.payload as DominoesClientState;
        setState(payload);
        setRejection(null);
        if (payload.winner || payload.blocked) {
          setRestartStatus(null);
          setRestartRequested(false);
        }
      } else if (message.type === 'move_rejected') {
        const payload = message.payload as { reason: string };
        setRejection(payload.reason);
      } else if (message.type === 'restart_status') {
        setRestartStatus(
          message.payload as { votes: number; required: number },
        );
      } else if (message.type === 'opponent_disconnected') {
        setDisconnectedOpponent(
          message.payload as { userId: string; timeoutMs: number },
        );
      } else if (message.type === 'opponent_reconnected') {
        setDisconnectedOpponent(null);
      }
    },
  );

  const sendPlay = useCallback(
    (tile: Tile, end?: ChainEnd) => {
      roomSend({ type: 'play', payload: end ? { tile, end } : { tile } });
      setSelectedTile(null);
      setPendingEnds(null);
    },
    [roomSend],
  );

  const handleTileClick = useCallback(
    (tile: Tile) => {
      if (!state || state.currentPlayer !== selfId) return;
      if (state.chain.length === 0) {
        sendPlay(tile);
        return;
      }
      const ends = legalEndsFor(tile, state.leftEnd, state.rightEnd);
      if (ends.length === 0) return;
      if (ends.length === 1) {
        sendPlay(tile, ends[0]);
        return;
      }
      setSelectedTile(tile);
      setPendingEnds(ends);
    },
    [sendPlay, state, selfId],
  );

  const isMyTurn = state?.currentPlayer === selfId;
  const winners = state?.winners;
  const matchOver = Boolean(state && (state.winner || state.blocked));

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-marquinhos-bg">
      <GameHeader
        titleKey="dominoes-block.name"
        titleNs="games"
        onBack={() => {
          roomSend({ type: 'leave' });
          navigate('/');
        }}
      />

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-4 sm:p-6">
        {!state && (
          <div className="font-pixel animate-pong-blink text-sm text-marquinhos-accent">
            {t('waitingPlayers')}
          </div>
        )}

        {state && (
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim">
            {state.players.map((player) => (
              <div
                key={player}
                className={cn(
                  'notch-3 border px-3 py-1.5',
                  player === state.currentPlayer
                    ? 'border-marquinhos-accent text-marquinhos-accent'
                    : 'border-marquinhos-border',
                )}
              >
                {player === selfId ? t('common:you') : player.slice(0, 6)} ·{' '}
                {state.handCounts[player]}
              </div>
            ))}
            <div className="notch-3 border border-marquinhos-border px-3 py-1.5">
              {t('boneyard')} · {state.boneyard}
            </div>
          </div>
        )}

        <div
          className="relative notch-8 border border-marquinhos-border bg-[#1c1b1c] shadow-[0_20px_40px_rgba(0,0,0,0.35)]"
          hidden={!state}
        >
          <DominoesBlockCanvas
            state={state}
            selfId={selfId}
            selectedTile={selectedTile}
            onTileClick={handleTileClick}
          />

          {state && pendingEnds && pendingEnds.length === 2 && (
            <div className="absolute bottom-24 left-1/2 flex -translate-x-1/2 gap-3">
              {pendingEnds.map((end) => (
                <button
                  key={end}
                  type="button"
                  className="notch-6 border border-marquinhos-accent bg-marquinhos-accent px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-black"
                  onClick={() => selectedTile && sendPlay(selectedTile, end)}
                >
                  {t('playEnd', {
                    end: t(end === 'left' ? 'endLeft' : 'endRight'),
                  })}
                </button>
              ))}
              <button
                type="button"
                className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-4 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim"
                onClick={() => {
                  setSelectedTile(null);
                  setPendingEnds(null);
                }}
              >
                {t('cancel')}
              </button>
            </div>
          )}

          {matchOver && (
            <div className="absolute inset-0">
              <EndScreen
                outcomeKey={
                  state?.blocked
                    ? 'outcomeBlocked'
                    : winners?.includes(selfId ?? '')
                      ? 'outcomeWin'
                      : 'outcomeGameOver'
                }
                outcomeNs="dominoes-block"
                onPlayAgain={
                  restartRequested
                    ? undefined
                    : () => {
                        roomSend({ type: 'restart' });
                        setRestartRequested(true);
                      }
                }
                onBackToHub={() => {
                  roomSend({ type: 'leave' });
                  navigate('/');
                }}
              />
            </div>
          )}
        </div>

        {state && (
          <>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={!isMyTurn}
                className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-marquinhos-text transition hover:border-marquinhos-border-hover disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => roomSend({ type: 'pass' })}
              >
                {t('pass')}
              </button>
            </div>

            {rejection && (
              <div className="text-sm text-marquinhos-danger">{rejection}</div>
            )}

            {disconnectedOpponent && !matchOver && (
              <div className="font-pixel animate-pong-blink text-sm text-marquinhos-text">
                {t('opponentDisconnected')}
              </div>
            )}

            {matchOver && restartRequested && (
              <div className="text-xs text-marquinhos-text-dim">
                {t('waitingRematch', {
                  votes: restartStatus?.votes ?? 1,
                  required: restartStatus?.required ?? state.players.length,
                })}
              </div>
            )}

            {(connectionState === 'disconnected' ||
              connectionState === 'error') && (
              <div className="notch-6 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-3 text-center text-sm text-marquinhos-danger">
                {t('common:connectionLost')}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
