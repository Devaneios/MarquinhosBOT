import { Application, Graphics, Text, Container } from 'pixi.js';
import { useEffect, useRef } from 'react';

interface HangmanCanvasProps {
  revealedWord: string;
  guessedLetters: string[];
  strikes: number;
  maxStrikes: number;
  gameOver: boolean;
  won: boolean;
  onLetterClick: (letter: string) => void;
  disabled: boolean;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ';

const HANGMAN_STAGES = [
  // Stage 0: gallows
  (gfx: Graphics) => {
    gfx.lineStyle(2, 0xffffff);
    gfx.moveTo(20, 250).lineTo(20, 50).lineTo(150, 50).lineTo(150, 70);
  },
  // Stage 1: head
  (gfx: Graphics) => {
    gfx.circle(150, 90, 20).stroke({ color: 0xffffff, width: 2 });
  },
  // Stage 2: body
  (gfx: Graphics) => {
    gfx.lineStyle(2, 0xffffff);
    gfx.moveTo(150, 110).lineTo(150, 170);
  },
  // Stage 3: left arm
  (gfx: Graphics) => {
    gfx.lineStyle(2, 0xffffff);
    gfx.moveTo(150, 130).lineTo(120, 150);
  },
  // Stage 4: right arm
  (gfx: Graphics) => {
    gfx.lineStyle(2, 0xffffff);
    gfx.moveTo(150, 130).lineTo(180, 150);
  },
  // Stage 5: left leg
  (gfx: Graphics) => {
    gfx.lineStyle(2, 0xffffff);
    gfx.moveTo(150, 170).lineTo(120, 210);
  },
  // Stage 6: right leg
  (gfx: Graphics) => {
    gfx.lineStyle(2, 0xffffff);
    gfx.moveTo(150, 170).lineTo(180, 210);
  },
];

export function HangmanCanvas({
  revealedWord,
  guessedLetters,
  strikes,
  maxStrikes,
  gameOver,
  won,
  onLetterClick,
  disabled,
}: HangmanCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const width = 800;
    const height = 600;

    const app = new Application({
      width,
      height,
      antialias: true,
      preference: 'webgl',
      autoDensity: true,
      resizeTo: canvasRef.current,
    });

    canvasRef.current.appendChild(app.canvas as unknown as HTMLCanvasElement);
    appRef.current = app;

    const stage = app.stage;
    stage.sortableChildren = true;

    let cancelled = false;

    const render = () => {
      if (cancelled) return;

      stage.removeChildren();

      // Draw hangman stages
      const hangmanGfx = new Graphics();
      for (let i = 0; i <= strikes; i++) {
        if (i < HANGMAN_STAGES.length) {
          HANGMAN_STAGES[i](hangmanGfx);
        }
      }
      stage.addChild(hangmanGfx);

      // Draw word
      const wordText = new Text(revealedWord, {
        fontSize: 48,
        fontFamily: 'Arial',
        fill: 0xffffff,
        letterSpacing: 8,
      });
      wordText.x = 250;
      wordText.y = 80;
      stage.addChild(wordText);

      // Draw strikes info
      const strikesText = new Text(`Strikes: ${strikes}/${maxStrikes}`, {
        fontSize: 20,
        fontFamily: 'Arial',
        fill: strikes >= maxStrikes - 1 ? 0xff6b6b : 0xffffff,
      });
      strikesText.x = 250;
      strikesText.y = 160;
      stage.addChild(strikesText);

      // Draw game status
      if (gameOver) {
        const statusText = new Text(won ? 'YOU WIN!' : 'GAME OVER', {
          fontSize: 48,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          fill: won ? 0x51cf66 : 0xff6b6b,
        });
        statusText.x = 250;
        statusText.y = 200;
        stage.addChild(statusText);

        if (!won) {
          const answerText = new Text(`Answer: ${revealedWord}`, {
            fontSize: 24,
            fontFamily: 'Arial',
            fill: 0xffffff,
          });
          answerText.x = 250;
          answerText.y = 260;
          stage.addChild(answerText);
        }
      }

      // Draw keyboard
      const keyboardContainer = new Container();
      let keyX = 20;
      let keyY = 350;

      for (let i = 0; i < ALPHABET.length; i++) {
        const letter = ALPHABET[i];
        const isGuessed = guessedLetters.includes(letter.toLowerCase());

        const buttonGfx = new Graphics();
        buttonGfx.rect(keyX, keyY, 40, 40);
        buttonGfx.fill({
          color: isGuessed ? 0x495057 : 0x495057,
          alpha: isGuessed ? 0.5 : 1,
        });
        buttonGfx.stroke({
          color: isGuessed ? 0x6c757d : 0xffffff,
          width: 2,
        });

        const letterText = new Text(letter, {
          fontSize: 14,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          fill: isGuessed ? 0x999999 : 0xffffff,
        });
        letterText.x = keyX + 12;
        letterText.y = keyY + 10;

        const button = new Container();
        button.addChild(buttonGfx);
        button.addChild(letterText);
        button.interactive = !isGuessed && !disabled && !gameOver;
        button.cursor = button.interactive ? 'pointer' : 'default';
        button.on('pointerdown', () => {
          if (!isGuessed && !disabled && !gameOver) {
            onLetterClick(letter.toLowerCase());
          }
        });

        keyboardContainer.addChild(button);

        keyX += 50;
        if ((i + 1) % 12 === 0) {
          keyX = 20;
          keyY += 50;
        }
      }

      stage.addChild(keyboardContainer);
    };

    const renderLoop = () => {
      render();
      app.ticker.add(() => {
        render();
      });
    };

    renderLoop();

    return () => {
      cancelled = true;
      app.destroy({ removeView: true });
    };
  }, [revealedWord, guessedLetters, strikes, maxStrikes, gameOver, won, onLetterClick, disabled]);

  return <div ref={canvasRef} style={{ width: '100%', height: '600px' }} />;
}
