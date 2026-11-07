// Thin wrapper around a Map<sessionKey, TSession>, extracted from
// PongActivityManager's hand-rolled `sessions`/`getOrCreateSession` pair so
// every game's manager builds session lookup on the same tested primitive
// instead of copy-pasting it.
export class SessionRegistry<TSession> {
  private sessions = new Map<string, TSession>();

  get(key: string): TSession | undefined {
    return this.sessions.get(key);
  }

  getOrCreate(key: string, factory: () => TSession): TSession {
    let session = this.sessions.get(key);
    if (!session) {
      session = factory();
      this.sessions.set(key, session);
    }
    return session;
  }

  delete(key: string): void {
    this.sessions.delete(key);
  }
}
