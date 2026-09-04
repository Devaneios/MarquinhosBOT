import type { GameId } from '../gameId';

// Mirrors the server's GameRoomAdapter.supportsQueue registry (marquinhos-api
// src/realtime/adapters/registry.ts) — only these games' rooms show
// queue-toggle/rotate-seat UI meaningfully.
const QUEUE_ELIGIBLE_GAMES = new Set<GameId>([
  'tic-tac-toe',
  'connect-four',
  'checkers',
  'rock-paper-scissors',
  'battleship',
  'pong',
]);

export function isQueueEligible(game: GameId): boolean {
  return QUEUE_ELIGIBLE_GAMES.has(game);
}
