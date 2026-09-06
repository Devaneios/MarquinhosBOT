// Single declaration per §12/AP-8 — this was independently re-declared in 14
// session files (sometimes without broadcastBinary), which let them drift.
// `key` predates the Colyseus adoption, when one server multiplexed rooms
// over a single connection; every Colyseus Room adapter ignores it today,
// but it's kept here rather than dropped mid-fleet-migration (see §12).
export interface ActivityBroadcaster {
  broadcast(key: string, message: { type: string; payload?: unknown }): void;
}

// Real-time games broadcasting a binary snapshot (§7.2) take this instead.
// Only Pong currently implements it for real.
export interface BinaryActivityBroadcaster extends ActivityBroadcaster {
  broadcastBinary(key: string, data: ArrayBuffer): void;
}
