import type {
  PongAssignment,
  PongClientMessage,
} from '@marquinhos/contracts/activity/games/pong';
import type { GameMode } from '@marquinhos/contracts/activity/pong/types';
import type { Side } from '../pongTypes';
type InputPayload = Extract<PongClientMessage, { type: 'input' }>['payload'];
type Prediction =
  | { seq: number; sentAt: number; axis: -1 | 0 | 1 }
  | { seq: number; sentAt: number; target: number };

export interface PongInputOptions {
  canvas: HTMLCanvasElement;
  mode: GameMode;
  getSide: () => Side | null;
  getAssignment: () => PongAssignment | null;
  isSpectating: () => boolean;
  sendInput: (payload: InputPayload) => void;
  pushPrediction: (side: Side, prediction: Prediction) => void;
  onExit: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function attachPongInput({
  canvas,
  mode,
  getSide,
  getAssignment,
  isSpectating,
  sendInput,
  pushPrediction,
  onExit,
}: PongInputOptions): () => void {
  const directions: Record<Side, -1 | 0 | 1> = { left: 0, right: 0 };
  const seqBySide: Record<Side, number> = { left: 0, right: 0 };
  const seqBySlot: Record<number, number> = {};
  const arrowKeysDown = new Set<string>();
  const wsKeysDown = new Set<string>();
  let activePointerId: number | null = null;
  let lastPointerSentAt = -Infinity;

  function sendTrackedInput(side: Side, direction: -1 | 0 | 1, seq: number) {
    if (isSpectating() || direction === directions[side]) return;
    directions[side] = direction;
    pushPrediction(side, { seq, sentAt: performance.now(), axis: direction });
    sendInput(mode === 'local' ? { direction, seq, side } : { direction, seq });
  }

  function sendArrowInput() {
    const assigned = getAssignment();
    if (
      mode !== 'local' &&
      assigned &&
      (assigned.side === 'top' || assigned.side === 'bottom')
    ) {
      const direction: -1 | 0 | 1 = arrowKeysDown.has('ArrowLeft')
        ? -1
        : arrowKeysDown.has('ArrowRight')
          ? 1
          : 0;
      const seq = (seqBySlot[assigned.slot] ?? 0) + 1;
      seqBySlot[assigned.slot] = seq;
      sendInput({ direction, seq });
      return;
    }

    const direction: -1 | 0 | 1 = arrowKeysDown.has('ArrowUp')
      ? -1
      : arrowKeysDown.has('ArrowDown')
        ? 1
        : 0;
    const side = mode === 'local' ? 'right' : (getSide() ?? 'left');
    seqBySide[side] += 1;
    sendTrackedInput(side, direction, seqBySide[side]);
  }

  function sendWsInput() {
    const direction: -1 | 0 | 1 = wsKeysDown.has('w')
      ? -1
      : wsKeysDown.has('s')
        ? 1
        : 0;
    seqBySide.left += 1;
    sendTrackedInput('left', direction, seqBySide.left);
  }

  function sendRelease() {
    if (isSpectating()) return;
    if (mode === 'local') {
      for (const side of ['left', 'right'] as const) {
        seqBySide[side] += 1;
        sendInput({
          direction: 0,
          seq: seqBySide[side],
          side,
          action: 'release',
        });
      }
      return;
    }

    const assigned = getAssignment();
    if (!assigned) return;
    const classicSide =
      assigned.side === 'left' || assigned.side === 'right'
        ? assigned.side
        : null;
    const seq = classicSide
      ? (seqBySide[classicSide] += 1)
      : (seqBySlot[assigned.slot] ?? 0) + 1;
    if (!classicSide) seqBySlot[assigned.slot] = seq;
    sendInput({ direction: 0, seq, action: 'release' });
  }

  function onKeyDown(event: KeyboardEvent) {
    const key = event.key;
    const lower = key.toLowerCase();
    if (
      key === 'ArrowUp' ||
      key === 'ArrowDown' ||
      key === 'ArrowLeft' ||
      key === 'ArrowRight'
    ) {
      event.preventDefault();
      arrowKeysDown.add(key);
      sendArrowInput();
    } else if (mode === 'local' && (lower === 'w' || lower === 's')) {
      event.preventDefault();
      wsKeysDown.add(lower);
      sendWsInput();
    } else if (key === ' ') {
      event.preventDefault();
      sendRelease();
    } else if (key === 'Escape') {
      event.preventDefault();
      onExit();
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    const key = event.key;
    const lower = key.toLowerCase();
    if (
      key === 'ArrowUp' ||
      key === 'ArrowDown' ||
      key === 'ArrowLeft' ||
      key === 'ArrowRight'
    ) {
      arrowKeysDown.delete(key);
      sendArrowInput();
    } else if (mode === 'local' && (lower === 'w' || lower === 's')) {
      wsKeysDown.delete(lower);
      sendWsInput();
    }
  }

  function sendPointerTarget(event: PointerEvent) {
    if (isSpectating()) return;
    const now = performance.now();
    if (now - lastPointerSentAt < 8) return;
    lastPointerSentAt = now;
    const rect = canvas.getBoundingClientRect();
    const assignedSide = getAssignment()?.side;
    const target =
      assignedSide === 'top' || assignedSide === 'bottom'
        ? clamp((event.clientX - rect.left) / rect.width, 0, 1)
        : clamp((event.clientY - rect.top) / rect.height, 0, 1);
    const assigned = getAssignment();
    if (
      mode !== 'local' &&
      assignedSide &&
      assignedSide !== 'left' &&
      assignedSide !== 'right'
    ) {
      const slot = assigned?.slot ?? 0;
      const seq = (seqBySlot[slot] ?? 0) + 1;
      seqBySlot[slot] = seq;
      sendInput({ target, seq });
      return;
    }

    const side =
      mode === 'local'
        ? event.clientX < rect.left + rect.width / 2
          ? 'left'
          : 'right'
        : (getSide() ?? 'left');
    seqBySide[side] += 1;
    pushPrediction(side, {
      seq: seqBySide[side],
      sentAt: now,
      target,
    });
    directions[side] = 0;
    sendInput(
      mode === 'local'
        ? { target, seq: seqBySide[side], side }
        : { target, seq: seqBySide[side] },
    );
  }

  function onPointerDown(event: PointerEvent) {
    if (isSpectating()) return;
    activePointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    sendPointerTarget(event);
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerId !== activePointerId) return;
    event.preventDefault();
    sendPointerTarget(event);
  }

  function onPointerEnd(event: PointerEvent) {
    if (event.pointerId !== activePointerId) return;
    activePointerId = null;
    event.preventDefault();
    const assigned = getAssignment();
    if (!assigned || isSpectating()) return;
    if (mode === 'local') {
      const rect = canvas.getBoundingClientRect();
      const side =
        event.clientX < rect.left + rect.width / 2 ? 'left' : 'right';
      seqBySide[side] += 1;
      sendInput({
        direction: 0,
        seq: seqBySide[side],
        side,
        action: 'release',
      });
      return;
    }
    const classicSide =
      assigned.side === 'left' || assigned.side === 'right'
        ? assigned.side
        : null;
    const seq = classicSide
      ? (seqBySide[classicSide] += 1)
      : (seqBySlot[assigned.slot] ?? 0) + 1;
    if (!classicSide) seqBySlot[assigned.slot] = seq;
    sendInput({ direction: 0, seq, action: 'release' });
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerEnd);
    canvas.removeEventListener('pointercancel', onPointerEnd);
  };
}
