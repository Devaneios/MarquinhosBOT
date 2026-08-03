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
  private closedByCaller = false;

  constructor(url: string) {
    this.url = url;
  }

  connect() {
    console.info('[ws] connecting', this.url);
    this.closedByCaller = false;
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
      setTimeout(() => this.connect(), delay);
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

  close() {
    this.closedByCaller = true;
    this.ws?.close();
  }
}
