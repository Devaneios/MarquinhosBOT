import { Application, Container, Graphics } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';
import type { CheckersState, Color, Position } from '../types';

const BOARD_SIZE = 480;
const SQUARE_SIZE = BOARD_SIZE / 8;
const LIGHT_SQUARE = 0x2a2c30;
const DARK_SQUARE = 0x17181a;
const SELECTED_HIGHLIGHT = 0xffb000;
const CONTINUE_HIGHLIGHT = 0x5fbf77;
const BLACK_PIECE = 0x3a3d42;
const BLACK_PIECE_BORDER = 0x8a8d92;
const RED_PIECE = 0xd94f4f;
const RED_PIECE_BORDER = 0xffb0b0;
const KING_RING = 0xffd700;

function samePos(a: Position | null, b: Position | null): boolean {
  if (!a || !b) return a === b;
  return a.row === b.row && a.col === b.col;
}

export interface CheckersCanvasProps {
  state: CheckersState | null;
  myColor: Color | null;
  onMove: (from: Position, to: Position) => void;
  // 'player' | null both permit input — null is the existing non-room
  // single/direct-multiplayer path. Only 'spectator'/'queued' (a room's
  // non-seated viewers) block it, mirroring every other room-board wrapper
  // in this rollout.
  role?: 'player' | 'spectator' | 'queued' | null;
  // Bump this (any changing number) to force-clear the current selection —
  // used when the server rejects a move so the highlighted square doesn't
  // linger after a rejection.
  clearSelectionSignal?: number;
}

export function CheckersCanvas({
  state,
  myColor,
  onMove,
  role = null,
  clearSelectionSignal,
}: CheckersCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const boardLayerRef = useRef<Container | null>(null);
  const redrawFnRef = useRef<(() => void) | null>(null);

  const [selected, setSelected] = useState<Position | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const myColorRef = useRef(myColor);
  myColorRef.current = myColor;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const roleRef = useRef(role);
  roleRef.current = role;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

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
    if (clearSelectionSignal !== undefined) setSelected(null);
    // Only the signal changing should trigger this — not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSelectionSignal]);

  useEffect(() => {
    let cancelled = false;
    let initialized = false;
    let onContextLost: ((event: Event) => void) | null = null;
    let onContextRestored: (() => void) | null = null;
    const app = new Application();
    appRef.current = app;

    function onVisibilityChange() {
      if (document.hidden) app.ticker.stop();
      else app.ticker.start();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    (async () => {
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
      initialized = true;

      const boardLayer = new Container();
      app.stage.addChild(boardLayer);
      boardLayerRef.current = boardLayer;
      redraw();

      onContextLost = (event: Event) => {
        event.preventDefault();
        app.ticker.stop();
      };
      onContextRestored = () => {
        app.ticker.start();
      };
      canvasRef.current!.addEventListener('webglcontextlost', onContextLost, false);
      canvasRef.current!.addEventListener(
        'webglcontextrestored',
        onContextRestored,
        false,
      );
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
      if (roleRef.current === 'spectator' || roleRef.current === 'queued') return;
      const currentState = stateRef.current;
      const color = myColorRef.current;
      if (!currentState || !color) return;
      if (currentState.winner) return;
      if (currentState.turn !== color) return;

      const piece = currentState.board[pos.row]?.[pos.col] ?? null;

      if (currentState.mustContinueFrom) {
        if (samePos(pos, currentState.mustContinueFrom)) return;
        onMoveRef.current(currentState.mustContinueFrom, pos);
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
      onMoveRef.current(current, pos);
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
          squares.rect(col * SQUARE_SIZE, row * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE).fill(fill);
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
          const borderColor = piece.color === 'black' ? BLACK_PIECE_BORDER : RED_PIECE_BORDER;
          pieces.circle(cx, cy, radius).fill(fillColor).stroke({ width: 2, color: borderColor });
          if (piece.king) {
            pieces.circle(cx, cy, radius * 0.5).stroke({ width: 3, color: KING_RING });
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
      document.removeEventListener('visibilitychange', onVisibilityChange);
      canvas?.removeEventListener('pointerdown', onPointerDown);
      if (canvas && onContextLost) {
        canvas.removeEventListener('webglcontextlost', onContextLost);
      }
      if (canvas && onContextRestored) {
        canvas.removeEventListener('webglcontextrestored', onContextRestored);
      }
      redrawFnRef.current = null;
      boardLayerRef.current = null;
      if (initialized) {
        app.destroy({ removeView: false });
      }
      appRef.current = null;
    };
  }, []);

  useEffect(() => {
    redrawFnRef.current?.();
  }, [state, selected]);

  return (
    <div className="notch-8 border border-marquinhos-border bg-marquinhos-panel p-3 shadow-[0_20px_40px_rgba(0,0,0,0.28)]">
      <canvas
        ref={canvasRef}
        style={{ width: BOARD_SIZE, height: BOARD_SIZE, display: 'block' }}
      />
    </div>
  );
}
