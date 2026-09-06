import { Application, Graphics } from 'pixi.js';
import { useEffect, useRef } from 'react';
import type { TowerState } from '../types';

const BLOCK_WIDTH = 46;
const BLOCK_HEIGHT = 16;
const BLOCK_GAP = 3;
const LEVEL_GAP = 3;
const VISIBLE_LEVELS = 10;
const CANVAS_WIDTH = 260;
const BG_COLOR = '#17181a';
const BLOCK_COLOR = '#c9a36a';
const BLOCK_ELIGIBLE_COLOR = '#e8c98a';
const BLOCK_INELIGIBLE_COLOR = '#5a4b36';
const GONE_COLOR = '#2a2b2d';
const SHAKE_DURATION_MS = 260;

export interface TowerBoardCanvasProps {
  state: TowerState | null;
  userId: string;
  onPull: (level: number, position: number) => void;
  // 'player' | null both permit input; 'spectator'/'queued' block it.
  // Belt and suspenders: current.currentPlayer will never equal a
  // spectator's own userId either way, mirroring Dominoes' same situation.
  role?: 'player' | 'spectator' | 'queued' | null;
}

export function TowerBoardCanvas({ state, userId, onPull, role = null }: TowerBoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const stateRef = useRef<TowerState | null>(state);
  stateRef.current = state;
  const shakeStartRef = useRef(-Infinity);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const roleRef = useRef(role);
  roleRef.current = role;
  const onPullRef = useRef(onPull);
  onPullRef.current = onPull;

  useEffect(() => {
    if (state?.lastPull?.toppled) shakeStartRef.current = performance.now();
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    let initialized = false;
    let onContextLost: ((event: Event) => void) | null = null;
    let onContextRestored: (() => void) | null = null;
    let contextCanvas: HTMLCanvasElement | null = null;
    let tick: (() => void) | null = null;

    function onVisibilityChange() {
      if (document.hidden) appRef.current?.ticker.stop();
      else appRef.current?.ticker.start();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    const app = new Application();
    appRef.current = app;

    const canvasHeight = VISIBLE_LEVELS * (3 * BLOCK_HEIGHT + LEVEL_GAP) + 40;

    (async () => {
      await Promise.resolve();
      if (cancelled) return;

      await app.init({
        canvas: canvasRef.current!,
        width: CANVAS_WIDTH,
        height: canvasHeight,
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
      contextCanvas.addEventListener('webglcontextrestored', onContextRestored, false);

      function render() {
        const current = stateRef.current;
        app.stage.removeChildren();
        if (!current) return;

        const now = performance.now();
        const shakeElapsed = now - shakeStartRef.current;
        let shakeX = 0;
        let shakeY = 0;
        if (shakeElapsed < SHAKE_DURATION_MS) {
          const progress = shakeElapsed / SHAKE_DURATION_MS;
          const magnitude = 6 * (1 - progress) * (1 - progress);
          shakeX = (Math.random() - 0.5) * 2 * magnitude;
          shakeY = (Math.random() - 0.5) * 2 * magnitude;
        }
        app.stage.position.set(shakeX, shakeY);

        const levels = current.levels;
        const totalLevels = levels.length;
        const startLevel = Math.max(0, totalLevels - VISIBLE_LEVELS);
        const isMyTurn =
          current.status === 'playing' &&
          current.currentPlayer === userIdRef.current &&
          roleRef.current !== 'spectator' &&
          roleRef.current !== 'queued';

        for (let i = startLevel; i < totalLevels; i++) {
          const level = levels[i]!;
          const rowFromTop = totalLevels - 1 - i;
          const y = 20 + rowFromTop * (BLOCK_HEIGHT + LEVEL_GAP);
          const eligible = i < totalLevels - 2;

          for (let pos = 0; pos < level.present.length; pos++) {
            const present = level.present[pos];
            const x =
              CANVAS_WIDTH / 2 -
              (level.present.length * (BLOCK_WIDTH + BLOCK_GAP)) / 2 +
              pos * (BLOCK_WIDTH + BLOCK_GAP);

            const gfx = new Graphics();
            const color = !present
              ? GONE_COLOR
              : eligible
                ? isMyTurn
                  ? BLOCK_ELIGIBLE_COLOR
                  : BLOCK_COLOR
                : BLOCK_INELIGIBLE_COLOR;
            gfx.roundRect(0, 0, BLOCK_WIDTH, BLOCK_HEIGHT, 2).fill({ color, alpha: present ? 1 : 0.25 });
            gfx.position.set(x, y);

            if (present && eligible && isMyTurn) {
              gfx.eventMode = 'static';
              gfx.cursor = 'pointer';
              gfx.on('pointerdown', () => {
                onPullRef.current(i, pos);
              });
            }

            app.stage.addChild(gfx);
          }
        }
      }

      tick = () => render();
      app.ticker.add(tick);
    })();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (contextCanvas && onContextLost) {
        contextCanvas.removeEventListener('webglcontextlost', onContextLost);
      }
      if (contextCanvas && onContextRestored) {
        contextCanvas.removeEventListener('webglcontextrestored', onContextRestored);
      }
      if (initialized) {
        if (tick) app.ticker.remove(tick);
        app.destroy({ removeView: false });
      }
      appRef.current = null;
    };
  }, []);

  return <canvas ref={canvasRef} className="block" />;
}
