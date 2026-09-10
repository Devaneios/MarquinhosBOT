import { WebSocketTransport } from '@colyseus/ws-transport';
import { Room, Server } from 'colyseus';
import express from 'express';
import { createServer } from 'node:http';

class GatewayProbeRoom extends Room {
  override onCreate() {
    this.onMessage('ping', (client) => client.send('pong', 'gateway-ok'));
  }
}

export async function startGatewayTestServer() {
  const app = express();
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use((_req, res) => res.status(404).json({ message: 'Route not found' }));
  const http = createServer(app);
  const server = new Server({
    greet: false,
    transport: new WebSocketTransport({ server: http }),
  });
  server.define('gateway-probe', GatewayProbeRoom);
  await server.listen(0);
  const address = http.address();
  if (!address || typeof address === 'string')
    throw new Error('No test API port');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => server.gracefullyShutdown(false),
  };
}
