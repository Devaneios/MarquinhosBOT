import type { WireMessage } from '@marquinhos/contracts/activity/protocol';
import type { Client } from 'colyseus';

export function sendMessage<M extends WireMessage>(
  client: Pick<Client, 'send'>,
  message: M,
): void {
  client.send(message.type, message.payload);
}

export function broadcastMessage<M extends WireMessage>(
  ctx: { broadcast: (type: string, payload?: unknown) => void },
  message: M,
): void {
  ctx.broadcast(message.type, message.payload);
}
