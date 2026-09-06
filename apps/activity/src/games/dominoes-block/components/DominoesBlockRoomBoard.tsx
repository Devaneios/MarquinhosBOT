import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoomConnectionContext } from '../../shared/RoomConnectionProvider';
import {
  legalEndsFor,
  type ChainEnd,
  type DominoesClientState,
  type Tile,
} from '../protocol';
import { DominoesBlockCanvas } from './DominoesBlockCanvas';

// Renders Dominoes inside a multiplayer Room view — driven by
// RoomConnectionContext instead of DominoesBlockBoard's own useColyseusRoom
// call, reusing the same DominoesBlockCanvas presentational component.
export function DominoesBlockRoomBoard() {
  const ctx = useRoomConnectionContext();
  const { t } = useTranslation(['dominoes-block', 'common']);
  const [state, setState] = useState<DominoesClientState | null>(null);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [pendingEnds, setPendingEnds] = useState<ChainEnd[] | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((message) => {
      if (message.type === 'state') {
        setState(message.payload as DominoesClientState);
        setRejection(null);
      } else if (message.type === 'move_rejected') {
        setRejection((message.payload as { reason: string }).reason);
      }
    });
  }, [ctx]);

  const selfId = ctx?.currentUserId ?? '';

  function sendPlay(tile: Tile, end?: ChainEnd) {
    ctx?.send({ type: 'play', payload: end ? { tile, end } : { tile } });
    setSelectedTile(null);
    setPendingEnds(null);
  }

  function handleTileClick(tile: Tile) {
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
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
      <div className="relative notch-8 border border-marquinhos-border bg-[#1c1b1c] shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
        <DominoesBlockCanvas
          state={state}
          selfId={selfId}
          selectedTile={selectedTile}
          role={ctx?.role ?? null}
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
                {t('playEnd', { end: t(end === 'left' ? 'endLeft' : 'endRight') })}
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
      </div>

      {rejection && <div className="text-sm text-marquinhos-danger">{rejection}</div>}
    </div>
  );
}
