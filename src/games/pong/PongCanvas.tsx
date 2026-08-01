import { useEffect, useRef } from 'react';
import { wsUrl } from '../../lib/apiBase';
import { ActivitySocket, type ActivityMessage } from '../../lib/ws';

interface PongState {
  width: number;
  height: number;
  ball: { x: number; y: number };
  paddles: { left: number; right: number };
  score: { left: number; right: number };
  winner: 'left' | 'right' | null;
}

const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_RADIUS = 8;

export function PongCanvas({ wsToken }: { wsToken: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<PongState | null>(null);

  useEffect(() => {
    const socket = new ActivitySocket(
      `${wsUrl('/ws/activity')}?token=${encodeURIComponent(wsToken)}`,
    );
    const unsubscribe = socket.onMessage((message: ActivityMessage) => {
      if (message.type === 'state') {
        stateRef.current = message.payload as PongState;
      }
    });
    socket.connect();

    const keysDown = new Set<string>();
    function sendInput() {
      const direction = keysDown.has('ArrowUp')
        ? -1
        : keysDown.has('ArrowDown')
          ? 1
          : 0;
      socket.send({ type: 'input', payload: { direction } });
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      keysDown.add(event.key);
      sendInput();
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      keysDown.delete(event.key);
      sendInput();
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let raf: number;
    function render() {
      const canvas = canvasRef.current;
      const state = stateRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx && state) {
        canvas.width = state.width;
        canvas.height = state.height;

        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, state.width, state.height);

        ctx.fillStyle = '#fff';
        ctx.fillRect(0, state.paddles.left, PADDLE_WIDTH, PADDLE_HEIGHT);
        ctx.fillRect(
          state.width - PADDLE_WIDTH,
          state.paddles.right,
          PADDLE_WIDTH,
          PADDLE_HEIGHT,
        );

        ctx.beginPath();
        ctx.arc(state.ball.x, state.ball.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          `${state.score.left} - ${state.score.right}`,
          state.width / 2,
          30,
        );
        if (state.winner) {
          ctx.fillText(
            `${state.winner} wins!`,
            state.width / 2,
            state.height / 2,
          );
        }
      }
      raf = requestAnimationFrame(render);
    }
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      unsubscribe();
      socket.close();
    };
  }, [wsToken]);

  return <canvas ref={canvasRef} className="pong-canvas" />;
}
