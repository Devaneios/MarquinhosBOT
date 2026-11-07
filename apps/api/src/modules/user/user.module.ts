import { Module } from '@nestjs/common';
import { CryptoModule } from 'common/crypto.module';
import { BotAuthGuard } from 'common/guards/bot-auth.guard';
import { ConfigModule } from 'config/config.module';
import { DatabaseModule } from 'database/database.module';
import { DiscordModule } from 'integrations/discord/discord.module';
import { LastfmModule } from 'integrations/lastfm/lastfm.module';
import { SpotifyModule } from 'integrations/spotify/spotify.module';
import { DiscordUserAuthGuard } from 'modules/user/user-auth.guard';
import UserController from 'modules/user/user.controller';
import { UserService } from 'modules/user/user.service';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    DiscordModule,
    LastfmModule,
    SpotifyModule,
    CryptoModule,
  ],
  controllers: [UserController],
  providers: [UserService, DiscordUserAuthGuard, BotAuthGuard],
  exports: [UserService],
})
export class UserModule {}
