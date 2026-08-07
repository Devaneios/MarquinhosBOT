import React, { useEffect, useRef } from 'react';
import { Application, Graphics } from 'pixi.js';
import type { SnakeGameState } from './types';

interface SnakeCanvasProps {
  state: SnakeGameState | null;
  onDirection: (dir: string) => void;
}

const CELL_SIZE = 20;
const GRID_COLOR = 0x222222;
const SNAKE_COLORS: Record<string, number> = {
  player1: 0x00ff00,
  player2: 0xffff00,
};
const FOOD_COLOR = 0xff0000;

export const SnakeCanvas: React.FC<SnakeCanvasProps> = ({
  state,
  onDirection,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const graphicsRef = useRef<Graphics | null>(null);
  const keysPressed = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!containerRef.current || !state) return;

    try {
      const app = new Application({
        width: state.width * CELL_SIZE,
        height: state.height * CELL_SIZE,
        backgroundColor: 0x000000,
      });

      containerRef.current.appendChild(app.canvas as any);
      appRef.current = app;

      const graphics = new Graphics();
      app.stage.addChild(graphics);
      graphicsRef.current = graphics;

      const render = () => {
        if (!state) return;
        graphics.clear();

        graphics.lineStyle(1, GRID_COLOR);
        for (let i = 0; i <= state.width; i++) {
          graphics.moveTo(i * CELL_SIZE, 0);
          graphics.lineTo(i * CELL_SIZE, state.height * CELL_SIZE);
        }
        for (let i = 0; i <= state.height; i++) {
          graphics.moveTo(0, i * CELL_SIZE);
          graphics.lineTo(state.width * CELL_SIZE, i * CELL_SIZE);
        }

        for (const [id, snake] of Object.entries(state.snakes)) {
          const color = SNAKE_COLORS[id] || 0x888888;
          graphics.beginFill(color);
          for (const segment of snake.segments) {
            graphics.drawRect(
              segment.x * CELL_SIZE + 1,
              segment.y * CELL_SIZE + 1,
              CELL_SIZE - 2,
              CELL_SIZE - 2,
            );
          }
          graphics.endFill();
        }

        graphics.beginFill(FOOD_COLOR);
        for (const food of state.food) {
          graphics.drawRect(
            food.x * CELL_SIZE + 5,
            food.y * CELL_SIZE + 5,
            CELL_SIZE - 10,
            CELL_SIZE - 10,
          );
        }
        graphics.endFill();
      };

      app.ticker.add(render);

      return () => {
        app.ticker.remove(render);
        if (containerRef.current?.contains(app.canvas as any)) {
          containerRef.current.removeChild(app.canvas as any);
        }
        app.destroy();
      };
    } catch (error) {
      console.error('Failed to initialize PixiJS app:', error);
    }
  }, [state]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysPressed.current.add(key);

      switch (key) {
        case 'arrowup':
        case 'w':
          e.preventDefault();
          onDirection('up');
          break;
        case 'arrowdown':
        case 's':
          e.preventDefault();
          onDirection('down');
          break;
        case 'arrowleft':
        case 'a':
          e.preventDefault();
          onDirection('left');
          break;
        case 'arrowright':
        case 'd':
          e.preventDefault();
          onDirection('right');
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onDirection]);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        background: '#000',
      }}
    />
  );
};
