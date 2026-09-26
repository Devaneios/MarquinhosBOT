export const DRAG_COLOR = '#ffb000';
const PLAYER_PALETTE = [
  '#ffb000',
  '#5fbf77',
  '#5f9bbf',
  '#bf5f9b',
  '#bf9b5f',
  '#9b5fbf',
  '#5fbfaa',
  '#bf5f5f',
];

export function colorForPlayer(userId: string, selfId: string): string {
  if (userId === selfId) return DRAG_COLOR;
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return PLAYER_PALETTE[hash % PLAYER_PALETTE.length]!;
}
