import { Application, Graphics, Text } from 'pixi.js';
import { useEffect, useRef } from 'react';
import type { TicTacToeState } from '../hooks/useTicTacToeSession';

interface TicTacToeCanvasProps {
  state: TicTacToeState;
  player: string;
  onMove: (row: number, col: number) => void;
  gameOver: boolean;
  // 'player' | null both permit moves — null is the existing non-room
  // single/direct-multiplayer path (useColyseusRoom returns role: null
  // outside a RoomConnectionProvider), which must keep working unchanged.
  // Only 'spectator'/'queued' (a room view's non-seated viewers) block it.
  role?: 'player' | 'spectator' | 'queued' | null;
}

export function TicTacToeCanvas({
  state,
  player,
  onMove,
  gameOver,
  role = null,
}: TicTacToeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const cellsRef = useRef<Graphics[]>([]);
  const cellTextsRef = useRef<Text[]>([]);
  const stateRef = useRef(state);
  const playerRef = useRef(player);
  const gameOverRef = useRef(gameOver);
  const onMoveRef = useRef(onMove);
  const roleRef = useRef(role);
  const renderBoardRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    playerRef.current = player;
  }, [player]);
  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);
  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  // The board is rendered by one function, built once the scene exists
  // (renderBoardRef, set inside the init effect below); this effect is just
  // the trigger that re-invokes it whenever a new board arrives.
  useEffect(() => {
    renderBoardRef.current?.();
  }, [state.board]);

  useEffect(() => {
    let cancelled = false;
    let initialized = false;
    let onContextLost: ((event: Event) => void) | null = null;
    let onContextRestored: (() => void) | null = null;
    let contextCanvas: HTMLCanvasElement | null = null;

    function onVisibilityChange() {
      if (!initialized) return;
      if (document.hidden) appRef.current?.ticker.stop();
      else appRef.current?.ticker.start();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    const app = new Application();
    appRef.current = app;

    (async () => {
      // Yield a microtask before touching the canvas so React 19
      // StrictMode's phantom mount (mount -> cleanup -> mount) bails out
      // here, before calling init(), instead of sharing a WebGL context
      // with the real instance (see PongCanvas for the full rationale).
      await Promise.resolve();
      if (cancelled) return;

      await app.init({
        canvas: canvasRef.current!,
        width: 600,
        height: 600,
        antialias: true,
        backgroundColor: 0x1a1a1a,
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

      const cellSize = 180;
      const padding = 30;
      const grid = 3;

      const cellGraphics: Graphics[] = [];
      const cellTexts: Text[] = [];

      for (let row = 0; row < grid; row++) {
        for (let col = 0; col < grid; col++) {
          const x = padding + col * cellSize;
          const y = padding + row * cellSize;

          const cellGraphic = new Graphics();
          cellGraphic.rect(x, y, cellSize - 10, cellSize - 10);
          cellGraphic.stroke({ color: 0x4a4a4a, width: 2 });
          cellGraphic.fill({ color: 0x2a2a2a });

          cellGraphic.eventMode = 'static';
          cellGraphic.cursor = 'pointer';

          cellGraphic.on('pointerdown', () => {
            if (
              !gameOverRef.current &&
              roleRef.current !== 'spectator' &&
              roleRef.current !== 'queued' &&
              stateRef.current.currentPlayer === playerRef.current
            ) {
              onMoveRef.current(row, col);
            }
          });

          app.stage.addChild(cellGraphic);
          cellGraphics.push(cellGraphic);

          const text = new Text({
            text: '',
            style: {
              fontSize: 80,
              fontWeight: 'bold',
              fill: 0x3a9eff,
            },
          });
          text.position.set(
            padding + col * cellSize + cellSize / 2 - 45,
            padding + row * cellSize + cellSize / 2 - 50,
          );
          text.visible = false;
          cellGraphic.addChild(text);
          cellTexts.push(text);
        }
      }

      cellsRef.current = cellGraphics;
      cellTextsRef.current = cellTexts;

      renderBoardRef.current = () => {
        for (let row = 0; row < grid; row++) {
          for (let col = 0; col < grid; col++) {
            const cell = stateRef.current.board[row]?.[col];
            const text = cellTexts[row * grid + col];

            if (!text) continue;

            if (cell) {
              text.text = cell;
              text.style.fill = cell === 'X' ? 0x3a9eff : 0xff6b9d;
              text.visible = true;
            } else {
              text.text = '';
              text.visible = false;
            }
          }
        }
      };

      renderBoardRef.current();
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
      renderBoardRef.current = null;
      cellsRef.current = [];
      cellTextsRef.current = [];
      if (initialized) {
        app.destroy({ removeView: false });
      }
      appRef.current = null;
    };
  }, []);

  return (
    <div className="flex h-full w-full items-center justify-center">
      <canvas ref={canvasRef} className="block max-h-full max-w-full" />
    </div>
  );
}
