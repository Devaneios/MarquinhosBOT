import { Application, Container, Graphics, Text } from 'pixi.js';
import { useEffect, useRef } from 'react';
import { tImperative } from '../../../i18n/i18nImperative';
import type { BingoCard } from '../types';

const GRID_SIZE = 5;
const CELL_SIZE = 96;
const CELL_GAP = 4;
const BOARD_PADDING = 16;
const BOARD_SIZE = GRID_SIZE * CELL_SIZE;
export const CANVAS_SIZE = BOARD_SIZE + BOARD_PADDING * 2;

const BG_COLOR = '#1a1a1a';
const CELL_DEFAULT = 0x333333;
const CELL_MARKED = 0x4ade80;
const CELL_DRAWN = 0x3b82f6;
const CELL_BORDER = 0x666666;
const NUMBER_FONT_SIZE = Math.max(16, CELL_SIZE / 2);
const FREE_FONT_SIZE = Math.max(10, CELL_SIZE / 4);

export interface BingoSpeedBoardCanvasProps {
  card: BingoCard | null;
  drawnNumbers: Set<number>;
}

export function BingoSpeedBoardCanvas({
  card,
  drawnNumbers,
}: BingoSpeedBoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const cardRef = useRef(card);
  cardRef.current = card;
  const drawnRef = useRef(drawnNumbers);
  drawnRef.current = drawnNumbers;
  const redrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    let initialized = false;
    let onContextLost: ((event: Event) => void) | null = null;
    let onContextRestored: (() => void) | null = null;
    let contextCanvas: HTMLCanvasElement | null = null;

    function onVisibilityChange() {
      if (document.hidden) appRef.current?.ticker.stop();
      else appRef.current?.ticker.start();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

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
      if (initialized) {
        app.destroy({ removeView: false });
      }
      appRef.current = null;
    };
  }, []);

  useEffect(() => {
    redrawRef.current?.();
  }, [card, drawnNumbers]);

  return <canvas ref={canvasRef} className="block max-h-full max-w-full" />;
}
