import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GameHeader } from '../../../components/game-shell';
import { colyseusUrl } from '../../../lib/apiBase';
import { devlog } from '../../../lib/devlog';
import type { WsSession } from '../../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../../shared/useColyseusRoom';
import type {
  BingoCard,
  BingoGameEndPayload,
  BingoInitPayload,
  BingoNumberDrawnPayload,
} from '../types';
import { BingoSpeedBoardCanvas } from './BingoSpeedBoardCanvas';

export function BingoSpeedCanvas({
  session,
  userId,
  onMainMenu,
}: {
  session: WsSession;
  userId: string;
  onMainMenu: () => void;
}) {
  const { t } = useTranslation(['bingo-speed', 'common']);
  const [card, setCard] = useState<BingoCard | null>(null);
  const [drawnNumbers, setDrawnNumbers] = useState<Set<number>>(new Set());
  const [cardLoaded, setCardLoaded] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const messageHandlerRef = useRef<(message: ActivityMessage) => void>(
    () => {},
  );

  const { send, connectionState } = useColyseusRoom(
    'bingo-speed',
    session,
    colyseusUrl(),
    (message) => messageHandlerRef.current(message),
  );

  const claimBingo = useCallback(() => {
    send({ type: 'claim_bingo' });
  }, [send]);

  useEffect(() => {
    devlog('[bingo-speed-canvas] mounting');
    setCard(null);
    setDrawnNumbers(new Set());
    setCardLoaded(false);
    setWinner(null);

    messageHandlerRef.current = (message) => {
      if (message.type === 'init') {
        const payload = message.payload as BingoInitPayload;
        devlog('[bingo-speed-canvas] init', payload);
        setCard(payload.card);
        setDrawnNumbers(new Set(payload.state?.drawnNumbers ?? []));
        setCardLoaded(true);
      } else if (message.type === 'number_drawn') {
        const payload = message.payload as BingoNumberDrawnPayload;
        setDrawnNumbers((prev) => new Set(prev).add(payload.number));
      } else if (message.type === 'game_end') {
        const payload = message.payload as BingoGameEndPayload;
        devlog('[bingo-speed-canvas] game end', payload);
        setWinner(payload.winner ?? null);
      }
    };

    return () => {
      messageHandlerRef.current = () => {};
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--color-marquinhos-bg)]">
      <GameHeader
        titleKey="bingo-speed.name"
        titleNs="games"
        onBack={onMainMenu}
      />

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto p-4 sm:p-6">
        <div className="relative flex items-center justify-center overflow-hidden border border-marquinhos-border bg-marquinhos-bg">
          <BingoSpeedBoardCanvas card={card} drawnNumbers={drawnNumbers} />
          {!cardLoaded && (
            <div className="font-pixel animate-pong-blink absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-marquinhos-text">
              {t('bingo-speed:loadingCard')}
            </div>
          )}
          {(connectionState === 'disconnected' ||
            connectionState === 'error') && (
            <div className="font-pixel absolute top-3 left-1/2 -translate-x-1/2 border border-marquinhos-danger/60 bg-marquinhos-panel px-3 py-1.5 text-[11px] tracking-wide text-marquinhos-danger">
              {t('common:connectionLost')}
            </div>
          )}
          {winner !== null && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-marquinhos-bg/90">
              <div className="font-pixel text-2xl tracking-[0.24em] text-marquinhos-accent">
                {t('bingo-speed:bingoBanner')}
              </div>
              <div className="text-lg font-semibold text-marquinhos-text">
                {winner === userId
                  ? t('bingo-speed:youWon')
                  : t('bingo-speed:gameOver')}
              </div>
              <button
                type="button"
                className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
                onClick={onMainMenu}
              >
                {t('common:mainMenu')}
              </button>
            </div>
          )}
        </div>

        {winner === null && (
          <div className="flex gap-4">
            <button
              type="button"
              className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-6 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover disabled:cursor-not-allowed disabled:bg-marquinhos-panel disabled:text-marquinhos-text-disabled"
              disabled={!cardLoaded}
              onClick={claimBingo}
            >
              {t('bingo-speed:claimBingo')}
            </button>
            <button
              type="button"
              className="notch-6 border border-marquinhos-border px-6 py-3 text-sm font-semibold text-marquinhos-text transition hover:bg-marquinhos-panel"
              onClick={onMainMenu}
            >
              {t('common:back')}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
