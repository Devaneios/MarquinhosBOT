import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';

interface WordChainCanvasProps {
  currentWord: string;
  currentTurn: string;
  players: { userId: string; alive: boolean }[];
  gameOver: boolean;
  winner: string | null;
  usedWords: string[];
}

export function WordChainCanvas({
  currentWord,
  currentTurn,
  players,
  gameOver,
  winner,
  usedWords,
}: WordChainCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const app = new PIXI.Application({
      width,
      height,
      antialias: true,
      backgroundColor: 0x1a1a1a,
    });

    appRef.current = app;
    containerRef.current.appendChild(app.canvas);

    const render = () => {
      app.stage.removeChildren();

      const title = new PIXI.Text('CORRENTE DE PALAVRAS', {
        fontFamily: 'Arial',
        fontSize: 28,
        fill: 0xffa000,
        fontWeight: 'bold',
      });
      title.x = width / 2 - title.width / 2;
      title.y = 20;
      app.stage.addChild(title);

      if (currentWord) {
        const wordText = new PIXI.Text(`Palavra atual: ${currentWord.toUpperCase()}`, {
          fontFamily: 'monospace',
          fontSize: 24,
          fill: 0xffffff,
        });
        wordText.x = width / 2 - wordText.width / 2;
        wordText.y = 70;
        app.stage.addChild(wordText);
      }

      const turnText = new PIXI.Text(`Turno de: ${currentTurn}`, {
        fontFamily: 'Arial',
        fontSize: 18,
        fill: gameOver ? 0xff4444 : 0x44ff44,
      });
      turnText.x = width / 2 - turnText.width / 2;
      turnText.y = 120;
      app.stage.addChild(turnText);

      const playerListY = 170;
      players.forEach((player, idx) => {
        const color = player.alive ? 0xcccccc : 0x666666;
        const status = player.alive ? '✓' : '✗';

        const playerText = new PIXI.Text(`${status} ${player.userId}`, {
          fontFamily: 'Arial',
          fontSize: 16,
          fill: color,
        });
        playerText.x = 30;
        playerText.y = playerListY + idx * 30;
        playerText.alpha = player.alive ? 1 : 0.5;
        app.stage.addChild(playerText);
      });

      if (gameOver) {
        const gameOverBg = new PIXI.Graphics();
        gameOverBg.beginFill(0x000000);
        gameOverBg.drawRect(0, height / 2 - 60, width, 120);
        gameOverBg.endFill();
        app.stage.addChild(gameOverBg);

        const gameOverText = new PIXI.Text('JOGO TERMINADO', {
          fontFamily: 'Arial',
          fontSize: 24,
          fill: 0xff4444,
          fontWeight: 'bold',
        });
        gameOverText.x = width / 2 - gameOverText.width / 2;
        gameOverText.y = height / 2 - 50;
        app.stage.addChild(gameOverText);

        if (winner) {
          const winnerText = new PIXI.Text(`${winner} venceu!`, {
            fontFamily: 'Arial',
            fontSize: 20,
            fill: 0x44ff44,
          });
          winnerText.x = width / 2 - winnerText.width / 2;
          winnerText.y = height / 2 + 10;
          app.stage.addChild(winnerText);
        }
      }

      const usedWordsY = height - 100;
      const usedWordsText = new PIXI.Text(
        `Palavras usadas: ${usedWords.join(', ')}`,
        {
          fontFamily: 'monospace',
          fontSize: 12,
          fill: 0x888888,
          wordWrap: true,
          wordWrapWidth: width - 40,
        },
      );
      usedWordsText.x = 20;
      usedWordsText.y = usedWordsY;
      app.stage.addChild(usedWordsText);
    };

    render();

    const handleResize = () => {
      if (!containerRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;
      app.renderer.resize(newWidth, newHeight);
      render();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      app.destroy(true);
      appRef.current = null;
    };
  }, [currentWord, currentTurn, players, gameOver, winner, usedWords]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    />
  );
}
