import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GameHeader } from '../../../components/game-shell';
import { colyseusUrl } from '../../../lib/apiBase';
import { devlog } from '../../../lib/devlog';
import type { WsSession } from '../../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../../shared/useColyseusRoom';
import type { CheckersState, Color, GameMode } from '../types';
import { CheckersCanvas } from './CheckersCanvas';

const CHECKERS_GAME_ID = 'checkers';

function colorKey(color: Color): 'colorBlack' | 'colorRed' {
  return color === 'black' ? 'colorBlack' : 'colorRed';
}

export function CheckersBoard({
  session,
  mode,
  onMainMenu,
}: {
  session: WsSession;
  mode: GameMode;
  onMainMenu: () => void;
}) {
  const { t } = useTranslation(['checkers', 'common', 'games']);

  const [myColor, setMyColor] = useState<Color | null>(null);
  const [state, setState] = useState<CheckersState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [clearSelectionSignal, setClearSelectionSignal] = useState(0);

  const onMessage = useCallback(
    (message: ActivityMessage) => {
      if (message.type === 'init') {
        const payload = message.payload as {
          color: Color | null;
          state: CheckersState;
        };
        devlog('[checkers] init', payload);
        setMyColor(payload.color);
        setState(payload.state);
      } else if (message.type === 'state') {
        setState(message.payload as CheckersState);
      } else if (message.type === 'action_rejected') {
        // checkersAdapter.ts (server) sends ACTION_REJECTED ('action_rejected')
        // for a rejected move, not 'move_rejected' — a pre-existing mismatch
        // with this client code found while adding room support, fixed here
        // rather than left broken. Sibling games (Connect Four, Dominoes)
        // still send 'move_rejected' — this is checkers-specific.
        setNotice(t('checkers:moveRejected'));
        setClearSelectionSignal((n) => n + 1);
      } else if (message.type === 'opponent_disconnected') {
        setNotice(t('checkers:opponentDisconnected'));
      } else if (message.type === 'opponent_reconnected') {
        setNotice(null);
      }
    },
    [t],
  );

  const { send, connectionState } = useColyseusRoom(
    CHECKERS_GAME_ID,
    session,
    colyseusUrl(),
    onMessage,
    (room) => room.send('leave'),
  );

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const isMyTurn =
    !!state && !!myColor && state.turn === myColor && !state.winner;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-4 sm:p-6">
      <div className="w-full max-w-[520px]">
        <GameHeader
          titleKey="checkers.name"
          titleNs="games"
          onBack={onMainMenu}
          backLabel={t('checkers:menuLabel')}
          variant="minimal"
          right={
            myColor ? (
              <div className="font-pixel text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim">
                {t('common:you')}: {t(`checkers:${colorKey(myColor)}`)}
              </div>
            ) : undefined
          }
        />
      </div>

      <CheckersCanvas
        state={state}
        myColor={myColor}
        onMove={(from, to) => send({ type: 'move', payload: { from, to } })}
        clearSelectionSignal={clearSelectionSignal}
      />

      <div className="font-pixel text-sm tracking-[0.2em] text-marquinhos-text-dim">
        {state?.winner
          ? t('checkers:wins', {
              color: t(`checkers:${colorKey(state.winner)}`),
            })
          : isMyTurn
            ? t('checkers:yourTurn')
            : state
              ? t('checkers:turnToMove', {
                  color: t(`checkers:${colorKey(state.turn)}`),
                })
              : ''}
      </div>

      {notice && (
        <div className="text-sm text-marquinhos-text-dim">{notice}</div>
      )}

      {(connectionState === 'disconnected' || connectionState === 'error') && (
        <div className="text-sm text-marquinhos-danger">
          {t('common:connectionLost')}
        </div>
      )}

      {state?.winner && (
        <div className="flex gap-3">
          {mode === 'multi' && (
            <button
              type="button"
              className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
              onClick={() => send({ type: 'restart' })}
            >
              {t('common:playAgain')}
            </button>
          )}
          <button
            type="button"
            className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-5 py-3 text-sm text-marquinhos-text hover:border-marquinhos-border-hover"
            onClick={onMainMenu}
          >
            {t('common:mainMenu')}
          </button>
        </div>
      )}
    </div>
  );
}
