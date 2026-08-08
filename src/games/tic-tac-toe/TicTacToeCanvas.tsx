import { Application, Graphics, Text } from 'pixi.js';
import { useEffect, useRef } from 'react';
import type { TicTacToeState } from './useTicTacToeSession';

interface TicTacToeCanvasProps {
  state: TicTacToeState;
  player: string;
  onMove: (row: number, col: number) => void;
  gameOver: boolean;
}

export function TicTacToeCanvas({
  state,
  player,
  onMove,
  gameOver,
}: TicTacToeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const cellsRef = useRef<Graphics[]>([]);
  let resizeCanvas: () => void;

  useEffect(() => {
    let cancelled = false;
    let initialized = false;
    if (!containerRef.current) return;

    const app = new Application();

    (async () => {
      if (cancelled) return;

      await app.init({
        width: 600,
        height: 600,
        antialias: true,
        backgroundColor: 0x1a1a1a,
      });

      if (cancelled || !containerRef.current) {
        app.destroy({ removeView: false });
        return;
      }

      initialized = true;
      appRef.current = app;
      containerRef.current.appendChild(app.canvas);

      const cellSize = 180;
      const padding = 30;
      const grid = 3;

      const cellGraphics: Graphics[] = [];

      for (let row = 0; row < grid; row++) {
        for (let col = 0; col < grid; col++) {
          const x = padding + col * cellSize;
          const y = padding + row * cellSize;

          const cellGraphic = new Graphics();
          cellGraphic.rect(x, y, cellSize - 10, cellSize - 10);
          cellGraphic.stroke({ color: 0x4a4a4a, width: 2 });
          cellGraphic.fill({ color: 0x2a2a2a });

          cellGraphic.interactive = true;
          cellGraphic.cursor = 'pointer';

          cellGraphic.on('pointerdown', () => {
            if (!gameOver && state.currentPlayer === player) {
              onMove(row, col);
            }
          });

          app.stage.addChild(cellGraphic);
          cellGraphics.push(cellGraphic);
        }
      }

      cellsRef.current = cellGraphics;

      const renderBoard = () => {
        for (let row = 0; row < grid; row++) {
          for (let col = 0; col < grid; col++) {
            const cell = state.board[row]?.[col];
            const cellGraphic = cellGraphics[row * grid + col];

            if (!cellGraphic) continue;
            cellGraphic.removeChildren();

            if (cell) {
              const text = new Text({
                text: cell,
                style: {
                  fontSize: 80,
                  fontWeight: 'bold',
                  fill: cell === 'X' ? 0x3a9eff : 0xff6b9d,
                },
              });

              const x = padding + col * cellSize + cellSize / 2 - 45;
              const y = padding + row * cellSize + cellSize / 2 - 50;

              text.position.set(x, y);
              cellGraphic.addChild(text);
            }
          }
        }
      };

      renderBoard();

      resizeCanvas = () => {
        if (!containerRef.current) return;
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        app.renderer.resize(width, height);
      };

      window.addEventListener('resize', resizeCanvas);
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('resize', resizeCanvas);
      if (initialized) {
        app.destroy(true);
        if (containerRef.current?.contains(app.canvas)) {
          containerRef.current.removeChild(app.canvas);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!appRef.current) return;

    const cellSize = 180;
    const padding = 30;

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const cell = state.board[row]?.[col];
        const cellGraphic = cellsRef.current[row * 3 + col];

        if (!cellGraphic) continue;

        cellGraphic.removeChildren();

        if (cell) {
          const text = new Text({
            text: cell,
            style: {
              fontSize: 80,
              fontWeight: 'bold',
              fill: cell === 'X' ? 0x3a9eff : 0xff6b9d,
            },
          });

          const x = padding + col * cellSize + cellSize / 2 - 45;
          const y = padding + row * cellSize + cellSize / 2 - 50;

          text.position.set(x, y);
          cellGraphic.addChild(text);
        }
      }
    }
  }, [state.board]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    />
  );
}
