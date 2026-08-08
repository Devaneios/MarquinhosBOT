import { Application, Container, Graphics } from 'pixi.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { colyseusUrl } from '../../lib/apiBase';
import { devlog } from '../../lib/devlog';
import type { GameId } from '../gameId';
import type { WsSession } from '../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../shared/useColyseusRoom';
import type { CheckersState, Color, GameMode, Position } from './types';

// See useCheckersSession.ts — 'checkers' is not yet in the shared GameId
// union, so it's cast at this one boundary until the registry wiring lands.
const CHECKERS_GAME_ID = 'checkers' as GameId;

const BOARD_SIZE = 480;
const SQUARE_SIZE = BOARD_SIZE / 8;
const LIGHT_SQUARE = 0x2a2c30;
const DARK_SQUARE = 0x17181a;
const SELECTED_HIGHLIGHT = 0xffb000;
const CONTINUE_HIGHLIGHT = 0x5fbf77;
const BLACK_PIECE = 0x1b1b1b;
const BLACK_PIECE_BORDER = 0x5a5a5a;
const RED_PIECE = 0xd94f4f;
const RED_PIECE_BORDER = 0xffb0b0;
const KING_RING = 0xffd700;

function samePos(a: Position | null, b: Position | null): boolean {
  if (!a || !b) return a === b;
  return a.row === b.row && a.col === b.col;
}

function colorLabel(color: Color): string {
  return color === 'black' ? 'BLACK' : 'RED';
}

export function CheckersBoard({
  session,
  mode,
  onMainMenu,
}: {
  session: WsSession;
  mode: GameMode;
  onMainMenu: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const boardLayerRef = useRef<Container | null>(null);
  const redrawFnRef = useRef<(() => void) | null>(null);

  const [myColor, setMyColor] = useState<Color | null>(null);
  const [state, setState] = useState<CheckersState | null>(null);
  const [selected, setSelected] = useState<Position | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const myColorRef = useRef(myColor);
  myColorRef.current = myColor;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const onMessage = useCallback((message: ActivityMessage) => {
    if (message.type === 'init') {
      const payload = message.payload as {
        color: Color | null;
        state: CheckersState;
      };
      devlog('[checkers] init', payload);
      setMyColor(payload.color);
      setState(payload.state);
    } else if (message.type === 'state') {
      setState(message.payload as CheckersState);
    } else if (message.type === 'move_rejected') {
      setSelected(null);
      setNotice('That move is not legal.');
    } else if (message.type === 'opponent_disconnected') {
      setNotice('Opponent disconnected — waiting for them to reconnect…');
    } else if (message.type === 'opponent_reconnected') {
      setNotice(null);
    }
  }, []);

  const { send } = useColyseusRoom(
    CHECKERS_GAME_ID,
    session,
    colyseusUrl(),
    onMessage,
    (room) => room.send('leave'),
  );

  // Auto-selects the mid-chain piece so a forced continuation jump is
  // always ready to receive its next destination click, and clears any
  // stale selection once it's no longer this player's turn.
  useEffect(() => {
    if (!state || !myColor) return;
    if (state.mustContinueFrom && state.turn === myColor) {
      setSelected(state.mustContinueFrom);
    } else if (state.turn !== myColor) {
      setSelected(null);
    }
  }, [state, myColor]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    let cancelled = false;
    const app = new Application();
    appRef.current = app;

    (async () => {
      // Yields a microtask before touching the canvas so React 19
      // StrictMode's phantom mount/cleanup/mount doesn't leave two
      // Application instances sharing one WebGL context — see PongCanvas
      // for the fuller explanation of why this matters.
      await Promise.resolve();
      if (cancelled) return;

      await app.init({
        canvas: canvasRef.current!,
        width: BOARD_SIZE,
        height: BOARD_SIZE,
        background: DARK_SQUARE,
        antialias: true,
        resolution: window.devicePixelRatio,
        autoDensity: true,
      });
      if (cancelled) {
        app.destroy({ removeView: false });
        return;
      }

      const boardLayer = new Container();
      app.stage.addChild(boardLayer);
      boardLayerRef.current = boardLayer;
      redraw();
    })();

    function onPointerDown(event: PointerEvent) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = BOARD_SIZE / rect.width;
      const scaleY = BOARD_SIZE / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
      const col = Math.floor(x / SQUARE_SIZE);
      const row = Math.floor(y / SQUARE_SIZE);
      if (row < 0 || row > 7 || col < 0 || col > 7) return;
      handleSquareClick({ row, col });
    }

    function handleSquareClick(pos: Position) {
      const currentState = stateRef.current;
      const color = myColorRef.current;
      if (!currentState || !color) return;
      if (currentState.winner) return;
      if (currentState.turn !== color) return;

      const piece = currentState.board[pos.row]?.[pos.col] ?? null;

      if (currentState.mustContinueFrom) {
        if (samePos(pos, currentState.mustContinueFrom)) return;
        send({
          type: 'move',
          payload: { from: currentState.mustContinueFrom, to: pos },
        });
        return;
      }

      const current = selectedRef.current;
      if (!current) {
        if (piece && piece.color === color) setSelected(pos);
        return;
      }
      if (samePos(pos, current)) {
        setSelected(null);
        return;
      }
      if (piece && piece.color === color) {
        setSelected(pos);
        return;
      }
      send({ type: 'move', payload: { from: current, to: pos } });
      setSelected(null);
    }

    function redraw() {
      const layer = boardLayerRef.current;
      if (!layer) return;
      layer.removeChildren();

      const currentState = stateRef.current;
      const current = selectedRef.current;

      const squares = new Graphics();
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const isDark = (row + col) % 2 === 1;
          const isSelected = current && current.row === row && current.col === col;
          const isContinuing =
            currentState?.mustContinueFrom?.row === row &&
            currentState?.mustContinueFrom?.col === col;
          const fill = isContinuing
            ? CONTINUE_HIGHLIGHT
            : isSelected
              ? SELECTED_HIGHLIGHT
              : isDark
                ? DARK_SQUARE
                : LIGHT_SQUARE;
          squares
            .rect(col * SQUARE_SIZE, row * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE)
            .fill(fill);
        }
      }
      layer.addChild(squares);

      if (!currentState) return;

      const pieces = new Graphics();
      const radius = SQUARE_SIZE * 0.36;
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const piece = currentState.board[row]?.[col];
          if (!piece) continue;
          const cx = col * SQUARE_SIZE + SQUARE_SIZE / 2;
          const cy = row * SQUARE_SIZE + SQUARE_SIZE / 2;
          const fillColor = piece.color === 'black' ? BLACK_PIECE : RED_PIECE;
          const borderColor =
            piece.color === 'black' ? BLACK_PIECE_BORDER : RED_PIECE_BORDER;
          pieces
            .circle(cx, cy, radius)
            .fill(fillColor)
            .stroke({ width: 2, color: borderColor });
          if (piece.king) {
            pieces.circle(cx, cy, radius * 0.5).stroke({
              width: 3,
              color: KING_RING,
            });
          }
        }
      }
      layer.addChild(pieces);
    }

    const canvas = canvasRef.current;
    canvas?.addEventListener('pointerdown', onPointerDown);
    redrawFnRef.current = redraw;

    return () => {
      cancelled = true;
      canvas?.removeEventListener('pointerdown', onPointerDown);
      redrawFnRef.current = null;
      boardLayerRef.current = null;
      app.destroy({ removeView: false });
      appRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [send]);

  useEffect(() => {
    redrawFnRef.current?.();
  }, [state, selected]);

  const winnerLabel = state?.winner ? colorLabel(state.winner) : null;
  const isMyTurn = !!state && !!myColor && state.turn === myColor && !state.winner;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-4 sm:p-6">
      <div className="flex w-full max-w-[520px] items-center justify-between">
        <button
          type="button"
          className="font-pixel cursor-pointer border-none bg-none text-[11px] text-marquinhos-text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
          onClick={onMainMenu}
        >
          &lt; MENU
        </button>
        <div className="font-pixel text-xs tracking-[0.2em] text-marquinhos-text-dim">
          {myColor ? `YOU: ${colorLabel(myColor)}` : ''}
        </div>
      </div>

      <div className="notch-8 border border-marquinhos-border bg-marquinhos-panel p-3 shadow-[0_20px_40px_rgba(0,0,0,0.28)]">
        <canvas
          ref={canvasRef}
          style={{ width: BOARD_SIZE, height: BOARD_SIZE, display: 'block' }}
        />
      </div>

      <div className="font-pixel text-sm tracking-[0.2em] text-marquinhos-text-dim">
        {winnerLabel
          ? `${winnerLabel} WINS`
          : isMyTurn
            ? 'YOUR TURN'
            : state
              ? `${colorLabel(state.turn)} TO MOVE`
              : ''}
      </div>

      {notice && (
        <div className="text-sm text-marquinhos-text-dim">{notice}</div>
      )}

      {winnerLabel && (
        <div className="flex gap-3">
          {mode === 'multi' && (
            <button
              type="button"
              className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
              onClick={() => send({ type: 'restart' })}
            >
              PLAY AGAIN
            </button>
          )}
          <button
            type="button"
            className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-5 py-3 text-sm text-marquinhos-text hover:border-marquinhos-border-hover"
            onClick={onMainMenu}
          >
            MAIN MENU
          </button>
        </div>
      )}
    </div>
  );
}
