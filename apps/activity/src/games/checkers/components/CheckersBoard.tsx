import type { WsSession } from '@/games/shared/session/gameSession';
import {
  GameHeader,
  menuButtonPrimary,
  menuButtonSecondary,
} from '@/games/shared/shell';
import { colyseusUrl } from '@/platform/api/apiBase';
import type { ActivityMessage } from '@/platform/realtime/colyseus/connection';
import { useColyseusRoom } from '@/platform/realtime/colyseus/useColyseusRoom';
import { devlog } from '@/shared/logging/devlog';
import {
  serverMessageSchema,
  type CheckersClientMessage,
  type Color,
} from '@marquinhos/contracts/activity/games/checkers';
import { parseMessage } from '@marquinhos/contracts/activity/protocol';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { applyCheckersMessage, initialCheckersView } from '../checkersMessages';
import type { GameMode } from '../types';
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

  const [view, setView] = useState(initialCheckersView);
  const { myColor, state, notice, clearSelectionSignal } = view;

  const onMessage = useCallback((raw: ActivityMessage) => {
    const message = parseMessage(serverMessageSchema, raw);
    if (!message) return;
    devlog('[checkers]', message.type, message);
    setView((current) => applyCheckersMessage(current, message));
  }, []);

  const { send, connectionState } = useColyseusRoom(
    CHECKERS_GAME_ID,
    session,
    colyseusUrl(),
    onMessage,
    (room) => room.send('leave'),
  );

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(
      () => setView((current) => ({ ...current, notice: null })),
      3000,
    );
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
        onMove={(from, to) =>
          send({
            type: 'move',
            payload: { from, to },
          } satisfies CheckersClientMessage)
        }
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
        <div className="text-sm text-marquinhos-text-dim">
          {t(`checkers:${notice}`)}
        </div>
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
              className={menuButtonPrimary}
              onClick={() =>
                send({ type: 'restart' } satisfies CheckersClientMessage)
              }
            >
              {t('common:playAgain')}
            </button>
          )}
          <button
            type="button"
            className={menuButtonSecondary}
            onClick={onMainMenu}
          >
            {t('common:mainMenu')}
          </button>
        </div>
      )}
    </div>
  );
}
