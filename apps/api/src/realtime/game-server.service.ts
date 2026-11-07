import { WebSocketTransport } from '@colyseus/ws-transport';
import { Injectable, type BeforeApplicationShutdown } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Server as ColyseusServer } from 'colyseus';
import { MatchRoom } from 'realtime/MatchRoom';

@Injectable()
export class GameServer implements BeforeApplicationShutdown {
  private server?: ColyseusServer;

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  async listen(port: number): Promise<void> {
    this.server = new ColyseusServer({
      gracefullyShutdown: false,
      transport: new WebSocketTransport({
        server: this.adapterHost.httpAdapter.getHttpServer(),
      }),
    });
    this.server.define('match', MatchRoom).filterBy(['roomKey']);
    await this.server.listen(port);
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.server?.gracefullyShutdown(false);
  }
}
