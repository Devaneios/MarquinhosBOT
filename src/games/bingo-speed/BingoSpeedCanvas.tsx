import { Application, Container, Graphics, Text } from 'pixi.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GameHeader } from '../../components/game-shell';
import { tImperative } from '../../i18n/i18nImperative';
import { colyseusUrl } from '../../lib/apiBase';
import { devlog } from '../../lib/devlog';
import type { WsSession } from '../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../shared/useColyseusRoom';
import type {
  BingoCard,
  BingoGameEndPayload,
  BingoInitPayload,
  BingoNumberDrawnPayload,
} from './types';

const GRID_SIZE = 5;
const CELL_SIZE = 96;
const CELL_GAP = 4;
const BOARD_PADDING = 16;
const BOARD_SIZE = GRID_SIZE * CELL_SIZE;
const CANVAS_SIZE = BOARD_SIZE + BOARD_PADDING * 2;

const BG_COLOR = '#1a1a1a';
const CELL_DEFAULT = 0x333333;
const CELL_MARKED = 0x4ade80;
const CELL_DRAWN = 0x3b82f6;
const CELL_BORDER = 0x666666;
const NUMBER_FONT_SIZE = Math.max(16, CELL_SIZE / 2);
const FREE_FONT_SIZE = Math.max(10, CELL_SIZE / 4);

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const cardRef = useRef<BingoCard | null>(null);
  const drawnRef = useRef<Set<number>>(new Set());
  const redrawRef = useRef<(() => void) | null>(null);
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
    cardRef.current = null;
    drawnRef.current = new Set();
    setCardLoaded(false);
    setWinner(null);

    messageHandlerRef.current = (message) => {
      if (message.type === 'init') {
        const payload = message.payload as BingoInitPayload;
        devlog('[bingo-speed-canvas] init', payload);
        cardRef.current = payload.card;
        drawnRef.current = new Set(payload.state?.drawnNumbers ?? []);
        setCardLoaded(true);
        redrawRef.current?.();
      } else if (message.type === 'number_drawn') {
        const payload = message.payload as BingoNumberDrawnPayload;
        drawnRef.current.add(payload.number);
        redrawRef.current?.();
      } else if (message.type === 'game_end') {
        const payload = message.payload as BingoGameEndPayload;
        devlog('[bingo-speed-canvas] game end', payload);
        setWinner(payload.winner ?? null);
      }
    };

    function onVisibilityChange() {
      if (document.hidden) appRef.current?.ticker.stop();
      else appRef.current?.ticker.start();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    let cancelled = false;
    let initialized = false;
    let onContextLost: ((event: Event) => void) | null = null;
    let onContextRestored: (() => void) | null = null;
    let contextCanvas: HTMLCanvasElement | null = null;

    const cellBgs: Graphics[][] = [];
    const cellTexts: Text[][] = [];

    const app = new Application();
    appRef.current = app;

    function buildScene() {
      const board = new Container();
      for (let row = 0; row < GRID_SIZE; row++) {
        const bgRow: Graphics[] = [];
        const textRow: Text[] = [];
        for (let col = 0; col < GRID_SIZE; col++) {
          const x = col * CELL_SIZE;
          const y = row * CELL_SIZE;

          const cellBg = new Graphics();
          cellBg.position.set(x, y);
          board.addChild(cellBg);

          const cellText = new Text({
            text: '',
            style: {
              fontFamily: 'Arial',
              fontSize: NUMBER_FONT_SIZE,
              fontWeight: 'bold',
              fill: 0xffffff,
            },
          });
          cellText.anchor.set(0.5);
          cellText.position.set(x + CELL_SIZE / 2, y + CELL_SIZE / 2);
          board.addChild(cellText);

          bgRow.push(cellBg);
          textRow.push(cellText);
        }
        cellBgs.push(bgRow);
        cellTexts.push(textRow);
      }
      board.position.set(BOARD_PADDING, BOARD_PADDING);
      app.stage.addChild(board);
    }

    function redraw() {
      const card = cardRef.current;
      const drawn = drawnRef.current;
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          const cellBg = cellBgs[row][col];
          const cellText = cellTexts[row][col];
          const number = card?.board[row]?.[col] ?? 0;
          const isMarked = card?.marked[row]?.[col] ?? false;
          const isDrawn = drawn.has(number);

          let backgroundColor = CELL_DEFAULT;
          if (isMarked) backgroundColor = CELL_MARKED;
          else if (isDrawn) backgroundColor = CELL_DRAWN;

          cellBg
            .clear()
            .rect(0, 0, CELL_SIZE - CELL_GAP, CELL_SIZE - CELL_GAP)
            .fill(backgroundColor)
            .stroke({ width: 1, color: CELL_BORDER });

          if (!card) {
            cellText.text = '';
            continue;
          }
          if (number === 0) {
            cellText.text = tImperative('freeCell', 'bingo-speed');
            cellText.style.fontSize = FREE_FONT_SIZE;
            cellText.style.fill = 0xffffff;
          } else {
            cellText.text = String(number);
            cellText.style.fontSize = NUMBER_FONT_SIZE;
            cellText.style.fill = isMarked ? 0x000000 : 0xffffff;
          }
        }
      }
    }

    (async () => {
      // Yield a microtask before touching the canvas — see PongCanvas for
      // the full explanation of why StrictMode's phantom mount/cleanup
      // pass must bail here rather than reach app.init().
      await Promise.resolve();
      if (cancelled) return;

      await app.init({
        canvas: canvasRef.current!,
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        background: BG_COLOR,
        antialias: true,
        resolution: window.devicePixelRatio,
        autoDensity: true,
      });
      if (cancelled) {
        app.destroy({ removeView: false });
        return;
      }
      initialized = true;

      onContextLost = (event: Event) => {
        event.preventDefault();
        app.ticker.stop();
      };
      onContextRestored = () => {
        app.ticker.start();
      };
      contextCanvas = canvasRef.current!;
      contextCanvas.addEventListener('webglcontextlost', onContextLost, false);
      contextCanvas.addEventListener(
        'webglcontextrestored',
        onContextRestored,
        false,
      );

      buildScene();
      redrawRef.current = redraw;
      redraw();
    })();

    return () => {
      devlog('[bingo-speed-canvas] unmounting');
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (contextCanvas && onContextLost) {
        contextCanvas.removeEventListener('webglcontextlost', onContextLost);
      }
      if (contextCanvas && onContextRestored) {
        contextCanvas.removeEventListener(
          'webglcontextrestored',
          onContextRestored,
        );
      }
      redrawRef.current = null;
      messageHandlerRef.current = () => {};
      if (initialized) {
        app.destroy({ removeView: false });
      }
      appRef.current = null;
    };
  }, [session]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--color-marquinhos-bg)]">
      <GameHeader
        titleKey="bingo-speed.name"
        titleNs="games"
        onBack={onMainMenu}
      />

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto p-4 sm:p-6">
        <div className="relative flex items-center justify-center overflow-hidden border border-marquinhos-border bg-marquinhos-bg">
          <canvas ref={canvasRef} className="block max-h-full max-w-full" />
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
