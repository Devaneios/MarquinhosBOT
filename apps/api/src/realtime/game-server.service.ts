import { WebSocketTransport } from '@colyseus/ws-transport';
import {
  Inject,
  Injectable,
  type BeforeApplicationShutdown,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Server as ColyseusServer } from 'colyseus';
import { createMatchRoom } from 'realtime/MatchRoom';
import {
  ROOM_DEPENDENCIES,
  type RoomDependencies,
} from 'realtime/room-dependencies';

@Injectable()
export class GameServer implements BeforeApplicationShutdown {
  private server?: ColyseusServer;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    @Inject(ROOM_DEPENDENCIES)
    private readonly dependencies: RoomDependencies,
  ) {}

  async listen(port: number): Promise<void> {
    this.server = new ColyseusServer({
      gracefullyShutdown: false,
      transport: new WebSocketTransport({
        server: this.adapterHost.httpAdapter.getHttpServer(),
      }),
    });
    this.server
      .define('match', createMatchRoom(this.dependencies))
      .filterBy(['roomKey']);
    await this.server.listen(port);
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.server?.gracefullyShutdown(false);
  }
}
