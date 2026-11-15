import { RedisDriver } from '@colyseus/redis-driver';
import { RedisPresence } from '@colyseus/redis-presence';
import { WebSocketTransport } from '@colyseus/ws-transport';
import {
  Inject,
  Injectable,
  Optional,
  type BeforeApplicationShutdown,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Server as ColyseusServer } from 'colyseus';
import { createMatchRoom } from 'realtime/MatchRoom';
import {
  ROOM_DEPENDENCIES,
  type RoomDependencies,
} from 'realtime/room-dependencies';
import { RedisService } from 'redis/redis.service';

@Injectable()
export class GameServer implements BeforeApplicationShutdown {
  private server?: ColyseusServer;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    @Inject(ROOM_DEPENDENCIES)
    private readonly dependencies: RoomDependencies,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async listen(port: number): Promise<void> {
    const redisUrl = this.redis?.redisUrl;
    const driverClient = this.redis?.createScopedClient('colyseus-driver');
    this.server = new ColyseusServer({
      gracefullyShutdown: false,
      transport: new WebSocketTransport({
        server: this.adapterHost.httpAdapter.getHttpServer(),
      }),
      ...(redisUrl && driverClient
        ? {
            presence: new RedisPresence(redisUrl),
            driver: new RedisDriver(driverClient),
          }
        : {}),
    });
    this.server
      .define('match', createMatchRoom(this.dependencies))
      .filterBy(['roomKey']);
    await this.server.listen(port);
  }

  async beforeApplicationShutdown(): Promise<void> {
    if (!this.server) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.server.gracefullyShutdown(false),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, 5_000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}
