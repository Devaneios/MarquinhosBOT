// Binary layout for the 'state' snapshot broadcast — must be kept in sync by
// hand with the encoder in marquinhos-api/src/services/activity/pong/pongProtocol.ts.
//
// offset  type     field
// 0       Uint32   snapshotSeq
// 4       Uint32   ackLeft
// 8       Uint32   ackRight
// 12      Float32  paddleLeftY
// 16      Float32  paddleRightY
// 20      Float32  ballX
// 24      Float32  ballY
// 28      Uint8    scoreLeft
// 29      Uint8    scoreRight
// 30      Uint8    winner (0=none, 1=left, 2=right)

export interface DecodedSnapshot {
  seq: number;
  ackLeft: number;
  ackRight: number;
  ball: { x: number; y: number };
  paddles: { left: number; right: number };
  score: { left: number; right: number };
  winner: 'left' | 'right' | null;
}

function decodeWinner(byte: number): 'left' | 'right' | null {
  if (byte === 1) return 'left';
  if (byte === 2) return 'right';
  return null;
}

export function decodeStateSnapshot(buffer: ArrayBuffer): DecodedSnapshot {
  const view = new DataView(buffer);
  return {
    seq: view.getUint32(0),
    ackLeft: view.getUint32(4),
    ackRight: view.getUint32(8),
    paddles: {
      left: view.getFloat32(12),
      right: view.getFloat32(16),
    },
    ball: {
      x: view.getFloat32(20),
      y: view.getFloat32(24),
    },
    score: {
      left: view.getUint8(28),
      right: view.getUint8(29),
    },
    winner: decodeWinner(view.getUint8(30)),
  };
}
