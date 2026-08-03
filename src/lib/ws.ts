export interface ActivityMessage {
  type: string;
  payload?: unknown;
}

type Listener = (message: ActivityMessage) => void;
type BinaryListener = (data: ArrayBuffer) => void;

const MAX_RECONNECT_DELAY_MS = 10_000;

export class ActivitySocket {
  private url: string;
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private binaryListeners = new Set<BinaryListener>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByCaller = false;

  constructor(url: string) {
    this.url = url;
  }

  connect() {
    // close() is terminal. Without this guard a reconnect timer that fires
    // after the caller closed us would reopen the socket — and, because it
    // reuses the still-valid session token, silently re-join the room with a
    // socket nothing holds a reference to and nobody can ever close again.
    if (this.closedByCaller) return;
    console.info('[ws] connecting', this.url);
    this.ws = new WebSocket(this.url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      console.info('[ws] connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.binaryListeners.forEach((listener) => listener(event.data));
        return;
      }
      let message: ActivityMessage;
      try {
        message = JSON.parse(event.data);
      } catch {
        console.warn('[ws] failed to parse message', event.data);
        return;
      }
      console.log('[ws] message', message.type, message.payload);
      this.listeners.forEach((listener) => listener(message));
    };

    this.ws.onclose = () => {
      if (this.closedByCaller) {
        console.info('[ws] closed by caller');
        return;
      }
      const delay = Math.min(
        1000 * 2 ** this.reconnectAttempts,
        MAX_RECONNECT_DELAY_MS,
      );
      console.warn(`[ws] closed unexpectedly, reconnecting in ${delay}ms`);
      this.reconnectAttempts += 1;
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };
  }

  send(message: ActivityMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return;
    }
    console.warn('[ws] dropped message, socket not open', message.type);
  }

  onMessage(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onBinaryMessage(listener: BinaryListener): () => void {
    this.binaryListeners.add(listener);
    return () => this.binaryListeners.delete(listener);
  }

  // `farewell` is sent right before closing. It exists because a plain send()
  // is dropped whenever the socket isn't OPEN yet, and a dropped goodbye is
  // indistinguishable from a network drop on the server — which then holds the
  // player's slot open instead of detaching them. Queuing it onto `onopen`
  // makes the goodbye actually arrive.
  close(farewell?: ActivityMessage) {
    this.closedByCaller = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const ws = this.ws;
    if (!ws) return;

    if (farewell && ws.readyState === WebSocket.CONNECTING) {
      console.info('[ws] deferring farewell until open', farewell.type);
      ws.onopen = () => {
        ws.send(JSON.stringify(farewell));
        ws.close();
      };
      return;
    }
    if (farewell) this.send(farewell);
    ws.close();
  }
}
