import { afterEach, describe, expect, it } from 'bun:test';
import { ActivitySocket } from './ws';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = FakeWebSocket.CONNECTING;
  binaryType = '';
  sent: string[] = [];
  closeCalls = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;

  url: string;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closeCalls += 1;
    this.readyState = FakeWebSocket.CLOSED;
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  dropConnection() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('ActivitySocket', () => {
  const originalWebSocket = globalThis.WebSocket;

  function install() {
    FakeWebSocket.instances = [];
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  }

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  it('reconnects after an unexpected close', async () => {
    install();
    const socket = new ActivitySocket('ws://test/activity');
    socket.connect();

    FakeWebSocket.instances[0]!.dropConnection();
    await wait(1100);

    expect(FakeWebSocket.instances.length).toBe(2);
  });

  // A reconnect that fires after the caller closed us would re-join the room
  // with a socket nothing references and nobody can close — leaving the user
  // attached to a session they walked out of.
  it('cancels a pending reconnect on close and never reopens', async () => {
    install();
    const socket = new ActivitySocket('ws://test/activity');
    socket.connect();

    FakeWebSocket.instances[0]!.dropConnection();
    socket.close();
    await wait(1100);

    expect(FakeWebSocket.instances.length).toBe(1);
  });

  it('stays closed even if connect() is called again afterwards', async () => {
    install();
    const socket = new ActivitySocket('ws://test/activity');
    socket.connect();
    socket.close();

    socket.connect();

    expect(FakeWebSocket.instances.length).toBe(1);
  });

  it('sends the farewell before closing an open socket', () => {
    install();
    const socket = new ActivitySocket('ws://test/activity');
    socket.connect();
    const ws = FakeWebSocket.instances[0]!;
    ws.open();

    socket.close({ type: 'leave' });

    expect(ws.sent).toEqual([JSON.stringify({ type: 'leave' })]);
    expect(ws.closeCalls).toBe(1);
  });

  // The three ways out of a match all unmount immediately, so the socket is
  // routinely still CONNECTING when the goodbye is due. Dropping it there is
  // what made the server treat a deliberate exit as a network blip.
  it('defers the farewell until open when the socket is still connecting', () => {
    install();
    const socket = new ActivitySocket('ws://test/activity');
    socket.connect();
    const ws = FakeWebSocket.instances[0]!;

    socket.close({ type: 'leave' });
    expect(ws.sent).toEqual([]);

    ws.open();

    expect(ws.sent).toEqual([JSON.stringify({ type: 'leave' })]);
    expect(ws.closeCalls).toBe(1);
  });

  it('does not reconnect after a deferred farewell completes', async () => {
    install();
    const socket = new ActivitySocket('ws://test/activity');
    socket.connect();
    const ws = FakeWebSocket.instances[0]!;

    socket.close({ type: 'leave' });
    ws.open();
    ws.onclose?.();
    await wait(1100);

    expect(FakeWebSocket.instances.length).toBe(1);
  });

  it('closes without sending anything when no farewell is given', () => {
    install();
    const socket = new ActivitySocket('ws://test/activity');
    socket.connect();
    const ws = FakeWebSocket.instances[0]!;
    ws.open();

    socket.close();

    expect(ws.sent).toEqual([]);
    expect(ws.closeCalls).toBe(1);
  });
});
