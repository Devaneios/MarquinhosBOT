import { closeDefaultDb, db } from '@marquinhos/database/client';
import type { OnApplicationShutdown } from '@nestjs/common';
import { Global, Injectable, Module } from '@nestjs/common';
import { DB } from 'database/database.tokens';

@Injectable()
class DatabaseLifecycleService implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await closeDefaultDb();
  }
}

@Global()
@Module({
  providers: [{ provide: DB, useValue: db }, DatabaseLifecycleService],
  exports: [DB],
})
export class DatabaseModule {}
