import { Module } from '@nestjs/common';
import { GameServer } from 'realtime/game-server.service';

@Module({
  providers: [GameServer],
  exports: [GameServer],
})
export class RealtimeModule {}
