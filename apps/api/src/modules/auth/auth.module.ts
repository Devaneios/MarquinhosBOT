import { Module } from '@nestjs/common';
import { CryptoModule } from 'common/crypto.module';
import { DiscordModule } from 'integrations/discord/discord.module';
import { LastfmModule } from 'integrations/lastfm/lastfm.module';
import AuthController from 'modules/auth/auth.controller';
import { UserModule } from 'modules/user/user.module';

@Module({
  imports: [CryptoModule, DiscordModule, LastfmModule, UserModule],
  controllers: [AuthController],
})
export class AuthModule {}
