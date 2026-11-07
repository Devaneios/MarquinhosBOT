import { Module } from '@nestjs/common';
import { TokenCipherService } from 'common/crypto';
import { ConfigModule } from 'config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [TokenCipherService],
  exports: [TokenCipherService],
})
export class CryptoModule {}
