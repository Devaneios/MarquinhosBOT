import { Module } from '@nestjs/common';
import { BotAuthGuard } from 'common/guards/bot-auth.guard';
import { DiscordModule } from 'integrations/discord/discord.module';
import { LastfmModule } from 'integrations/lastfm/lastfm.module';
import { SpotifyModule } from 'integrations/spotify/spotify.module';
import { ParserService } from 'modules/scrobble/parser.service';
import ScrobbleController from 'modules/scrobble/scrobble.controller';
import { ScrobblerService } from 'modules/scrobble/scrobbler.service';

@Module({
  imports: [DiscordModule, LastfmModule, SpotifyModule],
  controllers: [ScrobbleController],
  providers: [ParserService, ScrobblerService, BotAuthGuard],
})
export class ScrobbleModule {}
