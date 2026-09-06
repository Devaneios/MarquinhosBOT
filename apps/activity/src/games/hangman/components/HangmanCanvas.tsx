import { Application, Graphics } from 'pixi.js';
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

const GALLOWS_WIDTH = 220;
const GALLOWS_HEIGHT = 260;
const GALLOWS_BG = '#17181a';
const LINE_COLOR = 0xffffff;
const LINE_WIDTH = 2;

const HANGMAN_STAGES: ((gfx: Graphics) => void)[] = [
  // Stage 0: gallows post
  (gfx) =>
    gfx
      .moveTo(20, 250)
      .lineTo(20, 50)
      .lineTo(150, 50)
      .lineTo(150, 70)
      .stroke({ width: LINE_WIDTH, color: LINE_COLOR }),
  // Stage 1: head
  (gfx) =>
    gfx.circle(150, 90, 20).stroke({ width: LINE_WIDTH, color: LINE_COLOR }),
  // Stage 2: body
  (gfx) =>
    gfx
      .moveTo(150, 110)
      .lineTo(150, 170)
      .stroke({ width: LINE_WIDTH, color: LINE_COLOR }),
  // Stage 3: left arm
  (gfx) =>
    gfx
      .moveTo(150, 130)
      .lineTo(120, 150)
      .stroke({ width: LINE_WIDTH, color: LINE_COLOR }),
  // Stage 4: right arm
  (gfx) =>
    gfx
      .moveTo(150, 130)
      .lineTo(180, 150)
      .stroke({ width: LINE_WIDTH, color: LINE_COLOR }),
  // Stage 5: left leg
  (gfx) =>
    gfx
      .moveTo(150, 170)
      .lineTo(120, 210)
      .stroke({ width: LINE_WIDTH, color: LINE_COLOR }),
  // Stage 6: right leg
  (gfx) =>
    gfx
      .moveTo(150, 170)
      .lineTo(180, 210)
      .stroke({ width: LINE_WIDTH, color: LINE_COLOR }),
];

function drawGallows(gfx: Graphics, strikes: number) {
  gfx.clear();
  for (let i = 0; i <= strikes && i < HANGMAN_STAGES.length; i++) {
    HANGMAN_STAGES[i](gfx);
  }
}

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const gallowsRef = useRef<Graphics | null>(null);
  const redrawRef = useRef<(() => void) | null>(null);
  const strikesRef = useRef(strikes);
  strikesRef.current = strikes;

  useEffect(() => {
    let cancelled = false;
    let initialized = false;
    let onContextLost: ((event: Event) => void) | null = null;
    let onContextRestored: (() => void) | null = null;
    let contextCanvas: HTMLCanvasElement | null = null;

    function onVisibilityChange() {
      if (document.hidden) {
        appRef.current?.ticker.stop();
      } else {
        appRef.current?.ticker.start();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    const app = new Application();
    appRef.current = app;

    (async () => {
      // Mirrors PongCanvas: React 19 StrictMode double-invokes this effect
      // before any await settles, so bail here if the phantom first pass's
      // cleanup already ran.
      await Promise.resolve();
      if (cancelled) return;

      await app.init({
        canvas: canvasRef.current!,
        width: GALLOWS_WIDTH,
        height: GALLOWS_HEIGHT,
        background: GALLOWS_BG,
        antialias: true,
        resolution: window.devicePixelRatio,
        autoDensity: true,
      });
      if (cancelled) {
        app.destroy({ removeView: false });
        return;
      }
      initialized = true;

      const gallows = new Graphics();
      gallowsRef.current = gallows;
      app.stage.addChild(gallows);

      const redraw = () => drawGallows(gallows, strikesRef.current);
      redrawRef.current = redraw;
      redraw();

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
      gallowsRef.current = null;
      if (initialized) {
        app.destroy({ removeView: false });
      }
      appRef.current = null;
    };
  }, []);

  useEffect(() => {
    redrawRef.current?.();
  }, [strikes]);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative border border-marquinhos-border bg-marquinhos-bg">
        <canvas ref={canvasRef} className="block" />
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="font-pixel text-3xl tracking-[0.35em] text-marquinhos-text">
          {revealedWord}
        </div>
        <div
          className={`text-sm ${strikes >= maxStrikes - 1 ? 'text-marquinhos-danger' : 'text-marquinhos-text-dim'}`}
        >
          Strikes: {strikes}/{maxStrikes}
        </div>
      </div>

      {gameOver && (
        <div className="flex flex-col items-center gap-1">
          <div
            className={`font-pixel text-2xl ${won ? 'text-marquinhos-green' : 'text-marquinhos-danger'}`}
          >
            {won ? 'YOU WIN!' : 'GAME OVER'}
          </div>
          {!won && (
            <div className="text-sm text-marquinhos-text-dim">
              Answer: {revealedWord}
            </div>
          )}
        </div>
      )}

      <div className="flex max-w-[600px] flex-wrap justify-center gap-1.5">
        {ALPHABET.split('').map((letter) => {
          const lower = letter.toLowerCase();
          const isGuessed = guessedLetters.includes(lower);
          const isDisabled = isGuessed || disabled || gameOver;
          return (
            <button
              key={letter}
              type="button"
              disabled={isDisabled}
              onClick={() => onLetterClick(lower)}
              className="notch-3 flex h-10 w-10 items-center justify-center border border-marquinhos-border bg-marquinhos-panel text-sm font-bold text-marquinhos-text hover:border-marquinhos-border-hover disabled:cursor-not-allowed disabled:border-marquinhos-border/60 disabled:text-marquinhos-text-disabled disabled:hover:border-marquinhos-border/60"
            >
              {letter}
            </button>
          );
        })}
      </div>
    </div>
  );
}
