import { useEffect, useRef } from 'react';
import { Application, Graphics, Container, Text } from 'pixi.js';
import type { BingoCard } from './types';

interface BingoSpeedCanvasProps {
  card: BingoCard | undefined;
  drawnNumbers: number[];
  onMainMenu: () => void;
  onClaimBingo: () => void;
}

export function BingoSpeedCanvas({
  card,
  drawnNumbers,
  onMainMenu,
  onClaimBingo,
}: BingoSpeedCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const cardContainerRef = useRef<Container | null>(null);

  useEffect(() => {
    if (!containerRef.current || !card) return;

    const width = Math.min(window.innerWidth - 40, 600);
    const height = Math.min(window.innerHeight - 200, 600);

    const app = new Application({
      width,
      height,
      antialias: true,
      backgroundColor: 0x1a1a1a,
    });

    containerRef.current.appendChild(app.canvas);
    appRef.current = app;

    const cardContainer = new Container();
    cardContainer.x = 20;
    cardContainer.y = 20;
    app.stage.addChild(cardContainer);
    cardContainerRef.current = cardContainer;

    const cellSize = (width - 40) / 5;
    const drawnSet = new Set(drawnNumbers);

    // Draw bingo card
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const number = card.board[row][col];
        const isMarked = card.marked[row][col];
        const isDrawn = drawnSet.has(number);

        // Draw cell background
        const cellGraphics = new Graphics();
        const x = col * cellSize;
        const y = row * cellSize;

        let backgroundColor = 0x333333;
        if (isMarked) {
          backgroundColor = 0x4ade80;
        } else if (isDrawn) {
          backgroundColor = 0x3b82f6;
        }

        cellGraphics.beginFill(backgroundColor);
        cellGraphics.drawRect(x, y, cellSize - 2, cellSize - 2);
        cellGraphics.endFill();

        // Draw border
        cellGraphics.lineStyle(1, 0x666666);
        cellGraphics.drawRect(x, y, cellSize - 2, cellSize - 2);

        cardContainer.addChild(cellGraphics);

        // Draw number text
        if (number !== 0) {
          const textColor = isMarked ? 0x000000 : 0xffffff;
          const text = new Text(number.toString(), {
            fontFamily: 'Arial',
            fontSize: Math.max(16, cellSize / 2),
            fill: textColor,
            fontWeight: 'bold',
          });
          text.anchor.set(0.5);
          text.x = x + cellSize / 2;
          text.y = y + cellSize / 2;
          cardContainer.addChild(text);
        } else {
          // FREE space
          const text = new Text('FREE', {
            fontFamily: 'Arial',
            fontSize: Math.max(10, cellSize / 4),
            fill: 0xffffff,
            fontWeight: 'bold',
          });
          text.anchor.set(0.5);
          text.x = x + cellSize / 2;
          text.y = y + cellSize / 2;
          cardContainer.addChild(text);
        }
      }
    }

    const handleResize = () => {
      const newWidth = Math.min(window.innerWidth - 40, 600);
      const newHeight = Math.min(window.innerHeight - 200, 600);
      app.renderer.resize(newWidth, newHeight);
    };

    const handleContextLoss = () => {
      cleanup();
    };

    window.addEventListener('resize', handleResize);
    app.canvas.addEventListener('webglcontextlost', handleContextLoss);

    function cleanup() {
      window.removeEventListener('resize', handleResize);
      app.canvas.removeEventListener('webglcontextlost', handleContextLoss);
      cardContainer.destroy();
      app.destroy();
    }

    return cleanup;
  }, [card, drawnNumbers]);

  if (!card) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin text-4xl">⏳</div>
          <p className="mt-4 text-marquinhos-text-dim">Loading card...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6">
      <div ref={containerRef} className="mb-6 rounded-lg border border-marquinhos-border" />
      <div className="flex gap-4">
        <button
          type="button"
          className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-6 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
          onClick={onClaimBingo}
        >
          CLAIM BINGO
        </button>
        <button
          type="button"
          className="notch-6 border border-marquinhos-border px-6 py-3 text-sm font-semibold text-marquinhos-text transition hover:bg-marquinhos-panel"
          onClick={onMainMenu}
        >
          BACK
        </button>
      </div>
    </div>
  );
}
