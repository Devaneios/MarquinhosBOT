import { Module } from '@nestjs/common';
import { CryptoModule } from 'common/crypto.module';
import { ConfigModule } from 'config/config.module';
import { DatabaseModule } from 'database/database.module';
import { LastfmService } from 'integrations/lastfm/lastfm.service';

@Module({
  imports: [ConfigModule, DatabaseModule, CryptoModule],
  providers: [LastfmService],
  exports: [LastfmService],
})
export class LastfmModule {}
