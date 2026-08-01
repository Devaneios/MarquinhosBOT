export interface ActivityMessage {
  type: string;
  payload?: unknown;
}

type Listener = (message: ActivityMessage) => void;

const MAX_RECONNECT_DELAY_MS = 10_000;

export class ActivitySocket {
  private url: string;
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectAttempts = 0;
  private closedByCaller = false;

  constructor(url: string) {
    this.url = url;
  }

  connect() {
    this.closedByCaller = false;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      let message: ActivityMessage;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      this.listeners.forEach((listener) => listener(message));
    };

    this.ws.onclose = () => {
      if (this.closedByCaller) return;
      const delay = Math.min(
        1000 * 2 ** this.reconnectAttempts,
        MAX_RECONNECT_DELAY_MS,
      );
      this.reconnectAttempts += 1;
      setTimeout(() => this.connect(), delay);
    };
  }

  send(message: ActivityMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  onMessage(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close() {
    this.closedByCaller = true;
    this.ws?.close();
  }
}
